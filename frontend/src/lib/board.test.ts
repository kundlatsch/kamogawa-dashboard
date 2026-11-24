import type { Assignment } from "../api/types";
import { columnAssignments, dropTargets, groupByCategory, moveBefore, sortByName } from "./board";

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

describe("exercise list", () => {
  const drill = (name: string, category: number | null) => ({ name, category });

  it("sorts by name ignoring case and accents", () => {
    const names = sortByName([drill("corrida", 1), drill("Abdominal", 1), drill("Ágil", 1), drill("Burpee", 1)], "pt-BR");
    expect(names.map((d) => d.name)).toEqual(["Abdominal", "Ágil", "Burpee", "corrida"]);
  });

  it("groups by category in category order, sorted inside, uncategorized last", () => {
    const groups = groupByCategory(
      [drill("Sombra", 2), drill("Polichinelo", 1), drill("Livre", null), drill("Corrida", 1), drill("Órfão", 99)],
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      "pt-BR",
    );
    expect(groups.map((g) => [g.categoryId, g.drills.map((d) => d.name)])).toEqual([
      [1, ["Corrida", "Polichinelo"]],
      [2, ["Sombra"]],
      [null, ["Livre", "Órfão"]],
    ]);
  });
});
