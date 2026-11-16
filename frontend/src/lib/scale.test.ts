import { scaleOf, scaleSteps } from "./scale";

describe("assessment scale", () => {
  it("defaults to 1-10 and lists every step", () => {
    expect(scaleOf(null)).toEqual({ min: 1, max: 10 });
    expect(scaleSteps(0, 3)).toEqual([0, 1, 2, 3]);
    expect(scaleSteps(1, 3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
