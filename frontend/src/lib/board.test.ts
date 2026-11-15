import type { Assignment } from "../api/types";
import { columnAssignments, dropTargets, moveBefore } from "./board";

const make = (id: number, order: number, participants: number[], is_broadcast = false) =>
  ({ id, order, participants, is_broadcast }) as Assignment;

const assignments = [
  make(1, 0, [], true), // broadcast warm-up
  make(2, 1, [10]), // A solo
  make(3, 2, [20, 30]), // B + C pair
];

describe("board helpers", () => {
  it("shows a pair drill in both participants' columns", () => {
    expect(columnAssignments(assignments, "s20").map((a) => a.id)).toEqual([3]);
    expect(columnAssignments(assignments, "s30").map((a) => a.id)).toEqual([3]);
    expect(columnAssignments(assignments, "s10").map((a) => a.id)).toEqual([2]);
  });

  it("puts broadcast drills only in the broadcast column", () => {
    expect(columnAssignments(assignments, "broadcast").map((a) => a.id)).toEqual([1]);
  });

  it("moves an assignment before another across the session order", () => {
    expect(moveBefore(assignments, 3, 2)).toEqual([1, 3, 2]);
    expect(moveBefore(assignments, 1, 3)).toEqual([2, 1, 3]);
    expect(moveBefore(assignments, 2, 2)).toEqual([1, 2, 3]);
  });

  it("uses the multi-selection when dropping on a selected student", () => {
    expect(dropTargets(20, new Set([30, 20]))).toEqual([20, 30]);
    expect(dropTargets(10, new Set([20, 30]))).toEqual([10]);
    expect(dropTargets(20, new Set([20]))).toEqual([20]);
  });
});
