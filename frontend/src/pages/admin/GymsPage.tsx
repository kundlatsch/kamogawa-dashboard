import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { api } from "../../api/client";
import type { Gym } from "../../api/types";
import { Button, Input, Modal, PageHeader } from "../../components/ui";

interface Credential {
  username: string;
  generated_password: string;
}

export const useGyms = () =>
  useQuery({ queryKey: ["gyms"], queryFn: async () => (await api.get<Gym[]>("/gyms/")).data });

export default function GymsPage() {
  const { t } = useTranslation();
  const { data: gyms = [], isLoading } = useGyms();
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<{ gym: string; list: Credential[] } | null>(null);

  return (
    <section>
      <PageHeader title={t("gyms.title")} actions={<Button onClick={() => setCreating(true)}>+ {t("gyms.new")}</Button>} />
      <p className="mb-4 text-sm text-smoke">{t("gyms.hint")}</p>
      {isLoading && <p className="text-smoke">{t("common.loading")}</p>}
      {!isLoading && gyms.length === 0 && <p className="text-smoke">{t("gyms.empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gyms.map((gym) => (
          <li key={gym.id}>
            <Link
              to={`/gyms/${gym.id}`}
              className={`flex flex-col gap-2 rounded-xl border bg-canvas p-4 hover:border-smoke ${
                gym.is_active ? "border-rope" : "border-rope opacity-50"
              }`}
            >
              <span className="font-display text-2xl tracking-wide uppercase">🥊 {gym.name}</span>
              <span className="text-sm text-smoke">
                {t("gyms.coachCount", { count: gym.coach_count })} · {t("gyms.studentCount", { count: gym.student_count })}
              </span>
              {!gym.is_active && <span className="text-xs font-bold text-glove uppercase">{t("gyms.inactive")}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {creating && (
        <CreateGymModal
          onClose={() => setCreating(false)}
          onCreated={(gym, list) => {
            setCreating(false);
            if (list.length) setCredentials({ gym, list });
          }}
        />
      )}

      {credentials && (
        <Modal title={t("gyms.credentialsTitle", { name: credentials.gym })} onClose={() => setCredentials(null)}>
          <p className="mb-3 text-sm text-smoke">{t("accounts.passwordHint")}</p>
          <ul className="mb-4 flex flex-col gap-2 font-mono">
            {credentials.list.map((c) => (
              <li key={c.username} className="rounded-lg border border-belt bg-ring p-3">
                {c.username} / <strong className="text-belt">{c.generated_password}</strong>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                navigator.clipboard?.writeText(credentials.list.map((c) => `${c.username} / ${c.generated_password}`).join("\n"))
              }
            >
              {t("common.copy")}
            </Button>
            <Button onClick={() => setCredentials(null)}>{t("common.done")}</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

interface CoachDraft {
  display_name: string;
  username: string;
}

function CreateGymModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (gymName: string, credentials: Credential[]) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [coaches, setCoaches] = useState<CoachDraft[]>([{ display_name: "", username: "" }]);

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post<Gym & { coach_credentials: Credential[] }>("/gyms/", {
          name: name.trim(),
          coaches: coaches
            .filter((c) => c.username.trim())
            .map((c) => ({ username: c.username.trim(), display_name: c.display_name.trim() })),
        })
      ).data,
    onSuccess: (gym) => {
      queryClient.invalidateQueries({ queryKey: ["gyms"] });
      onCreated(gym.name, gym.coach_credentials);
    },
  });

  const update = (index: number, field: keyof CoachDraft, value: string) =>
    setCoaches((list) => list.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Modal title={t("gyms.new")} onClose={onClose}>
      <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
        <Input label={t("gyms.name")} value={name} onChange={(e) => setName(e.target.value)} required />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm text-smoke">{t("gyms.coaches")}</legend>
          {coaches.map((coach, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Input label={t("accounts.displayName")} value={coach.display_name} onChange={(e) => update(index, "display_name", e.target.value)} />
              <Input label={t("auth.username")} value={coach.username} onChange={(e) => update(index, "username", e.target.value)} />
              <button
                type="button"
                aria-label={t("common.delete")}
                disabled={coaches.length === 1}
                onClick={() => setCoaches((list) => list.filter((_, i) => i !== index))}
                className="mb-2 text-smoke hover:text-glove disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
          <div>
            <Button type="button" variant="ghost" onClick={() => setCoaches((list) => [...list, { display_name: "", username: "" }])}>
              + {t("gyms.addCoach")}
            </Button>
          </div>
        </fieldset>
        <p className="text-xs text-smoke">{t("accounts.passwordGeneratedNote")}</p>
        {create.isError && <p className="text-sm text-glove">{t("gyms.createError")}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {t("common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
