import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import type { SessionSummary } from "../api/types";
import { formatDate } from "../lib/dates";

export const useUpcoming = () =>
  useQuery({
    queryKey: ["me", "upcoming"],
    queryFn: async () => (await api.get<SessionSummary[]>("/me/upcoming/")).data,
  });

/** Loud red alert for every upcoming sparring day. */
export default function SparringBanner() {
  const { t, i18n } = useTranslation();
  const { data = [] } = useUpcoming();
  const sparrings = data.filter((session) => session.kind === "SPARRING");
  if (sparrings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {sparrings.map((session) => (
        <div
          key={session.id}
          role="alert"
          className="relative overflow-hidden rounded-xl border-2 border-blood bg-gradient-to-r from-blood-dark to-blood p-4 shadow-[0_0_30px_#d6282866]"
        >
          <div className="flex items-center gap-3">
            <span className="animate-bounce text-4xl" aria-hidden>
              🥊
            </span>
            <div>
              <p className="font-display text-2xl tracking-wide uppercase">{t("sparring.bannerTitle")}</p>
              <p className="first-letter:uppercase">
                {formatDate(session.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
                {session.start_time && ` · ${session.start_time.slice(0, 5)}`}
                {session.title && ` · ${session.title}`}
              </p>
              <p className="text-sm text-chalk/80">{t("sparring.bannerHint")}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
