import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { Assignment, User } from "../../../api/types";
import DrillCard from "../../../components/DrillCard";
import { Button, Input, Modal } from "../../../components/ui";
import Avatar from "../../../components/Avatar";

export interface AssignmentChanges {
  notes: string;
  rounds: number | null;
  duration_minutes: number | null;
  participants: number[];
}

export default function AssignmentModal({
  assignment,
  students,
  onSave,
  onDelete,
  onClose,
}: {
  assignment: Assignment;
  students: User[];
  onSave: (changes: AssignmentChanges) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(assignment.notes);
  const [rounds, setRounds] = useState<number | null>(assignment.rounds);
  const [duration, setDuration] = useState<number | null>(assignment.duration_minutes);
  const [participants, setParticipants] = useState<number[]>(assignment.participants);
  const numberOrNull = (value: string) => (value === "" ? null : Math.max(0, Number(value)));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ notes, rounds, duration_minutes: duration, participants });
  }

  const toggle = (id: number) =>
    setParticipants((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));

  return (
    <Modal title={assignment.drill_detail.name} onClose={onClose}>
      <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="mx-auto w-48">
          <DrillCard drill={assignment.drill_detail} compact />
        </div>
        {assignment.is_broadcast ? (
          <p className="rounded-lg bg-belt/15 p-2 text-sm text-belt">📣 {t("board.broadcastHint")}</p>
        ) : (
          <fieldset>
            <legend className="mb-1 text-sm text-smoke">{t("board.participants")}</legend>
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
          </fieldset>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("drills.rounds")}
            type="number"
            min={0}
            placeholder={assignment.drill_detail.default_rounds?.toString() ?? ""}
            value={rounds ?? ""}
            onChange={(e) => setRounds(numberOrNull(e.target.value))}
          />
          <Input
            label={t("drills.minutes")}
            type="number"
            min={0}
            placeholder={assignment.drill_detail.default_duration_minutes?.toString() ?? ""}
            value={duration ?? ""}
            onChange={(e) => setDuration(numberOrNull(e.target.value))}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("board.notes")}</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-rope bg-ring px-3 py-2 text-chalk outline-none focus:border-glove"
          />
        </label>
        <div className="flex justify-between gap-2">
          <Button type="button" variant="danger" onClick={onDelete}>
            {t("board.removeDrill")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!assignment.is_broadcast && participants.length === 0}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
