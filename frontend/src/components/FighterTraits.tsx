import { useTranslation } from "react-i18next";

import type { FighterClass, User } from "../api/types";
import type { ScoredMetric } from "../lib/fighterProfile";
import FighterClassArt from "./FighterClassArt";

/** What the coach needs to plan for a fighter: style, strengths, weaknesses, stance and limitations. */
export default function FighterTraits({
  student,
  fighterClass,
  strengths,
  weaknesses,
}: {
  student: User;
  fighterClass?: FighterClass;
  strengths: ScoredMetric[];
  weaknesses: ScoredMetric[];
}) {
  const { t } = useTranslation();
  const list = (items: ScoredMetric[]) => items.map((i) => `${i.metric.name} ${i.score}`).join(" · ");
  return (
    <div className="flex flex-col gap-1 border-b border-rope px-3 py-2 text-xs">
      {fighterClass && (
        <div className="flex items-center gap-2" title={fighterClass.description}>
          <FighterClassArt fighterClass={fighterClass} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold" style={{ color: fighterClass.color }}>
              {fighterClass.name}
            </p>
            {fighterClass.description && <p className="line-clamp-2 text-smoke">{fighterClass.description}</p>}
          </div>
        </div>
      )}
      {strengths.length > 0 && (
        <p>
          <span className="font-semibold text-belt">💪 {t("traits.strengths")}:</span> {list(strengths)}
        </p>
      )}
      {weaknesses.length > 0 && (
        <p>
          <span className="font-semibold text-glove">🎯 {t("traits.weaknesses")}:</span> {list(weaknesses)}
        </p>
      )}
      {student.handedness !== "UNSPECIFIED" && (
        <p className="text-smoke">✋ {t(`handedness.${student.handedness}`)}</p>
      )}
      {student.limitations && <p className="line-clamp-3 text-belt">⚠ {student.limitations}</p>}
      {!fighterClass && !strengths.length && !weaknesses.length && <p className="text-smoke">{t("traits.empty")}</p>}
    </div>
  );
}
