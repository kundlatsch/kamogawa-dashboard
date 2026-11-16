import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useSessionBlocks } from "../api/hooks";
import type { BlockMode, SessionBlock } from "../api/types";
import { ColorPicker } from "./pickers";
import { Button, Input } from "./ui";

const MODES: BlockMode[] = ["COLLECTIVE", "INDIVIDUAL", "PAIRS"];
const PATH = "/session-blocks/";
const field = "rounded-md border border-rope bg-ring px-2 py-1.5 text-sm text-chalk outline-none focus:border-glove";

/** The parts of every class, in order, with how each one runs and its fixed start time. */
export default function BlockSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: blocks = [] } = useSessionBlocks();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#d62828");
  const [mode, setMode] = useState<BlockMode>("COLLECTIVE");
  const refresh = () => queryClient.invalidateQueries({ queryKey: [PATH] });

  const create = useMutation({
    mutationFn: async () => api.post(PATH, { name: name.trim(), color, mode }),
    onSuccess: () => {
      setName("");
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: async ({ block, patch }: { block: SessionBlock; patch: Partial<SessionBlock> }) =>
      api.patch(`${PATH}${block.id}/`, patch),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (block: SessionBlock) => api.delete(`${PATH}${block.id}/`),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: async (ids: number[]) => api.post(`${PATH}reorder/`, { ids }),
    onSuccess: refresh,
  });

  const move = (index: number, delta: number) => {
    const ids = blocks.map((b) => b.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("settings.blocks")}</h2>
      <p className="mb-4 text-sm text-smoke">{t("settings.blocksHint")}</p>
      <ol className="mb-4 flex flex-col gap-2">
        {blocks.map((block, index) => (
          <li
            key={block.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-rope bg-ring p-2 text-sm"
            style={{ borderLeft: `4px solid ${block.color}` }}
          >
            <span className="w-6 text-center text-smoke">{index + 1}</span>
            <span className="min-w-32 flex-1 font-semibold">{block.name}</span>
            <select
              aria-label={`${t("settings.blockMode")} ${block.name}`}
              value={block.mode}
              onChange={(e) => update.mutate({ block, patch: { mode: e.target.value as BlockMode } })}
              className={field}
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`settings.mode.${m}`)}
                </option>
              ))}
            </select>
            {block.mode === "COLLECTIVE" && (
              <OffsetInput block={block} onSave={(value) => update.mutate({ block, patch: { start_offset_minutes: value } })} />
            )}
            <button
              className="px-1 text-smoke hover:text-chalk disabled:opacity-30"
              aria-label={`↑ ${block.name}`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              className="px-1 text-smoke hover:text-chalk disabled:opacity-30"
              aria-label={`↓ ${block.name}`}
              disabled={index === blocks.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
            <button
              className="px-1 text-smoke hover:text-glove"
              aria-label={`${t("common.delete")} ${block.name}`}
              onClick={() => remove.mutate(block)}
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Input label={t("settings.blockName")} value={name} onChange={(event) => setName(event.target.value)} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("settings.blockMode")}</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as BlockMode)} className={field}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {t(`settings.mode.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={create.isPending}>
            + {t("settings.addBlock")}
          </Button>
          {create.isError && <span className="text-sm text-glove">{t("settings.duplicateName")}</span>}
        </div>
      </form>
    </div>
  );
}

function OffsetInput({ block, onSave }: { block: SessionBlock; onSave: (value: number | null) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(block.start_offset_minutes === null ? "" : String(block.start_offset_minutes));
  return (
    <label className="flex items-center gap-1 text-xs text-smoke">
      {t("settings.startOffset")}
      <input
        type="number"
        min={0}
        max={600}
        placeholder={t("settings.noFixedTime")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const next = value === "" ? null : Math.max(0, Math.round(Number(value)));
          if (next !== block.start_offset_minutes) onSave(next);
        }}
        className={`${field} w-24`}
      />
    </label>
  );
}
