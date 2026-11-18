import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useMetrics, useStudents } from "../../api/hooks";
import type { Assessment, Metric, MetricGroup, User } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import Avatar from "../../components/Avatar";
import { PageHeader } from "../../components/ui";
import { todayISO } from "../../lib/dates";
import { latestScores } from "../../lib/assessments";
import { scaleOf, scaleSteps } from "../../lib/scale";
import StudentLink from "../../components/StudentLink";

const GROUPS: MetricGroup[] = ["PHYSICAL", "TECHNICAL"];

/**
 * Coach grid: one row per student, one column per metric, each cell the student's current score.
 * There is no month to pick: a change is saved on the current month by the API, and older months
 * stay as the student's history (the evolution shown on their stats page).
 */
export default function AssessmentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const scale = scaleOf(user?.gym);
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const { data: metrics = [] } = useMetrics();
  const key = ["assessments", "all"];
  const { data: scores = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<Assessment[]>("/assessments/")).data,
  });

  const set = useMutation({
    mutationFn: async (input: { student: number; metric: number; score: number | null }) =>
      api.post("/assessments/set/", input),
    onMutate: (input) => {
      // Optimistic: the grid reacts at once; the refetch below settles the real state.
      const period = `${todayISO().slice(0, 7)}-01`;
      queryClient.setQueryData<Assessment[]>(key, (current = []) => {
        const sameCell = (a: Assessment) => a.student === input.student && a.metric === input.metric;
        if (input.score === null) return current.filter((a) => !sameCell(a));
        const rest = current.filter((a) => !(sameCell(a) && a.period === period));
        return [...rest, { id: -1, student: input.student, metric: input.metric, period, score: input.score, notes: "", updated_at: "" }];
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["assessments"] }),
  });

  const current = new Map(
    students.map((student) => [student.id, latestScores(scores.filter((a) => a.student === student.id))]),
  );
  const scoreOf = (student: number, metric: number) => current.get(student)?.get(metric)?.score ?? null;
  const ordered = GROUPS.flatMap((group) => metrics.filter((m) => m.group === group));

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("assessments.title")} />
      <p className="-mt-4 text-sm text-smoke">{t("assessments.hint", scale)}</p>
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
                    <StudentLink id={student.id}>
                      <Avatar person={student} /> {student.display_name}
                    </StudentLink>
                  </th>
                  {ordered.map((metric, index) => (
                    <td
                      key={metric.id}
                      className={`p-1 text-center ${
                        index === 0 || ordered[index - 1].group !== metric.group ? "border-l border-rope" : ""
                      }`}
                    >
                      <ScoreCell
                        min={scale.min}
                        max={scale.max}
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
  min,
  max,
  student,
  metric,
  value,
  onChange,
}: {
  min: number;
  max: number;
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
      style={value !== null ? { backgroundColor: `${metric.color}${Math.round(Math.min(Math.max((value - min + 1) / (max - min + 1), 0.1), 1) * 0.65 * 255).toString(16).padStart(2, "0")}` } : undefined}
    >
      <option value="">{t("assessments.noScore")}</option>
      {scaleSteps(min, max, value).map((score) => (
        <option key={score} value={score}>
          {score}
        </option>
      ))}
    </select>
  );
}
