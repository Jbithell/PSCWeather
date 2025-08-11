import { data } from "react-router";
import {
  observationFromWeatherStation,
  observationInsertSchema,
} from "../../database/schema.d";
import type { Route } from "./+types/uploadFromWeatherStation";

export async function action({ request, context, params }: Route.ActionArgs) {
  if (request.method !== "PUT" || !request.body) {
    return data(
      {
        error: "Invalid request method or empty body",
      },
      { status: 400 }
    );
  }
  const requestBody = await request.json();
  if (!requestBody) {
    return data(
      {
        error: "Invalid request body",
      },
      { status: 400 }
    );
  }
  console.debug("Received data from weather station", requestBody);

  const uploadSecret = await context.cloudflare.env.KV.get(
    "UPLOAD_FROM_WEATHER_STATION_SECRET"
  );
  if (params.secret !== uploadSecret) {
    return data(
      {
        error: "Incorrect secret",
      },
      { status: 401 }
    );
  }

  // First, check this is a valid request from the weather station - don't care if the data is valid or not, just that the structure is correct
  const validatedFormData = await observationFromWeatherStation.safeParseAsync(
    requestBody
  );
  if (!validatedFormData.success) {
    console.log(
      "Error in data packet from weather station",
      requestBody,
      validatedFormData.error
    );
    return data(
      {
        error: "Error in data packet from weather station",
        errors: validatedFormData.error,
      },
      { status: 400 }
    );
  }

  // Okay, so we have a valid data packet from the weather station, now we need to validate the data
  // We need to parse the data from the weather station, and convert it to the correct types
  const parsedData = validatedFormData.data;
  const { timestamp, disregardReason, ...rest } = parsedData;
  const fullValidation = await observationInsertSchema.safeParseAsync({
    data: {
      ...rest,
    },
    timestamp,
  });
  if (!fullValidation.success) {
    // The data is not valid, so we need to return an error
    const workflowInstance =
      await context.cloudflare.env.WORKFLOW_HANDLE_DISREGARD_OBSERVATION.create(
        {
          params: {
            data: parsedData,
            errors: fullValidation.error,
          },
        }
      );
    const workflowStatus = await workflowInstance.status();
    return data({
      message: "Observation received, and will be disregarded",
      status: workflowStatus.status,
    });
  } else {
    // The data is valid, so we need to insert it into the database
    await context.cloudflare.env.WORKFLOW_UPLOAD_RECEIVED_OBSERVATION_TO_DB.create(
      {
        params: fullValidation.data,
      }
    );
    await context.cloudflare.env.WORKFLOW_UPLOAD_TO_METOFFICE.create({
      params: fullValidation.data,
    });
    await context.cloudflare.env.WORKFLOW_UPLOAD_TO_WINDGURU.create({
      params: fullValidation.data,
    });
    await context.cloudflare.env.WORKFLOW_UPLOAD_TO_WINDY.create({
      params: fullValidation.data,
    });
    return data({
      message: "Observation received",
    });
  }
}
