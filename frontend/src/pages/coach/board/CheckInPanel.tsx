import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../../api/client";
import type { CheckIn, TrainingSession, User } from "../../../api/types";
import Avatar from "../../../components/Avatar";
import { todayISO } from "../../../lib/dates";
import StudentLink from "../../../components/StudentLink";

/**
 * Who confirmed presence for the class, with pain alerts and limitations, so the coach can build
 * pairs; after class the coach marks who actually came.
 */
export default function CheckInPanel({
  session,
  checkIns,
  students,
}: {
  session: TrainingSession;
  checkIns: CheckIn[];
  students: User[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<number | "">("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["checkins", session.id] });
  const add = useMutation({
    mutationFn: async (student: number) => api.post("/checkins/", { session: session.id, student }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ checkIn, attended }: { checkIn: CheckIn; attended: boolean | null }) =>
      api.patch(`/checkins/${checkIn.id}/`, { attended }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (checkIn: CheckIn) => api.delete(`/checkins/${checkIn.id}/`),
    onSuccess: refresh,
  });

  const byId = new Map(students.map((s) => [s.id, s]));
  const missing = students.filter((s) => !checkIns.some((c) => c.student === s.id));
  const canConfirmAttendance = session.date <= todayISO();

  return (
    <section aria-label={t("board.checkins")} className="flex flex-col gap-2 rounded-xl border border-rope bg-canvas p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg tracking-wide uppercase">✋ {t("board.checkins")}</h2>
        <span className="text-sm text-smoke">{t("board.checkedIn", { count: checkIns.length })}</span>
        <span className="flex-1" />
        {missing.length > 0 && (
          <select
            aria-label={t("board.addCheckin")}
            value={adding}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) add.mutate(id);
              setAdding("");
            }}
            className="rounded-md border border-rope bg-ring px-2 py-1 text-sm text-chalk"
          >
            <option value="">+ {t("board.addCheckin")}</option>
            {missing.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        )}
      </div>
      {session.status === "DRAFT" && <p className="text-xs text-belt">{t("board.publishToCheckIn")}</p>}
      {checkIns.length === 0 && <p className="text-sm text-smoke">{t("board.noCheckins")}</p>}
      {canConfirmAttendance && checkIns.length > 0 && <p className="text-xs text-smoke">{t("board.attendanceHint")}</p>}
      <ul className="flex flex-wrap gap-2">
        {checkIns.map((checkIn) => {
          const student = byId.get(checkIn.student);
          if (!student) return null;
          return (
            <li
              key={checkIn.id}
              className={`flex max-w-full flex-col gap-1 rounded-lg border px-2 py-1.5 text-sm ${
                checkIn.has_pain ? "border-blood bg-blood/15" : "border-rope bg-ring"
              } ${checkIn.attended === false ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Avatar person={student} />
                <StudentLink id={student.id} className="font-semibold">
                  {student.display_name}
                </StudentLink>
                {student.handedness !== "UNSPECIFIED" && (
                  <span className="rounded bg-rope px-1 text-[10px] font-bold uppercase" title={t(`handedness.${student.handedness}`)}>
                    {t(`handedness.${student.handedness}`)}
                  </span>
                )}
                {checkIn.added_by_coach && <span className="text-[10px] text-smoke">({t("board.addedByCoach")})</span>}
                {canConfirmAttendance && (
                  <span className="flex gap-1">
                    {[true, false].map((value) => (
                      <button
                        key={String(value)}
                        aria-pressed={checkIn.attended === value}
                        onClick={() => update.mutate({ checkIn, attended: checkIn.attended === value ? null : value })}
                        className={`rounded px-1.5 text-xs ${
                          checkIn.attended === value
                            ? value
                              ? "bg-belt text-ring"
                              : "bg-blood text-chalk"
                            : "border border-rope text-smoke hover:text-chalk"
                        }`}
                      >
                        {value ? t("board.attended") : t("board.absent")}
                      </button>
                    ))}
                  </span>
                )}
                <button
                  className="text-smoke hover:text-glove"
                  aria-label={t("board.removeCheckin", { name: student.display_name })}
                  onClick={() => remove.mutate(checkIn)}
                >
                  ✕
                </button>
              </div>
              {checkIn.has_pain && (
                <p className="text-xs font-semibold text-chalk">
                  🤕{" "}
                  {checkIn.pain_level !== null
                    ? t("board.painAlert", { location: checkIn.pain_location, level: checkIn.pain_level })
                    : t("board.painAlertNoLevel", { location: checkIn.pain_location })}
                </p>
              )}
              {checkIn.notes && <p className="text-xs text-smoke">💬 {checkIn.notes}</p>}
              {student.limitations && <p className="line-clamp-2 text-xs text-belt">⚠ {student.limitations}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
