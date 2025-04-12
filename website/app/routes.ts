import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("/upload-from-weather-station/:secret", "./routes/uploadFromWeatherStation.ts"),
  layout("./routes/layout.tsx", [index("./routes/index.tsx")]),
] satisfies RouteConfig;
