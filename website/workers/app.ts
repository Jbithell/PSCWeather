import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { createRequestHandler } from "react-router";
import type { ZodError } from "zod";
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
      0
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
          eq(schema.Observations.exportedToR2, false)
        )
      )
      .orderBy(asc(sql`date(timestamp)`))
      .limit(99) // Limit to 99 days which is the limit of the workflow instances
      .catch((error) => {
        throw new Error("Failed to get dates", { cause: error });
      });
    const days = allDates.map((date) => new Date(date.day as string));
    // Create a new batch of 3 Workflow instances, each with its own ID and pass params to the Workflow instances
    await env.WORKFLOW_OVERNIGHT_SAVE_TO_R2.createBatch(
      days.map((day) => ({
        params: { dayToProcess: day },
      }))
    );
    console.log(`Created ${days.length} workflow instances`);
  },
} satisfies ExportedHandler<Env>;

export class UploadReceivedObservation extends WorkflowEntrypoint<
  Env,
  schema.ObservationInsert
> {
  async run(
    event: WorkflowEvent<schema.ObservationInsert>,
    step: WorkflowStep
  ) {
    await step.do(
      "Upload incoming data into database",
      {
        retries: {
          limit: 30,
          delay: 5000,
          backoff: "exponential",
        },
        timeout: "2 seconds",
      },
      async () => {
        const db = drizzle(this.env.DB, {
          schema,
          logger: drizzleLogger,
        });
        const payloadData = await schema.observationInsertSchema.safeParseAsync(
          event.payload
        );
        if (!payloadData.success)
          throw new NonRetryableError("Issue with incoming data");

        const insert = await db
          .insert(schema.Observations)
          .values(payloadData.data)
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

export class UploadToWindGuru extends WorkflowEntrypoint<
  Env,
  schema.ObservationInsert
> {
  async run(
    event: WorkflowEvent<schema.ObservationInsert>,
    step: WorkflowStep
  ) {
    await step.do(
      "Upload to WindGuru",
      {
        retries: {
          limit: 10,
          delay: 60000,
          backoff: "exponential",
        },
        timeout: "5 seconds",
      },
      async () => {
        const WINDGURU_UID = await this.env.KV.get("WINDGURU_UID");
        const WINDGURU_PASSWORD = await this.env.KV.get("WINDGURU_PASSWORD");
        if (!WINDGURU_UID || !WINDGURU_PASSWORD)
          throw new NonRetryableError("Missing Windguru credentials");
        const payloadData = await schema.observationInsertSchema.safeParseAsync(
          event.payload
        );
        if (!payloadData.success)
          throw new NonRetryableError("Issue with incoming data");
        const data = payloadData.data;

        const salt = Date.now();
        const hash = await crypto.subtle.digest(
          {
            name: "MD5",
          },
          new TextEncoder().encode(`${salt}${WINDGURU_UID}${WINDGURU_PASSWORD}`)
        );
        const params = new URLSearchParams({
          uid: WINDGURU_UID,
          interval: "120",
          wind_avg: (data.data.wind2MinAverage / 1.151).toString(),
          wind_direction: data.data.windDirection.toString(),
          temperature: data.data.temperatureC.toString(),
          datetime: data.timestamp.toISOString(),
          salt: salt.toString(),
          hash: Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
        });
        const response = await fetch(
          `https://www.windguru.cz/upload/api.php?${params.toString()}`,
          {
            method: "GET",
          }
        ).then((response) => {
          if (!response.ok)
            throw new Error("Windguru failed, status: " + response.status);
          return response.text();
        });
        if (response !== "OK") {
          throw new Error(`Windguru upload failed: ${response}`);
        }
      }
    );
  }
}

export class UploadToMetOffice extends WorkflowEntrypoint<
  Env,
  schema.ObservationInsert
> {
  async run(
    event: WorkflowEvent<schema.ObservationInsert>,
    step: WorkflowStep
  ) {
    await step.do(
      "Upload to Met Office",
      {
        retries: {
          limit: 10,
          delay: 60000,
          backoff: "exponential",
        },
        timeout: "5 seconds",
      },
      async () => {
        const METOFFICE_SITE_ID = await this.env.KV.get("METOFFICE_SITE_ID");
        const METOFFICE_AUTH_KEY = await this.env.KV.get("METOFFICE_AUTH_KEY");
        if (!METOFFICE_SITE_ID || !METOFFICE_AUTH_KEY)
          throw new NonRetryableError("Missing Met Office credentials");
        const payloadData = await schema.observationInsertSchema.safeParseAsync(
          event.payload
        );
        if (!payloadData.success)
          throw new NonRetryableError("Issue with incoming data");
        const data = payloadData.data;

        const params = new URLSearchParams({
          siteid: METOFFICE_SITE_ID,
          siteAuthenticationKey: METOFFICE_AUTH_KEY,
          softwaretype: "PSC Weather Station",
          dateutc: data.timestamp
            .toISOString()
            .replace("T", "+")
            .replace(/:/g, "%3A")
            .split(".")[0],
          dailyrainin: (data.data.lastHourRain * 0.0393701).toString(), // real number [in]; rain inches over the past hour (alternative to precip)
          dewptf: data.data.dewPoint.toString(),
          tempf: data.data.temperatureF.toString(), // real number [°F]; air temperature
          windspeedmph: data.data.windSpeed.toString(), // real number [mph]; wind speed (alternative to wind)
          winddir: data.data.windDirection.toString(), // integer number [deg]; instantaneous wind direction
          //windgustmph: data.data.windGust.toString(), // real number [mph]; current wind gust (alternative to gust)
          //windgustdir: data.data.windGustDirection.toString(), // integer number [deg]; instantaneous wind direction
        });
        const response = await fetch(
          `http://wow.metoffice.gov.uk/automaticreading?${params.toString()}`,
          {
            method: "GET",
          }
        ).then((response) => {
          if (response.status === 429)
            throw new NonRetryableError(
              "Met office asked for a backoff, skip this observation"
            );
          if (!response.ok)
            throw new Error(
              "Met Office upload failed, status: " + response.status
            );
          return response.json();
        });
        if (
          !response ||
          typeof response !== "object" ||
          Object.keys(response).length !== 0
        )
          throw new Error(
            `Met Office upload failed: ${JSON.stringify(response)}`
          );
      }
    );
  }
}

export class UploadToWindy extends WorkflowEntrypoint<
  Env,
  schema.ObservationInsert
> {
  async run(
    event: WorkflowEvent<schema.ObservationInsert>,
    step: WorkflowStep
  ) {
    await step.do(
      "Upload to Windy",
      {
        retries: {
          limit: 2,
          delay: 60000,
          backoff: "exponential",
        },
        timeout: "5 seconds",
      },
      async () => {
        const WINDY_API_KEY = await this.env.KV.get("WINDY_API_KEY");
        const WINDY_STATION_ID = await this.env.KV.get("WINDY_STATION_ID");
        if (!WINDY_API_KEY || !WINDY_STATION_ID)
          throw new NonRetryableError("Missing Windy credentials");
        const payloadData = await schema.observationInsertSchema.safeParseAsync(
          event.payload
        );
        if (!payloadData.success)
          throw new NonRetryableError("Issue with incoming data");
        const data = payloadData.data;

        const params = new URLSearchParams({
          station: WINDY_STATION_ID, // 32 bit integer; required for multiple stations; default value 0; alternative names: si, stationId
          ts: data.timestamp.getTime().toString(),
          temp: data.data.temperatureC.toString(), // real number [°C]; air temperature
          windspeedmph: data.data.windSpeed.toString(), // real number [mph]; wind speed (alternative to wind)
          winddir: data.data.windDirection.toString(), // integer number [deg]; instantaneous wind direction
          //windgustmph: data.data.windGust.toString(), // real number [mph]; current wind gust (alternative to gust)
          dewpoint: data.data.dewPoint.toString(), // real number [°C];
          precip: data.data.lastHourRain.toString(), // real number [mm]; precipitation over the past hour
        });
        const response = await fetch(
          `https://stations.windy.com/pws/update/${WINDY_API_KEY}?${params.toString()}`,
          {
            method: "GET",
          }
        );
        const responseText = await response.text();
        if (
          responseText.length > 0 &&
          responseText.includes(
            "Measurement sent too soon, update interval is 5 minutes"
          )
        ) {
          throw new NonRetryableError(
            "Windy asked for a backoff, skip this observation"
          );
        } else if (!response.ok)
          throw new Error("Windy upload failed, status: " + response.status);
        const responseJson = JSON.parse(responseText);
        if (!responseJson || typeof responseJson !== "object")
          throw new Error(`Windy upload failed: ${JSON.stringify(response)}`);
        return responseText;
      }
    );
  }
}

export class DisregardReceivedObservation extends WorkflowEntrypoint<
  Env,
  {
    data: schema.ObservationDataFromWeatherStation;
    errors: ZodError<schema.ObservationDataFromWeatherStation>;
  }
> {
  async run(
    event: WorkflowEvent<{
      data: schema.ObservationDataFromWeatherStation;
      errors: ZodError<schema.ObservationDataFromWeatherStation>;
    }>,
    step: WorkflowStep
  ) {
    await step.do(
      "Upload incoming data into database to be disregarded",
      async () => {
        const db = drizzle(this.env.DB, {
          schema,
          logger: drizzleLogger,
        });
        const { timestamp, disregardReason, ...data } = event.payload.data;
        const insert = await db
          .insert(schema.DisregardedObservations)
          .values({
            data,
            timestamp: new Date(timestamp),
            disregardReasonFriendly: disregardReason ?? "Unknown",
            disregardReasonDetailed: JSON.stringify(event.payload.errors),
          })
          .returning({ insertedId: schema.DisregardedObservations.id });
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
    const firstStep = await step.do(
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
          dayToProcess.getDate() - 1,
          0,
          0,
          0,
          0
        );
        const endOfPeriod = new Date(
          dayToProcess.getFullYear(),
          dayToProcess.getMonth(),
          dayToProcess.getDate(),
          0,
          0,
          0,
          0
        );

        const allObservations = await db
          .select()
          .from(schema.Observations)
          .where(
            and(
              gte(schema.Observations.timestamp, startOfPeriod),
              lt(schema.Observations.timestamp, endOfPeriod)
            )
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
            ].join(",")
          ),
        ].join("\n");
        console.log(`Uploading ${csv.length} bytes to R2`);
        const upload = await this.env.R2_BUCKET.put(
          `daily-observations/${startOfPeriod.getFullYear()}-${String(
            startOfPeriod.getMonth() + 1
          ).padStart(2, "0")}-${String(startOfPeriod.getDate()).padStart(
            2,
            "0"
          )}.csv`,
          csv
        ).catch((error) => {
          throw new Error("Failed to upload to R2", { cause: error });
        });
        if (!upload || !upload.uploaded)
          throw new Error("Failed to upload to R2");
        console.log(
          `Uploaded to R2 ${upload.size} bytes, proceeding to update observations`
        );
        const [updateObservations, deleteDisregardedObservations] =
          await db.batch([
            db
              .update(schema.Observations)
              .set({ exportedToR2: true })
              .where(
                and(
                  gte(schema.Observations.timestamp, startOfPeriod),
                  lt(schema.Observations.timestamp, endOfPeriod)
                )
              ), // Record observations which were uploaded to R2 as being exported
            db
              .delete(schema.DisregardedObservations)
              .where(
                lt(
                  schema.DisregardedObservations.timestamp,
                  new Date(
                    startOfPeriod.getFullYear(),
                    startOfPeriod.getMonth(),
                    startOfPeriod.getDate() - 30,
                    0,
                    0,
                    0,
                    0
                  )
                )
              ), // Delete all disregarded observations older than 30 days, as we don't need to keep that data indefinitely
          ]);
        if (updateObservations.error)
          throw new Error("Failed to update observations", {
            cause: updateObservations.error,
          });
        if (deleteDisregardedObservations.error)
          throw new Error("Failed to delete disregarded observations", {
            cause: deleteDisregardedObservations.error,
          });
        console.log(
          `Successfully uploaded to R2 and updated observations. Script complete`
        );
      }
    );
  }
}
