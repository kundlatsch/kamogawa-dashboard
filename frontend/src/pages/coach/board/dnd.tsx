import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import type { ColumnKey } from "../../../lib/board";

/** Payloads carried by draggable items on the board. */
export type DragData =
  | { type: "drill"; drillId: number }
  | { type: "student"; studentId: number }
  | { type: "assignment"; assignmentId: number; column: ColumnKey };

/** Payloads of drop targets on the board. */
export type DropData = { type: "column"; column: ColumnKey } | { type: "card"; assignmentId: number; column: ColumnKey };

export function Draggable({ id, data, children, className = "" }: { id: string; data: DragData; children: ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`touch-none ${isDragging ? "opacity-30" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Droppable({
  id,
  data,
  children,
  className = "",
  overClassName = "",
}: {
  id: string;
  data: DropData;
  children: ReactNode;
  className?: string;
  overClassName?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? overClassName : ""}`}>
      {children}
    </div>
  );
}
