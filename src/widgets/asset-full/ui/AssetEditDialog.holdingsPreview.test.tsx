// 자산 편집 — 연동 보유의 평가액 미리보기가 시세를 못 받았을 때(I-wrap-b2b 판단 (5)). 예전에는 칸이 비어 보였다.
// 지금: 보유 종목 칸 맨 위에 그 자리 Result Section "시세를 불러오지 못했어요" + [다시 시도](B2a 분할 실패와 같은 꼴, 고정 글).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import { installDomStubs } from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  // `i18n` 까지 흉내 낸다 — 다이얼로그가 금액을 통화 표기로 쓸 때 `i18n.language` 를
  // 본다. 빼 두면 그 경로가 닿는 순간 테스트가 아니라 목이 터진다.
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: [] }, isLoading: false }),
}));
vi.mock("@/features/card-catalog", () => ({
  useCardCatalogs: () => ({ data: undefined, isFetching: false }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSearch: () => ({ data: [], isFetching: false }),
  useStockSymbolName: () => ({ data: undefined }),
}));
const live = vi.hoisted(() => ({ failed: false, retry: vi.fn() }));
vi.mock("@/features/stock/model/useLivePrices", () => ({
  useLivePrices: (_s: string[], enabled: boolean) => ({
    quoteOf: () => undefined,
    unitKrw: () => null,
    prevUnitKrw: () => null,
    currencyOf: () => undefined,
    failed: enabled && live.failed,
    failedShows: enabled && live.failed ? "lastBalance" : null,
    retrying: false,
    retry: live.retry,
  }),
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  // 증권 연결 — 연동 보유의 평가 미리보기가 시세를 부른다
  useMyFeatures: () => ({
    data: { features: ["SECURITIES"], connectedBrokers: ["NAMU"] },
  }),
}));
// 설정의 기본 통화 — 실제 훅은 react-query 를 타므로 값만 흘려보낸다(D7).
const prefs = vi.hoisted(() => ({ defaultCurrency: "KRW" }));
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: prefs.defaultCurrency,
    ready: true,
    ensure: async () => true,
  }),
}));

const { AssetEditDialog } = await import("./AssetEditDialog");

const invest = {
  rowId: 11,
  userRowId: 1,
  assetName: "주식계좌",
  assetType: "INVESTMENT",
  balance: 1_000_000,
  cashBalance: 0,
  holdingBalance: 1_000_000,
  currency: "KRW",
  exchangeRate: null,
  institution: "키움증권",
  memo: null,
  color: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  holdings: [
    {
      rowId: 1,
      holdingType: "STOCK",
      linked: true,
      tossSymbol: "A900001",
      quantity: "3",
      holdingValue: 0,
    },
  ],
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
} as unknown as Asset;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  installDomStubs();
  live.failed = false;
  live.retry.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
let updated: Record<string, unknown> | null = null;
const draw = () =>
  act(() =>
    root.render(
      <AssetEditDialog
        item={invest}
        onClose={() => {}}
        onCreate={() => {}}
        onUpdate={(v) => {
          updated = v as unknown as Record<string, unknown>;
        }}
      />,
    ),
  );

describe("자산 편집 — 보유 평가 미리보기 시세 실패", () => {
  it("시세를 못 받으면 보유 칸에 Result Section + [다시 시도] — 비어 보이지 않는다", () => {
    live.failed = true;
    draw();
    const band = document.body.querySelector("[data-slot=price-fail-band]");
    expect(band?.textContent).toContain("detail.priceFail");
    const retry = [...band!.querySelectorAll("button")][0]!;
    act(() => retry.click());
    expect(live.retry).toHaveBeenCalled();
  });

  it("시세를 받으면 실패 자리가 없다", () => {
    draw();
    expect(
      document.body.querySelector("[data-slot=price-fail-band]"),
    ).toBeNull();
  });

  it("합계는 0 이 아니라 '—' — 시세를 모르는 연동 줄이 있으면 합계를 말하지 않는다", () => {
    live.failed = true;
    draw();
    const text = document.body.textContent ?? "";
    expect(text).toContain("holdings.editSummaryUnknown");
    expect(text).not.toContain("holdings.editSummary{");
  });

  it("시세 실패 중 저장해도 연동 줄 평가액 · 잔액은 보내지 않는다 — 서버가 시세 × 수량으로 센다(그래서 막지 않는다)", () => {
    live.failed = true;
    updated = null;
    draw();
    const save = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "save",
    )!;
    act(() => save.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(updated).not.toBeNull();
    expect(updated!.balance).toBeUndefined();
    const holdings = updated!.holdings as Array<Record<string, unknown>>;
    expect(holdings[0]).toMatchObject({
      linked: true,
      tossSymbol: "A900001",
      holdingValue: null,
    });
  });
});
