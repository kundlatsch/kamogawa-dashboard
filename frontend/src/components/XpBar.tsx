import { useTranslation } from "react-i18next";

import type { Level } from "../api/types";

/** Level badge with progress toward the next level. */
export default function XpBar({ level, compact = false }: { level: Level; compact?: boolean }) {
  const { t } = useTranslation();
  const percent = Math.round((level.level_xp / level.xp_per_level) * 100);
  return (
    <div className="flex w-full items-center gap-2">
      <span
        className={`shrink-0 rounded-md bg-belt font-display tracking-wide text-ring ${
          compact ? "px-1.5 text-sm" : "px-2.5 py-0.5 text-xl"
        }`}
      >
        {t("progress.level", { level: level.level })}
      </span>
      <div
        className={`flex-1 overflow-hidden rounded-full bg-rope ${compact ? "h-2" : "h-3"}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={level.xp_per_level}
        aria-valuenow={level.level_xp}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-belt to-glove" style={{ width: `${percent}%` }} />
      </div>
      <span className={`shrink-0 text-smoke ${compact ? "text-xs" : "text-sm"}`}>{level.xp} XP</span>
    </div>
  );
}
