import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useDrills, useStudents } from "../../api/hooks";
import type { CoachNote, Homework, User } from "../../api/types";
import Avatar from "../../components/Avatar";
import { Button, Input, Modal, PageHeader } from "../../components/ui";
import { addDays, formatDate, fromISODate, startOfWeek, toISODate } from "../../lib/dates";
import StudentLink from "../../components/StudentLink";
import FocusTextField from "../../components/FocusTextField";

const field = "rounded-md border border-rope bg-ring px-2 py-1.5 text-sm text-chalk outline-none focus:border-glove";

/** Coach view of one week: each student's focuses and notes, plus the week's homework. */
export default function WeekPage() {
  const { t, i18n } = useTranslation();
  const [week, setWeek] = useState(toISODate(startOfWeek(new Date())));
  const shift = (days: number) => setWeek(toISODate(addDays(fromISODate(week), days)));

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("week.title")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" aria-label={t("week.previous")} onClick={() => shift(-7)}>
              ←
            </Button>
            <span className="font-semibold">
              {t("week.weekOf", { date: formatDate(week, i18n.language, { day: "numeric", month: "long" }) })}
            </span>
            <Button variant="ghost" aria-label={t("week.next")} onClick={() => shift(7)}>
              →
            </Button>
          </div>
        }
      />
      <p className="-mt-4 text-sm text-smoke">{t("week.hint")}</p>
      <FocusTable />
      <HomeworkSection week={week} />
    </section>
  );
}

function FocusTable() {
  const { t } = useTranslation();
  const { data: students = [] } = useStudents();
  const [notesFor, setNotesFor] = useState<User | null>(null);

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("week.focuses")}</h2>
      <p className="mb-3 text-xs text-smoke">{t("studentProfile.focusesHint")}</p>
      <ul className="flex flex-col divide-y divide-rope">
        {students.map((student) => (
          <li key={student.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
            <div className="flex items-center justify-between gap-2 sm:w-48 sm:flex-col sm:items-start">
              <StudentLink id={student.id} className="flex items-center gap-2 font-medium">
                <Avatar person={student} /> {student.display_name}
              </StudentLink>
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setNotesFor(student)}>
                📝 {t("week.notes")}
              </Button>
            </div>
            <div className="flex-1">
              <FocusTextField student={student} rows={2} />
            </div>
          </li>
        ))}
      </ul>
      {notesFor && <NotesModal student={notesFor} onClose={() => setNotesFor(null)} />}
    </div>
  );
}

function NotesModal({ student, onClose }: { student: User; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = ["coach-notes", student.id];
  const [body, setBody] = useState("");
  const [visible, setVisible] = useState(true);
  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<CoachNote[]>("/coach-notes/", { params: { student: student.id } })).data,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: async () =>
      api.post("/coach-notes/", { student: student.id, body: body.trim(), visible_to_student: visible }),
    onSuccess: () => {
      setBody("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (note: CoachNote) => api.delete(`/coach-notes/${note.id}/`),
    onSuccess: refresh,
  });

  return (
    <Modal title={t("week.notesFor", { name: student.display_name })} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        {student.limitations && <p className="rounded-lg bg-belt/15 p-2 text-sm text-belt">⚠ {student.limitations}</p>}
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) create.mutate();
          }}
        >
          <textarea
            aria-label={t("week.newNote")}
            placeholder={t("week.newNote")}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={field}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            {t("week.visibleToStudent")}
          </label>
          <div>
            <Button type="submit" disabled={create.isPending}>
              {t("week.addNote")}
            </Button>
          </div>
        </form>
        {notes.length === 0 && <p className="text-sm text-smoke">{t("week.noNotes")}</p>}
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-rope bg-ring p-3 text-sm">
              <p className="whitespace-pre-line">{note.body}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-smoke">
                <span>{formatDate(note.created_at.slice(0, 10), i18n.language, { day: "numeric", month: "short" })}</span>
                <span>· {note.author_name}</span>
                <span>· {note.visible_to_student ? t("week.visibleToStudent") : t("week.hiddenFromStudent")}</span>
                <span className="flex-1" />
                <button className="hover:text-glove" aria-label={t("common.delete")} onClick={() => remove.mutate(note)}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function HomeworkSection({ week }: { week: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const { data: drills = [] } = useDrills();
  const key = ["homework", week];
  const { data: homework = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<Homework[]>("/homework/", { params: { week } })).data,
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drill, setDrill] = useState<number | "">("");
  const [everyone, setEveryone] = useState(true);
  const [participants, setParticipants] = useState<number[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: async () =>
      api.post("/homework/", {
        week_start: week,
        title: title.trim(),
        description,
        drill: drill === "" ? null : drill,
        is_broadcast: everyone,
        participants: everyone ? [] : participants,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDrill("");
      setParticipants([]);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (item: Homework) => api.delete(`/homework/${item.id}/`),
    onSuccess: refresh,
  });
  const names = (ids: number[]) =>
    ids.map((id) => students.find((s) => s.id === id)?.display_name).filter(Boolean).join(", ");
  const toggle = (id: number) =>
    setParticipants((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));
  const missingStudents = !everyone && participants.length === 0;

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-3 font-display text-2xl tracking-wide uppercase">{t("week.homework")}</h2>
      {homework.length === 0 && <p className="mb-3 text-sm text-smoke">{t("week.noHomework")}</p>}
      <ul className="mb-4 flex flex-col gap-2">
        {homework.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-lg border border-rope bg-ring p-3 text-sm">
            <span className="text-xl" aria-hidden>
              {item.drill_detail?.emoji ?? "🏠"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.title}</p>
              {item.description && <p className="whitespace-pre-line text-smoke">{item.description}</p>}
              <p className="text-xs text-belt">{item.is_broadcast ? t("week.everyone") : names(item.participants)}</p>
            </div>
            <button className="text-smoke hover:text-glove" aria-label={t("common.delete")} onClick={() => remove.mutate(item)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3 border-t border-rope pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() && !missingStudents) create.mutate();
        }}
      >
        <h3 className="font-semibold">{t("week.newHomework")}</h3>
        <Input label={t("week.homeworkTitle")} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("week.homeworkDescription")}</span>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("week.drill")}</span>
          <select value={drill} onChange={(e) => setDrill(e.target.value ? Number(e.target.value) : "")} className={field}>
            <option value="">{t("week.noDrill")}</option>
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.emoji} {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2" role="radiogroup">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={everyone === value}
              onClick={() => setEveryone(value)}
              className={`rounded-md border px-3 py-1.5 text-sm ${everyone === value ? "border-glove bg-glove/20" : "border-rope text-smoke"}`}
            >
              {value ? t("week.forEveryone") : t("week.forStudents")}
            </button>
          ))}
        </div>
        {!everyone && (
          <div className="flex flex-wrap gap-2">
            {students.map((student) => (
              <button
                type="button"
                key={student.id}
                aria-pressed={participants.includes(student.id)}
                onClick={() => toggle(student.id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  participants.includes(student.id) ? "bg-glove text-chalk" : "border border-rope text-smoke"
                }`}
              >
                <Avatar person={student} /> {student.display_name}
              </button>
            ))}
          </div>
        )}
        {missingStudents && <p className="text-xs text-smoke">{t("week.pickStudents")}</p>}
        <div>
          <Button type="submit" disabled={create.isPending || missingStudents}>
            + {t("week.addHomework")}
          </Button>
        </div>
      </form>
    </div>
  );
}
