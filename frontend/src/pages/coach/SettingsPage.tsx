import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Wordmark } from "../../components/AppShell";
import { useCategories, useSchedule } from "../../api/hooks";
import type { DrillCategory, GymSummary } from "../../api/types";
import BlockSettings from "../../components/BlockSettings";
import FighterClassSettings from "../../components/FighterClassSettings";
import NamedListSettings from "../../components/NamedListSettings";
import { ColorPicker } from "../../components/pickers";
import { Button, Input, PageHeader } from "../../components/ui";
import { weekdayNames } from "../../lib/dates";

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-8">
      <PageHeader title={t("settings.title")} />
      <GymSettings />
      <ScheduleSettings />
      <CheckinSettings />
      <AssessmentScaleSettings />
      <FighterClassSettings />
      <BlockSettings />
      <CategorySettings />
      <NamedListSettings
        path="/valences/"
        title={t("settings.valences")}
        hint={t("settings.valencesHint")}
        nameLabel={t("settings.valenceName")}
        addLabel={t("settings.addValence")}
      />
      <NamedListSettings
        path="/microcycle-phases/"
        title={t("settings.phases")}
        hint={t("settings.phasesHint")}
        nameLabel={t("settings.phaseName")}
        addLabel={t("settings.addPhase")}
      />
      <NamedListSettings
        path="/focus-options/"
        title={t("settings.focuses")}
        hint={t("settings.focusesHint")}
        nameLabel={t("settings.focusName")}
        addLabel={t("settings.addFocus")}
      />
      <NamedListSettings
        path="/metrics/"
        title={t("settings.metrics")}
        hint={t("settings.metricsHint")}
        nameLabel={t("settings.metricName")}
        addLabel={t("settings.addMetric")}
        groups={[
          { value: "PHYSICAL", label: t("metricGroup.PHYSICAL") },
          { value: "TECHNICAL", label: t("metricGroup.TECHNICAL") },
        ]}
      />
    </section>
  );
}

/** Gym name and the accent color of the student area. */
function GymSettings() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.gym?.name ?? "");
  const [color, setColor] = useState(user?.gym?.color ?? "#d62828");

  const save = useMutation({
    mutationFn: async () => api.patch("/my-gym/", { name: name.trim(), color }),
    onSuccess: () => refreshUser(),
  });

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("settings.gym")}</h2>
      <p className="mb-4 text-sm text-smoke">{t("settings.gymHint")}</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <Input label={t("gyms.name")} value={name} onChange={(event) => setName(event.target.value)} required />
        <ColorPicker value={color} onChange={setColor} label={t("settings.gymColor")} />
        <div>
          <p className="mb-1 text-sm text-smoke">{t("settings.studentPreview")}</p>
          <div
            data-theme="student"
            style={{ "--color-glove": color } as CSSProperties}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-rope bg-ring p-3"
          >
            <Wordmark name={name || " "} />
            <span className="rounded-md bg-glove px-3 py-1.5 text-sm font-medium">{t("nav.today")}</span>
            <span className="text-sm text-smoke">{t("nav.upcoming")}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {t("common.save")}
          </Button>
          {save.isSuccess && <span className="text-sm text-belt">{t("settings.saved")}</span>}
          {save.isError && <span className="text-sm text-glove">{t("settings.gymError")}</span>}
        </div>
      </form>
    </div>
  );
}

function ScheduleSettings() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: schedule } = useSchedule();
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("19:00");
  const names = weekdayNames(i18n.language);

  useEffect(() => {
    if (schedule) {
      setWeekdays(schedule.training_weekdays);
      setStartTime(schedule.default_start_time.slice(0, 5));
    }
  }, [schedule]);

  const save = useMutation({
    mutationFn: async () =>
      api.put("/schedule/", { training_weekdays: weekdays, default_start_time: startTime }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const toggle = (day: number) =>
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("settings.schedule")}</h2>
      <p className="mb-4 text-sm text-smoke">{t("settings.scheduleHint")}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {names.map((name, day) => (
          <button
            key={day}
            type="button"
            aria-pressed={weekdays.includes(day)}
            onClick={() => toggle(day)}
            className={`rounded-full px-4 py-2 text-sm font-semibold first-letter:uppercase ${
              weekdays.includes(day) ? "bg-glove text-chalk" : "border border-rope text-smoke"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Input
          label={t("settings.startTime")}
          type="time"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
        />
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {t("common.save")}
        </Button>
        {save.isSuccess && <span className="text-sm text-belt">{t("settings.saved")}</span>}
      </div>
    </div>
  );
}

function CategorySettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#d62828");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["drill-categories"] });

  const create = useMutation({
    mutationFn: async () => api.post("/drill-categories/", { name: name.trim(), color, order: categories.length }),
    onSuccess: () => {
      setName("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (category: DrillCategory) => api.delete(`/drill-categories/${category.id}/`),
    onSuccess: refresh,
  });

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("settings.categories")}</h2>
      <p className="mb-4 text-sm text-smoke">{t("settings.categoriesHint")}</p>
      <ul className="mb-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-2 rounded-full border border-rope py-1 pr-2 pl-3 text-sm"
          >
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
            {category.name}
            <button
              aria-label={t("common.delete")}
              className="text-smoke hover:text-glove"
              onClick={() => remove.mutate(category)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Input label={t("settings.categoryName")} value={name} onChange={(event) => setName(event.target.value)} />
        <ColorPicker value={color} onChange={setColor} />
        <div>
          <Button type="submit" disabled={create.isPending}>
            + {t("settings.addCategory")}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** How long before class students can still check in or cancel. */
function CheckinSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: gym } = useQuery({
    queryKey: ["my-gym"],
    queryFn: async () => (await api.get<GymSummary>("/my-gym/")).data,
  });
  const [minutes, setMinutes] = useState("");
  useEffect(() => {
    if (gym?.checkin_deadline_minutes !== undefined) setMinutes(String(gym.checkin_deadline_minutes));
  }, [gym]);
  const save = useMutation({
    mutationFn: async () => api.patch("/my-gym/", { checkin_deadline_minutes: Number(minutes) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-gym"] }),
  });

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("checkin.title")}</h2>
      <p className="mb-4 text-sm text-smoke">{t("settings.checkinDeadlineHint")}</p>
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (minutes !== "") save.mutate();
        }}
      >
        <Input
          label={t("settings.checkinDeadline")}
          type="number"
          min={0}
          max={1440}
          step={15}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
        <Button type="submit" disabled={save.isPending}>
          {t("common.save")}
        </Button>
        {save.isSuccess && <span className="text-sm text-belt">{t("settings.saved")}</span>}
        {save.isError && <span className="text-sm text-glove">{t("cycles.saveError")}</span>}
      </form>
    </div>
  );
}

/** The top of the monthly assessment scale. */
function AssessmentScaleSettings() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: gym } = useQuery({
    queryKey: ["my-gym"],
    queryFn: async () => (await api.get<GymSummary>("/my-gym/")).data,
  });
  const [scaleMax, setScaleMax] = useState("");
  useEffect(() => {
    if (gym?.assessment_scale_max !== undefined) setScaleMax(String(gym.assessment_scale_max));
  }, [gym]);
  const save = useMutation({
    mutationFn: async () =>
      api.patch("/my-gym/", { assessment_scale_max: Number(scaleMax) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-gym"] });
      refreshUser();
    },
  });

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("settings.assessmentScale")}</h2>
      <p className="mb-4 text-sm text-smoke">{t("settings.assessmentScaleHint")}</p>
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (Number(scaleMax) >= 2) save.mutate();
        }}
      >
        <Input
          label={t("settings.assessmentScaleMax")}
          type="number"
          min={2}
          max={10}
          value={scaleMax}
          onChange={(event) => setScaleMax(event.target.value)}
        />
        <Button type="submit" disabled={save.isPending}>
          {t("common.save")}
        </Button>
        {save.isSuccess && <span className="text-sm text-belt">{t("settings.saved")}</span>}
        {save.isError && <span className="text-sm text-glove">{t("cycles.saveError")}</span>}
      </form>
    </div>
  );
}
