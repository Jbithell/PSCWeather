import { count, gt, sql } from "drizzle-orm";
import { data } from "react-router";
import * as schema from "../../database/schema.d";
import type { Route } from "./+types/status";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const [
    successfulResult,
    disregardedResult,
    currentHourHeartbeat,
    previousHourHeartbeat,
  ] = await Promise.all([
    context.db
      .select({ count: count() })
      .from(schema.Observations)
      .where(gt(schema.Observations.timestamp, sql`(unixepoch() - 60 * 30)`)),
    context.db
      .select({ count: count() })
      .from(schema.DisregardedObservations)
      .where(
        gt(
          schema.DisregardedObservations.timestamp,
          sql`(unixepoch() - 60 * 30)`
        )
      ),
    context.db
      .select({ pingCount: schema.Heartbeats.pingCount })
      .from(schema.Heartbeats)
      .where(
        sql`${schema.Heartbeats.hourStartTimestamp} = unixepoch(strftime('%Y-%m-%d %H:00:00', 'now'))`
      )
      .limit(1),
    context.db
      .select({ pingCount: schema.Heartbeats.pingCount })
      .from(schema.Heartbeats)
      .where(
        sql`${schema.Heartbeats.hourStartTimestamp} = (unixepoch(strftime('%Y-%m-%d %H:00:00', 'now')) - 3600)`
      )
      .limit(1),
  ]);

  return data({
    successfulObservationsLast30Min: successfulResult[0].count,
    disregardedObservationsLast30Min: disregardedResult[0].count,
    heartbeatCurrentHour: currentHourHeartbeat[0]?.pingCount ?? 0,
    heartbeatPreviousHour: previousHourHeartbeat[0]?.pingCount ?? 0,
    minutesIntoCurrentHour: new Date().getMinutes(),
  });
}
