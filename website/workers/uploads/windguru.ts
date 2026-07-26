import type { ObservationInsert } from "../../database/schema.d";
import { NonRetryableUploadError, UPLOAD_TIMEOUT_MS } from "./retry";

export async function uploadToWindGuru(env: Env, data: ObservationInsert) {
  const WINDGURU_UID = await env.KV.get("WINDGURU_UID");
  const WINDGURU_PASSWORD = await env.KV.get("WINDGURU_PASSWORD");
  if (!WINDGURU_UID || !WINDGURU_PASSWORD)
    throw new NonRetryableUploadError("Missing Windguru credentials");

  const salt = Date.now();
  const hash = await crypto.subtle.digest(
    {
      name: "MD5",
    },
    new TextEncoder().encode(`${salt}${WINDGURU_UID}${WINDGURU_PASSWORD}`),
  );
  const params = new URLSearchParams({
    uid: WINDGURU_UID,
    interval: "120",
    wind_avg: (data.data.wind2MinAverage / 1.151).toString(),
    wind_direction: data.data.windDirection.toString(),
    temperature: data.data.temperatureC.toString(),
    datetime: data.timestamp.toISOString(),
    salt: salt.toString(),
    hash: Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  });
  const response = await fetch(
    `https://www.windguru.cz/upload/api.php?${params.toString()}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    },
  ).then((response) => {
    if (!response.ok)
      throw new Error("Windguru failed, status: " + response.status);
    return response.text();
  });
  if (response !== "OK") {
    throw new Error(`Windguru upload failed: ${response}`);
  }
}
