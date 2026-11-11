import { describe, expect, it } from "vitest";
import { visiblePercentLabels } from "./percent-labels";

describe("visiblePercentLabels — 끝을 지키고 앞에서 건너뛴다", () => {
  it("자리가 넉넉하면 모두 보인다", () => {
    expect(visiblePercentLabels(["96%", "104%", "88%"], 200, 12)).toEqual([
      true,
      true,
      true,
    ]);
  });
  it("닿으면 끝(가장 최근)은 남기고 앞 라벨을 건너뛴다", () => {
    const r = visiblePercentLabels(["96%", "104%", "100%", "104%"], 20, 12);
    expect(r[3]).toBe(true);
    expect(r[2]).toBe(false);
  });
  it("빈 달(null)은 자리를 차지하지 않는다", () => {
    const r = visiblePercentLabels(["96%", null, "104%"], 30, 12);
    expect(r).toEqual([true, false, true]);
  });
});
