import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
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

        const salt = Date.now();
        const hash = await crypto.subtle.digest(
          {
            name: "MD5",
          },
          new TextEncoder().encode(`${salt}${WINDGURU_UID}${WINDGURU_PASSWORD}`)
        );
        const data = event.payload.data as schema.ObservationData;
        const params = new URLSearchParams({
          uid: WINDGURU_UID,
          interval: "120",
          wind_avg: (data.wind2MinAverage / 1.151).toString(),
          wind_direction: data.windDirection.toString(),
          temperature: data.temperatureC.toString(),
          rh: data.humidity.toString(),
          datetime: new Date(
            event.payload.timestamp as string | number
          ).toISOString(),
          salt: salt.toString(),
          hash: Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
        });
        await fetch(
          `https://www.windguru.cz/upload/api.php?${params.toString()}`,
          {
            method: "GET",
          }
        )
          .then((response) => response.text())
          .then((data) => {
            console.log("Sent request successfully to windguru", data);
          });
      }
    );
    await step.do(
      "Upload to Windy",
      {
        retries: {
          limit: 10,
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

        const data = event.payload.data as schema.ObservationData;
        const params = new URLSearchParams({
          station: WINDY_STATION_ID, // 32 bit integer; required for multiple stations; default value 0; alternative names: si, stationId
          ts: new Date(event.payload.timestamp as string | number)
            .getTime()
            .toString(),
          temp: data.temperatureC.toString(), // real number [°C]; air temperature
          windspeedmph: data.windSpeed.toString(), // real number [mph]; wind speed (alternative to wind)
          winddir: data.windDirection.toString(), // integer number [deg]; instantaneous wind direction
          windgustmph: data.windGust.toString(), // real number [mph]; current wind gust (alternative to gust)
          rh: data.humidity.toString(), // real number [%]; relative humidity ; alternative name: humidity
          dewpoint: data.dewPoint.toString(), // real number [°C];
          baromin: data.barometer.toString(), // real number [inches Hg]; atmospheric pressure alternative
          rainin: (data.rainRate / 0.01).toString(), // real number [in]; rain inches over the past hour (alternative to precip)
          uv: data.uv.toString(), //number [index];
        });
        await fetch(
          `https://stations.windy.com/pws/update/${WINDY_API_KEY}?${params.toString()}`,
          {
            method: "GET",
          }
        )
          .then((response) => response.text())
          .then((data) => {
            console.log("Sent request successfully to windguru", data);
          });
      }
    );
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
        const data = event.payload.data as schema.ObservationData;
        const params = new URLSearchParams({
          siteid: METOFFICE_SITE_ID,
          siteAuthenticationKey: METOFFICE_AUTH_KEY,
          softwaretype: "PSC Weather Station",
          dateutc: new Date(event.payload.timestamp as string | number)
            .toISOString()
            .replace("T", "+")
            .replace(/:/g, "%3A")
            .split(".")[0],
          baromin: data.barometer.toString(), // real number [inches Hg]; atmospheric pressure alternative
          dailyrainin: (data.rainRate / 0.01).toString(), // real number [in]; rain inches over the past hour (alternative to precip)
          dewptf: data.dewPoint.toString(),
          humidity: data.humidity.toString(), // real number [%]; relative humidity ; alternative name: humidity
          tempf: data.temperatureF.toString(), // real number [°F]; air temperature
          windspeedmph: data.windSpeed.toString(), // real number [mph]; wind speed (alternative to wind)
          winddir: data.windDirection.toString(), // integer number [deg]; instantaneous wind direction
          windgustmph: data.windGust.toString(), // real number [mph]; current wind gust (alternative to gust)
          windgustdir: data.windGustDirection.toString(), // integer number [deg]; instantaneous wind direction
        });
        await fetch(
          `http://wow.metoffice.gov.uk/automaticreading?${params.toString()}`,
          {
            method: "GET",
          }
        )
          .then((response) => response.text())
          .then((data) => {
            console.log("Sent request successfully to windguru", data);
          });
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
    });
  }
}
export class OvernightSaveToR2 extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`
  }
}
