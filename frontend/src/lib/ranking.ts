import type { LeaderboardEntry } from "../api/types";

export type RankingOrder = "attendance" | "missions";

/** Attendance ranking (ties: fewer absences) or missions ranking (ties: attendance), then name. */
export function sortLeaderboard(entries: LeaderboardEntry[], order: RankingOrder): LeaderboardEntry[] {
  const byName = (a: LeaderboardEntry, b: LeaderboardEntry) => a.student.display_name.localeCompare(b.student.display_name);
  const byAttendance = (a: LeaderboardEntry, b: LeaderboardEntry) => b.attended - a.attended || a.absences - b.absences;
  return [...entries].sort((a, b) =>
    order === "attendance"
      ? byAttendance(a, b) || b.missions_completed - a.missions_completed || byName(a, b)
      : b.missions_completed - a.missions_completed || byAttendance(a, b) || byName(a, b),
  );
}
