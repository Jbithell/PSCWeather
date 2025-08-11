import { BarChart } from "@mantine/charts";
import { Button, Divider, Group, Paper, Text, ThemeIcon } from "@mantine/core";
import {
  IconCircleDashedCheck,
  IconCircleDashedX,
  IconCloudDownload,
  IconHeartBroken,
  IconTableShare,
  IconWifi,
  IconWifiOff,
} from "@tabler/icons-react";
import { asc, gt, sql } from "drizzle-orm";
import { href, Link } from "react-router";
import * as schema from "../../database/schema.d";
import type { Route } from "./+types/index";

export const handle = {
  title: "Home",
};
export async function loader({ context }: Route.LoaderArgs) {
  const weatherStationHealthQuery = await context.db.all(sql`
    WITH RECURSIVE time_periods(period_index) AS (
      SELECT -48 AS period_index
      UNION ALL
      SELECT period_index + 1 FROM time_periods WHERE period_index < 0
    ),
    data_summary AS (
      SELECT 
        'disregarded_observations' AS table_name,
        COUNT(*) AS count,
        FLOOR((timestamp - unixepoch()) / (30 * 60)) AS period_index
      FROM disregarded_observations
      WHERE timestamp >= (unixepoch()-(24 * 60 * 60))
      GROUP BY period_index
      UNION ALL
      SELECT 
        'observations' AS table_name,
        COUNT(*) AS count,
        FLOOR((timestamp - unixepoch()) / (30 * 60)) AS period_index
      FROM observations
      WHERE timestamp >= (unixepoch()-(24 * 60 * 60))
      GROUP BY period_index
    )
    SELECT
      FLOOR(unixepoch() + (tp.period_index * 30 * 60)) AS period_time,
      tp.period_index,
      COALESCE(SUM(CASE WHEN ds.table_name = 'disregarded_observations' THEN ds.count ELSE 0 END), 0) AS disregarded,
      COALESCE(SUM(CASE WHEN ds.table_name = 'observations' THEN ds.count ELSE 0 END), 0) AS observed
    FROM time_periods tp
    LEFT JOIN data_summary ds ON tp.period_index = ds.period_index
    GROUP BY tp.period_index
    ORDER BY tp.period_index;
  `);
  const heartbeats = await context.db
    .select()
    .from(schema.Heartbeats)
    .where(
      gt(
        schema.Heartbeats.hourStartTimestamp,
        sql`(unixepoch() - 24 * 60 * 60)`
      )
    )
    .orderBy(asc(schema.Heartbeats.hourStartTimestamp));
  const weatherStationHealthData: {
    time: string;
    disregarded: number;
    observed: number;
  }[] = weatherStationHealthQuery
    .filter((row: any) => row.period_index !== -48) // Skip the first period, it is always empty as it contains data from more than 24 hours ago
    .map((row: any) => {
      const endOfPeriod = new Date(row.period_time * 1000);
      const startOfPeriod = new Date(endOfPeriod.getTime() - 30 * 60 * 1000); // Add 30 minutes to start
      const minutesSinceStartOfPeriod = Math.round(
        (new Date().getTime() - startOfPeriod.getTime()) / 60000
      );
      const heartbeat = heartbeats.find((heartbeat) => {
        // Match if the weatherStationPeriod's hour matches the heartbeat's hourStartTimestamp
        return (
          heartbeat.hourStartTimestamp.getHours() ===
            startOfPeriod.getHours() &&
          heartbeat.hourStartTimestamp.getDate() === startOfPeriod.getDate()
        );
      });

      let uptime = 0; // Uptime as a percentage (i.e. 100% = 55 pings)
      let expectedPings = 60; // Expected number of pings in the period, if the period is the current one (ie less than an hour, we should expect fewer pings). This is because it's the previous 30 minutes.
      if (minutesSinceStartOfPeriod < 60)
        expectedPings = expectedPings * (minutesSinceStartOfPeriod / 60);
      if (heartbeat) uptime = (heartbeat.pingCount / expectedPings) * 100;
      if (uptime > 100) uptime = 100;
      uptime = Math.round(uptime);

      return {
        time: `${startOfPeriod.getHours()}:${startOfPeriod
          .getMinutes()
          .toString()
          .padStart(2, "0")}`,
        observed: row.observed || 0,
        disregarded: row.disregarded || 0,
        endOfPeriod: `${endOfPeriod.getHours()}:${endOfPeriod
          .getMinutes()
          .toString()
          .padStart(2, "0")}`,
        pingCount: heartbeat?.pingCount ?? 0,
        uptime,
        expectedPings,
      };
    });

  const averageProcessingTimeLastHourQuery = await context.db.get(sql`
    SELECT AVG(created_at - timestamp) AS avg_difference_of_last_5_observations_within_last_hour
    FROM (
      SELECT timestamp, created_at
      FROM observations
      WHERE created_at >= (unixepoch()-(1 * 60 * 60))
      ORDER BY timestamp DESC
      LIMIT 5
    ) AS recent_observations;
  `);
  let averageProcessingTimeLastHour = 0;
  if (
    averageProcessingTimeLastHourQuery &&
    typeof averageProcessingTimeLastHourQuery === "object" &&
    "avg_difference_of_last_5_observations_within_last_hour" in
      averageProcessingTimeLastHourQuery
  )
    averageProcessingTimeLastHour =
      averageProcessingTimeLastHourQuery.avg_difference_of_last_5_observations_within_last_hour as number;

  return {
    weatherStationHealthData,
    averageProcessingTimeLastHour,
  };
}

export default function Page({ actionData, loaderData }: Route.ComponentProps) {
  const ChartTooltip = ({
    label,
    payload,
  }: {
    label: string;
    payload: Record<string, any>[] | undefined;
  }) => {
    if (!payload || payload.length === 0) return null;
    const payloadData = payload[0]["payload"];
    const startOfPeriod = new Date(`1970-01-01T${payloadData.time}:00`);

    return (
      <Paper px="md" py="sm" withBorder shadow="md" radius="md">
        <Text fw={500} mb={5}>
          {label} to {payloadData.endOfPeriod} UTC
        </Text>

        <Group>
          <ThemeIcon variant="white" color="green.4" radius="md">
            <IconCircleDashedCheck style={{ width: "70%", height: "70%" }} />
          </ThemeIcon>
          <Text fz="sm">
            {payloadData.observed} observation
            {payloadData.observed === 1 ? "" : "s"} successfully recorded
          </Text>
        </Group>
        {payloadData.disregarded > 0 && (
          <Group>
            <ThemeIcon variant="white" color="red.5" radius="md">
              <IconCircleDashedX style={{ width: "70%", height: "70%" }} />
            </ThemeIcon>
            <Text fz="sm">
              {payloadData.disregarded} observation
              {payloadData.disregarded === 1 ? "" : "s"} failed validation check
            </Text>
          </Group>
        )}
        {payloadData.uptime >= 90 ? (
          <Group>
            <ThemeIcon variant="white" color="black" radius="md">
              <IconWifi style={{ width: "70%", height: "70%" }} />
            </ThemeIcon>
            <Text fz="sm">No connectivity issues experienced</Text>
          </Group>
        ) : (
          <>
            <Group>
              <ThemeIcon variant="white" color="black" radius="md">
                <IconWifiOff style={{ width: "70%", height: "70%" }} />
              </ThemeIcon>
              <Text fz="sm">Connected {payloadData.uptime}% of the time</Text>
            </Group>
            <Group>
              <ThemeIcon variant="white" color="pink.4" radius="md">
                <IconHeartBroken style={{ width: "70%", height: "70%" }} />
              </ThemeIcon>
              <Text fz="sm">
                Received {payloadData.pingCount} of {payloadData.expectedPings}{" "}
                expected heartbeats
              </Text>
            </Group>
          </>
        )}
      </Paper>
    );
  };
  return (
    <>
      <Text my={"sm"}>
        Every 30 seconds, live observations are taken from the weather station
        at the sailing club and are uploaded to:
      </Text>
      <Group justify="center">
        <Button
          variant="outline"
          component={Link}
          to="https://www.windguru.cz/station/2973"
          target="_blank"
          rel="noopener noreferrer"
          size={"lg"}
          leftSection={
            <img
              src="/service-provider-icons/windguru.png"
              alt="Windguru"
              height={20}
            />
          }
        >
          Windguru
        </Button>
        <Button
          variant="outline"
          component={Link}
          to="https://www.windy.com/station/pws-f05043fc?52.91711478245152,-4.131985902786256"
          target="_blank"
          rel="noopener noreferrer"
          size={"lg"}
          leftSection={
            <img
              src="/service-provider-icons/windycom.png"
              alt="Windguru"
              height={20}
            />
          }
        >
          Windy.com
        </Button>
        <Button
          variant="outline"
          component={Link}
          to="https://wow.metoffice.gov.uk/observations/details/?site_id=5c09b287-9717-f011-a81b-000d3adc591b"
          target="_blank"
          rel="noopener noreferrer"
          size={"lg"}
          leftSection={
            <img
              src="/service-provider-icons/metoffice.png"
              alt="Windguru"
              height={20}
            />
          }
        >
          MetOffice
        </Button>
      </Group>
      <Text my={"sm"}>
        The weather station (a Davis Vantage Vue) is sheltered in some wind
        directions so the observations should be viewed with caution. With winds
        from SW through East to NE accurate observations may be expected though
        with winds WSW through West to NNE the observations are likely to be
        substantially lower and winds much stronger than indicated are likely
        both beyond the Powder House and towards Portmeirion.
      </Text>
      <Group justify="center">
        <Button
          component={Link}
          to={href("/download")}
          variant="light"
          size="sm"
          leftSection={<IconCloudDownload size={16} />}
        >
          Download historic observations
        </Button>
        <Button
          component={Link}
          to={href("/data/:thisCursor?")}
          variant="light"
          size="sm"
          rightSection={<IconTableShare size={16} />}
        >
          View recent observations
        </Button>
      </Group>
      <Divider
        label={"Weather Station Health"}
        labelPosition="center"
        my={"sm"}
      />
      <Text my={"sm"} size={"sm"} fw={400}>
        Occasionally the weather station transmits data which is outside the
        expected range (e.g. a wind direction above 360 degrees, or wind speed
        above 500 mph). This chart shows the number of observations received
        over the last 24 hours and whether they were disregarded due to
        validation checks failing.
      </Text>
      <BarChart
        h={300}
        data={loaderData.weatherStationHealthData}
        dataKey="time"
        type="stacked"
        withLegend
        yAxisLabel="Observations"
        legendProps={{ verticalAlign: "bottom" }}
        tickLine="none"
        gridAxis="none"
        tooltipProps={{
          content: ({ label, payload }) => (
            <ChartTooltip label={label} payload={payload} />
          ),
        }}
        series={[
          {
            name: "observed",
            color: "green.4",
            label: "Successfully recorded",
          },
          {
            name: "disregarded",
            color: "red.5",
            label: "Failed validation checks",
          },
        ]}
      />
      <Text fw={400} size={"sm"} my={"sm"}>
        60 observations are taken every 30 minute period.
        {loaderData.averageProcessingTimeLastHour > 0 &&
          ` The average time to upload, process and validate the last five observations was ${loaderData.averageProcessingTimeLastHour} seconds.`}
      </Text>
    </>
  );
}
