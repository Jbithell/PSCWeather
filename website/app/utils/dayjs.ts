import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
//import dayjs from "dayjs/esm/index.js";
//import localizedFormat from "dayjs/esm/plugin/localizedFormat";
//import timezone from "dayjs/esm/plugin/timezone";
//import utc from "dayjs/esm/plugin/utc";

const instance = dayjs;
instance.extend(localizedFormat);
instance.extend(timezone);
instance.extend(utc);

export { instance as dayjs };
