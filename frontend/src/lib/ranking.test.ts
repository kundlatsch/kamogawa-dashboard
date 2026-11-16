import type { LeaderboardEntry } from "../api/types";
import { sortLeaderboard } from "./ranking";

const entry = (name: string, attended: number, absences: number, missions: number) =>
  ({ student: { id: attended, display_name: name }, attended, absences, missions_completed: missions }) as LeaderboardEntry;

describe("sortLeaderboard", () => {
  const rows = [entry("Ana", 2, 3, 4), entry("Bia", 5, 0, 1), entry("Cris", 5, 1, 0)];

  it("ranks by attendance, then fewer absences", () => {
    expect(sortLeaderboard(rows, "attendance").map((r) => r.student.display_name)).toEqual(["Bia", "Cris", "Ana"]);
  });

  it("ranks by completed missions", () => {
    expect(sortLeaderboard(rows, "missions").map((r) => r.student.display_name)).toEqual(["Ana", "Bia", "Cris"]);
  });
});
