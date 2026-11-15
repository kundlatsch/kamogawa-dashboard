import { pythonWeekday, startOfWeek, toISODate, fromISODate, weekdayNames } from "./dates";

describe("dates", () => {
  it("round-trips ISO dates without timezone drift", () => {
    expect(toISODate(fromISODate("2026-11-16"))).toBe("2026-11-16");
  });

  it("uses Monday=0 weekdays like the backend", () => {
    expect(pythonWeekday(fromISODate("2026-11-16"))).toBe(0); // Monday
    expect(pythonWeekday(fromISODate("2026-11-22"))).toBe(6); // Sunday
  });

  it("starts weeks on Monday", () => {
    expect(toISODate(startOfWeek(fromISODate("2026-11-22")))).toBe("2026-11-16");
  });

  it("localizes weekday names", () => {
    expect(weekdayNames("pt-BR")[0].toLowerCase()).toContain("segunda");
  });
});
