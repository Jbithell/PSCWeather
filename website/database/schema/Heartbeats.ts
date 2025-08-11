import { sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const Heartbeats = sqliteTable(
  "heartbeats",
  {
    hourStartTimestamp: integer("hour_start_timestamp", { mode: "timestamp" })
      .primaryKey()
      .$defaultFn(() => sql`(unixepoch(strftime('%Y-%m-%d %H:00:00', 'now')))`), // Time of the heartbeat
    pingCount: integer("ping_count").notNull().default(0),
  },
  (table) => []
);
