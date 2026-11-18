import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Drill } from "../api/types";
import { youtubeId } from "../lib/youtube";

type CardDrill = Pick<
  Drill,
  "name" | "emoji" | "color" | "thumbnail_url" | "youtube_url" | "default_rounds" | "default_duration_minutes"
> & { description?: string };

/** The visual card used everywhere a drill appears (library, board, student routine). */
export default function DrillCard({
  drill,
  compact = false,
  categoryName,
  categoryColor,
  footer,
  onClick,
}: {
  drill: CardDrill;
  compact?: boolean;
  categoryName?: string;
  /** Tints the category label as a small pill when given. */
  categoryColor?: string;
  footer?: ReactNode;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const hasVideo = Boolean(youtubeId(drill.youtube_url));

  return (
    <article
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-rope bg-canvas shadow-lg ${
        onClick ? "cursor-pointer hover:border-smoke" : ""
      }`}
      style={{ borderTop: `4px solid ${drill.color}` }}
    >
      {!compact && (
        <div
          className="flex h-24 items-center justify-center text-5xl"
          style={{ background: `linear-gradient(135deg, ${drill.color}55, transparent 70%)` }}
        >
          {drill.thumbnail_url ? (
            <img src={drill.thumbnail_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{drill.emoji}</span>
          )}
        </div>
      )}
      <div className={compact ? "flex items-center gap-2 p-2" : "p-3"}>
        {compact && (
          <span className="text-2xl" aria-hidden>
            {drill.emoji}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{drill.name || t("drills.untitled")}</h3>
          <div className="flex flex-wrap gap-x-2 text-xs text-smoke">
            {categoryName && <CategoryLabel name={categoryName} color={categoryColor} />}
            {drill.default_rounds ? <span>{t("drills.roundsCount", { count: drill.default_rounds })}</span> : null}
            {drill.default_duration_minutes ? (
              <span>{t("drills.minutesCount", { count: drill.default_duration_minutes })}</span>
            ) : null}
            {hasVideo && <span className="text-glove">▶ {t("drills.video")}</span>}
          </div>
          {!compact && drill.description && (
            <p className="mt-1 line-clamp-2 text-sm text-smoke">{drill.description}</p>
          )}
        </div>
      </div>
      {footer}
    </article>
  );
}

/** Category name shown on drill cards; a colored pill when the category has a color. */
export function CategoryLabel({ name, color }: { name: string; color?: string }) {
  if (!color) return <span>{name}</span>;
  return (
    <span className="truncate rounded-full px-1.5 text-chalk" style={{ backgroundColor: `${color}44` }}>
      {name}
    </span>
  );
}
