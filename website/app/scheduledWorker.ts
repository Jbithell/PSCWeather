import type { DrizzleD1Database } from "drizzle-orm/d1";
import timers from "node:timers";
import * as schema from "~/database/schema.d";
export const scheduledWorker = async (
  event: ScheduledController,
  env: Env,
  context: ExecutionContext,
  db: DrizzleD1Database<typeof schema>,
  triggerName: string
) => {
  new Promise<void>(async (resolve) => {
    console.log(`Hello from Cloudflare Scheduled Worker: ${triggerName}`);
    // This is where you can run your scheduled tasks
    timers.setTimeout(() => resolve(), 1000);
  });
};
