/**
 * Retries used to come from Cloudflare Workflows, which billed per step and so
 * became expensive at one observation every ~30 seconds across three services.
 * These uploads now run inline under `ctx.waitUntil`, so retries have to finish
 * within the invocation that received the observation.
 *
 * Three attempts spread over ~18 seconds (plus up to 5 seconds per attempt
 * waiting on the network) keeps the worst case around 33 seconds. That fits
 * inside the shortest throttle window (2 minutes, see ./index.ts), so a slow
 * retry can never overlap the next dispatch to the same service. Sleeping costs
 * no CPU time, which matters on the free plan's 10ms per-invocation limit.
 */
const RETRY_DELAYS_MS = [3000, 15000];

/** How long a single request to an external service may take. */
export const UPLOAD_TIMEOUT_MS = 5000;

/**
 * Thrown when retrying would be pointless or unwelcome - missing credentials,
 * data the service will never accept, or the service explicitly asking us to
 * back off. Replaces `NonRetryableError` from `cloudflare:workflows`.
 */
export class NonRetryableUploadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NonRetryableUploadError";
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `upload`, retrying transient failures. Gives up immediately on a
 * NonRetryableUploadError, and rethrows the final error if every attempt fails.
 */
export async function withRetry<T>(
  name: string,
  upload: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    try {
      return await upload();
    } catch (error) {
      lastError = error;
      if (error instanceof NonRetryableUploadError) throw error;
      console.warn(
        `${name} upload attempt ${attempt + 1} of ${
          RETRY_DELAYS_MS.length + 1
        } failed`,
        error,
      );
    }
  }
  throw lastError;
}
