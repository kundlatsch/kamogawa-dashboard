import { useTranslation } from "react-i18next";

import { ratingBandRanges } from "../lib/scale";

/** The coach's reference for scoring: what each part of the scale means (iniciante … nível de competição). */
export default function RatingGuide({ min, max }: { min: number; max: number }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t("rating.title")} className="rounded-xl border border-rope bg-canvas p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-smoke uppercase">{t("rating.title")}</h2>
      <ol className="grid gap-2 sm:grid-cols-5">
        {ratingBandRanges(min, max).map(({ band, from, to }) => (
          <li key={band} className="rounded-lg border-t-4 bg-ring p-2.5 text-sm" style={{ borderTopColor: `var(--rating-${band})` }}>
            <p className="font-display text-lg leading-none">{from === to ? from : `${from}–${to}`}</p>
            <p className="mt-1 font-semibold">{t(`rating.band${band}`)}</p>
            <p className="text-xs text-smoke">{t(`rating.band${band}Hint`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
