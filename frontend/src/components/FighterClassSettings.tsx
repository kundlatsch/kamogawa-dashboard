import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useFighterClasses } from "../api/hooks";
import type { FighterClass } from "../api/types";
import { ART_KEYS, fighterArt } from "../lib/fighterArt";
import FighterClassArt from "./FighterClassArt";
import { ColorPicker } from "./pickers";
import { Button, Input, Modal } from "./ui";

const PATH = "/fighter-classes/";

/** Fighter classes (styles) as a gallery; each one opens an editor with art choice and image upload. */
export default function FighterClassSettings() {
  const { t } = useTranslation();
  const { data: classes = [] } = useFighterClasses();
  const [editing, setEditing] = useState<FighterClass | "new" | null>(null);

  return (
    <div className="rounded-xl border border-rope bg-canvas p-5">
      <h2 className="mb-1 font-display text-2xl tracking-wide uppercase">{t("settings.fighterClasses")}</h2>
      <p className="mb-4 text-sm text-smoke">{t("settings.fighterClassesHint")}</p>
      <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {classes.map((fighterClass) => (
          <li key={fighterClass.id}>
            <button
              onClick={() => setEditing(fighterClass)}
              className="flex w-full flex-col items-center gap-1 rounded-lg border border-rope bg-ring p-2 text-sm hover:border-smoke"
            >
              <FighterClassArt fighterClass={fighterClass} size="md" />
              <span className="font-semibold" style={{ color: fighterClass.color }}>
                {fighterClass.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button onClick={() => setEditing("new")}>+ {t("settings.addFighterClass")}</Button>
      {editing && (
        <FighterClassEditor fighterClass={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function FighterClassEditor({ fighterClass, onClose }: { fighterClass: FighterClass | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(fighterClass?.name ?? "");
  const [description, setDescription] = useState(fighterClass?.description ?? "");
  const [emoji, setEmoji] = useState(fighterClass?.emoji ?? "🥊");
  const [color, setColor] = useState(fighterClass?.color ?? "#d62828");
  const [artKey, setArtKey] = useState(fighterClass?.art_key ?? ART_KEYS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [PATH] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), description, emoji: emoji || "🥊", color, art_key: artKey };
      const saved = fighterClass
        ? (await api.patch<FighterClass>(`${PATH}${fighterClass.id}/`, payload)).data
        : (await api.post<FighterClass>(PATH, payload)).data;
      if (file) {
        const form = new FormData();
        form.append("image", file);
        await api.post(`${PATH}${saved.id}/image/`, form);
      } else if (removeImage && fighterClass?.image_url) {
        await api.delete(`${PATH}${saved.id}/image/`);
      }
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const archive = useMutation({
    mutationFn: async () => api.delete(`${PATH}${fighterClass!.id}/`),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  const preview: FighterClass = {
    id: fighterClass?.id ?? 0,
    name: name || "?",
    description,
    emoji: emoji || "🥊",
    color,
    art_key: artKey,
    image_url: removeImage ? null : (fighterClass?.image_url ?? null),
    order: 0,
    archived: false,
  };
  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <Modal title={fighterClass ? t("settings.editFighterClass") : t("settings.addFighterClass")} onClose={onClose}>
      <form
        className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <div className="flex justify-center">
          {previewUrl ? (
            <img src={previewUrl} alt={name} className="h-24 w-20 object-contain" />
          ) : (
            <FighterClassArt fighterClass={preview} size="md" />
          )}
        </div>
        <Input label={t("settings.fighterClassName")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("settings.fighterClassDescription")}</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-rope bg-ring px-3 py-2 text-chalk outline-none focus:border-glove"
          />
        </label>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 text-smoke">{t("settings.fighterClassArt")}</legend>
          <div className="grid grid-cols-4 gap-2">
            {ART_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={artKey === key}
                aria-label={key}
                onClick={() => setArtKey(key)}
                className={`flex justify-center rounded-md border p-1 ${artKey === key ? "border-glove bg-glove/15" : "border-rope"}`}
              >
                <img src={fighterArt(key)!} alt="" className="h-14 object-contain" />
              </button>
            ))}
            <button
              type="button"
              aria-pressed={artKey === ""}
              onClick={() => setArtKey("")}
              className={`rounded-md border p-1 text-xs ${artKey === "" ? "border-glove bg-glove/15" : "border-rope text-smoke"}`}
            >
              {t("settings.emojiOnly")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-rope px-3 py-1.5 font-semibold hover:border-smoke">
              {t("settings.uploadClassImage")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setRemoveImage(false);
                }}
              />
            </label>
            {(file || (fighterClass?.image_url && !removeImage)) && (
              <button
                type="button"
                className="text-xs text-smoke underline hover:text-glove"
                onClick={() => {
                  setFile(null);
                  setRemoveImage(true);
                }}
              >
                {t("settings.removeClassImage")}
              </button>
            )}
          </div>
          <span className="text-xs text-smoke">{t("settings.classImageHint")}</span>
        </fieldset>
        <Input label={t("settings.fighterClassEmoji")} value={emoji} maxLength={16} onChange={(e) => setEmoji(e.target.value)} />
        <ColorPicker value={color} onChange={setColor} />
        {save.isError && <p className="text-sm text-glove">{t("settings.duplicateName")}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          {fighterClass ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => window.confirm(t("settings.confirmArchiveClass", { name: fighterClass.name })) && archive.mutate()}
            >
              {t("common.delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
