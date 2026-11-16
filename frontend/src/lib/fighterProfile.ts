import type { Assessment, Metric } from "../api/types";
import { latestScores } from "./assessments";

export interface ScoredMetric {
  metric: Metric;
  score: number;
}

/**
 * A student's strongest and weakest metrics from their latest scores (`count` of each).
 * Ties keep the coach's metric order; a metric is never both a strength and a weakness.
 */
export function strengthsAndWeaknesses(
  assessments: Assessment[],
  metrics: Metric[],
  count = 2,
): { strengths: ScoredMetric[]; weaknesses: ScoredMetric[] } {
  const latest = latestScores(assessments);
  const scored = metrics
    .filter((metric) => latest.has(metric.id))
    .map((metric) => ({ metric, score: latest.get(metric.id)!.score }));
  // A flat profile (everything equal) has no meaningful strengths or weaknesses.
  if (new Set(scored.map((item) => item.score)).size < 2) return { strengths: [], weaknesses: [] };
  const strengths = [...scored].sort((a, b) => b.score - a.score).slice(0, count);
  const weaknesses = [...scored]
    .sort((a, b) => a.score - b.score)
    .filter((item) => !strengths.includes(item))
    .slice(0, count);
  return { strengths, weaknesses };
}
