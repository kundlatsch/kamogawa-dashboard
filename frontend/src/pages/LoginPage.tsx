import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Button, Input } from "../components/ui";

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await login(username.trim(), password);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#3a0b0b_0%,_#0a0a0a_60%)] p-4">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-rope bg-canvas/90 p-8 shadow-2xl"
      >
        <div className="text-center">
          <div className="text-6xl" aria-hidden>
            🥊
          </div>
          <h1 className="mt-2 font-display text-4xl tracking-wide uppercase">
            <span className="text-glove">Chacão</span> {t("brand.suffix")}
          </h1>
          <p className="text-sm text-smoke">{t("brand.tagline")}</p>
        </div>
        <Input
          label={t("auth.username")}
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <Input
          label={t("auth.password")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && <p className="text-sm text-glove">{t("auth.invalid")}</p>}
        <Button type="submit" disabled={busy}>
          {t("auth.login")}
        </Button>
      </form>
    </div>
  );
}
