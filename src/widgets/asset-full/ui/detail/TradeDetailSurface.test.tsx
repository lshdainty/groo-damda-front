// 거래 기록 상세(I-17 50 · 10-25 줄 끝 ⋮ 원칙) — 줄 누름 = 들어가기(조회), 동작은 바닥 왼쪽 [거래 취소] 하나
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetTrade } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
// 1280 이상 대화상자 쪽을 본다(시트는 같은 본문 · 같은 바닥 단추)
vi.mock("@/shared/ds/overlay", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWideSurface: () => true,
}));

const { TradeDetailSurface } = await import("./TradeDetailSurface");

const sell = {
  rowId: 2,
  tradeType: "SELL",
  holdingKey: "숲빛전자",
  quantity: "30",
  amount: 2_100_000,
  fee: 0,
  realizedPl: 250_000,
  tradeDate: "2026-10-09T10:00:00",
} as unknown as AssetTrade;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mask = (s: string) => s;
const text = () => document.body.textContent ?? "";

describe("TradeDetailSurface", () => {
  it("종류 · 종목 · 수량 · 단가 · 금액 · 실현손익 · 일시를 키-값 줄로 보인다", () => {
    act(() =>
      root.render(
        <TradeDetailSurface
          trade={sell}
          mask={mask}
          onClose={() => {}}
          onCancelTrade={() => {}}
        />,
      ),
    );
    const t = text();
    expect(t).toContain("trade.sell");
    expect(t).toContain("숲빛전자");
    expect(t).toContain("70,000원"); // 단가 = 금액 ÷ 수량
    expect(t).toContain("2,100,000원");
    expect(t).toContain("+250,000원");
    expect(t).toContain("2026-10-09 10:00");
    // 수수료 0 은 줄을 그리지 않는다
    expect(t).not.toContain("trade.feeLabel");
  });

  it("동작은 [거래 취소] 하나 — ⋮ · 다른 단추가 없고, 누르면 확인으로 넘긴다", () => {
    const cancelled: number[] = [];
    act(() =>
      root.render(
        <TradeDetailSurface
          trade={sell}
          mask={mask}
          onClose={() => {}}
          onCancelTrade={() => cancelled.push(sell.rowId)}
        />,
      ),
    );
    const btn = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent === "trade.deleteAction",
    );
    expect(btn).toBeDefined();
    act(() => btn!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(cancelled).toEqual([2]);
    expect(document.body.querySelector("[aria-label*='ellipsis']")).toBeNull();
  });

  it("금액 가림을 따른다 — 단가 · 금액 · 실현손익이 마스크를 거친다", () => {
    act(() =>
      root.render(
        <TradeDetailSurface
          trade={sell}
          mask={() => "••••"}
          onClose={() => {}}
          onCancelTrade={() => {}}
        />,
      ),
    );
    expect(text()).not.toContain("2,100,000");
    expect(text()).toContain("••••");
  });
});
