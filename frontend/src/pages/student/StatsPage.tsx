import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useMetrics } from "../../api/hooks";
import type { Assessment, MetricGroup } from "../../api/types";
import { PageHeader } from "../../components/ui";
import { formatDate } from "../../lib/dates";
import { latestScores } from "../../lib/assessments";

const GROUPS: MetricGroup[] = ["PHYSICAL", "TECHNICAL"];

/** The student's latest score on each metric (1–5) and how it changed since the month before. */
export default function StatsPage() {
  const { t, i18n } = useTranslation();
  const { data: metrics = [] } = useMetrics();
  const { data: history, isLoading } = useQuery({
    queryKey: ["me", "assessments"],
    queryFn: async () => (await api.get<Assessment[]>("/me/assessments/")).data,
  });
  const latest = latestScores(history ?? []);
  const lastPeriod = history?.length ? history[history.length - 1].period : null;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("stats.title")} />
      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {history && history.length === 0 && (
        <div className="rounded-xl border border-rope bg-canvas p-8 text-center text-smoke">{t("stats.empty")}</div>
      )}
      {lastPeriod && (
        <p className="-mt-4 text-sm text-smoke first-letter:uppercase">
          {t("stats.assessedIn", { month: formatDate(lastPeriod, i18n.language, { month: "long", year: "numeric" }) })}
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
                        <span className="font-display text-2xl">{score}/5</span>
                      </div>
                      <div className="flex gap-1" role="meter" aria-valuemin={1} aria-valuemax={5} aria-valuenow={score} aria-label={metric.name}>
                        {[1, 2, 3, 4, 5].map((step) => (
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
    </section>
  );
}
