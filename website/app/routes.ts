import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route(
    "/upload-from-weather-station/:secret",
    "./routes/uploadFromWeatherStation.ts"
  ),
  layout("./routes/layout.tsx", [
    route("/download", "./routes/download.tsx"),
    route("/download-observation/:file", "./routes/downloadCsv.tsx"),
    route("/data/:thisCursor?", "./routes/data.tsx"),
    index("./routes/index.tsx"),
  ]),
] satisfies RouteConfig;
