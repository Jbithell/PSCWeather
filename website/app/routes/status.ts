import { count, desc, gt, sql } from "drizzle-orm";
import { data } from "react-router";
import * as schema from "../../database/schema.d";
import type { Route } from "./+types/status";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const dataReceived = await context.db
    .select({ count: count() })
    .from(schema.Observations)
    .where(
      gt(schema.Observations.timestamp, sql`(unixepoch() - 60 * 5)`) // 5 minutes ago
    );
  const dataReceivedDisregarded = await context.db
    .select({ count: count() })
    .from(schema.DisregardedObservations)
    .where(
      gt(schema.DisregardedObservations.timestamp, sql`(unixepoch() - 60 * 5)`) // 5 minutes ago
    );
  if (dataReceived[0].count > 0 || dataReceivedDisregarded[0].count > 0) {
    if (dataReceived[0].count > 0)
      return data({
        status: "ok",
        message: "Successfully parsed data received in the last 5 minutes",
      });
    else
      return data({
        status: "ok",
        message:
          "No successfully parsed data received in the last 5 minutes, but data was received that was subsequently disregarded",
      });
  }

  // No data received in the last 5 minutes, so we need to check when the last observation was received
  const lastObservation = await context.db
    .select({ timestamp: schema.Observations.timestamp })
    .from(schema.Observations)
    .orderBy(desc(schema.Observations.timestamp))
    .limit(1);
  const lastObservationDisregarded = await context.db
    .select({ timestamp: schema.DisregardedObservations.timestamp })
    .from(schema.DisregardedObservations)
    .orderBy(desc(schema.DisregardedObservations.timestamp))
    .limit(1);

  if (lastObservation.length !== 1 && lastObservationDisregarded.length !== 1) {
    return data({
      status: "offline",
      message:
        "No data received in the last 5 minutes, could not retrieve last data received",
    });
  }

  const lastObservationTimeAgo = Math.round(
    (new Date().getTime() - lastObservation[0].timestamp.getTime()) / 60000
  );
  const lastObservationDisregardedTimeAgo = Math.round(
    (new Date().getTime() - lastObservationDisregarded[0].timestamp.getTime()) /
      60000
  );

  return data({
    status: "offline",
    message: `Last observation was received ${lastObservationTimeAgo} minutes ago, and last disregarded observation was received ${lastObservationDisregardedTimeAgo} minutes ago`,
  });
}
