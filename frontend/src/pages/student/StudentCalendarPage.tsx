import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { api } from "../../api/client";
import type { CalendarEntry } from "../../api/types";
import CheckInButton from "../../components/CheckInButton";
import { KindBadge } from "../../components/SessionBadge";
import { Button, PageHeader } from "../../components/ui";
import { addDays, formatDate, startOfWeek, toISODate, todayISO, weekdayNames } from "../../lib/dates";

const WEEKS = 4;

/**
 * Student calendar: every class day is shown (from the coach's schedule even before it is
 * published); published classes open with their exercises.
 */
export default function StudentCalendarPage() {
  const { t, i18n } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const firstDay = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: WEEKS * 7 }, (_, i) => toISODate(addDays(firstDay, i))), [firstDay]);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["me", "calendar", days[0]],
    queryFn: async () =>
      (await api.get<CalendarEntry[]>("/me/calendar/", { params: { from: days[0], to: days[days.length - 1] } })).data,
  });
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    entries.forEach((entry) => map.set(entry.date, [...(map.get(entry.date) ?? []), entry]));
    return map;
  }, [entries]);
  const today = todayISO();
  const names = weekdayNames(i18n.language, "short");
  // Every class still ahead: published ones open with exercises, drafts only take check-ins.
  const upcoming = entries.filter((e) => e.date >= today && (e.published || e.checkin || e.cancelled));
  const time = (entry: CalendarEntry) => entry.start_time?.slice(0, 5) ?? "";

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("nav.upcoming")} />
      <p className="-mt-4 text-sm text-smoke">{t("studentCalendar.hint")}</p>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setWeekOffset((w) => w - WEEKS)} aria-label={t("calendar.previous")}>
          ‹
        </Button>
        <Button variant="ghost" onClick={() => setWeekOffset(0)}>
          {t("calendar.today")}
        </Button>
        <Button variant="ghost" onClick={() => setWeekOffset((w) => w + WEEKS)} aria-label={t("calendar.next")}>
          ›
        </Button>
        <span className="ml-1 text-sm text-smoke first-letter:uppercase">
          {formatDate(days[0], i18n.language, { month: "long", year: "numeric" })}
        </span>
        {isLoading && <span className="text-sm text-smoke">{t("common.loading")}</span>}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-rope bg-rope">
        {names.map((name) => (
          <div key={name} className="bg-ring py-1 text-center text-[10px] font-bold text-smoke uppercase">
            {name}
          </div>
        ))}
        {days.map((day) => (
          <div
            key={day}
            className={`flex min-h-16 flex-col gap-1 bg-canvas p-1 ${day < today ? "opacity-50" : ""} ${
              day === today ? "ring-2 ring-glove ring-inset" : ""
            }`}
          >
            <span className="text-[10px] text-smoke">{formatDate(day, i18n.language, { day: "numeric" })}</span>
            {(byDate.get(day) ?? []).map((entry, index) =>
              entry.cancelled ? (
                <span
                  key={`cancelled-${entry.id}`}
                  title={entry.cancel_reason}
                  className="rounded px-1 py-0.5 text-[11px] leading-tight text-smoke line-through"
                >
                  {time(entry) || t("studentCalendar.class")}
                </span>
              ) : entry.published && entry.id ? (
                <Link
                  key={entry.id}
                  to={`/class/${entry.id}`}
                  className={`rounded px-1 py-0.5 text-[11px] font-semibold leading-tight hover:ring-1 hover:ring-chalk ${
                    entry.kind === "SPARRING" ? "bg-blood text-chalk" : "bg-glove/80 text-chalk"
                  }`}
                >
                  {entry.kind === "SPARRING" ? "🥊 " : ""}
                  {time(entry)}
                </Link>
              ) : (
                <span
                  key={`planned-${index}`}
                  title={t("studentCalendar.planned")}
                  className="rounded border border-dashed border-rope px-1 py-0.5 text-[11px] leading-tight text-smoke"
                >
                  {time(entry) || t("studentCalendar.class")}
                </span>
              ),
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-smoke">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-glove/80 align-middle" /> {t("studentCalendar.legendPublished")}
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded border border-dashed border-smoke align-middle" />{" "}
          {t("studentCalendar.legendPlanned")}
        </span>
      </div>

      <h2 className="mt-2 font-display text-2xl tracking-wide uppercase">{t("studentCalendar.upcoming")}</h2>
      {!isLoading && upcoming.length === 0 && <p className="text-sm text-smoke">{t("student.noUpcoming")}</p>}
      <ul className="flex flex-col gap-2">
        {upcoming.map((entry) => (
          <li
            key={entry.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
              entry.cancelled
                ? "border-rope bg-canvas opacity-70"
                : entry.kind === "SPARRING"
                  ? "border-blood bg-blood/15"
                  : "border-rope bg-canvas"
            }`}
          >
            {entry.published ? (
              <Link to={`/class/${entry.id}`} className="font-semibold first-letter:uppercase hover:text-glove hover:underline">
                {formatDate(entry.date, i18n.language, { weekday: "long", day: "numeric", month: "short" })}
              </Link>
            ) : (
              <span className={`font-semibold first-letter:uppercase ${entry.cancelled ? "line-through" : ""}`}>
                {formatDate(entry.date, i18n.language, { weekday: "long", day: "numeric", month: "short" })}
              </span>
            )}
            <span className="text-smoke">{time(entry)}</span>
            {entry.kind && <KindBadge kind={entry.kind} />}
            {entry.title && <span className="text-sm">{entry.title}</span>}
            {entry.cancelled && (
              <span className="text-sm text-glove">
                {t("studentCalendar.cancelled")}: {entry.cancel_reason}
              </span>
            )}
            {entry.published ? (
              <Link to={`/class/${entry.id}`} className="ml-auto text-xs text-smoke underline hover:text-chalk">
                {t("studentCalendar.seeExercises")}
              </Link>
            ) : (
              !entry.cancelled && <span className="ml-auto text-xs text-smoke">{t("studentCalendar.notPublishedYet")}</span>
            )}
            {entry.checkin && (
              <div className="w-full">
                <CheckInButton sessionId={entry.id!} state={entry.checkin} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
