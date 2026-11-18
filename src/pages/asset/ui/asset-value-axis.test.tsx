// 자산 순자산 추이 세로 눈금 QA(2026-11-18, dev f3d43f81 — 순자산 조 단위 · 폰 320).
// recharts 세로축 기본(interval "preserveEnd")이 준 눈금도 글 높이 + 8 로 재 빼서, 100% 에서도 "50조 · 150조" 만 남고
// 0 · 100조 가 빠졌다 — niceValueAxis 눈금(1 · 2 · 5 간격 · 0 포함)을 하나도 빼지 않고 그린다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installValueAxisHarness,
  layoutCharts,
  tickScale,
  yTickLabels,
  yTickPositions,
} from "@/shared/lib/groo/value-axis.test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const JO = 1_000_000_000_000;
/** 12 달 순자산 — [from] 조에서 달마다 [by] 조씩 */
const series = (from: number, by: number) =>
  Array.from({ length: 12 }, (_, i) => ({
    year: 2025 + (i >= 2 ? 1 : 0),
    month: ((i + 10) % 12) + 1,
    netWorth: Math.round((from + i * by) * JO),
  }));
let points = series(112, 3.1);

vi.mock("@/features/asset", async (orig) => ({
  ...(await orig<typeof import("@/features/asset")>()),
  useNetWorthTrend: () => ({
    data: points,
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
}));

const { i18n } = await import("@/shared/i18n/config");
const { NetWorthChart } = await import("./asset-parts");

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

/** 폰 320 — 띠 좌우 24 를 뺀 차트 폭. 띠의 차트 높이는 140 */
const PHONE_CHART = 272;

// recharts 는 잰 글 크기를 글 내용으로 기억한다(글자 크기는 열쇠에 안 든다 — jsdom) — 두 글자 크기는 서로 다른 글로 잰다
describe("순자산 추이 — 조 단위", () => {
  it("폰 320 · 글자 100% — 112조 ~ 146조: 0 · 50조 · 100조 · 150조 를 모두 그린다", async () => {
    points = series(112, 3.1);
    await act(() => root.render(<NetWorthChart height={140} />));
    await layoutCharts(PHONE_CHART);
    expect(yTickLabels(container)).toEqual(["0", "50조", "100조", "150조"]);
  });

  it("폰 320 · 글자 200% — 1.12조 ~ 1.46조: 0 · 0.5조 · 1조 · 1.5조 를 모두 그린다", async () => {
    tickScale.value = 2;
    points = series(1.12, 0.031);
    await act(() => root.render(<NetWorthChart height={140} />));
    await layoutCharts(PHONE_CHART);
    expect(yTickLabels(container)).toEqual(["0", "0.5조", "1조", "1.5조"]);
  });

  // 폰 띠 140(위 8 · 아래 0) · 글자 200% — 그리는 높이 94(140 − 8 − 0 − 38) · 눈금 글 줄 30 → 세 칸까지. 0.35조 ~ 0.95조 는 네 칸 겨냥이면
  // 0 ~ 1조 · 0.2조 간격 다섯 칸(눈금 사이 18.8)이라 글이 겹친다 — 칸 수를 줄여 다시 센다(chart.md "세로 눈금이 겹치면 수를 줄입니다")
  it("폰 띠 140 · 글자 200% — 0.35조 ~ 0.95조: 0 · 0.5조 · 1조, 세로 눈금 글이 겹치지 않는다", async () => {
    tickScale.value = 2;
    points = series(0.35, 0.055);
    await act(() => root.render(<NetWorthChart height={140} />));
    await layoutCharts(PHONE_CHART);
    expect(yTickLabels(container)).toEqual(["0", "0.5조", "1조"]);
    const ys = yTickPositions(container);
    for (let i = 1; i < ys.length; i++)
      expect(ys[i - 1]! - ys[i]!).toBeGreaterThanOrEqual(30);
  });
});
