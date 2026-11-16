import type { RoutineItem, SessionBlock } from "../api/types";

/** Consecutive routine items of the same block (the API already returns them in class order). */
export function groupByBlock(items: RoutineItem[]): { block: SessionBlock | null; items: RoutineItem[] }[] {
  const groups: { block: SessionBlock | null; items: RoutineItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && (last.block?.id ?? null) === (item.block?.id ?? null)) last.items.push(item);
    else groups.push({ block: item.block, items: [item] });
  }
  return groups;
}
