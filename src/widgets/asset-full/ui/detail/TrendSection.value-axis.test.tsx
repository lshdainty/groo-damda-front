// 자산 상세 › 최근 잔액 추이 세로 눈금 QA(2026-11-18 — 잔액 조 단위 · 폰 320 · 글자 200%).
// recharts 세로축 기본(interval "preserveEnd")이 준 눈금도 글 높이 + 8 로 재 빼서 고르지 않게 남았다 —
// niceValueAxis 눈금(1 · 2 · 5 간격 · 0 포함)을 하나도 빼지 않고 그린다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import {
  installValueAxisHarness,
  layoutCharts,
  tickScale,
  yTickLabels,
} from "@/shared/lib/groo/value-axis.test-utils";
import type { AssetDetailModel } from "./use-asset-detail";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const JO = 1_000_000_000_000;
/** 12 주 잔액 — 2.3조 ~ 3.2조(원화 합계) */
const weeks = Array.from({ length: 12 }, (_, i) => ({
  weekStart: `2026-08-${String(i + 1).padStart(2, "0")}`,
  balance: 0,
  balanceInKrw: Math.round((2.3 + i * 0.08) * JO),
}));

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

describe("자산 상세 잔액 추이 — 조 단위", () => {
  it("폰 320 · 글자 200% — 0 · 1조 · 2조 · 3조 · 4조 를 모두 그린다", async () => {
    tickScale.value = 2;
    await act(() =>
      root.render(
        <TrendSection
          asset={{ rowId: 7, isAmountHidden: "N" } as Asset}
          model={{ isCard: false, isInv: false } as AssetDetailModel}
          desk={false}
        />,
      ),
    );
    // 폰 320 — 좌우 거터 16 을 뺀 폭. 폰의 차트 높이는 140
    await layoutCharts(288);
    expect(yTickLabels(container)).toEqual(["0", "1조", "2조", "3조", "4조"]);
  });
});
