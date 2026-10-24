import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * One row per external weather service we upload observations to.
 *
 * `lastAttemptAt` drives the per-service throttle - observations arrive from the
 * weather station roughly every 30 seconds, which is far more often than the
 * services will accept, so we only dispatch to a service once its minimum
 * interval has elapsed. See workers/uploads/index.ts for the intervals.
 *
 * `lastError` exists so upload failures are still visible now that these
 * uploads no longer run as Workflows (which had their own dashboard).
 */
export const UploadState = sqliteTable("upload_state", {
  target: text("target").$type<UploadTarget>().primaryKey(), // The service, e.g. "windguru"
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }), // Last time we tried, successful or not
  lastSuccessAt: integer("last_success_at", { mode: "timestamp" }), // Last time an upload succeeded
  lastError: text("last_error"), // Why the last attempt failed, or null if it succeeded
});

export const uploadTargets = ["windguru", "windy"] as const;
export type UploadTarget = (typeof uploadTargets)[number];
