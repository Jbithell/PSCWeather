import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { createRequestHandler } from "react-router";
import { scheduledWorker } from "../app/scheduledWorker";
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
  import.meta.env.MODE
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
    // This is a scheduled event, triggered by a cron schedule. These can be tested locally using the /__scheduled?cron=*+*+*+*+* path
    const triggerName = event.cron;
    const db = drizzle(env.DB, {
      schema,
      logger: drizzleLogger,
    });
    ctx.waitUntil(scheduledWorker(event, env, ctx, db, triggerName));
  },
} satisfies ExportedHandler<Env>;

export class HandleReceivedObservation extends WorkflowEntrypoint<Env, Params> {
  async run(
    event: WorkflowEvent<schema.ObservationInsert>,
    step: WorkflowStep
  ) {
    const upload = await step.do(
      "Upload incoming data into database",
      async () => {
        const db = drizzle(this.env.DB, {
          schema,
          logger: drizzleLogger,
        });
        const insert = await db
          .insert(schema.Observations)
          .values(event.payload)
          .returning({ insertedId: schema.Observations.id });
        if (!insert[0].insertedId) {
          throw new Error("Failed to insert");
        }
        return {
          databaseRowId: insert[0].insertedId,
        };
      }
    );
  }
}

export class DisregardReceivedObservation extends WorkflowEntrypoint<
  Env,
  {
    data: schema.ObservationDataFromWeatherStation;
    errors: {
      formErrors: string[];
      fieldErrors: Record<string, string[]>;
    };
  }
> {
  async run(
    event: WorkflowEvent<{
      data: schema.ObservationDataFromWeatherStation;
      errors: {
        formErrors: string[];
        fieldErrors: Record<string, string[]>;
      };
    }>,
    step: WorkflowStep
  ) {
    await step.do("Upload incoming data into database", async () => {
      const db = drizzle(this.env.DB, {
        schema,
        logger: drizzleLogger,
      });
      const { timestamp, disregardReason, ...data } = event.payload.data;
      const insert = await db
        .insert(schema.DisregardedObservations)
        .values({
          data,
          timestamp,
          disregardReasonFriendly: disregardReason,
          disregardReasonDetailed: JSON.stringify(event.payload.errors),
        })
        .returning({ insertedId: schema.Observations.id });
      if (!insert[0].insertedId) {
        throw new Error("Failed to insert");
      }
      return {
        databaseRowId: insert[0].insertedId,
      };
    });
  }
}
export class OvernightSaveToR2 extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`
  }
}
