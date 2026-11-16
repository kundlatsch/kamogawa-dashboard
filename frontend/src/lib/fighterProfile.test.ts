import type { Assessment, Metric } from "../api/types";
import { strengthsAndWeaknesses } from "./fighterProfile";

const metric = (id: number, name: string) =>
  ({ id, name, color: "#000000", order: id, archived: false, group: "PHYSICAL" }) as Metric;
const score = (metricId: number, value: number, period = "2026-11-01") =>
  ({ id: 0, student: 1, metric: metricId, period, score: value, notes: "", updated_at: "" }) as Assessment;

const metrics = [metric(1, "Velocidade"), metric(2, "Força"), metric(3, "Guarda"), metric(4, "Defesa")];

describe("strengthsAndWeaknesses", () => {
  it("picks the top and bottom latest scores", () => {
    const result = strengthsAndWeaknesses(
      [score(1, 5), score(2, 2), score(3, 4), score(4, 1), score(4, 5, "2026-10-01")],
      metrics,
    );
    expect(result.strengths.map((s) => s.metric.name)).toEqual(["Velocidade", "Guarda"]);
    expect(result.weaknesses.map((s) => s.metric.name)).toEqual(["Defesa", "Força"]);
  });

  it("returns nothing for a flat or empty profile", () => {
    expect(strengthsAndWeaknesses([score(1, 3), score(2, 3)], metrics)).toEqual({ strengths: [], weaknesses: [] });
    expect(strengthsAndWeaknesses([], metrics)).toEqual({ strengths: [], weaknesses: [] });
  });
});
