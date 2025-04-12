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
    data: text({ mode: "json" }).$type<ObservationData>().notNull(),
  },
  (table) => []
);

const observationDataSchema = z.object({
  temperatureF: z.coerce.number().gt(-460).lt(150),
  windSpeed: z.coerce.number().gte(0).lte(200), // mph
  windDirection: z.coerce.number().gt(0).lte(360),
  wind10MinAverage: z.coerce.number().gte(0).lte(200), // mph
  wind2MinAverage: z.coerce.number().gte(0).lte(200), // mph
  //windGust: z.coerce.number().gte(0).lte(200), // mph
  //windGustDirection: z.coerce.number().gt(0).lte(360),
  dewPoint: z.coerce.number().gt(-460).lt(150), // Fahrenheit
  rainRate: z.coerce.number().positive(), // Clicks per hour (0.2mm or 0.01in)
  uv: z.coerce.number(), // UV Index
  solarRadiation: z.coerce.number(), // watt/meter^2
  last15MinRain: z.coerce.number(), // Clicks per 15 minutes (0.2mm or 0.01in)
  lastHourRain: z.coerce.number(), // Clicks per hour (0.2mm or 0.01in)
  last24HourRain: z.coerce.number(), // Clicks per 24 hours (0.2mm or 0.01in)
  temperatureC: z.coerce.number().gt(-273).lt(150),
});
// A raw weather station observation - which may or may not be valid
export const observationFromWeatherStation = z.object({
  temperatureF: z.coerce.number(),
  windSpeed: z.coerce.number(),
  windDirection: z.coerce.number(),
  wind10MinAverage: z.coerce.number(),
  wind2MinAverage: z.coerce.number(),
  //windGust: z.coerce.number(),
  //windGustDirection: z.coerce.number(),
  dewPoint: z.coerce.number(),
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
  timestamp: z.coerce.date(),
});
export type ObservationInsert = z.infer<typeof observationInsertSchema>;
