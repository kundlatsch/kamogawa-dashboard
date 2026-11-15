import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import { useCategories, useDrills } from "../../api/hooks";
import type { Drill } from "../../api/types";
import DrillCard from "../../components/DrillCard";
import { ColorPicker, EmojiPicker } from "../../components/pickers";
import { Button, Input, Modal, PageHeader } from "../../components/ui";
import { youtubeEmbedUrl, youtubeId } from "../../lib/youtube";

type DrillDraft = Omit<Drill, "id" | "archived"> & { id?: number };

const emptyDraft: DrillDraft = {
  name: "",
  description: "",
  emoji: "🥊",
  color: "#d62828",
  youtube_url: "",
  thumbnail_url: "",
  category: null,
  default_rounds: null,
  default_duration_minutes: null,
};

export default function DrillsPage() {
  const { t } = useTranslation();
  const { data: drills = [], isLoading } = useDrills();
  const { data: categories = [] } = useCategories();
  const [editing, setEditing] = useState<DrillDraft | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");

  const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name;
  const visible = useMemo(
    () =>
      drills.filter(
        (drill) =>
          drill.name.toLowerCase().includes(search.toLowerCase()) &&
          (categoryFilter === "all" || drill.category === categoryFilter),
      ),
    [drills, search, categoryFilter],
  );

  return (
    <section>
      <PageHeader
        title={t("drills.title")}
        actions={<Button onClick={() => setEditing({ ...emptyDraft })}>+ {t("drills.new")}</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          placeholder={t("drills.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-md border border-rope bg-canvas px-3 py-2 text-sm"
        />
        <select
          aria-label={t("drills.category")}
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value === "all" ? "all" : Number(event.target.value))}
          className="rounded-md border border-rope bg-canvas px-3 py-2 text-sm"
        >
          <option value="all">{t("drills.allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-smoke">{t("common.loading")}</p>
      ) : visible.length === 0 ? (
        <p className="text-smoke">{t("drills.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {visible.map((drill) => (
            <DrillCard
              key={drill.id}
              drill={drill}
              categoryName={categoryName(drill.category)}
              onClick={() => setEditing(drill)}
            />
          ))}
        </div>
      )}

      {editing && <DrillFormModal draft={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function DrillFormModal({ draft: initial, onClose }: { draft: DrillDraft; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [draft, setDraft] = useState<DrillDraft>(initial);
  const set = <K extends keyof DrillDraft>(key: K, value: DrillDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const videoId = youtubeId(draft.youtube_url);

  const save = useMutation({
    mutationFn: async () =>
      draft.id ? api.put(`/drills/${draft.id}/`, draft) : api.post("/drills/", draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drills"] });
      onClose();
    },
  });

  const archive = useMutation({
    mutationFn: async () => api.delete(`/drills/${draft.id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drills"] });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const numberOrNull = (value: string) => (value === "" ? null : Math.max(0, Number(value)));

  return (
    <Modal title={draft.id ? t("drills.edit") : t("drills.new")} onClose={onClose}>
      <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="mx-auto w-48">
          <DrillCard drill={draft} categoryName={categories.find((c) => c.id === draft.category)?.name} />
        </div>
        <Input label={t("drills.name")} value={draft.name} onChange={(e) => set("name", e.target.value)} required />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("drills.description")}</span>
          <textarea
            rows={3}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            className="rounded-md border border-rope bg-ring px-3 py-2 text-chalk outline-none focus:border-glove"
          />
        </label>
        <EmojiPicker value={draft.emoji} onChange={(emoji) => set("emoji", emoji)} />
        <ColorPicker value={draft.color} onChange={(color) => set("color", color)} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-smoke">{t("drills.category")}</span>
          <select
            value={draft.category ?? ""}
            onChange={(e) => set("category", e.target.value ? Number(e.target.value) : null)}
            className="rounded-md border border-rope bg-ring px-3 py-2"
          >
            <option value="">{t("drills.noCategory")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("drills.rounds")}
            type="number"
            min={0}
            value={draft.default_rounds ?? ""}
            onChange={(e) => set("default_rounds", numberOrNull(e.target.value))}
          />
          <Input
            label={t("drills.minutes")}
            type="number"
            min={0}
            value={draft.default_duration_minutes ?? ""}
            onChange={(e) => set("default_duration_minutes", numberOrNull(e.target.value))}
          />
        </div>
        <Input
          label={t("drills.youtubeUrl")}
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={draft.youtube_url}
          onChange={(e) => set("youtube_url", e.target.value)}
        />
        {draft.youtube_url && !videoId && <p className="text-xs text-belt">{t("drills.notYoutube")}</p>}
        {videoId && (
          <iframe
            title={draft.name}
            src={youtubeEmbedUrl(videoId)}
            className="aspect-video w-full rounded-lg"
            allowFullScreen
          />
        )}
        <Input
          label={t("drills.thumbnailUrl")}
          type="url"
          placeholder="https://…"
          value={draft.thumbnail_url}
          onChange={(e) => set("thumbnail_url", e.target.value)}
        />
        {save.isError && <p className="text-sm text-glove">{t("drills.saveError")}</p>}
        <div className="flex justify-between gap-2">
          {draft.id ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => window.confirm(t("drills.confirmArchive")) && archive.mutate()}
            >
              {t("drills.archive")}
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
