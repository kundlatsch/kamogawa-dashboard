import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useFighterClasses } from "../../api/hooks";
import type { LeaderboardEntry } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import Avatar from "../../components/Avatar";
import FighterClassArt from "../../components/FighterClassArt";
import { PageHeader } from "../../components/ui";
import { sortLeaderboard, type RankingOrder } from "../../lib/ranking";

/** The gym ranking as students see it: read-only, by attendance or completed missions. */
export default function StudentRankingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [order, setOrder] = useState<RankingOrder>("attendance");
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => (await api.get<LeaderboardEntry[]>("/ranking/")).data,
  });
  const { data: classes = [] } = useFighterClasses();
  const entries = sortLeaderboard(data, order);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={t("nav.ranking")} />
      <div role="tablist" className="flex gap-2">
        {(["attendance", "missions"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={order === key}
            onClick={() => setOrder(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold max-md:flex-1 ${
              order === key ? "bg-glove text-chalk" : "border border-rope text-smoke hover:text-chalk"
            }`}
          >
            {t(`ranking.by.${key}`)}
          </button>
        ))}
      </div>
      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {isError && <p className="text-glove">{t("ranking.loadError")}</p>}
      <ol className="flex flex-col divide-y divide-rope rounded-xl border border-rope bg-canvas px-4">
        {entries.map((entry, index) => {
          const fighterClass = classes.find((c) => c.id === entry.fighter_class);
          const me = entry.student.id === user?.id;
          return (
            <li
              key={entry.student.id}
              aria-current={me ? "true" : undefined}
              className={`flex items-center gap-3 py-3 ${me ? "font-semibold" : ""}`}
            >
              <span className={`w-7 text-center font-display text-2xl ${index < 3 ? "text-belt" : "text-smoke"}`}>
                {index + 1}
              </span>
              {fighterClass ? <FighterClassArt fighterClass={fighterClass} size="sm" /> : <span className="w-8" />}
              <div className="min-w-0 flex-1">
                <p className={`truncate ${me ? "text-glove" : ""}`}>
                  <Avatar person={entry.student} /> {entry.student.display_name}
                  {me && ` (${t("studentRanking.you")})`}
                </p>
                {/* Each stat wraps as a whole, never in the middle of "0 missões concluídas". */}
                <p className="flex flex-wrap gap-x-2 text-xs font-normal text-smoke">
                  <span className={`whitespace-nowrap ${order === "attendance" ? "text-belt" : ""}`}>
                    ✓ {t("ranking.attended", { count: entry.attended })}
                  </span>
                  <span className="whitespace-nowrap">✗ {t("ranking.absences", { count: entry.absences })}</span>
                  <span className={`whitespace-nowrap ${order === "missions" ? "text-belt" : ""}`}>
                    🎯 {t("ranking.missionsCompleted", { count: entry.missions_completed })}
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
