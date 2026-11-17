import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import type { CheckInState } from "../api/types";
import { formatDate, toISODate } from "../lib/dates";
import { Button, Input, Modal } from "./ui";

/** Student check-in for one class: confirm presence before the deadline, with an optional pain report. */
export default function CheckInButton({ sessionId, state }: { sessionId: number; state: CheckInState }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["me"] });
  const cancel = useMutation({
    mutationFn: async () => api.delete(`/me/checkins/${sessionId}/`),
    onSuccess: refresh,
  });

  const deadline = new Date(state.deadline);
  const time = deadline.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const sameDay = toISODate(deadline) === toISODate(new Date());
  const until = sameDay
    ? t("checkin.until", { time })
    : t("checkin.untilDate", { date: formatDate(toISODate(deadline), i18n.language, { day: "numeric", month: "short" }), time });
  const mine = state.mine;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {mine ? (
        <span className="rounded-full bg-belt/20 px-3 py-1 font-semibold text-belt">
          ✓ {t("checkin.confirmed")}
          {mine.has_pain && <span className="text-glove"> · 🤕 {t("checkin.withPain")}</span>}
        </span>
      ) : (
        !state.open && <span className="text-smoke">{t("checkin.notCheckedIn")}</span>
      )}
      {state.open ? (
        <>
          <Button
            variant={mine ? "ghost" : "primary"}
            // Comfortable thumb target on phones; compact from md up.
            className="max-md:min-h-11 md:!py-1"
            onClick={() => setEditing(true)}
          >
            {mine ? t("checkin.edit") : `✋ ${t("checkin.confirm")}`}
          </Button>
          {mine && (
            <button
              className="rounded-md px-2 py-2 text-xs text-smoke underline hover:text-glove md:p-0"
              onClick={() => cancel.mutate()}
            >
              {t("checkin.cancel")}
            </button>
          )}
          <span className="text-xs text-smoke">{until}</span>
        </>
      ) : (
        <span className="text-xs text-smoke">· {t("checkin.closed")}</span>
      )}
      {editing && (
        <CheckInForm
          sessionId={sessionId}
          state={state}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CheckInForm({
  sessionId,
  state,
  onClose,
  onSaved,
}: {
  sessionId: number;
  state: CheckInState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [hasPain, setHasPain] = useState(state.mine?.has_pain ?? false);
  const [location, setLocation] = useState(state.mine?.pain_location ?? "");
  const [level, setLevel] = useState(state.mine?.pain_level ?? 3);
  const [notes, setNotes] = useState(state.mine?.notes ?? "");
  const save = useMutation({
    mutationFn: async () =>
      api.put(`/me/checkins/${sessionId}/`, {
        has_pain: hasPain,
        pain_location: hasPain ? location.trim() : "",
        pain_level: hasPain ? level : null,
        notes: notes.trim(),
      }),
    onSuccess: onSaved,
  });

  return (
    <Modal title={t("checkin.title")} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="flex gap-2" role="radiogroup">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={hasPain === value}
              onClick={() => setHasPain(value)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${
                hasPain === value ? (value ? "border-blood bg-blood/20" : "border-belt bg-belt/15") : "border-rope text-smoke"
              }`}
            >
              {value ? `🤕 ${t("checkin.hasPain")}` : `💪 ${t("checkin.noPain")}`}
            </button>
          ))}
        </div>
        {hasPain && (
          <>
            <Input
              label={t("checkin.painLocation")}
              placeholder={t("checkin.painLocationPlaceholder")}
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-smoke">{t("checkin.painLevel", { level })}</span>
              <input
                type="range"
                min={0}
                max={10}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="accent-[var(--color-blood)]"
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("checkin.notes")}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-rope bg-ring px-3 py-2 text-chalk outline-none focus:border-glove"
          />
        </label>
        {save.isError && <p className="text-sm text-glove">{t("checkin.error")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {t("checkin.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
