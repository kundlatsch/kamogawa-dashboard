import { useTranslation } from "react-i18next";

import CheckInButton from "../../components/CheckInButton";
import { KindBadge } from "../../components/SessionBadge";
import { useUpcoming } from "../../components/SparringBanner";
import { PageHeader } from "../../components/ui";
import { formatDate } from "../../lib/dates";

export default function UpcomingPage() {
  const { t, i18n } = useTranslation();
  const { data: sessions = [], isLoading } = useUpcoming();

  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader title={t("nav.upcoming")} />
      <p className="mb-4 text-sm text-smoke">{t("student.upcomingHint")}</p>
      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {!isLoading && sessions.length === 0 && <p className="text-smoke">{t("student.noUpcoming")}</p>}
      <ul className="flex flex-col gap-2">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
              session.kind === "SPARRING" ? "border-blood bg-blood/15" : "border-rope bg-canvas"
            }`}
          >
            <span className="font-semibold first-letter:uppercase">
              {formatDate(session.date, i18n.language, { weekday: "long", day: "numeric", month: "short" })}
            </span>
            {session.start_time && <span className="text-smoke">{session.start_time.slice(0, 5)}</span>}
            <KindBadge kind={session.kind} />
            {session.title && <span className="text-sm">{session.title}</span>}
            <div className="w-full">
              <CheckInButton sessionId={session.id} state={session.checkin} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
