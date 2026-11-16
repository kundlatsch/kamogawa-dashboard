import { useTranslation } from "react-i18next";

import type { Assignment, CheckIn, User } from "../../../api/types";
import type { ColumnKey } from "../../../lib/board";
import { Draggable, Droppable } from "./dnd";
import Avatar from "../../../components/Avatar";
import StudentLink from "../../../components/StudentLink";

export default function BoardColumn({
  column,
  student,
  checkIn,
  assignments,
  studentsById,
  selected,
  onToggleSelect,
  onOpen,
  onRemove,
}: {
  column: ColumnKey;
  student?: User;
  /** The student's check-in for this class, if any (shown as a badge). */
  checkIn?: CheckIn;
  assignments: Assignment[];
  studentsById: Map<number, User>;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen: (assignment: Assignment) => void;
  onRemove: (assignment: Assignment) => void;
}) {
  const { t } = useTranslation();
  const isBroadcast = column === "broadcast";

  return (
    <Droppable
      id={`column:${column}`}
      data={{ type: "column", column }}
      className={`flex w-60 shrink-0 flex-col rounded-xl border bg-canvas transition-colors ${
        isBroadcast ? "border-belt/60" : selected ? "border-glove" : "border-rope"
      }`}
      overClassName="!border-chalk bg-rope/40"
    >
      <header className="flex items-center gap-2 border-b border-rope p-3">
        {isBroadcast ? (
          <div className="flex-1">
            <p className="font-display text-xl tracking-wide text-belt uppercase">📣 {t("board.broadcast")}</p>
            <p className="text-xs text-smoke">{t("board.broadcastHint")}</p>
          </div>
        ) : (
          student && (
            <>
              <Draggable id={`student:${student.id}`} data={{ type: "student", studentId: student.id }}>
                <span title={t("board.dragStudentHint")} className="flex cursor-grab">
                  <Avatar person={student} size="md" ring />
                </span>
              </Draggable>
              <p className="min-w-0 flex-1 truncate font-semibold">
                <StudentLink id={student.id}>{student.display_name}</StudentLink>
                {checkIn && (
                  <span
                    className={`ml-1 text-xs ${checkIn.has_pain ? "text-blood" : "text-belt"}`}
                    title={checkIn.has_pain ? `${checkIn.pain_location} (${checkIn.pain_level ?? "?"}/10)` : t("checkin.confirmed")}
                  >
                    {checkIn.has_pain ? "🤕" : "✓"}
                  </span>
                )}
              </p>
              <input
                type="checkbox"
                aria-label={t("board.select", { name: student.display_name })}
                checked={selected}
                onChange={onToggleSelect}
                className="h-4 w-4 accent-[var(--color-glove)]"
              />
            </>
          )
        )}
      </header>
      <div className="flex min-h-40 flex-1 flex-col gap-2 p-2">
        {assignments.length === 0 && <p className="p-2 text-center text-xs text-smoke">{t("board.dropHere")}</p>}
        {assignments.map((assignment) => {
          const partners = assignment.participants
            .filter((id) => `s${id}` !== column)
            .map((id) => studentsById.get(id))
            .filter(Boolean) as User[];
          const drill = assignment.drill_detail;
          return (
            <Droppable
              key={assignment.id}
              id={`card:${assignment.id}:${column}`}
              data={{ type: "card", assignmentId: assignment.id, column }}
              className="rounded-lg"
              overClassName="ring-2 ring-chalk"
            >
              <Draggable
                id={`assignment:${assignment.id}:${column}`}
                data={{ type: "assignment", assignmentId: assignment.id, column }}
              >
                <div
                  onClick={() => onOpen(assignment)}
                  className="cursor-grab rounded-lg border border-rope bg-ring p-2 hover:border-smoke"
                  style={{ borderLeft: `4px solid ${drill.color}` }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-2xl" aria-hidden>
                      {drill.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{drill.name}</p>
                      <p className="text-xs text-smoke">
                        {[
                          assignment.rounds ?? drill.default_rounds
                            ? t("drills.roundsCount", { count: assignment.rounds ?? drill.default_rounds ?? 0 })
                            : null,
                          assignment.duration_minutes ?? drill.default_duration_minutes
                            ? t("drills.minutesCount", {
                                count: assignment.duration_minutes ?? drill.default_duration_minutes ?? 0,
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      aria-label={isBroadcast ? t("common.delete") : t("board.removeStudent")}
                      title={isBroadcast ? t("common.delete") : t("board.removeStudent")}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(assignment);
                      }}
                      className="text-smoke hover:text-glove"
                    >
                      ✕
                    </button>
                  </div>
                  {partners.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-smoke">
                      <span>{t("board.with")}</span>
                      {partners.map((partner) => (
                        <span
                          key={partner.id}
                          className="rounded-full px-1.5 py-0.5 text-chalk"
                          style={{ backgroundColor: `${partner.color}44` }}
                        >
                          <Avatar person={partner} /> {partner.display_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Draggable>
            </Droppable>
          );
        })}
      </div>
    </Droppable>
  );
}
