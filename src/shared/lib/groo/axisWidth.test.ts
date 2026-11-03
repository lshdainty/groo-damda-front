import { describe, it, expect } from "vitest";
import { measureTickWidth } from "./axisWidth";

describe("measureTickWidth (D6)", () => {
  it("가장 긴 눈금 글자에 맞춘다 — 음수 부호가 붙은 쪽이 더 넓다", () => {
    const pos = measureTickWidth(["0", "2,500만"]);
    const neg = measureTickWidth(["0", "−2,500만"]);
    expect(neg).toBeGreaterThan(pos);
  });
  it("눈금이 늘어도 가장 긴 하나가 폭을 정한다", () => {
    const one = measureTickWidth(["−3,000만"]);
    expect(measureTickWidth(["0", "−1억", "−3,000만"])).toBe(one);
  });
});

describe("measureTickWidth 여백 (축 끝 글자)", () => {
  it("글자 폭 + tickSize 6 + tickMargin 8 보다 좁지 않다 — ds 차트 축 끝 글자가 잘리지 않는다", () => {
    // jsdom 은 레이아웃이 없어 글자 수 추정치(한글 11 · 그 밖 7)로 돌아간다: "100만" = 7 × 3 + 11 = 32
    expect(measureTickWidth(["100만"])).toBeGreaterThanOrEqual(32 + 6 + 8);
  });
});

describe("niceTickLabels", () => {
  it("값 범위의 nice 눈금 글자를 낸다 — 음수가 있으면 음수 눈금도", async () => {
    const { niceTickLabels } = await import("./axisWidth");
    const f = (v: number) => String(v);
    expect(niceTickLabels([0, 100], f)).not.toContain("-");
    expect(niceTickLabels([-100, 50], f).some((l) => l.startsWith("-"))).toBe(
      true,
    );
  });
});
