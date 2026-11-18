import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useFighterClasses } from "../../api/hooks";
import type { LeaderboardEntry } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import Avatar from "../../components/Avatar";
import FighterClassArt from "../../components/FighterClassArt";
import { PageHeader } from "../../components/ui";
import { sortLeaderboard } from "../../lib/ranking";

/** The gym attendance ranking as students see it (read-only), with their own fighter class on top. */
export default function StudentRankingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => (await api.get<LeaderboardEntry[]>("/ranking/")).data,
  });
  const { data: classes = [] } = useFighterClasses();
  const entries = sortLeaderboard(data);
  const myClassId = data.find((entry) => entry.student.id === user?.id)?.fighter_class;
  const myClass = classes.find((c) => c.id === myClassId);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={t("nav.ranking")} />
      {!isLoading && !isError && (
        <div
          className="flex items-center gap-4 overflow-hidden rounded-xl border border-rope bg-canvas p-4"
          style={myClass ? { background: `radial-gradient(circle at 15% 50%, ${myClass.color}44, transparent 60%)` } : undefined}
        >
          {myClass && <FighterClassArt fighterClass={myClass} />}
          {myClass ? (
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-wider text-smoke uppercase">{t("studentRanking.yourClass")}</p>
              <h2 className="font-display text-2xl tracking-wide uppercase" style={{ color: myClass.color }}>
                {myClass.name}
              </h2>
              {myClass.description && <p className="text-sm text-smoke">{myClass.description}</p>}
            </div>
          ) : (
            <p className="text-sm text-smoke">{t("studentRanking.noClass")}</p>
          )}
        </div>
      )}
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
                {/* Each stat wraps as a whole, never in the middle of "0 presenças". */}
                <p className="flex flex-wrap gap-x-2 text-xs font-normal text-smoke">
                  <span className="whitespace-nowrap text-belt">✓ {t("ranking.attended", { count: entry.attended })}</span>
                  <span className="whitespace-nowrap">✗ {t("ranking.absences", { count: entry.absences })}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
