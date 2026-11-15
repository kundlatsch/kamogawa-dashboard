import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ColorPicker, EmojiPicker, AVATAR_EMOJIS } from "../components/pickers";
import { Button, Input, PageHeader, PasswordInput } from "../components/ui";

const MIN_LENGTH = 8;

/** Every user (account admin, coach, student) sees their details and changes their password here. */
export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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

  const save = useMutation({
    mutationFn: async () =>
      api.patch("/auth/me/", { display_name: displayName.trim(), avatar_emoji: emoji, color }),
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
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl"
          style={{ backgroundColor: `${color}33`, border: `2px solid ${color}` }}
        >
          {emoji}
        </span>
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
      <EmojiPicker value={emoji} onChange={setEmoji} options={AVATAR_EMOJIS} label={t("profile.emoji")} />
      <ColorPicker value={color} onChange={setColor} label={t("profile.color")} />
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
