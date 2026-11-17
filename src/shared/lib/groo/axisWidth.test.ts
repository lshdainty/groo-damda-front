import { describe, it, expect } from "vitest";
import { measureTickWidth, niceValueAxis } from "./axisWidth";

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

/**
 * QA B5-1 — 홈 "11월 수입 · 지출" 축이 "3만 / 2.3만 / 1.5만 / ,500 / 0" 이었다. 폭은 nice 눈금("3만")으로 재고
 * recharts 는 자기 눈금(7,500 간격)을 그려 가장 긴 "7,500" 의 앞자리가 잘렸다. niceValueAxis 는 그리는 눈금과
 * 잰 눈금을 한 목록으로 묶는다.
 */
describe("niceValueAxis — 그리는 눈금 = 폭을 잰 눈금 (B5-1)", () => {
  it("최대 2.8만(홈 11월) — 눈금 0 · 1만 · 2만 · 3만, 한 체계(만)이고 7,500 같은 자동 눈금이 없다", async () => {
    const { formatAxisWon } = await import("@/shared/ds/chart");
    const a = niceValueAxis([28_000, 12_000, 0], formatAxisWon);
    expect(a.ticks).toEqual([0, 10_000, 20_000, 30_000]);
    expect(a.domain).toEqual([0, 30_000]);
    expect(a.ticks.map(a.tickFormatter)).toEqual(["0", "1만", "2만", "3만"]);
  });

  it.each([7_500, 15_000, 22_500, 30_000])(
    "최대 %d — 눈금은 1·2·2.5·5 배수라 반올림한 글자(2.25만 → '2.3만')가 나오지 않고, 폭은 그 눈금 글자 가운데 가장 긴 것",
    async (max) => {
      const { formatAxisWon } = await import("@/shared/ds/chart");
      const a = niceValueAxis([0, max], formatAxisWon);
      const labels = a.ticks.map(a.tickFormatter);
      // 글자가 눈금값을 그대로 말한다 — 소수 한 자리로 반올림돼 다른 수가 되지 않는다
      for (const [i, v] of a.ticks.entries()) {
        const l = labels[i]!;
        const back = l.endsWith("만")
          ? Number(l.slice(0, -1)) * 10_000
          : Number(l.replace(/,/g, ""));
        expect(back).toBe(v);
      }
      // 한 축은 한 단위 — 0 말고는 모두 만 단위이거나 모두 쉼표 정수
      const units = new Set(
        labels.filter((l) => l !== "0").map((l) => l.endsWith("만")),
      );
      expect(units.size).toBe(1);
      expect(a.domain[1]).toBeGreaterThanOrEqual(max);
      expect(a.width).toBe(measureTickWidth(labels));
    },
  );

  it("최대 1.5만 — '5,000 · 1만 · 1.5만' 이 아니라 '0.5만 · 1만 · 1.5만'(한 축은 한 단위), 8,000 이면 모두 쉼표 정수", async () => {
    const { formatAxisWon } = await import("@/shared/ds/chart");
    const man = niceValueAxis([0, 15_000], formatAxisWon);
    expect(man.ticks.map(man.tickFormatter)).toEqual([
      "0",
      "0.5만",
      "1만",
      "1.5만",
    ]);
    // 폭도 그리는 글자("0.5만")로 잰다
    expect(man.width).toBe(measureTickWidth(["0", "0.5만", "1만", "1.5만"]));
    const won = niceValueAxis([0, 7_500], formatAxisWon);
    expect(won.ticks.map(won.tickFormatter)).toEqual([
      "0",
      "2,000",
      "4,000",
      "6,000",
      "8,000",
    ]);
  });

  it("글자 함수는 눈금 목록을 함께 받는다 — 그리는 눈금과 같은 목록", () => {
    const seen: (readonly number[])[] = [];
    const a = niceValueAxis([0, 28_000], (v, ticks) => {
      seen.push(ticks);
      return String(v);
    });
    a.tickFormatter(10_000);
    for (const t of seen) expect(t).toEqual(a.ticks);
  });

  it("음수가 있으면 0 아래 눈금까지 재서 부호가 잘리지 않는다", () => {
    const f = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));
    const a = niceValueAxis([-25_000, 60_000], f);
    expect(a.ticks[0]).toBeLessThan(0);
    expect(a.width).toBe(measureTickWidth(a.ticks.map(f)));
    expect(a.width).toBeGreaterThan(measureTickWidth(["60000"]));
  });

  it("값이 없으면(계열을 모두 껐을 때) 0 하나짜리 축이 아니라 0 ~ 1 로 잡는다", () => {
    const a = niceValueAxis([], String);
    expect(a.domain[0]).toBe(0);
    expect(a.domain[1]).toBeGreaterThan(0);
  });
});
