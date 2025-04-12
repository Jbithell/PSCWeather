import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  lt,
  or,
  SQL,
  type InferSelectModel,
} from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import * as schema from "../../../database/schema.d";

export const querySystem = async ({
  db,
  schema: thisSchema,
  sortable,
  shownCols,
  sortingColAsString,
  sortAsc = true,
  thisCursor = false,
  limit = 10,
  filters,
  joins = [], // New parameter for join conditions
}: {
  db: DrizzleD1Database<typeof schema>; // The database object itself
  schema: SQLiteTableWithColumns<any>; // The schema of this table
  sortable: ReturnType<typeof getTableColumns>; // The columns that can be sorted by the end user (subset of below)
  shownCols: {
    // The columns that are shown to the end user, with the label of the column name
    [K in keyof ReturnType<typeof getTableColumns>]: string;
  };
  sortingColAsString: string; // The column that the data is sorted by
  sortAsc: boolean; // Whether the data is sorted in ascending order (true) or descending order
  thisCursor: number | false; // The cursor for pagination - this is the first row of this page
  limit: number; // The number of rows to show per page
  filters: any[]; // Where clauses to apply to the data
  joins?: {
    table: SQLiteTableWithColumns<any>; // The table to join with
    tableName: string; // The name of the table in the query
    on: SQL<unknown>; // The join condition
    downloadCols: ReturnType<typeof getTableColumns>;
    type: "left" | "inner";
  }[]; // Array of join configurations
}) => {
  const cols = getTableColumns(thisSchema); // Get all columns of the table

  if (!Object.keys(sortable).includes(sortingColAsString))
    throw new Error("Invalid sorting column"); // Ensure the user hasn't tried to sort by a column that isn't allowed to be sorted by

  const sortingColAsCol = sortable[sortingColAsString];

  const shownColsKeysAndNames: {
    key: keyof InferSelectModel<typeof thisSchema>;
    name: string;
    sortable: boolean;
  }[] = Object.keys(shownCols).map((key) => ({
    key: key,
    name: shownCols[key],
    sortable: Object.keys(sortable).includes(key),
  }));

  const shownColsAsCols = Object.keys(shownCols).reduce((acc, key) => {
    acc[key] = cols[key];
    if (!Object.keys(cols).includes(key))
      throw new Error(`Displayed column ${key} not in schema`);
    return acc;
  }, {} as Record<string, any>);

  const totalCount = await db.$count(thisSchema, and(...filters));

  const subQueryWhere = db // This is a subquery to get the value of the sorting column for the current row
    .select({
      val: sortingColAsCol,
    })
    .from(thisSchema)
    .where(eq(cols.id, thisCursor !== false ? thisCursor : 0))
    .limit(1);

  let query = db
    .select({
      ...shownColsAsCols,
      id: thisSchema.id,
      // Add the columns from the joined tables
      ...joins.reduce(
        (acc: Record<string, any>, { tableName, downloadCols }) => {
          acc[tableName] = Object.fromEntries(
            Object.entries(downloadCols).map(([key, value]) => [key, value])
          );
          return acc;
        },
        {} as Record<string, any>
      ),
    }) // Only select the columns that are shown plus the ID
    .from(thisSchema)
    .limit(limit + 1);

  joins.forEach(({ table, on, type }) => {
    if (type === "left") query = query.leftJoin(table, on);
    else if (type === "inner") query = query.innerJoin(table, on);
  });

  const rows = (await query
    .where(
      and(
        thisCursor
          ? or(
              sortAsc
                ? gt(sortingColAsCol, subQueryWhere)
                : lt(sortingColAsCol, subQueryWhere),
              and(eq(sortingColAsCol, subQueryWhere), gte(cols.id, thisCursor))
            )
          : undefined,
        ...filters
      )
    )
    .orderBy(
      sortAsc ? asc(sortingColAsCol) : desc(sortingColAsCol),
      asc(thisSchema.id)
    )) as InferSelectModel<typeof thisSchema>[];

  // If we are not at the start of the list, we need to grab the previous row in the previous batch in order to show a back button
  let prevRows: { id: number }[] = [];
  if (thisCursor)
    prevRows = await db
      .select({
        id: thisSchema.id,
      })
      .from(thisSchema)
      .where(
        and(
          thisCursor
            ? or(
                sortAsc
                  ? lt(sortingColAsCol, subQueryWhere)
                  : gt(sortingColAsCol, subQueryWhere),
                and(eq(sortingColAsCol, subQueryWhere), lt(cols.id, thisCursor))
              )
            : undefined,
          ...filters
        )
      )
      .limit(limit)
      .orderBy(
        sortAsc ? desc(sortingColAsCol) : asc(sortingColAsCol),
        desc(thisSchema.id)
      );

  return {
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
    cols: {
      show: shownColsKeysAndNames,
      sortable: Object.keys(sortable),
    },
  };
};
