import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { and, asc, gte, lt } from "drizzle-orm";
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
    const workflowInstance = await env.WORKFLOW_OVERNIGHT_SAVE_TO_R2.create({
      params: {
        scheduledTime: event.scheduledTime,
      },
    });
    await workflowInstance.status();
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
  scheduledTime: number;
}
export class OvernightSaveToR2 extends WorkflowEntrypoint<
  Env,
  OvernightSaveToR2Params
> {
  async run(event: WorkflowEvent<OvernightSaveToR2Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`
    const calculatedDate = await step.do("Calculate date", async () => {
      const date = new Date(event.payload.scheduledTime); // This is the time the workflow was scheduled, probably about 2am - so we want to get the data from the previous day
      const previousDayAtMidnight = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() - 1,
        0,
        0,
        0,
        0
      );
      const nextDayAtMidnight = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0
      );
      return {
        previousDayAtMidnight,
        nextDayAtMidnight,
      };
    });
    await step.do(
      "Download data, and upload to R2",
      {
        retries: {
          limit: 30,
          delay: 120000,
          backoff: "exponential",
        },
        timeout: "60 minutes",
      },
      async () => {
        const db = drizzle(this.env.DB, {
          schema,
          logger: drizzleLogger,
        });

        const allObservations = await db
          .select()
          .from(schema.Observations)
          .where(
            and(
              gte(
                schema.Observations.timestamp,
                calculatedDate.previousDayAtMidnight
              ),
              lt(
                schema.Observations.timestamp,
                calculatedDate.nextDayAtMidnight
              )
            )
          )
          .orderBy(asc(schema.Observations.timestamp));
        if (allObservations.length === 0) return;
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
        await this.env.R2_BUCKET.put(
          `daily-observations/${calculatedDate.previousDayAtMidnight.getFullYear()}-${calculatedDate.previousDayAtMidnight.getMonth()}-${calculatedDate.previousDayAtMidnight.getDate()}.csv`,
          csv
        );
      }
    );
    await step.do("Delete data from live database", async () => {
      const db = drizzle(this.env.DB, {
        schema,
        logger: drizzleLogger,
      });
      await db.batch([
        db
          .delete(schema.Observations)
          .where(
            and(
              gte(
                schema.Observations.timestamp,
                calculatedDate.previousDayAtMidnight
              ),
              lt(
                schema.Observations.timestamp,
                calculatedDate.nextDayAtMidnight
              )
            )
          ), // Delete all observations which were uploaded to R2
        db
          .delete(schema.DisregardedObservations)
          .where(
            and(
              lt(
                schema.DisregardedObservations.timestamp,
                new Date(
                  calculatedDate.previousDayAtMidnight.getFullYear(),
                  calculatedDate.previousDayAtMidnight.getMonth(),
                  calculatedDate.previousDayAtMidnight.getDate() - 30,
                  0,
                  0,
                  0,
                  0
                )
              )
            )
          ), // Delete all disregarded observations older than 30 days
      ]);
    });
  }
}
