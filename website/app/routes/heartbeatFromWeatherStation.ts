import { sql } from "drizzle-orm";
import { data } from "react-router";
import { Heartbeats } from "../../database/schema.d";
import type { Route } from "./+types/heartbeatFromWeatherStation";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  if (request.method !== "HEAD") {
    return data(
      {
        error: "Invalid request method",
      },
      { status: 400 }
    );
  }
  const uploadSecret = await context.cloudflare.env.KV.get(
    "UPLOAD_FROM_WEATHER_STATION_SECRET"
  );
  if (params.secret !== uploadSecret) {
    return data(
      {
        error: "Incorrect secret",
      },
      { status: 401 }
    );
  }

  context.cloudflare.ctx.waitUntil(
    context.db
      .insert(Heartbeats)
      .values({
        hourStartTimestamp: sql`unixepoch(strftime('%Y-%m-%d %H:00:00', 'now'))`,
        pingCount: 1,
      })
      .onConflictDoUpdate({
        target: Heartbeats.hourStartTimestamp,
        set: { pingCount: sql`${Heartbeats.pingCount} + 1` },
      })
  );

  return new Response(null, { status: 204 }); // This is a HEAD request, so we need to return a 204 response
}
