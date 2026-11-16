import type { RoutineItem, SessionBlock } from "../api/types";
import { groupByBlock } from "./routine";

const block = (id: number): SessionBlock => ({
  id,
  name: `B${id}`,
  color: "#000000",
  order: id,
  archived: false,
  mode: "COLLECTIVE",
  start_offset_minutes: null,
});
const item = (id: number, b: SessionBlock | null) => ({ id, block: b }) as RoutineItem;

describe("groupByBlock", () => {
  it("groups consecutive items of the same block and keeps unblocked ones apart", () => {
    const a = block(1);
    const b = block(2);
    const groups = groupByBlock([item(1, a), item(2, a), item(3, b), item(4, null)]);
    expect(groups.map((g) => [g.block?.id ?? null, g.items.map((i) => i.id)])).toEqual([
      [1, [1, 2]],
      [2, [3]],
      [null, [4]],
    ]);
  });
});
