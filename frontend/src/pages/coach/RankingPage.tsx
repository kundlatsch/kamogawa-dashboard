import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useFighterClasses } from "../../api/hooks";
import type { LeaderboardEntry } from "../../api/types";
import Avatar from "../../components/Avatar";
import FighterClassArt from "../../components/FighterClassArt";
import { PageHeader } from "../../components/ui";
import { sortLeaderboard } from "../../lib/ranking";
import StudentLink from "../../components/StudentLink";

const field = "rounded-md border border-rope bg-ring px-2 py-1.5 text-sm text-chalk outline-none focus:border-glove";

/** Coach view of the attendance ranking, where the coach also sets each student's fighter class. */
export default function RankingPage() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("ranking.title")} />
      <p className="-mt-4 text-sm text-smoke">{t("ranking.hint")}</p>
      <Leaderboard />
    </section>
  );
}

function Leaderboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => (await api.get<LeaderboardEntry[]>("/leaderboard/")).data,
  });
  const entries = sortLeaderboard(data);
  const { data: classes = [] } = useFighterClasses();
  const setClass = useMutation({
    mutationFn: async ({ student, fighterClass }: { student: number; fighterClass: number | null }) =>
      api.patch(`/students/${student}/`, { fighter_class: fighterClass }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/students/"] });
    },
  });

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {isError && <p className="text-glove">{t("ranking.loadError")}</p>}
      {!isLoading && !isError && entries.length === 0 && <p className="text-smoke">{t("ranking.empty")}</p>}
      <ol className="flex flex-col divide-y divide-rope">
        {entries.map((entry, index) => {
          const fighterClass = classes.find((c) => c.id === entry.fighter_class);
          return (
            <li key={entry.student.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className={`w-8 text-center font-display text-2xl ${index < 3 ? "text-belt" : "text-smoke"}`}>
                {index + 1}
              </span>
              {fighterClass ? <FighterClassArt fighterClass={fighterClass} size="sm" /> : <span className="w-8" />}
              <div className="flex min-w-48 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 font-semibold">
                  <StudentLink id={entry.student.id}>
                    <Avatar person={entry.student} /> {entry.student.display_name}
                  </StudentLink>
                </span>
                <span className="text-xs text-smoke">
                  <span className="font-semibold text-belt">✓ {t("ranking.attended", { count: entry.attended })}</span> ·{" "}
                  <span className={entry.absences > 0 ? "text-glove" : ""}>✗ {t("ranking.absences", { count: entry.absences })}</span>
                </span>
              </div>
              <select
                aria-label={t("ranking.classFor", { name: entry.student.display_name })}
                value={entry.fighter_class ?? ""}
                onChange={(e) =>
                  setClass.mutate({ student: entry.student.id, fighterClass: e.target.value ? Number(e.target.value) : null })
                }
                className={`${field} w-56`}
              >
                <option value="">{t("ranking.noClass")}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
