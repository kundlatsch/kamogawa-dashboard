import type { LeaderboardEntry } from "../api/types";

/** Attendance ranking: most classes attended, then fewer absences, then name. */
export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.attended - a.attended || a.absences - b.absences || a.student.display_name.localeCompare(b.student.display_name),
  );
}
