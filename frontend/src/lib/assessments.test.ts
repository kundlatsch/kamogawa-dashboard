import type { Assessment } from "../api/types";
import { latestScores } from "./assessments";

const score = (metric: number, period: string, value: number) =>
  ({ id: 0, student: 1, metric, period, score: value, notes: "", updated_at: "" }) as Assessment;

describe("latestScores", () => {
  it("keeps the latest month per metric and the change since the previous one", () => {
    const result = latestScores([
      score(1, "2026-11-01", 4),
      score(1, "2026-10-01", 2),
      score(2, "2026-11-01", 3),
    ]);
    expect(result.get(1)).toEqual({ score: 4, delta: 2 });
    expect(result.get(2)).toEqual({ score: 3, delta: null });
  });
});
