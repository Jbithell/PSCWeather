import { BarChart } from "@mantine/charts";
import { Button, Divider, Group, Text } from "@mantine/core";
import { IconCloudDownload, IconTableShare } from "@tabler/icons-react";
import { sql } from "drizzle-orm";
import { href, Link } from "react-router";
import type { Route } from "./+types/index";

export const handle = {
  title: "Home",
};
export async function loader({ context }: Route.LoaderArgs) {
  const weatherStationHealthQuery = await context.db.all(sql`
    SELECT
      FLOOR(unixepoch() + (period_index * 30 * 60)) AS period_time,
      period_index,
      SUM(CASE WHEN table_name = 'disregarded_observations' THEN count ELSE 0 END) AS disregarded,
      SUM(CASE WHEN table_name = 'observations' THEN count ELSE 0 END) AS observed
    FROM (
      SELECT 
        'disregarded_observations' AS table_name,
        COUNT(*) AS count,
        FLOOR((timestamp - unixepoch()) / (30 * 60)) AS period_index
      FROM disregarded_observations
      WHERE timestamp >= (unixepoch()-(24 * 60 * 60 * 1000))
      GROUP BY period_index
      UNION ALL
      SELECT 
        'observations' AS table_name,
        COUNT(*) AS count,
        FLOOR((timestamp - unixepoch()) / (30 * 60)) AS period_index
      FROM observations
      WHERE timestamp >= (unixepoch()-(24 * 60 * 60 * 1000))
      GROUP BY period_index
    ) AS combined
    GROUP BY period_index
    ORDER BY period_index;
  `);
  const weatherStationHealthData: {
    time: string;
    disregarded: number;
    observed: number;
  }[] = weatherStationHealthQuery.map((row: any) => {
    const start = new Date(row.period_time * 1000);
    return {
      time: `${start.getHours()}:${start
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      observed: row.observed || 0,
      disregarded: row.disregarded || 0,
    };
  });

  const averageProcessingTimeLastHourQuery = await context.db.get(sql`
    SELECT AVG(created_at - timestamp) AS avg_difference_of_last_5_observations_within_last_hour
    FROM (
      SELECT timestamp, created_at
      FROM observations
      WHERE created_at >= (unixepoch()-(1 * 60 * 60 * 1000))
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
