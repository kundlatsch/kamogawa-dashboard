import { useTranslation } from "react-i18next";

import type { SessionKind, SessionStatus } from "../api/types";

const kindStyles: Record<SessionKind, string> = {
  REGULAR: "bg-rope text-chalk",
  EXTRA: "bg-belt text-ring",
  SPARRING: "bg-glove text-chalk",
};

export function KindBadge({ kind }: { kind: SessionKind }) {
  const { t } = useTranslation();
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${kindStyles[kind]}`}>
      {kind === "SPARRING" && "🥊 "}
      {t(`sessions.kind.${kind}`)}
    </span>
  );
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
        status === "PUBLISHED" ? "border border-belt text-belt" : "border border-smoke text-smoke"
      }`}
    >
      {t(`sessions.status.${status}`)}
    </span>
  );
}
