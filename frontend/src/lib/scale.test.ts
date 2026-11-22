import { ratingBand, ratingBandRanges, scaleOf, scaleSteps } from "./scale";

describe("assessment scale", () => {
  it("defaults to 1-10 and lists every step", () => {
    expect(scaleOf(null)).toEqual({ min: 1, max: 10 });
    expect(scaleSteps(0, 3)).toEqual([0, 1, 2, 3]);
    expect(scaleSteps(1, 3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("splits the scale into five rating levels, two scores each on 1-10", () => {
    expect(ratingBandRanges(1, 10).map((r) => [r.from, r.to])).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
    expect([1, 2, 3, 6, 7, 10].map((s) => ratingBand(s, 1, 10))).toEqual([0, 0, 1, 2, 3, 4]);
    expect(ratingBand(12, 1, 10)).toBe(4);
    expect(ratingBandRanges(0, 4).map((r) => r.band)).toEqual([0, 1, 2, 3, 4]);
  });
});
