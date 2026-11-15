import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api/client";
import type { GeneratedPassword, User } from "../../api/types";
import { Button, Input, Modal, PageHeader } from "../../components/ui";

/** Manages accounts of one role (students or coaches); passwords are always server-generated. */
export default function AccountsPage({
  kind,
  endpoint = `/${kind}/`,
  title,
}: {
  kind: "students" | "coaches";
  /** API collection, e.g. `/students/` or `/gyms/3/coaches/`. */
  endpoint?: string;
  title?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ user: string; password: string } | null>(null);

  // Gym cards show coach/student counts, so refresh them too.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [endpoint] });
    queryClient.invalidateQueries({ queryKey: ["gyms"] });
  };

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await api.get<User[]>(endpoint)).data,
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<User>) =>
      (await api.post<User & GeneratedPassword>(endpoint, payload)).data,
    onSuccess: (created) => {
      refresh();
      setCreating(false);
      setRevealed({ user: created.username, password: created.generated_password });
    },
  });

  const reset = useMutation({
    mutationFn: async (account: User) => ({
      account,
      data: (await api.post<GeneratedPassword>(`${endpoint}${account.id}/reset-password/`)).data,
    }),
    onSuccess: ({ account, data }) => setRevealed({ user: account.username, password: data.generated_password }),
  });

  const deactivate = useMutation({
    mutationFn: async (account: User) => api.delete(`${endpoint}${account.id}/`),
    onSuccess: refresh,
  });

  return (
    <section>
      <PageHeader
        title={title ?? t(`accounts.${kind}.title`)}
        actions={<Button onClick={() => setCreating(true)}>+ {t(`accounts.${kind}.new`)}</Button>}
      />

      {isLoading ? (
        <p className="text-smoke">{t("common.loading")}</p>
      ) : accounts.length === 0 ? (
        <p className="text-smoke">{t(`accounts.${kind}.empty`)}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-3 rounded-xl border border-rope bg-canvas p-4"
              style={{ borderLeft: `4px solid ${account.color}` }}
            >
              <span className="text-3xl" aria-hidden>
                {account.avatar_emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{account.display_name}</p>
                <p className="truncate text-xs text-smoke">@{account.username}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => reset.mutate(account)}>
                  {t("accounts.resetPassword")}
                </Button>
                <Button
                  variant="danger"
                  className="!px-2 !py-1 text-xs"
                  onClick={() => {
                    if (window.confirm(t("accounts.confirmDeactivate", { name: account.display_name })))
                      deactivate.mutate(account);
                  }}
                >
                  {t("accounts.deactivate")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <CreateAccountModal
          title={t(`accounts.${kind}.new`)}
          busy={create.isPending}
          error={create.isError}
          onClose={() => setCreating(false)}
          onSubmit={(payload) => create.mutate(payload)}
        />
      )}

      {revealed && (
        <Modal title={t("accounts.passwordTitle")} onClose={() => setRevealed(null)}>
          <p className="mb-3 text-sm text-smoke">{t("accounts.passwordHint")}</p>
          <div className="mb-4 rounded-lg border border-belt bg-ring p-4 font-mono">
            <p>
              {t("auth.username")}: <strong>{revealed.user}</strong>
            </p>
            <p>
              {t("auth.password")}: <strong className="text-belt">{revealed.password}</strong>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => navigator.clipboard?.writeText(`${revealed.user} / ${revealed.password}`)}
            >
              {t("common.copy")}
            </Button>
            <Button onClick={() => setRevealed(null)}>{t("common.done")}</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

const AVATARS = ["🥊", "🔥", "⚡", "🐯", "🦁", "🐺", "🦅", "💪", "👊", "🏆"];
const COLORS = ["#d62828", "#e9b949", "#f77f00", "#3a86ff", "#2a9d8f", "#9d4edd", "#ef476f", "#f5f5f5"];

function CreateAccountModal({
  title,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  busy: boolean;
  error: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<User>) => void;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(COLORS[0]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ username: username.trim(), display_name: displayName.trim(), avatar_emoji: avatar, color });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label={t("accounts.displayName")} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <Input label={t("auth.username")} value={username} onChange={(e) => setUsername(e.target.value)} required />
        <fieldset>
          <legend className="mb-1 text-sm text-smoke">{t("accounts.avatar")}</legend>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => setAvatar(emoji)}
                className={`rounded-md p-1 text-2xl ${avatar === emoji ? "bg-glove" : "bg-ring"}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm text-smoke">{t("accounts.color")}</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((value) => (
              <button
                type="button"
                key={value}
                aria-label={value}
                onClick={() => setColor(value)}
                className={`h-8 w-8 rounded-full border-2 ${color === value ? "border-chalk" : "border-transparent"}`}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </fieldset>
        {error && <p className="text-sm text-glove">{t("accounts.createError")}</p>}
        <p className="text-xs text-smoke">{t("accounts.passwordGeneratedNote")}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {t("common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
