import type { Assignment } from "../api/types";

/** A board column: everyone (broadcast) or a single student. */
export type ColumnKey = "broadcast" | `s${number}`;

export const studentColumn = (studentId: number): ColumnKey => `s${studentId}`;

export function columnStudentId(key: ColumnKey): number | null {
  return key === "broadcast" ? null : Number(key.slice(1));
}

/** Assignments shown in a column, in routine order. */
export function columnAssignments(assignments: Assignment[], key: ColumnKey): Assignment[] {
  const studentId = columnStudentId(key);
  return assignments
    .filter((a) => (studentId === null ? a.is_broadcast : a.participants.includes(studentId)))
    .sort((a, b) => a.order - b.order || a.id - b.id);
}

/** Session-wide order after moving `draggedId` right before `targetId`. */
export function moveBefore(assignments: Assignment[], draggedId: number, targetId: number): number[] {
  const ids = [...assignments].sort((a, b) => a.order - b.order || a.id - b.id).map((a) => a.id);
  if (draggedId === targetId) return ids;
  const without = ids.filter((id) => id !== draggedId);
  const index = without.indexOf(targetId);
  if (index === -1) return ids;
  without.splice(index, 0, draggedId);
  return without;
}

/** Students to assign when a drill is dropped on a student's column (multi-select aware). */
export function dropTargets(studentId: number, selected: Set<number>): number[] {
  return selected.has(studentId) && selected.size > 1 ? [...selected].sort((a, b) => a - b) : [studentId];
}

/** Exercises sorted by name, the way people read them (accents and numbers included). */
export function sortByName<T extends { name: string }>(items: T[], locale?: string): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return [...items].sort((a, b) => collator.compare(a.name, b.name));
}

export interface DrillGroup<T> {
  /** `null` holds the exercises without a category. */
  categoryId: number | null;
  drills: T[];
}

/**
 * Exercises grouped by category, in the categories' own order, each group sorted by name.
 * Exercises without a category (or with one that no longer exists) come last.
 */
export function groupByCategory<T extends { name: string; category: number | null }>(
  drills: T[],
  categories: { id: number }[],
  locale?: string,
): DrillGroup<T>[] {
  const known = new Set(categories.map((c) => c.id));
  const groups: DrillGroup<T>[] = categories.map((c) => ({ categoryId: c.id, drills: [] }));
  const byId = new Map(groups.map((g) => [g.categoryId, g]));
  const loose: DrillGroup<T> = { categoryId: null, drills: [] };
  for (const drill of drills) {
    (drill.category != null && known.has(drill.category) ? byId.get(drill.category)! : loose).drills.push(drill);
  }
  return [...groups, loose]
    .filter((g) => g.drills.length > 0)
    .map((g) => ({ ...g, drills: sortByName(g.drills, locale) }));
}
