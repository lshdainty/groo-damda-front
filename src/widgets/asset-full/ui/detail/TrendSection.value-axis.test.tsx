// 자산 상세 › 최근 잔액 추이 세로 눈금 QA(2026-11-18 — 잔액 조 단위 · 폰 320). 차트 눈금 글은 글자 크기 설정을 따르지 않는다(#260)
// — 300% 에서도 눈금이 100% 와 같다.
// recharts 세로축 기본(interval "preserveEnd")이 준 눈금도 글 높이 + 8 로 재 빼서 고르지 않게 남았다 —
// niceValueAxis 눈금(1 · 2 · 5 간격 · 0 포함)을 하나도 빼지 않고 그린다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import {
  changeTickScale,
  installValueAxisHarness,
  layoutCharts,
  tickScale,
  xTickLabels,
  yTickLabels,
  yTickPositions,
} from "@/shared/lib/groo/value-axis.test-utils";
import type { AssetDetailModel } from "./use-asset-detail";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const JO = 1_000_000_000_000;
/** 12 주 잔액(원화 합계) — [at] 주마다 값 */
const series = (at: (i: number) => number) =>
  Array.from({ length: 12 }, (_, i) => ({
    weekStart: `2026-08-${String(i + 1).padStart(2, "0")}`,
    balance: 0,
    balanceInKrw: Math.round(at(i)),
  }));
/** 2.3조 ~ 3.2조 */
let weeks = series((i) => (2.3 + i * 0.08) * JO);

vi.mock("@/features/asset", async (orig) => ({
  ...(await orig<typeof import("@/features/asset")>()),
  useAssetBalanceTrend: () => ({
    data: weeks,
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
}));

const { i18n } = await import("@/shared/i18n/config");
const { TrendSection } = await import("./TrendSection");

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installValueAxisHarness();
  await i18n.changeLanguage("ko");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const renderTrend = () =>
  act(() =>
    root.render(
      <TrendSection
        asset={{ rowId: 7, isAmountHidden: "N" } as Asset}
        model={{ isCard: false, isInv: false } as AssetDetailModel}
        desk={false}
      />,
    ),
  );

describe("자산 상세 잔액 추이 — 조 단위", () => {
  // 폰 차트 140(위 8 · 아래 0) — 그리는 높이 140 − 8 − 0 − (12 + 15) = 105, 눈금 글 줄 15 → 7 칸까지. 글자 크기를 키워도 그대로다
  it("폰 320 · 글자 100% 와 300% — 0 ~ 5조 같은 눈금, 눈금 사이가 눈금 글 줄(15) 이상", async () => {
    weeks = series((i) => (2.3 + i * 0.08) * JO);
    await renderTrend();
    // 폰 320 — 좌우 거터 24 를 뺀 폭. 폰의 차트 높이는 140
    await layoutCharts(272);
    const labels100 = yTickLabels(container);
    const ys100 = yTickPositions(container);
    expect(labels100).toEqual(["0", "1조", "2조", "3조", "4조"]);
    await changeTickScale(3);
    await layoutCharts(272);
    expect(yTickLabels(container)).toEqual(labels100);
    expect(yTickPositions(container)).toEqual(ys100);
    for (let i = 1; i < ys100.length; i++)
      expect(ys100[i - 1]! - ys100[i]!).toBeGreaterThanOrEqual(15);
  });
});

/**
 * 최근 12주 잔액 추이 — QA(2026-11-18, dev 58860fea · 잔액 0 ~ 9,000원). 이 차트만 가로축이 `chartAxisProps()` 라 recharts 가 눈금을
 * 골랐다 — "1 ~ 8 · 10 · 12주"(9 · 11 빠짐 · 간격 고르지 않음) · 오른쪽 1 넘침. 이제 ds 가로축 길(chartXAxisProps — 끝 주를 지키는
 * 고른 건너뛰기 · 끝 글 반 폭 비움)과 세로 눈금 수 줄이기를 탄다. 눈금 글은 글자 크기 설정을 따르지 않아 300% 에서도 100% 와 같다.
 */
describe("자산 상세 최근 12주 — 가로 · 세로 눈금", () => {
  const cases = [
    { width: 320, scale: 1 },
    { width: 320, scale: 3 },
    { width: 390, scale: 1 },
    { width: 390, scale: 3 },
  ];
  const seen = new Map<number, string[]>();
  for (const { width, scale } of cases) {
    it(`폰 ${width} · 글자 ${scale * 100}% — 끝 "12주" 를 지키고 고르게 건너뛰며, 잘리지도 겹치지도 않는다(300% 는 100% 와 같은 눈금)`, async () => {
      tickScale.value = scale;
      weeks = series(
        (i) =>
          [
            0, 1_200, 3_400, 2_100, 9_000, 4_500, 6_100, 0, 5_200, 7_700, 3_300,
            8_400,
          ][i]!,
      );
      await renderTrend();
      // 좌우 거터 24 를 뺀 차트 폭
      const chart = width - 48;
      await layoutCharts(chart);
      const xs = xTickLabels(container);
      expect(xs[xs.length - 1]!.text).toBe("12주");
      // 끝 글이 차트 오른쪽 끝을 넘지 않는다
      expect(xs[xs.length - 1]!.right).toBeLessThanOrEqual(chart + 0.01);
      // 글 사이 8 이상 · 건너뛴 간격이 고르다
      for (let i = 1; i < xs.length; i++)
        expect(xs[i]!.left - xs[i - 1]!.right).toBeGreaterThanOrEqual(8);
      const n = xs.map((x) => parseInt(x.text, 10));
      expect(
        new Set(n.slice(1).map((v, i) => v - n[i]!)).size,
      ).toBeLessThanOrEqual(1);
      // 세로 — 눈금 사이가 눈금 글 줄 높이(15) 이상, 0 부터 1 · 2 · 5 간격
      const ys = yTickPositions(container);
      for (let i = 1; i < ys.length; i++)
        expect(ys[i - 1]! - ys[i]!).toBeGreaterThanOrEqual(15);
      expect(yTickLabels(container)[0]).toBe("0");
      // 300% 는 같은 폭의 100% 와 같은 가로 · 세로 눈금
      const all = [...xs.map((x) => x.text), "|", ...yTickLabels(container)];
      if (scale === 1) seen.set(width, all);
      else expect(all).toEqual(seen.get(width));
    });
  }
});
