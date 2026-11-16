import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useMacrocycles, useNamedList } from "../../api/hooks";
import type { Macrocycle, NamedItem, PlannedMesocycle, PlannedMicrocycle } from "../../api/types";
import { Button, Input, Modal, PageHeader } from "../../components/ui";
import { formatDate, todayISO } from "../../lib/dates";

const fieldClass = "rounded-md border border-rope bg-ring px-2 py-1.5 text-sm text-chalk outline-none focus:border-glove";

/** Any change to the plan can move dates and objectives, so cycles and sessions are refetched. */
function usePlanMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["macrocycles"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function DateRange({ start, end }: { start: string | null; end: string | null }) {
  const { i18n } = useTranslation();
  if (!start || !end) return null;
  const format = (value: string) => formatDate(value, i18n.language, { day: "2-digit", month: "short" });
  return (
    <span className="text-xs text-smoke">
      {format(start)} – {format(end)}
    </span>
  );
}

/** Coach planner: macrocycle → ordered mesocycles (one valence each) → microcycles (weeks). */
export default function CyclesPage() {
  const { t } = useTranslation();
  const { data: macrocycles = [], isLoading } = useMacrocycles();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (macrocycles.length && !macrocycles.some((m) => m.id === selectedId)) setSelectedId(macrocycles[0].id);
  }, [macrocycles, selectedId]);

  const selected = macrocycles.find((m) => m.id === selectedId);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("cycles.title")}
        actions={<Button onClick={() => setCreating(true)}>+ {t("cycles.newMacrocycle")}</Button>}
      />
      <p className="-mt-4 text-sm text-smoke">{t("cycles.hint")}</p>

      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {!isLoading && macrocycles.length === 0 && (
        <div className="rounded-xl border border-rope bg-canvas p-8 text-center text-smoke">{t("cycles.empty")}</div>
      )}

      {macrocycles.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {macrocycles.map((macro) => (
            <button
              key={macro.id}
              role="tab"
              aria-selected={macro.id === selectedId}
              onClick={() => setSelectedId(macro.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                macro.id === selectedId ? "bg-glove text-chalk" : "border border-rope text-smoke hover:text-chalk"
              }`}
            >
              {macro.name}
            </button>
          ))}
        </div>
      )}

      {selected && <MacrocyclePlan key={selected.id} macro={selected} />}

      {creating && (
        <MacrocycleForm
          onClose={() => setCreating(false)}
          onSaved={(macro) => {
            setSelectedId(macro.id);
            setCreating(false);
          }}
        />
      )}
    </section>
  );
}

function MacrocycleForm({
  macro,
  onClose,
  onSaved,
}: {
  macro?: Macrocycle;
  onClose: () => void;
  onSaved: (macro: Macrocycle) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(macro?.name ?? "");
  const [startDate, setStartDate] = useState(macro?.start_date ?? todayISO());
  const [notes, setNotes] = useState(macro?.notes ?? "");
  const save = usePlanMutation(async () => {
    const payload = { name: name.trim(), start_date: startDate, notes };
    const response = macro
      ? await api.patch<Macrocycle>(`/macrocycles/${macro.id}/`, payload)
      : await api.post<Macrocycle>("/macrocycles/", payload);
    onSaved(response.data);
  });

  return (
    <Modal title={macro ? t("cycles.editMacrocycle") : t("cycles.newMacrocycle")} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && startDate) save.mutate(undefined);
        }}
      >
        <Input
          label={t("cycles.macrocycleName")}
          placeholder={t("cycles.macrocyclePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label={t("cycles.startDate")}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("cycles.notes")}</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
        </label>
        {save.isError && <p className="text-sm text-glove">{t("cycles.saveError")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MacrocyclePlan({ macro }: { macro: Macrocycle }) {
  const { t } = useTranslation();
  const { data: valences = [] } = useNamedList("/valences/");
  const [editing, setEditing] = useState(false);
  const [newValence, setNewValence] = useState<number | "">("");

  const addMesocycle = usePlanMutation(async (valence: number) =>
    api.post("/mesocycles/", { macrocycle: macro.id, valence }),
  );
  const remove = usePlanMutation(async () => api.delete(`/macrocycles/${macro.id}/`));
  const reorder = usePlanMutation(async (ids: number[]) =>
    api.post("/mesocycles/reorder/", { macrocycle: macro.id, ids }),
  );

  const move = (index: number, delta: number) => {
    const ids = macro.mesocycles.map((m) => m.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rope bg-canvas p-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl tracking-wide uppercase">{macro.name}</h2>
          <DateRange start={macro.start_date} end={macro.end_date ?? macro.start_date} />
          {macro.notes && <p className="mt-1 text-sm text-smoke">{macro.notes}</p>}
        </div>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          {t("common.edit")}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm(t("cycles.confirmDeleteMacrocycle", { name: macro.name }))) remove.mutate(undefined);
          }}
        >
          {t("common.delete")}
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {macro.mesocycles.map((meso, index) => (
          <MesocycleCard
            key={meso.id}
            meso={meso}
            index={index}
            count={macro.mesocycles.length}
            valences={valences}
            onMove={(delta) => move(index, delta)}
          />
        ))}

        <form
          className="flex w-64 shrink-0 flex-col justify-center gap-3 rounded-xl border border-dashed border-rope p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (newValence !== "") {
              addMesocycle.mutate(newValence);
              setNewValence("");
            }
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-smoke">{t("cycles.addMesocycle")}</span>
            <select
              value={newValence}
              onChange={(e) => setNewValence(e.target.value ? Number(e.target.value) : "")}
              className={fieldClass}
            >
              <option value="">{t("cycles.pickValence")}</option>
              {valences.map((valence) => (
                <option key={valence.id} value={valence.id}>
                  {valence.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={newValence === "" || addMesocycle.isPending}>
            + {t("cycles.mesocycle")}
          </Button>
        </form>
      </div>

      {editing && <MacrocycleForm macro={macro} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </div>
  );
}

function MesocycleCard({
  meso,
  index,
  count,
  valences,
  onMove,
}: {
  meso: PlannedMesocycle;
  index: number;
  count: number;
  valences: NamedItem[];
  onMove: (delta: number) => void;
}) {
  const { t } = useTranslation();
  const { data: phases = [] } = useNamedList("/microcycle-phases/");
  const [name, setName] = useState(meso.name);
  const update = usePlanMutation(async (patch: Record<string, unknown>) => api.patch(`/mesocycles/${meso.id}/`, patch));
  const remove = usePlanMutation(async () => api.delete(`/mesocycles/${meso.id}/`));
  const addWeek = usePlanMutation(async () => api.post("/microcycles/", { mesocycle: meso.id }));
  // The current valence stays selectable even if it was archived since.
  const options = valences.some((v) => v.id === meso.valence.id) ? valences : [meso.valence, ...valences];

  return (
    <article
      className="flex w-80 shrink-0 flex-col gap-3 rounded-xl border border-rope bg-canvas p-4"
      style={{ borderTop: `4px solid ${meso.valence.color}` }}
      aria-label={meso.name || meso.valence.name}
    >
      <div className="flex items-center gap-1">
        <span className="font-display text-sm tracking-wider text-smoke uppercase">
          {t("cycles.mesocycleNumber", { number: index + 1 })}
        </span>
        <span className="flex-1" />
        <button
          className="rounded px-2 text-smoke hover:text-chalk disabled:opacity-30"
          aria-label={t("cycles.moveEarlier")}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ←
        </button>
        <button
          className="rounded px-2 text-smoke hover:text-chalk disabled:opacity-30"
          aria-label={t("cycles.moveLater")}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          →
        </button>
        <button
          className="rounded px-2 text-smoke hover:text-glove"
          aria-label={t("common.delete")}
          onClick={() => {
            if (window.confirm(t("cycles.confirmDeleteMesocycle"))) remove.mutate(undefined);
          }}
        >
          ✕
        </button>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-smoke">{t("cycles.valence")}</span>
        <select
          value={meso.valence.id}
          onChange={(e) => update.mutate({ valence: Number(e.target.value) })}
          className={`${fieldClass} font-semibold`}
        >
          {options.map((valence) => (
            <option key={valence.id} value={valence.id}>
              {valence.name}
            </option>
          ))}
        </select>
      </label>
      <input
        aria-label={t("cycles.mesocycleName")}
        placeholder={t("cycles.mesocycleNamePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== meso.name && update.mutate({ name })}
        className={fieldClass}
      />
      <DateRange start={meso.start_date} end={meso.end_date} />

      <ol className="flex flex-col gap-2">
        {meso.microcycles.map((micro, weekIndex) => (
          <MicrocycleRow key={micro.id} micro={micro} number={weekIndex + 1} phases={phases} />
        ))}
      </ol>
      <Button variant="ghost" onClick={() => addWeek.mutate(undefined)} disabled={addWeek.isPending}>
        + {t("cycles.addMicrocycle")}
      </Button>
    </article>
  );
}

function MicrocycleRow({ micro, number, phases }: { micro: PlannedMicrocycle; number: number; phases: NamedItem[] }) {
  const { t } = useTranslation();
  const [objective, setObjective] = useState(micro.objective);
  const [length, setLength] = useState(String(micro.length_days));
  const update = usePlanMutation(async (patch: Record<string, unknown>) => api.patch(`/microcycles/${micro.id}/`, patch));
  const remove = usePlanMutation(async () => api.delete(`/microcycles/${micro.id}/`));
  const options = !micro.phase || phases.some((p) => p.id === micro.phase?.id) ? phases : [micro.phase, ...phases];

  useEffect(() => setLength(String(micro.length_days)), [micro.length_days]);

  const saveLength = () => {
    const days = Number(length);
    if (Number.isInteger(days) && days >= 1 && days <= 90 && days !== micro.length_days) update.mutate({ length_days: days });
    else setLength(String(micro.length_days));
  };

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border border-rope bg-ring p-3"
      style={{ borderLeft: `4px solid ${micro.phase?.color ?? "transparent"}` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{t("cycles.microcycleNumber", { number })}</span>
        <DateRange start={micro.start_date} end={micro.end_date} />
        <span className="flex-1" />
        <button
          className="text-smoke hover:text-glove"
          aria-label={t("cycles.deleteMicrocycle", { number })}
          onClick={() => remove.mutate(undefined)}
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2">
        <select
          aria-label={t("cycles.phase")}
          value={micro.phase?.id ?? ""}
          onChange={(e) => update.mutate({ phase: e.target.value ? Number(e.target.value) : null })}
          className={`${fieldClass} min-w-0 flex-1`}
        >
          <option value="">{t("cycles.noPhase")}</option>
          {options.map((phase) => (
            <option key={phase.id} value={phase.id}>
              {phase.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-smoke">
          <input
            aria-label={t("cycles.lengthDays")}
            type="number"
            min={1}
            max={90}
            value={length}
            onChange={(e) => setLength(e.target.value)}
            onBlur={saveLength}
            className={`${fieldClass} w-14`}
          />
          {t("cycles.days")}
        </label>
      </div>
      <textarea
        aria-label={t("cycles.objective")}
        placeholder={t("cycles.objectivePlaceholder")}
        rows={2}
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        onBlur={() => objective !== micro.objective && update.mutate({ objective })}
        className={fieldClass}
      />
    </li>
  );
}
