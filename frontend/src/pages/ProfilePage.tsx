import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Input, PageHeader } from "../components/ui";

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

      <div className="flex items-center gap-4 rounded-xl border border-rope bg-canvas p-5">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ backgroundColor: `${user.color}33`, border: `2px solid ${user.color}` }}
        >
          {user.avatar_emoji}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-semibold">{user.display_name}</p>
          <p className="text-sm text-smoke">@{user.username}</p>
          <p className="text-sm text-smoke">
            {t(`roles.${user.role}`)}
            {user.gym && ` · ${user.gym.name}`}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-rope bg-canvas p-5">
        <h2 className="font-display text-2xl tracking-wide uppercase">{t("profile.changePassword")}</h2>
        <Input
          label={t("profile.currentPassword")}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <Input
          label={t("profile.newPassword")}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <Input
          label={t("profile.confirmPassword")}
          type="password"
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
