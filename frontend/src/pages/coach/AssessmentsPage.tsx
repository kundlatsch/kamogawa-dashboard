import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useMetrics, useStudents } from "../../api/hooks";
import type { Assessment, Metric, MetricGroup, User } from "../../api/types";
import Avatar from "../../components/Avatar";
import { PageHeader } from "../../components/ui";
import { todayISO } from "../../lib/dates";

const GROUPS: MetricGroup[] = ["PHYSICAL", "TECHNICAL"];
const SCORES = [1, 2, 3, 4, 5];

/** "2026-11" → "2026-11-01"; the API stores a month as its first day. */
const monthPeriod = (month: string) => `${month}-01`;

/** Coach grid: one row per student, one column per metric, a 1–5 score per cell for the chosen month. */
export default function AssessmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const period = monthPeriod(month);
  const { data: students = [] } = useStudents();
  const { data: metrics = [] } = useMetrics();
  const key = ["assessments", period];
  const { data: scores = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<Assessment[]>("/assessments/", { params: { period } })).data,
  });

  const set = useMutation({
    mutationFn: async (input: { student: number; metric: number; score: number | null }) =>
      api.post("/assessments/set/", { ...input, period }),
    onMutate: (input) => {
      // Optimistic: the grid reacts at once; the refetch below settles the real state.
      queryClient.setQueryData<Assessment[]>(key, (current = []) => {
        const rest = current.filter((a) => !(a.student === input.student && a.metric === input.metric));
        return input.score === null
          ? rest
          : [...rest, { id: -1, student: input.student, metric: input.metric, period, score: input.score, notes: "", updated_at: "" }];
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const scoreOf = (student: number, metric: number) =>
    scores.find((a) => a.student === student && a.metric === metric)?.score ?? null;
  const ordered = GROUPS.flatMap((group) => metrics.filter((m) => m.group === group));

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("assessments.title")}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-smoke">{t("assessments.month")}</span>
            <input
              type="month"
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
              className="rounded-md border border-rope bg-ring px-3 py-1.5 text-chalk"
            />
          </label>
        }
      />
      <p className="-mt-4 text-sm text-smoke">{t("assessments.hint")}</p>
      {students.length === 0 ? (
        <p className="text-smoke">{t("assessments.noStudents")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rope bg-canvas">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 z-10 bg-canvas p-3 text-left">
                  {t("assessments.student")}
                </th>
                {GROUPS.map((group) => {
                  const count = metrics.filter((m) => m.group === group).length;
                  return count ? (
                    <th key={group} colSpan={count} className="border-l border-rope px-2 pt-2 text-xs tracking-wider text-smoke uppercase">
                      {t(`metricGroup.${group}`)}
                    </th>
                  ) : null;
                })}
              </tr>
              <tr>
                {ordered.map((metric, index) => (
                  <th
                    key={metric.id}
                    className={`px-2 py-2 font-semibold whitespace-nowrap ${
                      index === 0 || ordered[index - 1].group !== metric.group ? "border-l border-rope" : ""
                    }`}
                    style={{ borderBottom: `3px solid ${metric.color}` }}
                  >
                    {metric.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-rope">
                  <th scope="row" className="sticky left-0 z-10 bg-canvas p-2 text-left font-medium whitespace-nowrap">
                    <Avatar person={student} /> {student.display_name}
                  </th>
                  {ordered.map((metric, index) => (
                    <td
                      key={metric.id}
                      className={`p-1 text-center ${
                        index === 0 || ordered[index - 1].group !== metric.group ? "border-l border-rope" : ""
                      }`}
                    >
                      <ScoreCell
                        student={student}
                        metric={metric}
                        value={scoreOf(student.id, metric.id)}
                        onChange={(score) => set.mutate({ student: student.id, metric: metric.id, score })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ScoreCell({
  student,
  metric,
  value,
  onChange,
}: {
  student: User;
  metric: Metric;
  value: number | null;
  onChange: (score: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      aria-label={t("assessments.scoreFor", { student: student.display_name, metric: metric.name })}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className="w-14 rounded-md border border-rope bg-ring py-1 text-center font-semibold text-chalk"
      style={value ? { backgroundColor: `${metric.color}${Math.round(value * 0.13 * 255).toString(16).padStart(2, "0")}` } : undefined}
    >
      <option value="">{t("assessments.noScore")}</option>
      {SCORES.map((score) => (
        <option key={score} value={score}>
          {score}
        </option>
      ))}
    </select>
  );
}
