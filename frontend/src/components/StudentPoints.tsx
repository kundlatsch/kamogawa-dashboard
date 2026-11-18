import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import type { StudentPoint } from "../api/types";

const KINDS: StudentPoint["kind"][] = ["STRENGTH", "WEAKNESS"];
const kindColor = { STRENGTH: "text-belt", WEAKNESS: "text-glove" } as const;
const kindIcon = { STRENGTH: "💪", WEAKNESS: "🎯" } as const;

/** Read-only strengths and weaknesses, side by side (what the student sees). */
export function StudentPointLists({ points }: { points: StudentPoint[] }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {KINDS.map((kind) => {
        const items = points.filter((p) => p.kind === kind);
        return (
          <div key={kind}>
            <h3 className={`mb-2 text-sm font-semibold ${kindColor[kind]}`}>
              {kindIcon[kind]} {t(`points.${kind}`)}
            </h3>
            {items.length === 0 ? (
              <p className="text-sm text-smoke">{t("points.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {items.map((point) => (
                  <li key={point.id} className="rounded-lg bg-ring px-3 py-2 text-sm whitespace-pre-line">
                    {point.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Coach view: write, edit and remove strengths and weaknesses right on the student profile. */
export function EditableStudentPoints({ studentId }: { studentId: number }) {
  const queryKey = ["student-points", studentId];
  const { data: points = [] } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<StudentPoint[]>("/student-points/", { params: { student: studentId } })).data,
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {KINDS.map((kind) => (
        <EditableList key={kind} kind={kind} studentId={studentId} points={points.filter((p) => p.kind === kind)} />
      ))}
    </div>
  );
}

function EditableList({ kind, studentId, points }: { kind: StudentPoint["kind"]; studentId: number; points: StudentPoint[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["student-points", studentId] });
  const add = useMutation({
    mutationFn: async (text: string) => api.post("/student-points/", { student: studentId, kind, text }),
    onSuccess: () => {
      setDraft("");
      refresh();
    },
  });
  return (
    <div>
      <h3 className={`mb-2 text-sm font-semibold ${kindColor[kind]}`}>
        {kindIcon[kind]} {t(`points.${kind}`)}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {points.map((point) => (
          <EditablePoint key={point.id} point={point} onChange={refresh} />
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) add.mutate(draft.trim());
        }}
      >
        <input
          value={draft}
          maxLength={300}
          placeholder={t("studentProfile.newPoint")}
          aria-label={`${t(`points.${kind}`)}: ${t("studentProfile.newPoint")}`}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-rope bg-ring px-3 py-1.5 text-sm text-chalk outline-none focus:border-glove"
        />
        <button
          type="submit"
          disabled={!draft.trim() || add.isPending}
          className="rounded-md border border-rope px-3 text-xs font-semibold text-chalk hover:border-smoke disabled:opacity-50"
        >
          {t("studentProfile.addPoint")}
        </button>
      </form>
    </div>
  );
}

/** One line of the list: edit in place (saved when leaving the field or pressing Enter) or remove. */
function EditablePoint({ point, onChange }: { point: StudentPoint; onChange: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(point.text);
  const save = useMutation({
    mutationFn: async () => api.patch(`/student-points/${point.id}/`, { text: text.trim() }),
    onSuccess: onChange,
  });
  const remove = useMutation({ mutationFn: async () => api.delete(`/student-points/${point.id}/`), onSuccess: onChange });
  const commit = () => {
    if (!text.trim()) setText(point.text);
    else if (text.trim() !== point.text) save.mutate();
  };
  return (
    <li className="flex items-center gap-1 rounded-lg bg-ring pr-1">
      <input
        value={text}
        maxLength={300}
        aria-label={t(`points.${point.kind}`)}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-chalk outline-none focus:border-glove"
      />
      <button
        type="button"
        aria-label={t("studentProfile.removePoint", { text: point.text })}
        disabled={remove.isPending}
        onClick={() => remove.mutate()}
        className="rounded px-2 py-1 text-smoke hover:text-glove"
      >
        ✕
      </button>
    </li>
  );
}
