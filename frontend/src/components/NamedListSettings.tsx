import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useNamedList } from "../api/hooks";
import type { NamedItem } from "../api/types";
import { ColorPicker } from "./pickers";
import { Button, Input } from "./ui";

type Item = NamedItem & { group?: string };

/**
 * Settings card for a coach-editable list (valences, microcycle phases, ...).
 * Removing an item archives it on the server, so cycles that used it keep their history.
 */
export default function NamedListSettings({
  path,
  title,
  hint,
  nameLabel,
  addLabel,
  groups,
}: {
  path: string;
  title: string;
  hint: string;
  nameLabel: string;
  addLabel: string;
  /** Optional `group` field the items carry (e.g. physical vs technical metrics). */
  groups?: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: items = [] } = useNamedList(path);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#d62828");
  const [group, setGroup] = useState(groups?.[0]?.value ?? "");
  const refresh = () => queryClient.invalidateQueries({ queryKey: [path] });

  const create = useMutation({
    mutationFn: async () => api.post(path, { name: name.trim(), color, ...(groups ? { group } : {}) }),
    onSuccess: () => {
      setName("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (item: Item) => api.delete(`${path}${item.id}/`),
    onSuccess: refresh,
  });

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{title}</h2>
      <p className="mb-4 text-sm text-smoke">{hint}</p>
      <ul className="mb-4 flex flex-wrap gap-2">
        {(items as Item[]).map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-full border border-rope py-1 pr-2 pl-3 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
            {groups && "group" in item && (
              <span className="text-xs text-smoke">· {groups.find((g) => g.value === item.group)?.label}</span>
            )}
            <button
              aria-label={`${t("common.delete")} ${item.name}`}
              className="text-smoke hover:text-glove"
              onClick={() => remove.mutate(item)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Input label={nameLabel} value={name} onChange={(event) => setName(event.target.value)} />
        {groups && (
          <div className="flex gap-2" role="radiogroup">
            {groups.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={group === option.value}
                onClick={() => setGroup(option.value)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  group === option.value ? "border-glove bg-glove/20" : "border-rope text-smoke"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={create.isPending}>
            + {addLabel}
          </Button>
          {create.isError && <span className="text-sm text-glove">{t("settings.duplicateName")}</span>}
        </div>
      </form>
    </div>
  );
}
