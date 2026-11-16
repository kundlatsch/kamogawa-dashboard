import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { api } from "../../api/client";
import { useFighterClasses, useMetrics } from "../../api/hooks";
import type { Assessment, CoachNote, LeaderboardEntry, User, WeeklyFocus } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import Avatar from "../../components/Avatar";
import FighterClassArt from "../../components/FighterClassArt";
import { latestScores } from "../../lib/assessments";
import { scaleOf } from "../../lib/scale";
import { formatDate, startOfWeek, toISODate } from "../../lib/dates";

const card = "rounded-xl border border-rope bg-canvas p-5";
const heading = "mb-3 font-display text-2xl tracking-wide uppercase";

/** Everything the coach knows about one student, linking out to where each part is edited. */
export default function StudentProfilePage() {
  const { t, i18n } = useTranslation();
  const { user: coach } = useAuth();
  const id = Number(useParams().studentId);
  const week = toISODate(startOfWeek(new Date()));
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
  const { data: focuses = [] } = useQuery({
    queryKey: ["weekly-focuses", week],
    queryFn: async () => (await api.get<WeeklyFocus[]>("/weekly-focuses/", { params: { week } })).data,
  });
  const { data: classes = [] } = useFighterClasses();
  const { data: metrics = [] } = useMetrics();

  if (isError) return <p className="text-glove">{t("studentProfile.notFound")}</p>;
  if (!student) return <p className="text-smoke">{t("common.loading")}</p>;

  const entry = board.find((e) => e.student.id === id);
  const fighterClass = classes.find((c) => c.id === student.fighter_class);
  const latest = latestScores(assessments);
  const myFocuses = focuses.filter((f) => f.student === id);
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
          {entry && (
            <>
              <p className="text-xs text-smoke">
                ✓ {t("ranking.attended", { count: entry.attended })} ·{" "}
                <span className={entry.absences ? "text-glove" : ""}>✗ {t("ranking.absences", { count: entry.absences })}</span>
              </p>
            </>
          )}
        </div>
        {fighterClass && (
          <Link to="/ranking" className="flex flex-col items-center gap-1 text-center text-xs hover:text-glove">
            <FighterClassArt fighterClass={fighterClass} size="md" />
            {fighterClass.name}
          </Link>
        )}
      </div>

      <div className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className={heading}>{t("week.focuses")}</h2>
          <Link to="/week" className="text-xs text-smoke hover:text-glove">
            {t("studentProfile.editInWeek")} →
          </Link>
        </div>
        {myFocuses.length === 0 ? (
          <p className="text-sm text-smoke">{t("studentProfile.noFocuses")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {myFocuses.map((focus) => (
              <li
                key={focus.id}
                className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: focus.focus_detail.color }}
              >
                {focus.position}. {focus.focus_detail.name}
              </li>
            ))}
          </ul>
        )}
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
