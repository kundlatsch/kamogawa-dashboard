import type { GymSummary } from "../api/types";

/** The gym's assessment scale (default 1 to 10). */
export function scaleOf(gym: GymSummary | null | undefined): { min: number; max: number } {
  return { min: gym?.assessment_scale_min ?? 1, max: gym?.assessment_scale_max ?? 10 };
}

/** Every score from min to max (and up to `value`, so older scores outside the scale still show). */
export function scaleSteps(min: number, max: number, value?: number | null): number[] {
  const low = Math.min(min, value ?? min);
  const high = Math.max(max, value ?? max);
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

/** Number of rating levels the scale is split into (iniciante … nível de competição). */
export const RATING_BANDS = 5;

/** Which rating level (0 = iniciante … 4 = competição) a score falls in, splitting any scale into equal parts. */
export function ratingBand(score: number, min: number, max: number): number {
  const band = Math.floor(((score - min) * RATING_BANDS) / (max - min + 1));
  return Math.min(Math.max(band, 0), RATING_BANDS - 1);
}

/** The scores of each rating level, e.g. [[1, 2], [3, 4], …] on a 1-10 scale; empty levels are skipped. */
export function ratingBandRanges(min: number, max: number): { band: number; from: number; to: number }[] {
  const ranges: { band: number; from: number; to: number }[] = [];
  for (let score = min; score <= max; score++) {
    const band = ratingBand(score, min, max);
    const last = ranges[ranges.length - 1];
    if (last?.band === band) last.to = score;
    else ranges.push({ band, from: score, to: score });
  }
  return ranges;
}
