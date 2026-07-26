import type { ObservationInsert } from "../../database/schema.d";
import { NonRetryableUploadError, UPLOAD_TIMEOUT_MS } from "./retry";

export async function uploadToMetOffice(env: Env, data: ObservationInsert) {
  const METOFFICE_SITE_ID = await env.KV.get("METOFFICE_SITE_ID");
  const METOFFICE_AUTH_KEY = await env.KV.get("METOFFICE_AUTH_KEY");
  if (!METOFFICE_SITE_ID || !METOFFICE_AUTH_KEY)
    throw new NonRetryableUploadError("Missing Met Office credentials");

  const params = new URLSearchParams({
    siteid: METOFFICE_SITE_ID,
    siteAuthenticationKey: METOFFICE_AUTH_KEY,
    softwaretype: "PSC Weather Station",
    // WOW wants "YYYY-mm-DD HH:mm:ss" - URLSearchParams does the escaping for
    // us, so this must be the plain unescaped value
    dateutc: data.timestamp.toISOString().replace("T", " ").split(".")[0],
    dailyrainin: (data.data.lastHourRain * 0.0393701).toString(), // real number [in]; rain inches over the past hour (alternative to precip)
    dewptf: data.data.dewPoint.toString(),
    tempf: data.data.temperatureF.toString(), // real number [°F]; air temperature
    windspeedmph: data.data.windSpeed.toString(), // real number [mph]; wind speed (alternative to wind)
    winddir: data.data.windDirection.toString(), // integer number [deg]; instantaneous wind direction
    //windgustmph: data.data.windGust.toString(), // real number [mph]; current wind gust (alternative to gust)
    //windgustdir: data.data.windGustDirection.toString(), // integer number [deg]; instantaneous wind direction
  });
  const response = await fetch(
    `http://wow.metoffice.gov.uk/automaticreading?${params.toString()}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    },
  ).then((response) => {
    if (response.status === 429)
      throw new NonRetryableUploadError(
        "Met office asked for a backoff, skip this observation",
      );
    if (!response.ok)
      throw new Error("Met Office upload failed, status: " + response.status);
    return response.json();
  });
  if (
    !response ||
    typeof response !== "object" ||
    Object.keys(response).length !== 0
  )
    throw new Error(`Met Office upload failed: ${JSON.stringify(response)}`);
}
