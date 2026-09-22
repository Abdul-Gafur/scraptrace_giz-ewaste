import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface DataColumn<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** The column that titles a row in the mobile card layout. */
  primary?: boolean;
  align?: "start" | "end";
}

interface DataTableProps<Row> {
  /** Accessible name of the table, also used as the card list label. */
  caption: string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  className?: string;
}

/**
 * Responsive table: a real table from 768px, a list of labelled cards below it, so narrow
 * screens never need horizontal scrolling and every value keeps its column heading.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowId,
  className,
}: DataTableProps<Row>) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  return (
    <div className={className}>
      <div className="bg-surface hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-background">
            <tr>
              {columns.map((column) => (
                <th
                  className={cn(
                    "border-b p-4 font-bold",
                    column.align === "end" ? "text-end" : "text-start",
                  )}
                  key={column.key}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b last:border-b-0" key={getRowId(row)}>
                {columns.map((column) => (
                  <td
                    className={cn("p-4", column.align === "end" ? "text-end" : "text-start")}
                    key={column.key}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={caption} className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li className="bg-surface rounded-md border p-4" key={getRowId(row)}>
            {primary ? <p className="mb-2 text-sm font-bold">{primary.cell(row)}</p> : null}
            <dl className="space-y-1.5 text-xs">
              {columns
                .filter((column) => column !== primary)
                .map((column) => (
                  <div className="flex items-center justify-between gap-3" key={column.key}>
                    <dt className="text-muted-foreground">{column.header}</dt>
                    <dd className="text-end font-semibold">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
