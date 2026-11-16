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
