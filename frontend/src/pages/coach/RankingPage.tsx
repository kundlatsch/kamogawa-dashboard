import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useFighterClasses } from "../../api/hooks";
import type { LeaderboardEntry, Mission, MissionCompletion, PublicUser } from "../../api/types";
import Avatar from "../../components/Avatar";
import FighterClassArt from "../../components/FighterClassArt";
import { Button, Input, Modal, PageHeader } from "../../components/ui";
import XpBar from "../../components/XpBar";
import { sortLeaderboard } from "../../lib/ranking";
import { formatDate } from "../../lib/dates";
import StudentLink from "../../components/StudentLink";

const field = "rounded-md border border-rope bg-ring px-2 py-1.5 text-sm text-chalk outline-none focus:border-glove";

/** Coach gamification hub: ranking with fighter classes, mission approvals and the mission list. */
export default function RankingPage() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("ranking.title")} />
      <p className="-mt-4 text-sm text-smoke">{t("ranking.hint")}</p>
      <PendingCompletions />
      <Leaderboard />
      <Missions />
    </section>
  );
}

function Leaderboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<"xp" | "attendance">("xp");
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => (await api.get<LeaderboardEntry[]>("/leaderboard/")).data,
  });
  const entries = sortLeaderboard(data, order);
  const { data: classes = [] } = useFighterClasses();
  const [giving, setGiving] = useState<PublicUser | null>(null);
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
      <div role="tablist" className="mb-3 flex gap-2">
        {(["xp", "attendance"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={order === key}
            onClick={() => setOrder(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              order === key ? "bg-glove text-chalk" : "border border-rope text-smoke hover:text-chalk"
            }`}
          >
            {t(`ranking.by.${key}`)}
          </button>
        ))}
      </div>
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
                  {entry.pending_missions > 0 && (
                    <span className="rounded-full bg-glove px-1.5 text-xs" title={t("ranking.pending")}>
                      {entry.pending_missions}
                    </span>
                  )}
                </span>
                <XpBar level={entry} compact />
                <span className="text-xs text-smoke">
                  <span className={order === "attendance" ? "font-semibold text-belt" : ""}>
                    ✓ {t("ranking.attended", { count: entry.attended })}
                  </span>{" "}
                  · <span className={entry.absences > 0 ? "text-glove" : ""}>✗ {t("ranking.absences", { count: entry.absences })}</span>
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
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setGiving(entry.student)}>
                {t("ranking.giveXp")}
              </Button>
            </li>
          );
        })}
      </ol>
      {giving && <ManualXpModal student={giving} onClose={() => setGiving(null)} />}
    </div>
  );
}

function ManualXpModal({ student, onClose }: { student: PublicUser; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const grant = useMutation({
    mutationFn: async () => api.post("/xp-events/", { student: student.id, amount: Number(amount), note: note.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      onClose();
    },
  });
  return (
    <Modal title={t("ranking.giveXpTitle", { name: student.display_name })} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (Number(amount)) grant.mutate();
        }}
      >
        <Input label={t("ranking.amount")} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Input label={t("ranking.reason")} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        {grant.isError && <p className="text-sm text-glove">{t("cycles.saveError")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={grant.isPending || !Number(amount)}>
            {t("ranking.grant")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PendingCompletions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: pending = [] } = useQuery({
    queryKey: ["mission-completions", "PENDING"],
    queryFn: async () =>
      (await api.get<MissionCompletion[]>("/mission-completions/", { params: { status: "PENDING" } })).data,
  });
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => (await api.get<LeaderboardEntry[]>("/leaderboard/")).data,
  });
  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: number; approve: boolean }) =>
      api.post(`/mission-completions/${id}/${approve ? "approve" : "reject"}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mission-completions"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
  if (pending.length === 0) return null;
  const studentOf = (id: number) => leaderboard.find((e) => e.student.id === id)?.student;

  return (
    <div className="rounded-xl border border-glove bg-glove/10 p-5">
      <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">{t("ranking.pending")}</h2>
      <ul className="flex flex-col gap-2">
        {pending.map((completion) => {
          const student = studentOf(completion.student);
          return (
            <li key={completion.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-ring p-3 text-sm">
              {student && <Avatar person={student} />}
              {student && (
                <StudentLink id={student.id} className="font-semibold">
                  {student.display_name}
                </StudentLink>
              )}
              <span>
                {completion.mission_detail.emoji} {completion.mission_detail.title}
              </span>
              <span className="text-belt">+{completion.mission_detail.xp_reward} XP</span>
              {completion.note && <span className="w-full text-smoke">💬 {completion.note}</span>}
              <span className="flex-1" />
              <Button className="!py-1" onClick={() => review.mutate({ id: completion.id, approve: true })}>
                {t("ranking.approve")}
              </Button>
              <Button variant="ghost" className="!py-1" onClick={() => review.mutate({ id: completion.id, approve: false })}>
                {t("ranking.reject")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Missions() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: missions = [] } = useQuery({
    queryKey: ["missions"],
    queryFn: async () => (await api.get<Mission[]>("/missions/")).data,
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [xp, setXp] = useState("20");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [repeatable, setRepeatable] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["missions"] });
  const create = useMutation({
    mutationFn: async () =>
      api.post("/missions/", {
        title: title.trim(),
        description,
        xp_reward: Number(xp),
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        repeatable,
        active: true,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: async (mission: Mission) => api.patch(`/missions/${mission.id}/`, { active: !mission.active }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (mission: Mission) => api.delete(`/missions/${mission.id}/`),
    onSuccess: refresh,
  });
  const short = (value: string) => formatDate(value, i18n.language, { day: "numeric", month: "short" });

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">{t("ranking.missions")}</h2>
      {missions.length === 0 && <p className="mb-3 text-sm text-smoke">{t("ranking.noMissions")}</p>}
      <ul className="mb-4 flex flex-col gap-2">
        {missions.map((mission) => (
          <li
            key={mission.id}
            className={`flex flex-wrap items-center gap-2 rounded-lg border border-rope bg-ring p-3 text-sm ${
              mission.active ? "" : "opacity-60"
            }`}
          >
            <span className="text-xl">{mission.emoji}</span>
            <div className="min-w-40 flex-1">
              <p className="font-semibold">{mission.title}</p>
              {mission.description && <p className="text-smoke">{mission.description}</p>}
              <p className="text-xs text-smoke">
                {[
                  mission.starts_on && `${t("ranking.startsOn")} ${short(mission.starts_on)}`,
                  mission.ends_on && `${t("ranking.endsOn")} ${short(mission.ends_on)}`,
                  mission.repeatable && t("ranking.repeatable"),
                  !mission.active && t("ranking.paused"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="font-semibold text-belt">+{mission.xp_reward} XP</span>
            <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => toggle.mutate(mission)}>
              {mission.active ? t("ranking.pause") : t("ranking.activate")}
            </Button>
            <button className="text-smoke hover:text-glove" aria-label={t("common.delete")} onClick={() => remove.mutate(mission)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3 border-t border-rope pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <h3 className="font-semibold">{t("ranking.newMission")}</h3>
        <Input label={t("ranking.missionTitle")} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("ranking.missionDescription")}</span>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label={t("ranking.xpReward")} type="number" min={0} value={xp} onChange={(e) => setXp(e.target.value)} />
          <Input label={t("ranking.startsOn")} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          <Input label={t("ranking.endsOn")} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={repeatable} onChange={(e) => setRepeatable(e.target.checked)} />
          {t("ranking.repeatable")}
        </label>
        {create.isError && <p className="text-sm text-glove">{t("cycles.saveError")}</p>}
        <div>
          <Button type="submit" disabled={create.isPending}>
            + {t("ranking.addMission")}
          </Button>
        </div>
      </form>
    </div>
  );
}
