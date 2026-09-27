"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/states";
import { SectionLabel } from "@/components/ui/content";
import { cn } from "@/lib/cn";

import { useValueFormats } from "./formats";

/**
 * Flat horizontal bar chart built from the design tokens, with no charting dependency.
 *
 * The bars are decorative: every value is also present as text next to its label, the whole chart
 * carries a text summary for assistive technology, and the underlying numbers are available as a
 * real table. Nothing is inferred or smoothed, so the chart cannot show a trend the records do not
 * contain.
 */

export interface BarDatum {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly tone?: "primary" | "warning" | "danger" | "info" | "muted";
}

const TONE_CLASS = {
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  muted: "bg-muted-foreground",
} as const;

interface BarChartProps {
  title: string;
  data: readonly BarDatum[];
  /** Unit appended to every value, for example `kg`. Omit for plain counts. */
  unit?: string;
  /** Summary sentence for assistive technology. Describes what the chart shows. */
  summary: string;
  emptyDescription?: string;
  fractionDigits?: number;
}

export function BarChart({
  title,
  data,
  unit,
  summary,
  emptyDescription,
  fractionDigits = 0,
}: BarChartProps) {
  const translate = useTranslations("charts");
  const formats = useValueFormats();
  const total = data.reduce((sum, datum) => sum + datum.value, 0);

  if (data.length === 0 || total === 0) {
    return (
      <section aria-labelledby={`${title}-heading`} className="space-y-2">
        <SectionLabel>
          <span id={`${title}-heading`}>{title}</span>
        </SectionLabel>
        <EmptyState
          description={emptyDescription ?? translate("emptyDescription")}
          title={translate("emptyTitle")}
        />
      </section>
    );
  }

  const highest = Math.max(...data.map((datum) => datum.value));
  const formatValue = (value: number) =>
    unit
      ? `${formats.number(value, fractionDigits)} ${unit}`
      : formats.number(value, fractionDigits);

  return (
    <section aria-labelledby={`${title}-heading`} className="space-y-3">
      <SectionLabel>
        <span id={`${title}-heading`}>{title}</span>
      </SectionLabel>
      <p className="sr-only">{summary}</p>
      <ul className="space-y-2">
        {data.map((datum) => (
          <li className="space-y-1" key={datum.key}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-foreground min-w-0 truncate">{datum.label}</span>
              <span className="text-foreground shrink-0 font-bold">{formatValue(datum.value)}</span>
            </div>
            <div className="bg-surface-subtle h-2 w-full overflow-hidden rounded-xs">
              <div
                aria-hidden="true"
                className={cn("h-full rounded-xs", TONE_CLASS[datum.tone ?? "primary"])}
                style={{
                  width: `${highest === 0 ? 0 : Math.max(2, (datum.value / highest) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <details>
        <summary className="text-muted-foreground min-h-touch cursor-pointer text-xs">
          {translate("showTable")}
        </summary>
        <table className="mt-2 w-full text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th className="border-b p-2 text-start font-bold" scope="col">
                {translate("labelColumn")}
              </th>
              <th className="border-b p-2 text-end font-bold" scope="col">
                {unit ? translate("valueColumnWithUnit", { unit }) : translate("valueColumn")}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.key}>
                <td className="border-b p-2">{datum.label}</td>
                <td className="border-b p-2 text-end font-semibold">
                  {formats.number(datum.value, fractionDigits)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
