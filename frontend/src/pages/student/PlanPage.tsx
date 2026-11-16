import { useTranslation } from "react-i18next";

import { useCurrentCycle } from "../../api/hooks";
import { PageHeader } from "../../components/ui";
import { DateRange } from "../coach/CyclesPage";

/** Read-only view of the gym's current macrocycle, with this week highlighted. */
export default function PlanPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useCurrentCycle();
  const macro = data?.macrocycle;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("plan.title")} />
      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {data && !macro && (
        <div className="rounded-xl border border-rope bg-canvas p-8 text-center text-smoke">{t("plan.empty")}</div>
      )}
      {macro && (
        <>
          <div>
            <h2 className="font-display text-3xl tracking-wide uppercase">{macro.name}</h2>
            <DateRange start={macro.start_date} end={macro.end_date} />
          </div>
          <ol className="flex flex-col gap-4">
            {macro.mesocycles.map((meso) => {
              const current = meso.id === data.mesocycle;
              return (
                <li
                  key={meso.id}
                  aria-current={current ? "step" : undefined}
                  className={`rounded-xl border bg-canvas p-4 ${current ? "border-glove" : "border-rope opacity-80"}`}
                  style={{ borderLeft: `6px solid ${meso.valence.color}` }}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-xl font-semibold">{meso.valence.name}</h3>
                    {meso.name && <span className="text-smoke">· {meso.name}</span>}
                    {current && (
                      <span className="rounded bg-glove px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                        {t("plan.now")}
                      </span>
                    )}
                    <span className="flex-1" />
                    <DateRange start={meso.start_date} end={meso.end_date} />
                  </div>
                  {current && (
                    <ol className="mt-3 flex flex-col gap-2">
                      {meso.microcycles.map((micro, index) => {
                        const thisWeek = micro.id === data.microcycle;
                        return (
                          <li
                            key={micro.id}
                            className={`rounded-lg p-3 ${thisWeek ? "bg-glove/15 ring-1 ring-glove" : "bg-ring"}`}
                          >
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-semibold">{t("cycles.microcycleNumber", { number: index + 1 })}</span>
                              {micro.phase && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-xs"
                                  style={{ backgroundColor: `${micro.phase.color}33`, color: micro.phase.color }}
                                >
                                  {micro.phase.name}
                                </span>
                              )}
                              {thisWeek && <span className="text-xs font-semibold text-glove">{t("plan.thisWeek")}</span>}
                              <span className="flex-1" />
                              <DateRange start={micro.start_date} end={micro.end_date} />
                            </div>
                            {micro.objective && <p className="mt-1 text-sm">{micro.objective}</p>}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
