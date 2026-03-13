/**
 * Clamp a date string to today if it's in the future.
 * Prevents OCR/AI from saving expenses with incorrect future dates.
 */
export function clampDateToToday(dateStr: string | null | undefined): string {
  const today = new Date().toISOString().split("T")[0];
  if (!dateStr) return today;
  
  // Validate format
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return today;
  
  const dateOnly = dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;
  return dateOnly > today ? today : dateOnly;
}
