/** Israeli week (Sunday → Saturday), local time. */
export function israeliWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7); // exclusive
  return { start, end };
}

export function shiftWeek(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function formatWeekLabel(start: Date): string {
  const last = new Date(start);
  last.setDate(last.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${f(start)} – ${f(last)}`;
}

/** Calendar month, local time. `end` is the first day of the next month (exclusive). */
export function monthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

/** Shift by whole months, clamping the day so the result is always a valid date. */
export function shiftMonth(date: Date, months: number): Date {
  const month = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), month + 1, 0).getDate();
  return new Date(date.getFullYear(), month, Math.min(date.getDate(), lastDay));
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
