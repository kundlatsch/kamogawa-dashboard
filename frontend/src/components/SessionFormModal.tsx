import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import type { SessionKind, TrainingSession } from "../api/types";
import { todayISO } from "../lib/dates";
import { Button, Input, Modal } from "./ui";

/** Creates an extra or sparring session on any date. */
export default function SessionFormModal({
  kind,
  onClose,
  onCreated,
}: {
  kind: Exclude<SessionKind, "REGULAR">;
  onClose: () => void;
  onCreated?: (session: TrainingSession) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("19:00");
  const [title, setTitle] = useState(kind === "SPARRING" ? t("sessions.sparringDefaultTitle") : "");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const payload = { date, start_time: startTime || null, title, notes, kind };
      const endpoint = kind === "SPARRING" ? "/sessions/sparring/" : "/sessions/";
      return (await api.post<TrainingSession>(endpoint, payload)).data;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      onCreated?.(session);
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  const isSparring = kind === "SPARRING";
  return (
    <Modal title={isSparring ? t("sessions.newSparring") : t("sessions.newExtra")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {isSparring && <p className="rounded-lg bg-glove/15 p-3 text-sm text-chalk">{t("sessions.sparringHint")}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("sessions.date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label={t("sessions.time")} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <Input label={t("sessions.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("sessions.notes")}</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-rope bg-ring px-3 py-2 text-chalk outline-none focus:border-glove"
          />
        </label>
        {create.isError && <p className="text-sm text-glove">{t("sessions.saveError")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {isSparring ? `🥊 ${t("sessions.createSparring")}` : t("common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
