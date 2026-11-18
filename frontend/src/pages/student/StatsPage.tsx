import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useFighterClasses, useMetrics } from "../../api/hooks";
import type { Assessment, MetricGroup, MyWeek, StudentPoint, User } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import FighterClassArt from "../../components/FighterClassArt";
import { StudentPointLists } from "../../components/StudentPoints";
import { PageHeader } from "../../components/ui";
import { formatDate } from "../../lib/dates";
import { latestScores } from "../../lib/assessments";
import { scaleOf, scaleSteps } from "../../lib/scale";

const GROUPS: MetricGroup[] = ["PHYSICAL", "TECHNICAL"];

/** The student's current score on each metric and how it changed since the previous one. */
export default function StatsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const scale = scaleOf(user?.gym);
  const { data: metrics = [] } = useMetrics();
  const { data: history, isLoading } = useQuery({
    queryKey: ["me", "assessments"],
    queryFn: async () => (await api.get<Assessment[]>("/me/assessments/")).data,
  });
  const { data: week } = useQuery({
    queryKey: ["me", "week"],
    queryFn: async () => (await api.get<MyWeek>("/me/week/")).data,
  });
  // Fresh copy of the profile: the coach may have changed the level or style since login.
  const { data: me = user } = useQuery({
    queryKey: ["me", "profile"],
    queryFn: async () => (await api.get<User>("/auth/me/")).data,
  });
  const { data: points = [] } = useQuery({
    queryKey: ["me", "points"],
    queryFn: async () => (await api.get<StudentPoint[]>("/me/points/")).data,
  });
  const { data: classes = [] } = useFighterClasses();
  const fighterClass = classes.find((c) => c.id === me?.fighter_class);
  const latest = latestScores(history ?? []);
  const lastUpdate = (history ?? []).reduce<string | null>(
    (latestSoFar, a) => (a.updated_at && (!latestSoFar || a.updated_at > latestSoFar) ? a.updated_at : latestSoFar),
    null,
  );

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("stats.title")} />
      <div
        className="flex items-center gap-4 overflow-hidden rounded-xl border border-rope bg-canvas p-4"
        style={fighterClass ? { background: `radial-gradient(circle at 15% 50%, ${fighterClass.color}44, transparent 60%)` } : undefined}
      >
        {fighterClass && <FighterClassArt fighterClass={fighterClass} />}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs tracking-wider text-smoke uppercase">{t("stats.fighterStyle")}</p>
          {fighterClass ? (
            <h2 className="font-display text-2xl tracking-wide uppercase" style={{ color: fighterClass.color }}>
              {fighterClass.name}
            </h2>
          ) : (
            <p className="text-sm text-smoke">{t("stats.noStyle")}</p>
          )}
          <p className="text-sm">
            <span className="text-smoke">{t("stats.level")}:</span>{" "}
            <span className="font-semibold">{t(`level.${me?.level || "UNSPECIFIED"}`)}</span>
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-rope bg-canvas p-5">
        <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">{t("stats.points")}</h2>
        <StudentPointLists points={points} />
      </div>
      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {history && history.length === 0 && (
        <div className="rounded-xl border border-rope bg-canvas p-8 text-center text-smoke">{t("stats.empty")}</div>
      )}
      {lastUpdate && (
        <p className="-mt-4 text-sm text-smoke first-letter:uppercase">
          {t("stats.updatedAt", { date: formatDate(lastUpdate.slice(0, 10), i18n.language, { day: "numeric", month: "long", year: "numeric" }) })}
        </p>
      )}
      {history &&
        history.length > 0 &&
        GROUPS.map((group) => {
          const groupMetrics = metrics.filter((m) => m.group === group && latest.has(m.id));
          if (!groupMetrics.length) return null;
          return (
            <div key={group} className="rounded-xl border border-rope bg-canvas p-5">
              <h2 className="mb-4 font-display text-2xl tracking-wide uppercase">{t(`metricGroup.${group}`)}</h2>
              <ul className="flex flex-col gap-4">
                {groupMetrics.map((metric) => {
                  const { score, delta } = latest.get(metric.id)!;
                  return (
                    <li key={metric.id}>
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="font-semibold">{metric.name}</span>
                        <span className="flex-1" />
                        {delta !== null && delta !== 0 && (
                          <span className={`text-xs ${delta > 0 ? "text-belt" : "text-glove"}`}>
                            {delta > 0 ? `▲ ${t("stats.delta_up", { count: delta })}` : `▼ ${t("stats.delta_down", { count: delta })}`}
                          </span>
                        )}
                        <span className="font-display text-2xl">{score}/{scale.max}</span>
                      </div>
                      <div className="flex gap-1" role="meter" aria-valuemin={scale.min} aria-valuemax={scale.max} aria-valuenow={score} aria-label={metric.name}>
                        {scaleSteps(1, scale.max, score).map((step) => (
                          <span
                            key={step}
                            className="h-2.5 flex-1 rounded-full"
                            style={{ backgroundColor: step <= score ? metric.color : "var(--color-rope)" }}
                          />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      {week && week.notes.length > 0 && (
        <div className="rounded-xl border border-rope bg-canvas p-5">
          <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">{t("student.coachNotes")}</h2>
          <ul className="flex flex-col gap-2">
            {week.notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-ring p-3 text-sm">
                <p className="whitespace-pre-line">{note.body}</p>
                <p className="mt-1 text-xs text-smoke">
                  {formatDate(note.created_at.slice(0, 10), i18n.language, { day: "numeric", month: "short" })} ·{" "}
                  {note.author_name}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
