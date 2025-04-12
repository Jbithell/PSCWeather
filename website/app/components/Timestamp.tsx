import { dayjs } from "~/utils/dayjs";

interface TimestampProps {
  children: React.ReactNode | Date;
  format?: string;
}

export const Timestamp = (props: TimestampProps) => {
  const timestamp = String(props.children);
  if (
    typeof timestamp === "undefined" ||
    !timestamp ||
    timestamp.length < 1 ||
    timestamp === "undefined"
  )
    return null;

  const guessTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return dayjs.tz(timestamp, "UTC").tz(guessTimezone).format("LLL");
};
