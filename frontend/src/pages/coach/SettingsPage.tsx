import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useCategories, useSchedule } from "../../api/hooks";
import type { DrillCategory } from "../../api/types";
import { ColorPicker } from "../../components/pickers";
import { Button, Input, PageHeader } from "../../components/ui";
import { weekdayNames } from "../../lib/dates";

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-8">
      <PageHeader title={t("settings.title")} />
      <ScheduleSettings />
      <CategorySettings />
    </section>
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
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
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
