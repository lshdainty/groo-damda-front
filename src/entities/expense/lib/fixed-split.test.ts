import { describe, expect, it } from "vitest";
import { amountFor, fixedShareTexts, splitFixed } from "./fixed-split";

describe("splitFixed — 전체 · 고정 · 변동", () => {
  it("변동은 전체에서 고정을 뺀 값이다", () => {
    const s = splitFixed(1_530_000, 1_400_000);
    expect(s.total).toBe(1_530_000);
    expect(s.fixed).toBe(1_400_000);
    expect(s.variable).toBe(130_000);
    expect(s.fixedPercent).toBeCloseTo(91.5, 1);
  });

  it("옛 서버가 고정을 안 보내면 전부 변동이다 — 기존 화면 그대로", () => {
    const s = splitFixed(500_000, undefined);
    expect(s.fixed).toBe(0);
    expect(s.variable).toBe(500_000);
    expect(s.fixedPercent).toBe(0);
  });

  it("전체가 0 이면 비율도 0 이다 — 0 으로 나누지 않는다", () => {
    const s = splitFixed(0, 0);
    expect(s).toEqual({ total: 0, fixed: 0, variable: 0, fixedPercent: 0 });
  });

  it("고정이 전체를 넘어도 변동이 음수가 되지 않는다", () => {
    const s = splitFixed(100, 150);
    expect(s.fixed).toBe(100);
    expect(s.variable).toBe(0);
    expect(s.fixedPercent).toBe(100);
  });

  it("음수·null 은 0 으로 본다", () => {
    expect(splitFixed(-5, 3).total).toBe(0);
    expect(splitFixed(100, -3).fixed).toBe(0);
    expect(splitFixed(null, null).total).toBe(0);
  });

  it("비율은 반올림하지 않는다 — 자리수는 화면의 비중 규칙이 정한다", () => {
    expect(splitFixed(3, 1).fixedPercent).toBeCloseTo(33.3333, 3);
    expect(splitFixed(3, 2).fixedPercent).toBeCloseTo(66.6667, 3);
  });
});

describe("amountFor — 보기에 맞는 금액", () => {
  const s = splitFixed(1_000, 700);
  it("전체 / 고정 제외 / 고정만", () => {
    expect(amountFor(s, "all")).toBe(1_000);
    expect(amountFor(s, "variable")).toBe(300);
    expect(amountFor(s, "fixed")).toBe(700);
  });
});

describe("fixedShareTexts — 앱(ds/b3-b-app 477421ff)과 같은 입력 표", () => {
  // [전체, 고정, 고정 글, 변동 글] — 변동 = 100 − 반올림한 고정, 한쪽이 0 초과 0.05 미만이면 "0.1% 미만", 전체 0 이면 0.0 / 0.0
  it.each([
    [3, 1, "33.3%", "66.7%"],
    [3, 2, "66.7%", "33.3%"],
    [10_000, 4, "0.1% 미만", "100.0%"],
    [10_000, 9_996, "100.0%", "0.1% 미만"],
    [1_000, 1_000, "100.0%", "0.0%"],
    [1_000, 0, "0.0%", "100.0%"],
    [0, 0, "0.0%", "0.0%"],
    [800, 245, "30.6%", "69.4%"],
    [10_000, 1_225, "12.3%", "87.7%"], // 옛 계산은 87.75 → 87.8 로 합이 100.1
  ])("전체 %i · 고정 %i → 고정 %s · 변동 %s", (total, fixed, f, v) => {
    const r = fixedShareTexts(splitFixed(total, fixed));
    expect(r).toEqual({ fixed: f, variable: v });
  });
});
