import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as Schema from "./schema";
export type D1Database = DrizzleD1Database<typeof Schema>;
