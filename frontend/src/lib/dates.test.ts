import {
  addMinutesToTime,
  blockStartTime,
  fromISODate,
  pythonWeekday,
  startOfWeek,
  toISODate,
  weekdayNames,
} from "./dates";

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

describe("block times", () => {
  it("adds minutes to the class start", () => {
    expect(addMinutesToTime("19:00:00", 10)).toBe("19:10");
    expect(addMinutesToTime("23:50", 20)).toBe("00:10");
    expect(blockStartTime("19:00:00", 0)).toBe("19:00");
    expect(blockStartTime("19:00:00", null)).toBeNull();
    expect(blockStartTime(null, 10)).toBeNull();
  });
});
