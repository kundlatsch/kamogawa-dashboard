import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { api } from "../../api/client";
import type { MyRoutine } from "../../api/types";
import SessionRoutineView from "../../components/SessionRoutineView";
import { formatDate } from "../../lib/dates";

/** One published class (also a future one) with the student's exercises. */
export default function ClassPage() {
  const { t, i18n } = useTranslation();
  const id = Number(useParams().sessionId);
  const { data: session, isError } = useQuery({
    queryKey: ["me", "session", id],
    queryFn: async () => (await api.get<MyRoutine["sessions"][number]>(`/me/sessions/${id}/`)).data,
  });

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link to="/upcoming" className="text-sm text-smoke hover:text-chalk">
        ← {t("nav.upcoming")}
      </Link>
      {isError && <p className="text-glove">{t("studentCalendar.notFound")}</p>}
      {!session && !isError && <p className="text-smoke">{t("common.loading")}</p>}
      {session && (
        <>
          <h1 className="font-display text-3xl tracking-wide uppercase first-letter:uppercase md:text-4xl">
            {formatDate(session.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          </h1>
          <SessionRoutineView session={session} />
        </>
      )}
    </section>
  );
}
