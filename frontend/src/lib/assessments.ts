import type { Assessment } from "../api/types";

/**
 * Latest score per metric and the change since the previous assessed month of that metric
 * (`delta` is null when the metric was only assessed once). Input is any order.
 */
export function latestScores(history: Assessment[]): Map<number, { score: number; delta: number | null }> {
  const byMetric = new Map<number, Assessment[]>();
  for (const assessment of [...history].sort((a, b) => a.period.localeCompare(b.period))) {
    byMetric.set(assessment.metric, [...(byMetric.get(assessment.metric) ?? []), assessment]);
  }
  const result = new Map<number, { score: number; delta: number | null }>();
  for (const [metric, list] of byMetric) {
    const last = list[list.length - 1];
    const previous = list.length > 1 ? list[list.length - 2] : null;
    result.set(metric, { score: last.score, delta: previous ? last.score - previous.score : null });
  }
  return result;
}
