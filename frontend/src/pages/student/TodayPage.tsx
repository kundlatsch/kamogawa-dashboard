import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import type { MyRoutine } from "../../api/types";
import CheckInButton from "../../components/CheckInButton";
import SessionRoutineView from "../../components/SessionRoutineView";
import SparringBanner from "../../components/SparringBanner";
import WeekCard from "../../components/WeekCard";
import { useAuth } from "../../auth/AuthContext";
import { formatDate } from "../../lib/dates";

export default function TodayPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["me", "routine"],
    queryFn: async () => (await api.get<MyRoutine>("/me/routine/")).data,
    refetchInterval: 60_000,
  });

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-smoke">{t("student.hello", { name: user?.display_name })}</p>
        {data && (
          <h1 className="font-display text-3xl tracking-wide uppercase first-letter:uppercase md:text-4xl">
            {formatDate(data.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          </h1>
        )}
      </div>

      <SparringBanner />
      <WeekCard />

      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {data?.drafts?.map((draft) => (
        <div key={draft.id} className="flex flex-col gap-2 rounded-xl bg-canvas p-3">
          <p className="font-semibold">
            {t("studentCalendar.class")} {draft.start_time?.slice(0, 5)}
            <span className="ml-2 text-xs font-normal text-smoke">{t("studentCalendar.notPublishedYet")}</span>
          </p>
          <CheckInButton sessionId={draft.id} state={draft.checkin} />
        </div>
      ))}
      {data && data.sessions.length === 0 && !data.drafts?.length && (
        <div className="rounded-xl border border-rope bg-canvas p-8 text-center">
          <p className="text-5xl" aria-hidden>
            😴
          </p>
          <p className="mt-2 text-smoke">{t("student.restDay")}</p>
        </div>
      )}

      {data?.sessions.map((session) => <SessionRoutineView key={session.id} session={session} />)}
    </section>
  );
}
