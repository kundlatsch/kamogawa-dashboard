import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import type { User } from "../api/types";

/** The coach's free-text focuses for a student; saved when the field loses focus. Students only read it. */
export default function FocusTextField({ student, rows = 3 }: { student: User; rows?: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState(student.focus_text);
  useEffect(() => setText(student.focus_text), [student.focus_text]);
  const save = useMutation({
    mutationFn: async (focus_text: string) => api.patch(`/students/${student.id}/`, { focus_text }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/students/"] }),
  });
  const saved = !save.isPending && text === student.focus_text;
  return (
    <div className="flex flex-col gap-1">
      <textarea
        aria-label={t("focus.for", { name: student.display_name })}
        value={text}
        rows={rows}
        maxLength={1000}
        placeholder={t("focus.placeholder")}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => text !== student.focus_text && save.mutate(text.trim())}
        className="w-full resize-y rounded-md border border-rope bg-ring px-3 py-2 text-sm text-chalk outline-none focus:border-glove"
      />
      {save.isError && <p className="text-xs text-glove">{t("focus.saveError")}</p>}
      {save.isSuccess && saved && <p className="text-xs text-smoke">{t("focus.saved")}</p>}
    </div>
  );
}
