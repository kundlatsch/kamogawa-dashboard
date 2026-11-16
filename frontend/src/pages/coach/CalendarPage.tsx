import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { api } from "../../api/client";
import { useSessions } from "../../api/hooks";
import type { TrainingSession } from "../../api/types";
import { KindBadge, StatusBadge } from "../../components/SessionBadge";
import SessionFormModal from "../../components/SessionFormModal";
import { Button, Input, Modal, PageHeader } from "../../components/ui";
import { addDays, formatDate, startOfWeek, toISODate, todayISO, weekdayNames } from "../../lib/dates";

const WEEKS = 4;

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [creating, setCreating] = useState<"EXTRA" | "SPARRING" | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

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

      <p className="-mt-4 mb-4 text-sm text-smoke">{t("calendar.hint")}</p>
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
              role="button"
              tabIndex={0}
              aria-label={formatDate(day, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
              onClick={() => setOpenDay(day)}
              onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setOpenDay(day)}
              className={`min-h-24 cursor-pointer bg-canvas p-1.5 hover:bg-ring ${day < today ? "opacity-50" : ""} ${
                day === today ? "ring-2 ring-glove ring-inset" : ""
              }`}
            >
              <div className="mb-1 text-xs text-smoke">{formatDate(day, i18n.language, { day: "numeric", month: "short" })}</div>
              <div className="flex flex-col gap-1">
                {(byDate.get(day) ?? []).map((session) => (
                  <button
                    key={session.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenDay(day);
                    }}
                    className={`flex flex-col items-start gap-1 rounded-md border p-1.5 text-left text-xs hover:border-chalk ${
                      session.status === "CANCELLED"
                        ? "border-rope bg-ring opacity-60"
                        : session.kind === "SPARRING"
                          ? "border-blood bg-blood/15"
                          : "border-rope bg-ring"
                    }`}
                  >
                    <div className="flex flex-wrap gap-1">
                      <KindBadge kind={session.kind} />
                      <StatusBadge status={session.status} />
                    </div>
                    <span className={`font-medium ${session.status === "CANCELLED" ? "line-through" : ""}`}>
                      {session.start_time?.slice(0, 5)} {session.title}
                    </span>
                    {session.cancel_reason && <span className="text-[10px] text-smoke">{session.cancel_reason}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {openDay && (
        <DayModal
          day={openDay}
          sessions={byDate.get(openDay) ?? []}
          onClose={() => setOpenDay(null)}
          onOpenSession={(session) => navigate(`/?session=${session.id}`)}
        />
      )}

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

/**
 * A calendar day: open its class in Planejamento or mark it as sparring (the coach's exercises stay),
 * or, on a free day, create an extra class with the date already set.
 */
function DayModal({
  day,
  sessions,
  onClose,
  onOpenSession,
}: {
  day: string;
  sessions: TrainingSession[];
  onClose: () => void;
  onOpenSession: (session: TrainingSession) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const convert = useMutation({
    mutationFn: async ({ session, kind }: { session: TrainingSession; kind: "SPARRING" | "REGULAR" }) =>
      api.post(`/sessions/${session.id}/convert/`, { kind }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const [cancelling, setCancelling] = useState<TrainingSession | null>(null);
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: async (session: TrainingSession) => api.post(`/sessions/${session.id}/cancel/`, { reason: reason.trim() }),
    onSuccess: () => {
      setCancelling(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
  const restore = useMutation({
    mutationFn: async (session: TrainingSession) => api.post(`/sessions/${session.id}/restore/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const title = formatDate(day, i18n.language, { weekday: "long", day: "numeric", month: "long" });
  const canCreate = day >= todayISO();

  if (creating || (sessions.length === 0 && canCreate)) {
    return (
      <SessionFormModal
        kind="EXTRA"
        fixedDate={day}
        onClose={onClose}
        onCreated={(session) => navigate(`/?session=${session.id}`)}
      />
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {sessions.length === 0 && <p className="text-sm text-smoke">{t("calendar.noClassPast")}</p>}
        {sessions.map((session) => {
          const sparring = session.kind === "SPARRING";
          if (session.status === "CANCELLED") {
            return (
              <div key={session.id} className="flex flex-col gap-2 rounded-lg border border-rope bg-ring p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={session.status} />
                  <span className="font-semibold line-through">{session.start_time?.slice(0, 5)}</span>
                  <span className="text-smoke">{session.cancel_reason}</span>
                </div>
                <div>
                  <Button variant="ghost" disabled={restore.isPending} onClick={() => restore.mutate(session)}>
                    {t("calendar.restore")}
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={session.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 ${sparring ? "border-blood bg-blood/15" : "border-rope bg-ring"}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <KindBadge kind={session.kind} />
                <StatusBadge status={session.status} />
                <span className="font-semibold">{session.start_time?.slice(0, 5)}</span>
                {session.title && <span>{session.title}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onOpenSession(session)}>{t("calendar.openPlanning")}</Button>
                <Button
                  variant={sparring ? "ghost" : "danger"}
                  disabled={convert.isPending}
                  onClick={() => {
                    const question = sparring
                      ? t("board.confirmRegular")
                      : session.status === "PUBLISHED"
                        ? t("board.confirmSparringPublished")
                        : t("board.confirmSparring");
                    if (window.confirm(question)) convert.mutate({ session, kind: sparring ? "REGULAR" : "SPARRING" });
                  }}
                >
                  {sparring ? t("board.toRegular") : `🥊 ${t("board.toSparring")}`}
                </Button>
                <Button variant="ghost" onClick={() => setCancelling(session)}>
                  {t("calendar.cancelClass")}
                </Button>
              </div>
              {cancelling?.id === session.id && (
                <form
                  className="flex flex-col gap-2 border-t border-rope pt-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (reason.trim()) cancel.mutate(session);
                  }}
                >
                  <Input
                    label={t("calendar.cancelReason")}
                    placeholder={t("calendar.cancelReasonPlaceholder")}
                    value={reason}
                    maxLength={200}
                    autoFocus
                    onChange={(event) => setReason(event.target.value)}
                    required
                  />
                  <p className="text-xs text-smoke">{t("calendar.cancelHint")}</p>
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" disabled={cancel.isPending || !reason.trim()}>
                      {t("calendar.confirmCancel")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setCancelling(null)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
        {canCreate && sessions.length > 0 && (
          <Button variant="ghost" onClick={() => setCreating(true)}>
            + {t("calendar.anotherExtra")}
          </Button>
        )}
      </div>
    </Modal>
  );
}
