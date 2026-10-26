import { describe, it, expect } from "vitest";
import { israeliWeekRange, monthRange, shiftMonth, formatMonthLabel } from "./israeliWeek";

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

describe("monthRange", () => {
  it("covers the whole calendar month with an exclusive end", () => {
    const { start, end } = monthRange(new Date(2026, 9, 21, 15)); // Oct 2026
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(1);
  });
  it("December rolls into January of the next year", () => {
    const { start, end } = monthRange(new Date(2026, 11, 31));
    expect(start.getFullYear()).toBe(2026);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
  });
});

describe("shiftMonth", () => {
  it("clamps the day when shifting from the 31st", () => {
    const d = shiftMonth(new Date(2026, 9, 31), -1); // 31 Oct -> September
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(30);
  });
  it("crosses the year boundary both ways", () => {
    expect(shiftMonth(new Date(2026, 0, 15), -1).getFullYear()).toBe(2025);
    expect(shiftMonth(new Date(2026, 11, 15), 1).getFullYear()).toBe(2027);
  });
});

describe("formatMonthLabel", () => {
  it("renders the month and year in French", () => {
    expect(formatMonthLabel(new Date(2026, 9, 26))).toBe("octobre 2026");
  });
});
