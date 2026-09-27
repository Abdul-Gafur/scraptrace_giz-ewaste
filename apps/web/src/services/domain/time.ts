import { UtcTimestampSchema, type UtcTimestamp } from "@scraptrace/contracts";

/** Contract timestamps are UTC with millisecond precision and a trailing `Z`. */
export const toUtcTimestamp = (value: Date | string | number): UtcTimestamp =>
  UtcTimestampSchema.parse(new Date(value).toISOString());

export const nowUtc = (): UtcTimestamp => toUtcTimestamp(Date.now());

/** `YYYY-MM-DD`, the calendar-date shape used by approval, review and reporting filters. */
export const toCalendarDate = (value: Date | string | number): string =>
  new Date(value).toISOString().slice(0, 10);

export const todayCalendarDate = (): string => toCalendarDate(Date.now());

export const addDays = (value: Date | string | number, days: number): Date => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

export const isBeforeToday = (calendarDate: string): boolean => calendarDate < todayCalendarDate();
