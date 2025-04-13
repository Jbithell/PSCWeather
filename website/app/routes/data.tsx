import { ActionIcon, Group, Table, Text, Title } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
} from "@tabler/icons-react";
import { and, eq, gt, gte, lt, or, sql, SQL } from "drizzle-orm";
import { href, Link } from "react-router";
import { LinkPreserveQueryParams } from "~/components/LinkPreserveQueryParams";
import { Timestamp } from "~/components/Timestamp";
import * as schema from "../../database/schema.d";
import type { Route } from "./+types/data";
export const handle = {
  title: "Observations",
};
const dataFields = {
  temperatureF: "Temperature (°F)",
  temperatureC: "Temperature (°C)",
  windSpeed: "Wind Speed (mph)",
  windDirection: "Wind Direction (°)",
  wind10MinAverage: "10-Minute Average Wind Speed (mph)",
  wind2MinAverage: "2-Minute Average Wind Speed (mph)",
  windGust: "Wind Gust (mph)",
  windGustDirection: "Wind Gust Direction (°)",
  dewPoint: "Dew Point (°F)",
  humidity: "Humidity (%)",
  last15MinRain: "Rainfall in Last 15 Minutes (mm)",
  lastHourRain: "Rainfall in Last Hour (mm)",
  last24HourRain: "Rainfall in Last 24 Hours (mm)",
};
export async function loader({ request, context, params }: Route.LoaderArgs) {
  const searchParams = new URL(request.url).searchParams;
  const limit = 30;
  const sortAsc = searchParams.get("order") === "asc";
  const validSortingDataKeys = Object.keys(dataFields);
  const sortingColAsString: string =
    searchParams.get("sort") &&
    validSortingDataKeys.includes(searchParams.get("sort") || "")
      ? searchParams.get("sort") || "timestamp"
      : "timestamp";
  const sortingCol =
    sortingColAsString === "timestamp"
      ? schema.Observations.timestamp
      : sql`json_extract(${schema.Observations.data}, '$.${sql.raw(
          sortingColAsString
        )}')`;
  const totalCount = await context.db.$count(schema.Observations);
  const subQueryWhere = context.db // This is a subquery to get the value of the sorting column for the current row
    .select({
      val: sortingCol,
    })
    .from(schema.Observations)
    .where(
      eq(
        schema.Observations.id,
        params.thisCursor ? parseInt(params.thisCursor) : 0
      )
    )
    .limit(1);

  let rows = (await context.db
    .select({
      id: schema.Observations.id,
      timestamp: schema.Observations.timestamp,
      ...Object.entries(dataFields).reduce((acc, [key, name]) => {
        acc[key] = sql`json_extract(${schema.Observations.data}, '$.${sql.raw(
          key
        )}')`;
        return acc;
      }, {} as Record<string, SQL<unknown>>),
    }) // Only select the columns that are shown plus the ID
    .from(schema.Observations)
    .limit(limit + 1)
    .where(
      and(
        params.thisCursor
          ? or(
              sortAsc
                ? gt(sql`${sortingCol}`, subQueryWhere)
                : lt(sql`${sortingCol}`, subQueryWhere),
              and(
                eq(sql`${sortingCol}`, subQueryWhere),
                gte(schema.Observations.id, parseInt(params.thisCursor))
              )
            )
          : undefined
      )
    )
    .orderBy(sql`${sortingCol} ${sortAsc ? sql`asc` : sql`desc`}`)) as {
    id: number;
    timestamp: Date;
    [key: string]: number | string | Date; // Limit to keys of dataFields
  }[];

  // If we are not at the start of the list, we need to grab the previous row in the previous batch in order to show a back button
  let prevRows: { id: number }[] = [];
  if (params.thisCursor)
    prevRows = await context.db
      .select({
        id: schema.Observations.id,
      })
      .from(schema.Observations)
      .where(
        and(
          params.thisCursor
            ? or(
                sortAsc
                  ? lt(sql`${sortingCol}`, subQueryWhere)
                  : gt(sql`${sortingCol}`, subQueryWhere),
                and(
                  eq(sql`${sortingCol}`, subQueryWhere),
                  lt(schema.Observations.id, parseInt(params.thisCursor))
                )
              )
            : undefined
        )
      )
      .limit(limit)
      .orderBy(
        sql`${sortingCol} ${sortAsc ? sql`asc` : sql`desc`}`,
        sql`${schema.Observations.id} desc`
      );
  return {
    tableData: {
      rows: rows.length > limit ? rows.slice(0, -1) : rows, // Remove last row - it's just to grab the next button
      pagination: {
        totalCount,
        limit,
        prevRow: prevRows.length > 0 ? prevRows[prevRows.length - 1].id : false,
        nextRow: rows.length === limit + 1 ? rows[rows.length - 1].id : false,
      },
      query: {
        sortCol: sortingColAsString,
        sortOrder: sortAsc ? "asc" : "desc",
      },
    },
  };
}

export default function Page({ actionData, loaderData }: Route.ComponentProps) {
  const { tableData } = loaderData;

  return (
    <>
      <Title order={2}>Observations</Title>
      <Table.ScrollContainer minWidth={500}>
        <Table striped stickyHeader tabularNums>
          <Table.Thead>
            <Table.Tr>
              {[
                {
                  key: "timestamp",
                  name: "Timestamp",
                },
                ...Object.entries(dataFields).map(([key, name]) => ({
                  key,
                  name,
                })),
              ].map((col) => (
                <Table.Th key={col.key}>
                  <Group
                    justify="space-between"
                    grow
                    preventGrowOverflow={false}
                    wrap="nowrap"
                  >
                    <Text>{col.name}</Text>

                    <ActionIcon.Group orientation="vertical">
                      <ActionIcon
                        variant={
                          tableData.query.sortCol === col.key &&
                          tableData.query.sortOrder === "asc"
                            ? "outline"
                            : "subtle"
                        }
                        size="xs"
                        aria-label="Sort Ascending"
                        component={Link}
                        to={`${href("/data/:thisCursor?")}?sort=${
                          col.key
                        }&order=asc`}
                      >
                        <IconChevronUp size={20} stroke={3} />
                      </ActionIcon>

                      <ActionIcon
                        variant={
                          tableData.query.sortCol === col.key &&
                          tableData.query.sortOrder === "desc"
                            ? "outline"
                            : "subtle"
                        }
                        size="xs"
                        aria-label="Sort Descending"
                        component={Link}
                        to={`${href("/data/:thisCursor?")}?sort=${
                          col.key
                        }&order=desc`}
                      >
                        <IconChevronDown size={20} stroke={3} />
                      </ActionIcon>
                    </ActionIcon.Group>
                  </Group>
                </Table.Th>
              ))}
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tableData.rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>
                  <Timestamp>{row.timestamp}</Timestamp>
                </Table.Td>
                {Object.entries(dataFields).map(([key]) => (
                  <Table.Td key={key}>
                    {row[key] instanceof Date
                      ? row[key].toISOString()
                      : row[key]}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot></Table.Tfoot>
        </Table>
      </Table.ScrollContainer>
      <Group justify="space-between">
        <div>
          <ActionIcon
            component={LinkPreserveQueryParams}
            disabled={tableData.pagination.prevRow === false}
            to={href("/data/:thisCursor?", {
              thisCursor: String(tableData.pagination.prevRow),
            })}
            aria-label="Previous Page"
            size="md"
            variant="outline"
          >
            <IconChevronLeft />
          </ActionIcon>

          <ActionIcon
            component={LinkPreserveQueryParams}
            disabled={tableData.pagination.nextRow === false}
            to={href("/data/:thisCursor?", {
              thisCursor: String(tableData.pagination.nextRow),
            })}
            aria-label="Next Page"
            size="md"
            variant="outline"
          >
            <IconChevronRight />
          </ActionIcon>
        </div>
        <Text>
          Showing{" "}
          {tableData.pagination.limit > tableData.pagination.totalCount
            ? tableData.pagination.totalCount
            : tableData.pagination.limit}{" "}
          of {tableData.pagination.totalCount}
        </Text>
      </Group>
    </>
  );
}
