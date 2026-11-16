import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import type { MyProgress, XpEvent } from "../../api/types";
import FighterClassArt from "../../components/FighterClassArt";
import { Button, PageHeader } from "../../components/ui";
import XpBar from "../../components/XpBar";
import { formatDate } from "../../lib/dates";

/** Student gamification: fighter class, level and XP, missions to complete and recent XP. */
export default function ProgressPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me", "progress"],
    queryFn: async () => (await api.get<MyProgress>("/me/progress/")).data,
  });
  const complete = useMutation({
    mutationFn: async (mission: number) => api.post(`/me/missions/${mission}/complete/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "progress"] }),
  });
  const short = (value: string) => formatDate(value, i18n.language, { day: "numeric", month: "short" });
  const reason = (event: XpEvent) =>
    t(`progress.reason.${event.reason}`, {
      date: event.session_date ? short(event.session_date) : "",
      title: event.mission_title,
    }) + (event.note ? ` · ${event.note}` : "");

  if (isLoading || !data) return <p className="text-smoke">{t("common.loading")}</p>;
  const fighterClass = data.fighter_class;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("progress.title")} />

      <div
        className="flex flex-col items-center gap-4 overflow-hidden rounded-xl border border-rope bg-canvas p-5 sm:flex-row sm:items-center"
        style={fighterClass ? { background: `radial-gradient(circle at 20% 50%, ${fighterClass.color}44, transparent 60%)` } : undefined}
      >
        {fighterClass && <FighterClassArt fighterClass={fighterClass} size="lg" />}
        <div className="flex w-full flex-1 flex-col gap-3">
          {fighterClass ? (
            <div>
              <p className="text-xs tracking-wider text-smoke uppercase">{t("progress.yourClass")}</p>
              <h2 className="font-display text-3xl tracking-wide uppercase" style={{ color: fighterClass.color }}>
                {fighterClass.name}
              </h2>
              {fighterClass.description && <p className="text-sm text-smoke">{fighterClass.description}</p>}
            </div>
          ) : (
            <p className="text-sm text-smoke">{t("progress.noClass")}</p>
          )}
          <XpBar level={data} />
          <p className="text-xs text-smoke">
            {t("progress.toNext", { left: data.xp_per_level - data.level_xp, next: data.level + 1 })} ·{" "}
            {t("progress.attendanceHint", { xp: data.attendance_xp })}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-rope bg-canvas p-5">
        <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">{t("progress.missions")}</h2>
        {data.missions.length === 0 && <p className="text-sm text-smoke">{t("progress.noMissions")}</p>}
        <ul className="flex flex-col gap-2">
          {data.missions.map((mission) => (
            <li key={mission.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ring p-3 text-sm">
              <span className="text-2xl" aria-hidden>
                {mission.emoji}
              </span>
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{mission.title}</p>
                {mission.description && <p className="text-smoke">{mission.description}</p>}
                <p className="text-xs text-smoke">
                  {[
                    mission.ends_on && t("progress.until", { date: short(mission.ends_on) }),
                    mission.times_completed > 0 && t("progress.timesCompleted", { count: mission.times_completed }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="font-semibold text-belt">+{mission.xp_reward} XP</span>
              {mission.can_complete ? (
                <Button className="!py-1" disabled={complete.isPending} onClick={() => complete.mutate(mission.id)}>
                  {t("progress.complete")}
                </Button>
              ) : (
                <span className={`text-xs font-semibold ${mission.status === "REJECTED" ? "text-glove" : "text-smoke"}`}>
                  {mission.status === "PENDING"
                    ? `⏳ ${t("progress.pending")}`
                    : mission.status === "APPROVED"
                      ? `✓ ${t("progress.approved")}`
                      : t("progress.rejected")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-rope bg-canvas p-5">
        <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">{t("progress.history")}</h2>
        {data.events.length === 0 && <p className="text-sm text-smoke">{t("progress.noHistory")}</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {data.events.map((event) => (
            <li key={event.id} className="flex items-center gap-2">
              <span className={`w-16 font-semibold ${event.amount >= 0 ? "text-belt" : "text-glove"}`}>
                {event.amount > 0 ? `+${event.amount}` : event.amount} XP
              </span>
              <span className="flex-1">{reason(event)}</span>
              <span className="text-xs text-smoke">{short(event.created_at.slice(0, 10))}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
