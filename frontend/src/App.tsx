import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type HealthState = "checking" | "ok" | "error";

export default function App() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    fetch("/api/health/")
      .then((response) => setHealth(response.ok ? "ok" : "error"))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-6xl" aria-hidden>
        🥊
      </span>
      <h1 className="font-display text-5xl tracking-wide text-glove uppercase">{t("brand.name")}</h1>
      <p className="text-smoke">{t("brand.tagline")}</p>
      <p
        data-testid="health"
        className={health === "ok" ? "text-belt" : health === "error" ? "text-glove" : "text-smoke"}
      >
        {t(`health.${health}`)}
      </p>
    </main>
  );
}
