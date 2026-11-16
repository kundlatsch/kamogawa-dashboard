/** Date helpers working on local calendar dates as "YYYY-MM-DD" strings (no timezone drift). */

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(copy, -pythonWeekday(copy));
}

/** Weekday number as used by the backend: Monday=0 ... Sunday=6. */
export function pythonWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export const todayISO = () => toISODate(new Date());

export function formatDate(value: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, options).format(fromISODate(value));
}

/** Localized weekday names indexed Monday=0 ... Sunday=6. */
export function weekdayNames(locale: string, style: "long" | "short" = "long"): string[] {
  const monday = new Date(2024, 0, 1); // a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: style }).format(addDays(monday, i)),
  );
}

/** "19:00" (or "19:00:00") plus minutes, as "HH:MM"; wraps past midnight. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Start time of a block with a fixed time, or null. */
export function blockStartTime(sessionStart: string | null, offset: number | null): string | null {
  return sessionStart && offset !== null ? addMinutesToTime(sessionStart, offset) : null;
}
