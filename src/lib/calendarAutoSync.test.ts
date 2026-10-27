// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { startCalendarAutoSync } from "./calendarAutoSync";

afterEach(() => vi.useRealTimers());

describe("Planning automatic Calendar sync", () => {
  it("syncs on opening and exactly every 15 minutes, and stops on leaving", async () => {
    vi.useFakeTimers();
    const sync = vi.fn(async () => {});
    const stop = startCalendarAutoSync(sync, () => true, { window: new EventTarget(), document: new EventTarget() });
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 - 1);
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("waits offline and resumes once on network return without overlapping", async () => {
    vi.useFakeTimers();
    let online = false;
    const events = { window: new EventTarget(), document: new EventTarget() };
    const sync = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    const stop = startCalendarAutoSync(sync, () => online, events);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(sync).not.toHaveBeenCalled();
    online = true;
    events.window.dispatchEvent(new Event("online"));
    events.document.dispatchEvent(new Event("visibilitychange"));
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    events.document.dispatchEvent(new Event("visibilitychange"));
    expect(sync).toHaveBeenCalledTimes(1);
    stop();
  });
});