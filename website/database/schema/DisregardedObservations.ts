import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const DisregardedObservations = sqliteTable("disregarded_observations", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(), // Time of the actual observation
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => sql`(unixepoch())`), // Time of the observation being put in the database
  data: text({ mode: "json" }).$type<{
    [key: string]: unknown;
  }>(),
  disregardReasonFriendly: text().$type<string>().notNull(),
  disregardReasonDetailed: text().$type<string>().notNull(),
});
