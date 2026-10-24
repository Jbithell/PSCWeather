import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema.d";
import type { ObservationInsert, UploadTarget } from "../../database/schema.d";
import { withRetry } from "./retry";
import { uploadToWindGuru } from "./windguru";
import { uploadToWindy } from "./windy";

interface UploadTargetConfig {
  /** Human readable name, used in logs */
  name: string;
  /**
   * Shortest gap we will leave between dispatches to this service. The weather
   * station reports roughly every 30 seconds, which is far more often than any
   * of these services want, so most observations are skipped for most targets.
   */
  minimumIntervalMs: number;
  upload: (env: Env, data: ObservationInsert) => Promise<void>;
}

const TARGETS: Record<UploadTarget, UploadTargetConfig> = {
  windguru: {
    name: "Windguru",
    minimumIntervalMs: 2 * 60 * 1000, // Matches the interval=120 we send in the payload
    upload: uploadToWindGuru,
  },
  windy: {
    name: "Windy",
    minimumIntervalMs: 5 * 60 * 1000, // Windy's hard minimum - it rejects anything sooner
    upload: uploadToWindy,
  },
};

/** Keep `last_error` from growing unbounded */
const MAX_ERROR_LENGTH = 500;

const describeError = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(
    0,
    MAX_ERROR_LENGTH,
  );

/**
 * Uploads an observation to every external service that is due one.
 *
 * Intended to be called from `ctx.waitUntil` so the weather station gets its
 * response immediately - it can spend up to ~35 seconds retrying. The
 * observation is already saved to D1 by the caller before this runs, so a
 * failure here only ever costs us a data point on a third party site, and the
 * next observation arrives ~30 seconds later regardless.
 */
export async function dispatchObservation(
  env: Env,
  db: DrizzleD1Database<typeof schema>,
  observation: ObservationInsert,
) {
  try {
    const now = new Date();
    const state = await db.select().from(schema.UploadState);
    const lastAttemptByTarget = new Map(
      state.map((row) => [row.target, row.lastAttemptAt]),
    );

    const dueTargets = schema.uploadTargets.filter((target) => {
      const lastAttemptAt = lastAttemptByTarget.get(target);
      if (!lastAttemptAt) return true;
      return (
        now.getTime() - lastAttemptAt.getTime() >=
        TARGETS[target].minimumIntervalMs
      );
    });
    if (dueTargets.length === 0) {
      console.debug("No upload targets are due, skipping this observation");
      return;
    }

    // Claim the slot before uploading, so an observation that arrives while a
    // slow retry is still running doesn't dispatch to the same service again
    const [firstClaim, ...remainingClaims] = dueTargets.map((target) =>
      db
        .insert(schema.UploadState)
        .values({ target, lastAttemptAt: now })
        .onConflictDoUpdate({
          target: schema.UploadState.target,
          set: { lastAttemptAt: now },
        }),
    );
    await db.batch([firstClaim, ...remainingClaims]);

    const results = await Promise.allSettled(
      dueTargets.map((target) =>
        withRetry(TARGETS[target].name, () =>
          TARGETS[target].upload(env, observation),
        ),
      ),
    );

    const [firstUpdate, ...remainingUpdates] = dueTargets.map(
      (target, index) => {
        const result = results[index];
        if (result.status === "fulfilled") {
          console.log(`Uploaded observation to ${TARGETS[target].name}`);
          return db
            .update(schema.UploadState)
            .set({ lastSuccessAt: now, lastError: null })
            .where(eq(schema.UploadState.target, target));
        }
        console.error(
          `Failed to upload observation to ${TARGETS[target].name}`,
          result.reason,
        );
        return db
          .update(schema.UploadState)
          .set({ lastError: describeError(result.reason) })
          .where(eq(schema.UploadState.target, target));
      },
    );
    await db.batch([firstUpdate, ...remainingUpdates]);
  } catch (error) {
    // Never let this reject - it runs detached in waitUntil and the observation
    // itself has already been saved
    console.error("Failed to dispatch observation to upload targets", error);
  }
}
