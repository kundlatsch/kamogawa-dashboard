import type { LeaderboardEntry } from "../api/types";
import { sortLeaderboard } from "./ranking";

const entry = (name: string, xp: number, attended: number, absences: number) =>
  ({ student: { id: xp, display_name: name }, xp, attended, absences }) as LeaderboardEntry;

describe("sortLeaderboard", () => {
  const rows = [entry("Ana", 50, 2, 3), entry("Bia", 30, 5, 0), entry("Cris", 30, 5, 1)];

  it("ranks by XP, then attendance", () => {
    expect(sortLeaderboard(rows, "xp").map((r) => r.student.display_name)).toEqual(["Ana", "Bia", "Cris"]);
  });

  it("ranks by attendance, then fewer absences", () => {
    expect(sortLeaderboard(rows, "attendance").map((r) => r.student.display_name)).toEqual(["Bia", "Cris", "Ana"]);
  });
});
