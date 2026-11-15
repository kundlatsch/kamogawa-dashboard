import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import type { MyRoutine, RoutineItem } from "../../api/types";
import { KindBadge } from "../../components/SessionBadge";
import SparringBanner from "../../components/SparringBanner";
import { useAuth } from "../../auth/AuthContext";
import { formatDate } from "../../lib/dates";
import { youtubeEmbedUrl, youtubeId } from "../../lib/youtube";

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
          <h1 className="font-display text-4xl tracking-wide uppercase first-letter:uppercase">
            {formatDate(data.date, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          </h1>
        )}
      </div>

      <SparringBanner />

      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {data && data.sessions.length === 0 && (
        <div className="rounded-xl border border-rope bg-canvas p-8 text-center">
          <p className="text-5xl" aria-hidden>
            😴
          </p>
          <p className="mt-2 text-smoke">{t("student.restDay")}</p>
        </div>
      )}

      {data?.sessions.map((session) => (
        <div key={session.id} className="flex flex-col gap-3">
          <div
            className={`flex flex-wrap items-center gap-2 rounded-xl p-3 ${
              session.kind === "SPARRING" ? "border border-blood bg-blood/15" : "bg-canvas"
            }`}
          >
            <KindBadge kind={session.kind} />
            {session.start_time && <span className="font-semibold">{session.start_time.slice(0, 5)}</span>}
            {session.title && <span>{session.title}</span>}
            {session.notes && <p className="w-full text-sm text-smoke">{session.notes}</p>}
          </div>
          {session.routine.length === 0 ? (
            <p className="text-sm text-smoke">{t("student.noDrills")}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {session.routine.map((item, index) => (
                <RoutineCard key={item.id} item={item} step={index + 1} />
              ))}
            </ol>
          )}
        </div>
      ))}
    </section>
  );
}

function RoutineCard({ item, step }: { item: RoutineItem; step: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { drill } = item;
  const videoId = youtubeId(drill.youtube_url);
  const rounds = item.rounds ?? drill.default_rounds;
  const minutes = item.duration_minutes ?? drill.default_duration_minutes;

  return (
    <li className="overflow-hidden rounded-xl border border-rope bg-canvas" style={{ borderLeft: `6px solid ${drill.color}` }}>
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="font-display text-2xl text-smoke">{step}</span>
        <span className="text-4xl" aria-hidden>
          {drill.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{drill.name}</p>
          <div className="flex flex-wrap gap-x-3 text-sm text-smoke">
            {rounds ? <span>{t("drills.roundsCount", { count: rounds })}</span> : null}
            {minutes ? <span>{t("drills.minutesCount", { count: minutes })}</span> : null}
            {item.is_broadcast && <span className="text-belt">📣 {t("student.everyone")}</span>}
          </div>
          {item.partners.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">
              <span className="text-smoke">{t("board.with")}</span>
              {item.partners.map((partner) => (
                <span key={partner.id} className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${partner.color}44` }}>
                  {partner.avatar_emoji} {partner.display_name}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-smoke" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-rope p-4">
          {item.notes && <p className="rounded-lg bg-belt/10 p-3 text-sm">📝 {item.notes}</p>}
          {drill.description && <p className="text-sm whitespace-pre-line text-smoke">{drill.description}</p>}
          {videoId && (
            <iframe title={drill.name} src={youtubeEmbedUrl(videoId)} className="aspect-video w-full rounded-lg" allowFullScreen />
          )}
        </div>
      )}
    </li>
  );
}
