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
