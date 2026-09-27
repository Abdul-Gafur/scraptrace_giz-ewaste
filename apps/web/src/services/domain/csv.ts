/**
 * CSV serialisation for authorised exports (FR-DSH-007).
 *
 * Values are quoted whenever they contain a separator, quote or newline, and inner quotes are
 * doubled, so a value can never break out of its field. A value that a spreadsheet would treat
 * as a formula is prefixed with a single quote, so opening the file cannot execute content.
 */

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_START = /^[=+\-@\t\r]/;

export const escapeCsvValue = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const guarded = FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTING.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
};

export interface CsvColumn<Row> {
  /** Stable heading. Never translated, so downstream tooling keeps working. */
  readonly heading: string;
  readonly value: (row: Row) => string | number | boolean | null | undefined;
}

export const buildCsv = <Row>(columns: readonly CsvColumn<Row>[], rows: readonly Row[]): string => {
  const lines = [columns.map((column) => escapeCsvValue(column.heading)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(column.value(row))).join(","));
  }
  // A trailing newline keeps the last record intact in stricter parsers.
  return `${lines.join("\r\n")}\r\n`;
};

/** `scraptrace-<programme>-<scope>-<date>.csv`, safe for every common file system. */
export const buildExportFilename = (
  programmeName: string,
  scope: string,
  calendarDate: string,
): string => {
  const slug = programmeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `scraptrace-${slug || "programme"}-${scope}-${calendarDate}.csv`;
};
