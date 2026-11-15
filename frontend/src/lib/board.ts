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
