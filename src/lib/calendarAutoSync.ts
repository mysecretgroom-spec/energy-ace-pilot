export const CALENDAR_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/** One scheduler per mounted Planning view; missed ticks resume on foreground/network return. */
export function startCalendarAutoSync(
  sync: () => Promise<void>,
  available: () => boolean,
  events: { window: EventTarget; document: EventTarget },
) {
  let stopped = false;
  let running = false;
  let lastAttempt: number | undefined;
  const tick = async () => {
    if (stopped || running || !available()) return;
    if (lastAttempt !== undefined && Date.now() - lastAttempt < CALENDAR_SYNC_INTERVAL_MS) return;
    running = true;
    lastAttempt = Date.now();
    try {
      await sync();
    } catch (error) {
      console.error("Automatic Google Calendar sync failed:", error);
    } finally {
      running = false;
    }
  };
  const resume = () => { void tick(); };
  const timer = setInterval(resume, CALENDAR_SYNC_INTERVAL_MS);
  events.window.addEventListener("online", resume);
  events.document.addEventListener("visibilitychange", resume);
  resume();
  return () => {
    stopped = true;
    clearInterval(timer);
    events.window.removeEventListener("online", resume);
    events.document.removeEventListener("visibilitychange", resume);
  };
}