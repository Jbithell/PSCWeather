import type { ObservationInsert } from "../../database/schema.d";
import { NonRetryableUploadError, UPLOAD_TIMEOUT_MS } from "./retry";

export async function uploadToWindy(env: Env, data: ObservationInsert) {
  const WINDY_API_KEY = await env.KV.get("WINDY_API_KEY");
  const WINDY_STATION_ID = await env.KV.get("WINDY_STATION_ID");
  if (!WINDY_API_KEY || !WINDY_STATION_ID)
    throw new NonRetryableUploadError("Missing Windy credentials");

  const params = new URLSearchParams({
    station: WINDY_STATION_ID, // 32 bit integer; required for multiple stations; default value 0; alternative names: si, stationId
    ts: data.timestamp.getTime().toString(),
    temp: data.data.temperatureC.toString(), // real number [°C]; air temperature
    windspeedmph: data.data.windSpeed.toString(), // real number [mph]; wind speed (alternative to wind)
    winddir: data.data.windDirection.toString(), // integer number [deg]; instantaneous wind direction
    //windgustmph: data.data.windGust.toString(), // real number [mph]; current wind gust (alternative to gust)
    dewpoint: data.data.dewPoint.toString(), // real number [°C];
    precip: data.data.lastHourRain.toString(), // real number [mm]; precipitation over the past hour
  });
  const response = await fetch(
    `https://stations.windy.com/pws/update/${WINDY_API_KEY}?${params.toString()}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    },
  );
  const responseText = await response.text();
  if (
    responseText.length > 0 &&
    responseText.includes(
      "Measurement sent too soon, update interval is 5 minutes",
    )
  ) {
    throw new NonRetryableUploadError(
      "Windy asked for a backoff, skip this observation",
    );
  } else if (!response.ok)
    throw new Error("Windy upload failed, status: " + response.status);
  const responseJson = JSON.parse(responseText);
  if (!responseJson || typeof responseJson !== "object")
    throw new Error(`Windy upload failed: ${responseText}`);
}
