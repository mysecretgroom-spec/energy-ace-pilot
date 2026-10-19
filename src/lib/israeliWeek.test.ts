import { describe, it, expect } from "vitest";
import { israeliWeekRange } from "./israeliWeek";

describe("israeliWeekRange", () => {
  it("starts on Sunday and ends the next Sunday (exclusive)", () => {
    const { start, end } = israeliWeekRange(new Date(2026, 9, 21, 15)); // Wed 21 Oct 2026
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(18);
    expect(end.getDate()).toBe(25);
  });
  it("a Saturday stays in the week started the previous Sunday", () => {
    const { start } = israeliWeekRange(new Date(2026, 9, 24, 23)); // Sat 24 Oct
    expect(start.getDate()).toBe(18);
  });
  it("a Sunday opens its own week", () => {
    const { start } = israeliWeekRange(new Date(2026, 9, 25, 1));
    expect(start.getDate()).toBe(25);
  });
});
