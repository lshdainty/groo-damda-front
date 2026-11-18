import { describe, expect, it } from "vitest";
import {
  barChartTop,
  barValueRoom,
  visiblePercentLabels,
} from "./percent-labels";

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
  it("쉼표 글자도 폭에 든다 — 1,234% · 12,346% 가 닿으면 끝을 남기고 앞을 건너뛴다", () => {
    // jsdom 은 글자 수 × 0.62em 어림 — 쉼표 없는 5 · 6 글자는 step 48 에 들지만 쉼표 6 · 7 글자는 닿는다
    expect(visiblePercentLabels(["1234%", "12346%"], 48, 12)).toEqual([
      true,
      true,
    ]);
    expect(visiblePercentLabels(["1,234%", "12,346%"], 48, 12)).toEqual([
      false,
      true,
    ]);
  });
});

describe('막대 위 값 자리 — 그 글 줄 높이 + 4(chart.md "막대 위 값 자리도 글을 따릅니다", #250)', () => {
  it("값 글 12 / 16(줄 1rem) — 100% 20 · 200% 36 · 300% 52, 고정 20 이 아니다", () => {
    expect(barValueRoom(16)).toBe(20);
    expect(barValueRoom(32)).toBe(36);
    expect(barValueRoom(48)).toBe(52);
  });
  it("위 여백 = max(8 + 값 자리, ⌈세로 눈금 줄 ÷ 2⌉) — 100% 28 · 200% 44 · 300% 60(앱 topPad 와 같은 식)", () => {
    expect(barChartTop(16, 15)).toBe(28);
    expect(barChartTop(32, 30)).toBe(44);
    expect(barChartTop(48, 45)).toBe(60);
  });
});
