import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { api } from "../../api/client";
import { useFighterClasses, useMetrics } from "../../api/hooks";
import { LEVELS, type Assessment, type CoachNote, type FighterClass, type Level, type LeaderboardEntry, type User } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import Avatar from "../../components/Avatar";
import FighterClassArt from "../../components/FighterClassArt";
import FocusTextField from "../../components/FocusTextField";
import { EditableStudentPoints } from "../../components/StudentPoints";
import { latestScores } from "../../lib/assessments";
import { scaleOf } from "../../lib/scale";
import { formatDate } from "../../lib/dates";

const card = "rounded-xl border border-rope bg-canvas p-5";
const heading = "mb-3 font-display text-2xl tracking-wide uppercase";

/** Everything the coach knows about one student, linking out to where each part is edited. */
export default function StudentProfilePage() {
  const { t, i18n } = useTranslation();
  const { user: coach } = useAuth();
  const id = Number(useParams().studentId);
  const scaleMax = scaleOf(coach?.gym).max;

  const { data: student, isError } = useQuery({
    queryKey: ["/students/", id],
    queryFn: async () => (await api.get<User>(`/students/${id}/`)).data,
  });
  const { data: board = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => (await api.get<LeaderboardEntry[]>("/leaderboard/")).data,
  });
  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments", "student", id],
    queryFn: async () => (await api.get<Assessment[]>("/assessments/", { params: { student: id } })).data,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["coach-notes", id],
    queryFn: async () => (await api.get<CoachNote[]>("/coach-notes/", { params: { student: id } })).data,
  });
  const { data: classes = [] } = useFighterClasses();
  const { data: metrics = [] } = useMetrics();

  if (isError) return <p className="text-glove">{t("studentProfile.notFound")}</p>;
  if (!student) return <p className="text-smoke">{t("common.loading")}</p>;

  const entry = board.find((e) => e.student.id === id);
  const fighterClass = classes.find((c) => c.id === student.fighter_class);
  const secondaryClass = classes.find((c) => c.id === student.secondary_fighter_class);
  const latest = latestScores(assessments);
  const short = (value: string) => formatDate(value.slice(0, 10), i18n.language, { day: "numeric", month: "short" });

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link to="/students" className="text-sm text-smoke hover:text-chalk">
        ← {t("nav.students")}
      </Link>

      <div className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center`}>
        <Avatar person={student} size="lg" ring />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-display text-4xl tracking-wide uppercase">{student.display_name}</h1>
          <p className="text-sm text-smoke">
            @{student.username}
            {student.handedness !== "UNSPECIFIED" && ` · ${t(`handedness.${student.handedness}`)}`}
          </p>
          {student.limitations && <p className="text-sm text-belt">⚠ {student.limitations}</p>}
          <LevelField student={student} />
          <WeeklyClassesField student={student} />
          {entry && (
            <>
              <p className="text-xs text-smoke">
                ✓ {t("ranking.attended", { count: entry.attended })} ·{" "}
                <span className={entry.absences ? "text-glove" : ""}>✗ {t("ranking.absences", { count: entry.absences })}</span>
              </p>
            </>
          )}
        </div>
      </div>

      <div className={card} style={fighterClass ? { background: `radial-gradient(circle at 10% 50%, ${fighterClass.color}33, transparent 60%)` } : undefined}>
        <div className="flex items-baseline justify-between">
          <h2 className={heading}>{t("studentProfile.fighterStyle")}</h2>
          <Link to="/settings?tab=fighters" className="text-xs text-smoke hover:text-glove">
            {t("studentProfile.manageStyles")} →
          </Link>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {fighterClass && <FighterClassArt fighterClass={fighterClass} size="md" />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {fighterClass ? (
              <div>
                <p className="font-display text-2xl tracking-wide uppercase" style={{ color: fighterClass.color }}>
                  {fighterClass.name}
                </p>
                {fighterClass.description && <p className="text-sm text-smoke">{fighterClass.description}</p>}
              </div>
            ) : (
              <p className="text-sm text-smoke">{t("studentProfile.noStyle")}</p>
            )}
            {secondaryClass && (
              <div className="flex items-center gap-3 rounded-lg border border-rope bg-ring/40 p-2" title={secondaryClass.description}>
                <FighterClassArt fighterClass={secondaryClass} size="sm" />
                <div className="min-w-0">
                  <p className="text-[10px] tracking-wider text-smoke uppercase">{t("studentProfile.secondaryStyle")}</p>
                  <p className="font-display text-lg leading-tight tracking-wide uppercase" style={{ color: secondaryClass.color }}>
                    {secondaryClass.name}
                  </p>
                  {secondaryClass.description && <p className="text-xs text-smoke">{secondaryClass.description}</p>}
                </div>
              </div>
            )}
            <FighterStyleFields
              student={student}
              classes={classes.filter(
                (c) => !c.archived || c.id === student.fighter_class || c.id === student.secondary_fighter_class,
              )}
            />
          </div>
        </div>
      </div>

      <div className={card}>
        <h2 className={heading}>{t("studentProfile.points")}</h2>
        <p className="-mt-2 mb-3 text-xs text-smoke">{t("studentProfile.pointsHint")}</p>
        <EditableStudentPoints studentId={student.id} />
      </div>

      <div className={card}>
        <h2 className={heading}>{t("week.focuses")}</h2>
        <p className="-mt-2 mb-3 text-xs text-smoke">{t("studentProfile.focusesHint")}</p>
        <FocusTextField student={student} />
      </div>

      <div className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className={heading}>{t("nav.assessments")}</h2>
          <Link to="/assessments" className="text-xs text-smoke hover:text-glove">
            {t("studentProfile.editScores")} →
          </Link>
        </div>
        {latest.size === 0 ? (
          <p className="text-sm text-smoke">{t("studentProfile.noScores")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metrics
              .filter((m) => latest.has(m.id))
              .map((metric) => {
                const { score, delta } = latest.get(metric.id)!;
                return (
                  <li key={metric.id} className="rounded-lg bg-ring p-2 text-sm" style={{ borderLeft: `3px solid ${metric.color}` }}>
                    <p className="text-smoke">{metric.name}</p>
                    <p className="font-display text-2xl">
                      {score}/{scaleMax}
                      {delta ? (
                        <span className={`ml-1 font-sans text-xs ${delta > 0 ? "text-belt" : "text-glove"}`}>
                          {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      <div className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className={heading}>{t("week.notes")}</h2>
          <Link to="/week" className="text-xs text-smoke hover:text-glove">
            {t("studentProfile.addNote")} →
          </Link>
        </div>
        {notes.length === 0 && <p className="text-sm text-smoke">{t("week.noNotes")}</p>}
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-ring p-3 text-sm">
              <p className="whitespace-pre-line">{note.body}</p>
              <p className="mt-1 text-xs text-smoke">
                {short(note.created_at)} · {note.author_name} ·{" "}
                {note.visible_to_student ? t("week.visibleToStudent") : t("week.hiddenFromStudent")}
              </p>
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}

const selectClass = "rounded-md border border-rope bg-ring px-2 py-1 text-sm text-chalk";

/** Patch one coach-only field of the student and refresh the profile. */
function useStudentPatch(student: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fields: Partial<User>) => api.patch(`/students/${student.id}/`, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/students/"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

/** Skill level; saved as soon as the coach picks it. */
function LevelField({ student }: { student: User }) {
  const { t } = useTranslation();
  const save = useStudentPatch(student);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-smoke">{t("studentProfile.level")}</span>
      <select
        value={student.level}
        disabled={save.isPending}
        onChange={(event) => save.mutate({ level: event.target.value as Level })}
        className={selectClass}
      >
        <option value="">{t("level.UNSPECIFIED")}</option>
        {LEVELS.map((level) => (
          <option key={level} value={level}>
            {t(`level.${level}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Main and optional secondary fighter style (gym fighter classes); saved as soon as the coach picks one. */
function FighterStyleFields({ student, classes }: { student: User; classes: FighterClass[] }) {
  const { t } = useTranslation();
  const save = useStudentPatch(student);
  const toId = (value: string) => (value ? Number(value) : null);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="flex flex-col gap-1 text-xs text-smoke">
        {t("studentProfile.mainStyle")}
        <select
          aria-label={t("studentProfile.styleFor", { name: student.display_name })}
          value={student.fighter_class ?? ""}
          disabled={save.isPending}
          onChange={(event) => save.mutate({ fighter_class: toId(event.target.value) })}
          className={`${selectClass} w-full sm:w-56`}
        >
          <option value="">{t("studentProfile.noStyleOption")}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-smoke">
        {t("studentProfile.secondaryStyle")}
        <select
          aria-label={t("studentProfile.secondaryStyleFor", { name: student.display_name })}
          value={student.secondary_fighter_class ?? ""}
          disabled={save.isPending || student.fighter_class === null}
          onChange={(event) => save.mutate({ secondary_fighter_class: toId(event.target.value) })}
          className={`${selectClass} w-full disabled:opacity-50 sm:w-56`}
        >
          <option value="">{t("studentProfile.noSecondaryOption")}</option>
          {classes
            .filter((c) => c.id !== student.fighter_class)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

/** Classes a week the student committed to; the Sunday routine turns the gap into absences. */
function WeeklyClassesField({ student }: { student: User }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(student.weekly_classes == null ? "" : String(student.weekly_classes));
  const save = useMutation({
    mutationFn: async () =>
      api.patch(`/students/${student.id}/`, { weekly_classes: value === "" ? null : Number(value) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/students/"] }),
  });
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <label className="flex items-center gap-2">
        <span className="text-smoke">{t("profile.weeklyClasses")}</span>
        <input
          type="number"
          min={0}
          max={14}
          value={value}
          placeholder="—"
          onChange={(event) => setValue(event.target.value)}
          className="w-16 rounded-md border border-rope bg-ring px-2 py-1 text-chalk"
        />
      </label>
      <button type="submit" className="text-xs text-smoke underline hover:text-chalk" disabled={save.isPending}>
        {t("common.save")}
      </button>
      {save.isSuccess && <span className="text-xs text-belt">{t("settings.saved")}</span>}
    </form>
  );
}
