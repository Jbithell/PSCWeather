import type { Config } from "drizzle-kit";

export default {
  out: "./database/migrations",
  schema: "./database/schema.d.ts",
  dialect: "sqlite",
  driver: "d1-http",
  //breakpoints: false, // Remove statement-breakpoint from migrations
  dbCredentials: {
    databaseId: "local-test-db",
    accountId: "nothing-needed-here-not-used",
    token: "nothing-needed-here-not-used",
  },
} satisfies Config;
