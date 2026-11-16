import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useCurrentCycle } from "../api/hooks";
import type { MyWeek } from "../api/types";

/** Student's week at a glance: the week's objective and phase, their two focuses and homework. */
export default function WeekCard() {
  const { t } = useTranslation();
  const { data: cycle } = useCurrentCycle();
  const { data: week } = useQuery({
    queryKey: ["me", "week"],
    queryFn: async () => (await api.get<MyWeek>("/me/week/")).data,
  });

  const mesocycle = cycle?.macrocycle?.mesocycles.find((m) => m.id === cycle.mesocycle);
  const microcycle = mesocycle?.microcycles.find((m) => m.id === cycle?.microcycle);
  const hasContent = Boolean(microcycle || week?.focuses.length || week?.homework.length);
  if (!hasContent) return null;

  return (
    <section aria-label={t("student.thisWeek")} className="flex flex-col gap-3 rounded-xl border border-rope bg-canvas p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl tracking-wide uppercase">{t("student.thisWeek")}</h2>
        {mesocycle && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: `${mesocycle.valence.color}33`, color: mesocycle.valence.color }}
          >
            {mesocycle.valence.name}
          </span>
        )}
        {microcycle?.phase && <span className="text-xs text-smoke">· {microcycle.phase.name}</span>}
      </div>
      {microcycle?.objective && (
        <p className="text-sm">
          <span className="font-semibold text-belt">🎯 {t("student.weekObjective")}:</span> {microcycle.objective}
        </p>
      )}
      {week && week.focuses.length > 0 && (
        <div>
          <p className="mb-1 text-xs tracking-wider text-smoke uppercase">{t("student.yourFocuses")}</p>
          <ul className="flex flex-wrap gap-2">
            {week.focuses.map((focus) => (
              <li
                key={focus.id}
                className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: focus.focus_detail.color, backgroundColor: `${focus.focus_detail.color}22` }}
              >
                {focus.position}. {focus.focus_detail.name}
                {focus.note && <span className="block text-xs font-normal text-smoke">{focus.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {week && week.homework.length > 0 && (
        <div>
          <p className="mb-1 text-xs tracking-wider text-smoke uppercase">{t("student.homework")}</p>
          <ul className="flex flex-col gap-2">
            {week.homework.map((item) => (
              <li key={item.id} className="flex gap-2 rounded-lg bg-ring p-2 text-sm">
                <span aria-hidden>{item.drill_detail?.emoji ?? "🏠"}</span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  {item.description && <p className="whitespace-pre-line text-smoke">{item.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
