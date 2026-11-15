import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useSessions } from "../../api/hooks";
import type { TrainingSession } from "../../api/types";
import { KindBadge, StatusBadge } from "../../components/SessionBadge";
import SessionFormModal from "../../components/SessionFormModal";
import { Button, PageHeader } from "../../components/ui";
import { addDays, formatDate, startOfWeek, toISODate, todayISO, weekdayNames } from "../../lib/dates";

const WEEKS = 4;

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [creating, setCreating] = useState<"EXTRA" | "SPARRING" | null>(null);

  const firstDay = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: WEEKS * 7 }, (_, i) => toISODate(addDays(firstDay, i))), [firstDay]);
  const { data: sessions = [], isLoading } = useSessions(days[0], days[days.length - 1]);
  const byDate = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    sessions.forEach((session) => map.set(session.date, [...(map.get(session.date) ?? []), session]));
    return map;
  }, [sessions]);
  const today = todayISO();
  const names = weekdayNames(i18n.language, "short");

  return (
    <section>
      <PageHeader
        title={t("nav.calendar")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setCreating("EXTRA")}>
              + {t("sessions.newExtra")}
            </Button>
            <Button
              onClick={() => setCreating("SPARRING")}
              className="!bg-blood shadow-[0_0_20px_#d6282888] hover:!bg-blood-dark"
            >
              🥊 {t("sessions.createSparring")}
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" onClick={() => setWeekOffset((w) => w - WEEKS)} aria-label={t("calendar.previous")}>
          ‹
        </Button>
        <Button variant="ghost" onClick={() => setWeekOffset(0)}>
          {t("calendar.today")}
        </Button>
        <Button variant="ghost" onClick={() => setWeekOffset((w) => w + WEEKS)} aria-label={t("calendar.next")}>
          ›
        </Button>
        <span className="ml-2 text-smoke first-letter:uppercase">
          {formatDate(days[0], i18n.language, { month: "long", year: "numeric" })}
        </span>
        {isLoading && <span className="text-sm text-smoke">{t("common.loading")}</span>}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-rope bg-rope">
          {names.map((name) => (
            <div key={name} className="bg-ring px-2 py-1 text-center text-xs font-bold text-smoke uppercase">
              {name}
            </div>
          ))}
          {days.map((day) => (
            <div
              key={day}
              className={`min-h-24 bg-canvas p-1.5 ${day < today ? "opacity-50" : ""} ${
                day === today ? "ring-2 ring-glove ring-inset" : ""
              }`}
            >
              <div className="mb-1 text-xs text-smoke">{formatDate(day, i18n.language, { day: "numeric", month: "short" })}</div>
              <div className="flex flex-col gap-1">
                {(byDate.get(day) ?? []).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => navigate(`/?session=${session.id}`)}
                    className={`flex flex-col items-start gap-1 rounded-md border p-1.5 text-left text-xs hover:border-chalk ${
                      session.kind === "SPARRING" ? "border-blood bg-blood/15" : "border-rope bg-ring"
                    }`}
                  >
                    <div className="flex flex-wrap gap-1">
                      <KindBadge kind={session.kind} />
                      <StatusBadge status={session.status} />
                    </div>
                    <span className="font-medium">
                      {session.start_time?.slice(0, 5)} {session.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {creating && (
        <SessionFormModal
          kind={creating}
          onClose={() => setCreating(null)}
          onCreated={(session) => navigate(`/?session=${session.id}`)}
        />
      )}
    </section>
  );
}
