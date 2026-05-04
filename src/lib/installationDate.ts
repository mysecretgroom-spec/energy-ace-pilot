/**
 * Determine the value to set for `date_installation_reelle` when transitioning
 * a vente to status `installe` via swipe.
 *
 * Rules:
 * - If `date_installation_reelle` already exists, never overwrite it (caller
 *   should skip the update entirely — this helper returns `null` to signal that).
 * - If no planned date, or planned date is today or in the past → use today.
 * - If planned date is in the future → preserve it as the real installation date.
 */
export function resolveInstallationRealDate(
  currentReelle: string | null | undefined,
  prevue: string | null | undefined,
  today: string = new Date().toISOString().split("T")[0],
): string | null {
  if (currentReelle) return null;
  if (!prevue || prevue <= today) return today;
  return prevue;
}
