import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const Observations = sqliteTable(
  "observations",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(), // Time of the actual observation
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => sql`(unixepoch())`), // Time of the observation being put in the database
    data: text({ mode: "json" }).$type<ObservationData>(),
  },
  (table) => []
);

const observationDataSchema = z.object({
  barTrend: z.coerce
    .number()
    .refine((val) => [-60, -20, 0, 20, 60, 80].includes(val))
    .transform((val) => {
      switch (val) {
        case -60:
          return "Falling Rapidly";
        case -20:
          return "Falling Slowly";
        case 0:
          return "Steady";
        case 20:
          return "Rising Slowly";
        case 60:
          return "Rising Rapidly";
        case 80:
          return "P"; // Rev A firmware, no trend info is available
        default:
          return "Unknown";
      }
    }),
  barometer: z.coerce.number().gte(20).lte(32.5),
  temperatureF: z.coerce.number().gt(-460).lt(150),
  windSpeed: z.coerce.number().gte(0).lte(200),
  windDirection: z.coerce.number().gt(0).lte(360),
  wind10MinAverage: z.coerce.number().gte(0).lte(200),
  wind2MinAverage: z.coerce.number().gte(0).lte(200),
  windGust: z.coerce.number().gte(0).lte(200),
  windGustDirection: z.coerce.number().gt(0).lte(360),
  dewPoint: z.coerce.number().gt(-460).lt(150),
  humidity: z.coerce.number().gte(0).lte(100),
  rainRate: z.coerce.number().positive(), // Clicks per hour (0.2mm or 0.01in)
  uv: z.coerce.number(), // UV Index
  solarRadiation: z.coerce.number(), // watt/meter^2
  last15MinRain: z.coerce.number(),
  lastHourRain: z.coerce.number(),
  last24HourRain: z.coerce.number(),
  temperatureC: z.coerce.number().gt(-273).lt(150),
});
// A raw weather station observation - which may or may not be valid
export const observationFromWeatherStation = z.object({
  barTrend: z.coerce.number(),
  barometer: z.coerce.number(),
  temperatureF: z.coerce.number(),
  windSpeed: z.coerce.number(),
  windDirection: z.coerce.number(),
  wind10MinAverage: z.coerce.number(),
  wind2MinAverage: z.coerce.number(),
  windGust: z.coerce.number(),
  windGustDirection: z.coerce.number(),
  dewPoint: z.coerce.number(),
  humidity: z.coerce.number(),
  rainRate: z.coerce.number(),
  uv: z.coerce.number(),
  solarRadiation: z.coerce.number(),
  last15MinRain: z.coerce.number(),
  lastHourRain: z.coerce.number(),
  last24HourRain: z.coerce.number(),
  temperatureC: z.coerce.number(),
  timestamp: z.string(),
  disregardReason: z.string().optional(),
});

export type ObservationData = z.infer<typeof observationDataSchema>;
export type ObservationDataFromWeatherStation = z.infer<
  typeof observationFromWeatherStation
>;
export const observationInsertSchema = createInsertSchema(Observations, {
  data: observationDataSchema,
  timestamp: z.coerce.date().max(new Date(Date.now() + 10 * 60 * 1000)), // 10 minutes in the future
});
export type ObservationInsert = z.infer<typeof observationInsertSchema>;
