import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useCurrentCycle } from "../api/hooks";
import type { MyWeek } from "../api/types";

/** Student's week at a glance: the week's objective and phase, the coach's focuses for them and homework. */
export default function WeekCard() {
  const { t } = useTranslation();
  const { data: cycle } = useCurrentCycle();
  const { data: week } = useQuery({
    queryKey: ["me", "week"],
    queryFn: async () => (await api.get<MyWeek>("/me/week/")).data,
  });

  const mesocycle = cycle?.macrocycle?.mesocycles.find((m) => m.id === cycle.mesocycle);
  const microcycle = mesocycle?.microcycles.find((m) => m.id === cycle?.microcycle);
  const hasContent = Boolean(microcycle || week?.focus_text || week?.homework.length);
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
      {week?.focus_text && (
        <div>
          <p className="mb-1 text-xs tracking-wider text-smoke uppercase">{t("student.yourFocuses")}</p>
          <p className="rounded-lg border border-glove/60 bg-glove/10 px-3 py-2 text-sm whitespace-pre-line">{week.focus_text}</p>
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
