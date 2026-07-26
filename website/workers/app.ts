import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { createRequestHandler } from "react-router";
import { drizzleLogger } from "../database/logger";
import * as schema from "../database/schema.d";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    db: DrizzleD1Database<typeof schema>;
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const db = drizzle(env.DB, {
      schema,
      logger: drizzleLogger,
    });
    return requestHandler(request, {
      cloudflare: { env, ctx },
      db,
    });
  },
  async scheduled(event, env, ctx) {
    const db = drizzle(env.DB, {
      schema,
      logger: drizzleLogger,
    });
    const date = new Date(event.scheduledTime); // This is the time the workflow was scheduled, probably about 2am - so we want to get the data from the previous day or earlier
    const todayAtMidnight = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    );
    // Get all dates which have observations where uploaded to R2 is false
    const allDates = await db
      .selectDistinct({
        day: sql`date(DATETIME(${schema.Observations.timestamp}, 'unixepoch'))`,
      })
      .from(schema.Observations)
      .where(
        and(
          lt(schema.Observations.timestamp, todayAtMidnight),
          eq(schema.Observations.exportedToR2, false),
        ),
      )
      .orderBy(asc(sql`date(timestamp)`))
      .limit(99) // Limit to 99 days which is the limit of the number of workflow instances you can create in a batch
      .catch((error) => {
        throw new Error("Failed to get dates", { cause: error });
      });
    const days = allDates.map((date) => new Date(date.day as string));
    // Create a new batch of workflow instances, each with its own ID and pass params to the Workflow instances
    if (days.length > 0) {
      await env.WORKFLOW_OVERNIGHT_SAVE_TO_R2.createBatch(
        days.map((day) => ({
          id: `overnight-save-${day.toISOString().split("T")[0]}`,
          params: { dayToProcess: day },
        })),
      );
    }
    console.log(`Created ${days.length} workflow instances`);
    const tenDaysAgo = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - 10,
      0,
      0,
      0,
      0,
    );
    await db
      .delete(schema.DisregardedObservations)
      .where(lt(schema.DisregardedObservations.timestamp, tenDaysAgo));
    console.log(`Deleted disregarded observations older than 10 days`);
    await db
      .delete(schema.Heartbeats)
      .where(lt(schema.Heartbeats.hourStartTimestamp, tenDaysAgo));
    console.log(`Deleted heartbeats older than 10 days`);
  },
} satisfies ExportedHandler<Env>;

interface OvernightSaveToR2Params {
  dayToProcess: Date;
}
export class OvernightSaveToR2 extends WorkflowEntrypoint<
  Env,
  OvernightSaveToR2Params
> {
  async run(event: WorkflowEvent<OvernightSaveToR2Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`
    await step.do(
      "Download data, and upload to R2",
      {
        retries: {
          limit: 10,
          delay: 5000,
          backoff: "exponential",
        },
        timeout: "60 minutes",
      },
      async () => {
        const db = drizzle(this.env.DB, {
          schema,
          logger: drizzleLogger,
        });

        const dayToProcess = new Date(event.payload.dayToProcess);
        const startOfPeriod = new Date(
          dayToProcess.getFullYear(),
          dayToProcess.getMonth(),
          dayToProcess.getDate(),
          0,
          0,
          0,
          0,
        );
        const endOfPeriod = new Date(
          dayToProcess.getFullYear(),
          dayToProcess.getMonth(),
          dayToProcess.getDate() + 1,
          0,
          0,
          0,
          0,
        );

        const allObservations = await db
          .select()
          .from(schema.Observations)
          .where(
            and(
              gte(schema.Observations.timestamp, startOfPeriod),
              lt(schema.Observations.timestamp, endOfPeriod),
            ),
          )
          .orderBy(asc(schema.Observations.timestamp))
          .catch((error) => {
            throw new Error("Failed to get observations", { cause: error });
          });
        if (allObservations.length === 0)
          throw new NonRetryableError("No observations found");
        console.log(`Found ${allObservations.length} observations`);
        const header = [
          "Timestamp",
          Object.keys(allObservations[0].data).map((key) => `"${key}"`),
        ].join(",");
        const csv = [
          header,
          ...allObservations.map((observation) =>
            [
              observation.timestamp.toTimeString(),
              Object.values(observation.data)
                .map((value) => `"${value}"`)
                .join(","),
            ].join(","),
          ),
        ].join("\n");
        console.log(`Uploading ${csv.length} bytes to R2`);
        const upload = await this.env.R2_BUCKET.put(
          `daily-observations/${startOfPeriod.getFullYear()}-${String(
            startOfPeriod.getMonth() + 1,
          ).padStart(2, "0")}-${String(startOfPeriod.getDate()).padStart(
            2,
            "0",
          )}.csv`,
          csv,
        ).catch((error) => {
          throw new Error("Failed to upload to R2", { cause: error });
        });
        if (!upload || !upload.uploaded)
          throw new Error("Failed to upload to R2");
        console.log(
          `Uploaded to R2 ${upload.size} bytes, proceeding to update observations`,
        );
        const updateObservations = await db
          .update(schema.Observations)
          .set({ exportedToR2: true })
          .where(
            and(
              gte(schema.Observations.timestamp, startOfPeriod),
              lt(schema.Observations.timestamp, endOfPeriod),
            ),
          );
        if (updateObservations.error)
          throw new Error("Failed to update observations", {
            cause: updateObservations.error,
          });
        console.log(
          `Successfully uploaded to R2 and updated observations. Script complete`,
        );
      },
    );
  }
}
