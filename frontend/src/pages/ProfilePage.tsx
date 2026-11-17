import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import type { Handedness } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import Avatar from "../components/Avatar";
import { ColorPicker, EmojiPicker, AVATAR_EMOJIS } from "../components/pickers";
import { Button, Input, PageHeader, PasswordInput } from "../components/ui";

const MIN_LENGTH = 8;
const HANDEDNESS: Handedness[] = ["RIGHT", "LEFT", "UNSPECIFIED"];

/** Every user (account admin, coach, student) sees their details and changes their password here. */
export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: async () => api.post("/auth/change-password/", { current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    change.reset();
    if (next.length < MIN_LENGTH) return setLocalError(t("profile.tooShort", { count: MIN_LENGTH }));
    if (next !== confirm) return setLocalError(t("profile.mismatch"));
    setLocalError(null);
    change.mutate();
  }

  const serverError = (() => {
    if (!change.isError) return null;
    const data = isAxiosError(change.error) ? change.error.response?.data : undefined;
    if (data && typeof data === "object" && "current_password" in data) return t("profile.wrongCurrent");
    return t("profile.weakPassword");
  })();

  if (!user) return null;
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader title={t("profile.title")} />

      <ProfileDetails />

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-rope bg-canvas p-5">
        <h2 className="font-display text-2xl tracking-wide uppercase">{t("profile.changePassword")}</h2>
        <PasswordInput
          label={t("profile.currentPassword")}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <PasswordInput
          label={t("profile.newPassword")}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <PasswordInput
          label={t("profile.confirmPassword")}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <p className="text-xs text-smoke">{t("profile.rules", { count: MIN_LENGTH })}</p>
        {(localError || serverError) && <p className="text-sm text-glove">{localError ?? serverError}</p>}
        {change.isSuccess && <p className="text-sm text-belt">{t("profile.changed")}</p>}
        <div>
          <Button type="submit" disabled={change.isPending}>
            {t("profile.save")}
          </Button>
        </div>
      </form>

      {/* Students on phones have no logout in the header (it only fits on larger screens). */}
      {user.role === "STUDENT" && (
        <Button variant="danger" className="w-full py-3 md:hidden" onClick={logout}>
          {t("auth.logout")}
        </Button>
      )}
    </section>
  );
}

/** Shows who the user is and lets them change their display name, emoji and color (never the login). */
function ProfileDetails() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [emoji, setEmoji] = useState(user?.avatar_emoji ?? "🥊");
  const [color, setColor] = useState(user?.color ?? "#d62828");
  const [handedness, setHandedness] = useState<Handedness>(user?.handedness ?? "UNSPECIFIED");
  const [limitations, setLimitations] = useState(user?.limitations ?? "");
  const [weeklyClasses, setWeeklyClasses] = useState(user?.weekly_classes == null ? "" : String(user.weekly_classes));
  const isStudent = user?.role === "STUDENT";

  const save = useMutation({
    mutationFn: async () =>
      api.patch("/auth/me/", {
        display_name: displayName.trim(),
        avatar_emoji: emoji,
        color,
        handedness,
        limitations: limitations.trim(),
        ...(isStudent ? { weekly_classes: weeklyClasses === "" ? null : Number(weeklyClasses) } : {}),
      }),
    onSuccess: () => refreshUser(),
  });

  if (!user) return null;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (displayName.trim()) save.mutate();
      }}
      className="flex flex-col gap-4 rounded-xl border border-rope bg-canvas p-5"
    >
      <div className="flex items-center gap-4">
        <Avatar person={{ ...user, avatar_emoji: emoji, color }} size="lg" ring />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{displayName || user.display_name}</p>
          <p className="text-sm text-smoke">
            @{user.username} · {t("profile.loginFixed")}
          </p>
          <p className="text-sm text-smoke">
            {t(`roles.${user.role}`)}
            {user.gym && ` · ${user.gym.name}`}
          </p>
        </div>
      </div>
      <Input
        label={t("profile.displayName")}
        value={displayName}
        maxLength={80}
        onChange={(event) => setDisplayName(event.target.value)}
        required
      />
      <PhotoUpload />
      <EmojiPicker value={emoji} onChange={setEmoji} options={AVATAR_EMOJIS} label={t("profile.emoji")} />
      <ColorPicker value={color} onChange={setColor} label={t("profile.color")} />
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 text-smoke">{t("profile.handedness")}</legend>
        <div className="flex gap-2">
          {HANDEDNESS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={handedness === option}
              onClick={() => setHandedness(option)}
              className={`rounded-md border px-3 py-1.5 ${
                handedness === option ? "border-glove bg-glove/20 text-chalk" : "border-rope text-smoke hover:text-chalk"
              }`}
            >
              {t(`handedness.${option}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-smoke">{t("profile.limitations")}</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={limitations}
          placeholder={t("profile.limitationsPlaceholder")}
          onChange={(event) => setLimitations(event.target.value)}
          className="rounded-md border border-rope bg-ring px-3 py-2 text-chalk outline-none focus:border-glove"
        />
      </label>
      {isStudent && (
        <div className="flex flex-col gap-1">
          <Input
            label={t("profile.weeklyClasses")}
            type="number"
            min={0}
            max={14}
            value={weeklyClasses}
            onChange={(event) => setWeeklyClasses(event.target.value)}
          />
          <span className="text-xs text-smoke">{t("profile.weeklyClassesHint")}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {t("profile.saveDetails")}
        </Button>
        {save.isSuccess && <span className="text-sm text-belt">{t("profile.detailsSaved")}</span>}
        {save.isError && <span className="text-sm text-glove">{t("profile.detailsError")}</span>}
      </div>
    </form>
  );
}

/** Upload or remove the profile photo; it replaces the emoji wherever the user appears. */
function PhotoUpload() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("avatar", file);
      return api.post("/auth/me/avatar/", form);
    },
    onSuccess: () => refreshUser(),
  });
  const remove = useMutation({
    mutationFn: async () => api.delete("/auth/me/avatar/"),
    onSuccess: () => refreshUser(),
  });

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-smoke">{t("profile.photo")}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md border border-rope px-4 py-2 font-semibold hover:border-smoke">
          {user?.avatar_url ? t("profile.changePhoto") : t("profile.uploadPhoto")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = "";
            }}
          />
        </label>
        {user?.avatar_url && (
          <Button type="button" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {t("profile.removePhoto")}
          </Button>
        )}
        {upload.isPending && <span className="text-smoke">{t("profile.uploading")}</span>}
        {upload.isError && <span className="text-glove">{t("profile.photoError")}</span>}
      </div>
      <span className="text-xs text-smoke">{t("profile.photoHint")}</span>
    </div>
  );
}
