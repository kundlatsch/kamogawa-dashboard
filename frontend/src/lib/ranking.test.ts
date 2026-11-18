import type { LeaderboardEntry } from "../api/types";
import { sortLeaderboard } from "./ranking";

const entry = (name: string, attended: number, absences: number) =>
  ({ student: { id: attended, display_name: name }, attended, absences }) as LeaderboardEntry;

describe("sortLeaderboard", () => {
  it("ranks by attendance, then fewer absences, then name", () => {
    const rows = [entry("Ana", 2, 3), entry("Cris", 5, 1), entry("Bia", 5, 0), entry("Abel", 2, 3)];
    expect(sortLeaderboard(rows).map((r) => r.student.display_name)).toEqual(["Bia", "Cris", "Abel", "Ana"]);
  });
});
