import type { LeaderboardEntry } from "../api/types";

/** XP ranking (ties by attendance) or attendance ranking (ties by fewer absences, then XP). */
export function sortLeaderboard(entries: LeaderboardEntry[], order: "xp" | "attendance"): LeaderboardEntry[] {
  const byName = (a: LeaderboardEntry, b: LeaderboardEntry) => a.student.display_name.localeCompare(b.student.display_name);
  return [...entries].sort((a, b) =>
    order === "xp"
      ? b.xp - a.xp || b.attended - a.attended || byName(a, b)
      : b.attended - a.attended || a.absences - b.absences || b.xp - a.xp || byName(a, b),
  );
}
