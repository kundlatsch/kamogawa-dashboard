import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../../../api/client";
import { useCategories, useDrills, useFighterClasses, useMetrics, useSessionBlocks, useSessions, useStudents } from "../../../api/hooks";
import type { Assessment, Assignment, CheckIn, SessionBlock, TrainingSession, User } from "../../../api/types";
import FighterTraits from "../../../components/FighterTraits";
import { strengthsAndWeaknesses } from "../../../lib/fighterProfile";
import DrillCard from "../../../components/DrillCard";
import { KindBadge, StatusBadge } from "../../../components/SessionBadge";
import { Button, PageHeader } from "../../../components/ui";
import { columnAssignments, columnStudentId, dropTargets, moveBefore, studentColumn } from "../../../lib/board";
import { addDays, blockStartTime, formatDate, toISODate, todayISO } from "../../../lib/dates";
import AssignmentModal, { type AssignmentChanges } from "./AssignmentModal";
import BoardColumn from "./BoardColumn";
import CheckInPanel from "./CheckInPanel";
import { Draggable, type DragData, type DropData } from "./dnd";
import Avatar from "../../../components/Avatar";

export default function BoardPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const from = toISODate(addDays(new Date(), -60));
  const to = toISODate(addDays(new Date(), 60));
  const { data: sessions = [] } = useSessions(from, to);
  const { data: students = [] } = useStudents();
  const { data: drills = [] } = useDrills();
  const { data: categories = [] } = useCategories();
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categoryProps = (categoryId: number | null) => {
    const category = categoryId == null ? undefined : categoriesById.get(categoryId);
    return { categoryName: category?.name, categoryColor: category?.color };
  };
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const { data: blocks = [] } = useSessionBlocks();
  const [blockChoice, setBlockChoice] = useState<number | "none" | null>(null);

  const today = todayISO();
  const nextDate = sessions.find((s) => s.date >= today && s.status !== "CANCELLED")?.date;
  const requestedId = Number(params.get("session")) || null;
  // Planejamento works on the next class; other days are opened from the calendar (?session=).
  const upcoming = sessions.filter((s) => s.date >= today && s.status !== "CANCELLED");
  const session = sessions.find((s) => s.id === requestedId) ?? upcoming[0];

  useEffect(() => {
    if (session && session.id !== requestedId) setParams({ session: String(session.id) }, { replace: true });
  }, [session, requestedId, setParams]);

  const assignmentsKey = ["assignments", session?.id];
  const { data: assignments = [] } = useQuery({
    queryKey: assignmentsKey,
    enabled: Boolean(session),
    queryFn: async () => (await api.get<Assignment[]>("/assignments/", { params: { session: session!.id } })).data,
  });

  const hasUnblocked = assignments.some((a) => a.block === null);
  const activeBlock: number | "none" =
    blockChoice !== null && (blockChoice !== "none" || hasUnblocked) ? blockChoice : (blocks[0]?.id ?? "none");
  // The board shows one block of the class at a time; new drills land in that block.
  const blockAssignments = assignments.filter((a) => (activeBlock === "none" ? a.block === null : a.block === activeBlock));

  const { data: checkIns = [] } = useQuery({
    queryKey: ["checkins", session?.id],
    enabled: Boolean(session),
    queryFn: async () => (await api.get<CheckIn[]>("/checkins/", { params: { session: session!.id } })).data,
    refetchInterval: 60_000,
  });
  const checkInOf = (studentId: number) => checkIns.find((c) => c.student === studentId);

  // Exercises are planned for whoever confirmed presence (the coach can add students to the list).
  const presentStudents = students.filter((s) => checkIns.some((c) => c.student === s.id));
  const { data: fighterClasses = [] } = useFighterClasses();
  const { data: metrics = [] } = useMetrics();
  const { data: allScores = [] } = useQuery({
    queryKey: ["assessments", "all"],
    queryFn: async () => (await api.get<Assessment[]>("/assessments/")).data,
  });
  const traitsOf = (student: User) => {
    const { strengths, weaknesses } = strengthsAndWeaknesses(
      allScores.filter((a) => a.student === student.id),
      metrics,
    );
    return (
      <FighterTraits
        student={student}
        fighterClass={fighterClasses.find((c) => c.id === student.fighter_class)}
        strengths={strengths}
        weaknesses={weaknesses}
      />
    );
  };

  const studentsById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const visibleDrills = drills.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const refresh = () => queryClient.invalidateQueries({ queryKey: assignmentsKey });

  const mutation = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSettled: refresh,
  });
  const run = (fn: () => Promise<unknown>) => mutation.mutate(fn);

  const publish = useMutation({
    mutationFn: async (action: "publish" | "unpublish") => api.post(`/sessions/${session!.id}/${action}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const convert = useMutation({
    mutationFn: async (kind: "SPARRING" | "REGULAR") => api.post(`/sessions/${session!.id}/convert/`, { kind }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(event: DragStartEvent) {
    setDragging(event.active.data.current as DragData);
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const source = event.active.data.current as DragData | undefined;
    const target = event.over?.data.current as DropData | undefined;
    if (!source || !target || !session) return;
    const targetStudent = columnStudentId(target.column);

    if (source.type === "drill") {
      const body =
        targetStudent === null
          ? { is_broadcast: true, participants: [] }
          : { is_broadcast: false, participants: dropTargets(targetStudent, selected) };
      const block = activeBlock === "none" ? null : activeBlock;
      run(() => api.post("/assignments/", { session: session.id, drill: source.drillId, block, ...body }));
      return;
    }

    if (source.type === "student" && target.type === "card") {
      const assignment = assignments.find((a) => a.id === target.assignmentId);
      if (assignment && !assignment.is_broadcast && !assignment.participants.includes(source.studentId)) {
        run(() => api.post(`/assignments/${assignment.id}/add-participant/`, { student: source.studentId }));
      }
      return;
    }

    if (source.type === "assignment") {
      const assignment = assignments.find((a) => a.id === source.assignmentId);
      if (!assignment) return;
      if (target.column === source.column) {
        if (target.type === "card" && target.assignmentId !== assignment.id) {
          const ids = moveBefore(assignments, assignment.id, target.assignmentId);
          queryClient.setQueryData<Assignment[]>(assignmentsKey, (current = []) =>
            current.map((a) => ({ ...a, order: ids.indexOf(a.id) })),
          );
          run(() => api.post("/assignments/reorder/", { session: session.id, ids }));
        }
        return;
      }
      // Dropped on another student: share the drill with them (pair/group).
      if (targetStudent !== null && !assignment.is_broadcast && !assignment.participants.includes(targetStudent)) {
        run(() => api.post(`/assignments/${assignment.id}/add-participant/`, { student: targetStudent }));
      }
    }
  }

  function removeFromColumn(assignment: Assignment, column: ReturnType<typeof studentColumn> | "broadcast") {
    const studentId = columnStudentId(column);
    if (studentId === null) run(() => api.delete(`/assignments/${assignment.id}/`));
    else run(() => api.post(`/assignments/${assignment.id}/remove-participant/`, { student: studentId }));
  }

  function saveAssignment(assignment: Assignment, changes: AssignmentChanges) {
    const payload = assignment.is_broadcast ? { ...changes, participants: [] } : changes;
    run(() => api.patch(`/assignments/${assignment.id}/`, payload));
    setEditing(null);
  }

  const toggleSelect = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const overlay = (() => {
    if (!dragging) return null;
    if (dragging.type === "drill") {
      const drill = drills.find((d) => d.id === dragging.drillId);
      return drill && <DrillCard drill={drill} compact {...categoryProps(drill.category)} />;
    }
    if (dragging.type === "student") {
      const student = studentsById.get(dragging.studentId);
      return student && <Avatar person={student} size="lg" ring />;
    }
    const assignment = assignments.find((a) => a.id === dragging.assignmentId);
    return (
      assignment && (
        <DrillCard drill={assignment.drill_detail} compact {...categoryProps(assignment.drill_detail.category)} />
      )
    );
  })();

  if (!session) {
    return (
      <section>
        <PageHeader title={t("nav.board")} />
        <p className="text-smoke">
          {t("board.noSessions")} <Link className="text-glove underline" to="/calendar">{t("nav.calendar")}</Link>
        </p>
      </section>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <section className="flex flex-col gap-4">

        {session && (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl tracking-wide uppercase first-letter:uppercase">
              {formatDate(session.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
            </h1>
            <KindBadge kind={session.kind} />
            <StatusBadge status={session.status} />
            {session.title && <span className="text-smoke">{session.title}</span>}
            {requestedId === session.id && session.date !== nextDate && (
              <Link to="/" className="text-xs text-smoke underline hover:text-chalk">
                {t("board.backToNext")}
              </Link>
            )}
            <Link to="/calendar" className="text-xs text-smoke underline hover:text-chalk">
              {t("board.otherClasses")}
            </Link>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant={session.kind === "SPARRING" ? "ghost" : "danger"}
                disabled={convert.isPending}
                onClick={() => {
                  const toSparring = session.kind !== "SPARRING";
                  const question =
                    toSparring && session.status === "PUBLISHED"
                      ? t("board.confirmSparringPublished")
                      : toSparring
                        ? t("board.confirmSparring")
                        : t("board.confirmRegular");
                  if (window.confirm(question)) convert.mutate(toSparring ? "SPARRING" : "REGULAR");
                }}
              >
                {session.kind === "SPARRING" ? t("board.toRegular") : `🥊 ${t("board.toSparring")}`}
              </Button>
              {session.status === "DRAFT" ? (
                <Button
                  onClick={() => publish.mutate("publish")}
                  disabled={publish.isPending}
                  className={session.kind === "SPARRING" ? "!bg-blood hover:!bg-blood-dark" : ""}
                >
                  {session.kind === "SPARRING" ? `🥊 ${t("board.publishSparring")}` : t("board.publish")}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => publish.mutate("unpublish")} disabled={publish.isPending}>
                  {t("board.unpublish")}
                </Button>
              )}
            </div>
            {mutation.isPending && <span className="text-xs text-smoke">{t("board.saving")}</span>}
            {mutation.isError && <span className="text-xs text-glove">{t("board.error")}</span>}
          </div>
        )}
        {session && <SessionObjective key={session.id} session={session} />}

        <p className="text-sm text-smoke">{t("board.howTo")}</p>
        {session && (
          <CheckInPanel session={session} checkIns={checkIns} students={students} />
        )}
        {session && (
          <BlockTabs
            blocks={blocks}
            assignments={assignments}
            active={activeBlock}
            showUnblocked={hasUnblocked}
            sessionStart={session.start_time}
            onSelect={setBlockChoice}
          />
        )}
        {selected.size > 1 && (
          <p className="rounded-lg border border-glove bg-glove/10 p-2 text-sm">
            {t("board.groupSelected", { count: selected.size })}{" "}
            <button className="underline" onClick={() => setSelected(new Set())}>
              {t("board.clearSelection")}
            </button>
          </p>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          <aside className="flex shrink-0 flex-col gap-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-60">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl tracking-wide uppercase">{t("nav.drills")}</h2>
              <Link to="/drills" className="text-xs text-smoke hover:text-glove">
                + {t("drills.new")}
              </Link>
            </div>
            <input
              placeholder={t("drills.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-md border border-rope bg-canvas px-3 py-2 text-sm"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-y-auto lg:pr-1">
              {visibleDrills.map((drill) => (
                <Draggable key={drill.id} id={`drill:${drill.id}`} data={{ type: "drill", drillId: drill.id }} className="w-48 shrink-0 cursor-grab lg:w-auto">
                  <DrillCard drill={drill} compact {...categoryProps(drill.category)} />
                </Draggable>
              ))}
              {drills.length === 0 && <p className="text-sm text-smoke">{t("drills.empty")}</p>}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-4">
            <BoardColumn
              column="broadcast"
              assignments={columnAssignments(blockAssignments, "broadcast")}
              studentsById={studentsById}
              onOpen={setEditing}
              onRemove={(a) => removeFromColumn(a, "broadcast")}
            />
            {presentStudents.map((student: User) => {
              const column = studentColumn(student.id);
              return (
                <BoardColumn
                  key={student.id}
                  column={column}
                  student={student}
                  assignments={columnAssignments(blockAssignments, column)}
                  studentsById={studentsById}
                  checkIn={checkInOf(student.id)}
                  traits={traitsOf(student)}
                  selected={selected.has(student.id)}
                  onToggleSelect={() => toggleSelect(student.id)}
                  onOpen={setEditing}
                  onRemove={(a) => removeFromColumn(a, column)}
                />
              );
            })}
            {presentStudents.length === 0 && (
              <p className="max-w-60 p-4 text-sm text-smoke">{t("board.noCheckedInStudents")}</p>
            )}
          </div>
        </div>
      </section>

      <DragOverlay dropAnimation={null}>{overlay ? <div className="w-56 rotate-2 opacity-90">{overlay}</div> : null}</DragOverlay>

      {editing && (
        <AssignmentModal
          assignment={editing}
          students={students}
          onClose={() => setEditing(null)}
          onSave={(changes) => saveAssignment(editing, changes)}
          onDelete={() => {
            run(() => api.delete(`/assignments/${editing.id}/`));
            setEditing(null);
          }}
        />
      )}
    </DndContext>
  );
}

/** The class objective: inherited from the week's microcycle unless the coach overrides it. */
function SessionObjective({ session }: { session: TrainingSession }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(session.objective_override);
  const save = useMutation({
    mutationFn: async (objective_override: string) => api.patch(`/sessions/${session.id}/`, { objective_override }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(value.trim());
        }}
      >
        <input
          autoFocus
          aria-label={t("board.objective")}
          placeholder={t("board.objectivePlaceholder")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-rope bg-ring px-3 py-1.5 text-sm text-chalk outline-none focus:border-glove"
        />
        <Button type="submit" disabled={save.isPending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          {t("common.cancel")}
        </Button>
      </form>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-belt">🎯 {t("board.objective")}:</span>
      <span className={session.objective ? "" : "text-smoke"}>{session.objective || t("board.noObjective")}</span>
      {!session.objective_override && session.objective && (
        <span className="text-xs text-smoke">({t("board.fromWeek")})</span>
      )}
      <button className="text-xs text-smoke underline hover:text-chalk" onClick={() => setEditing(true)}>
        {t("board.changeObjective")}
      </button>
    </p>
  );
}

const MODE_ICONS = { COLLECTIVE: "📣", INDIVIDUAL: "🧍", PAIRS: "🤝" } as const;

/** One tab per class block, in order, with its fixed time and how many drills it holds. */
function BlockTabs({
  blocks,
  assignments,
  active,
  showUnblocked,
  sessionStart,
  onSelect,
}: {
  blocks: SessionBlock[];
  assignments: Assignment[];
  active: number | "none";
  showUnblocked: boolean;
  sessionStart: string | null;
  onSelect: (block: number | "none") => void;
}) {
  const { t } = useTranslation();
  const current = blocks.find((b) => b.id === active);
  const tab = (key: number | "none", label: string, color: string, extra: string | null, count: number) => (
    <button
      key={key}
      role="tab"
      aria-selected={active === key}
      onClick={() => onSelect(key)}
      className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
        active === key ? "border-chalk bg-rope text-chalk" : "border-rope text-smoke hover:text-chalk"
      }`}
      style={{ borderBottom: `3px solid ${color}` }}
    >
      <span className="font-semibold">{label}</span>
      {extra && <span className="text-xs">{extra}</span>}
      <span className="rounded-full bg-ring px-1.5 text-xs">{count}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label={t("board.blocks")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {blocks.map((block) =>
          tab(
            block.id,
            `${MODE_ICONS[block.mode]} ${block.name}`,
            block.color,
            block.mode === "COLLECTIVE" ? blockStartTime(sessionStart, block.start_offset_minutes) : null,
            assignments.filter((a) => a.block === block.id).length,
          ),
        )}
        {showUnblocked &&
          tab("none", t("board.noBlock"), "transparent", null, assignments.filter((a) => a.block === null).length)}
      </div>
      <p className="text-xs text-smoke">
        {current ? t(`board.blockMode.${current.mode}`) : t("board.noBlockHint")}
      </p>
    </div>
  );
}
