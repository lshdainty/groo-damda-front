// 자산 상세 보유 종목 — 시세를 못 받으면(I-wrap-b2b 단계 4). 예전에는 연동 줄 금액 Skeleton 이 끝없이 돌았다(버그).
// 지금: 섹션 머리 아래 실패 + [다시 시도], 연동 줄 금액은 "—"(받아 둔 값이 있으면 그 값).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  failed: false,
  price: null as number | null,
  pending: false,
  retry: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", () => ({
  holdingsOf: () => [
    { rowId: 1, linked: true, tossSymbol: "005930", quantity: "3" },
  ],
  useAssetTrades: () => ({ data: [], isLoading: false, isError: false }),
  useDeleteTrade: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => ({
    data: { features: ["SECURITIES"], connectedBrokers: ["NAMU"] },
  }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSymbolName: () => ({ data: "숲길전자" }),
}));
vi.mock("@/features/stock/model/useLivePrices", () => ({
  useLivePrices: () => ({
    quoteOf: () =>
      st.price != null ? { price: st.price, currency: "KRW" } : undefined,
    unitKrw: () => st.price,
    prevUnitKrw: () => null,
    currencyOf: () => "KRW",
    failed: st.failed,
    failedShows: st.failed
      ? st.price == null
        ? "lastBalance"
        : "lastPrice"
      : null,
    retrying: st.pending,
    retry: st.retry,
  }),
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));

const { HoldingsSection } = await import("./HoldingsSection");

const asset = {
  rowId: 9,
  assetName: "나무 계좌",
  assetType: "INVESTMENT",
  isAmountHidden: "N",
  currency: "KRW",
} as unknown as Asset;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  st.failed = false;
  st.price = null;
  st.pending = false;
  st.retry.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const draw = () => act(() => root.render(<HoldingsSection asset={asset} />));
const skeletons = () =>
  container.querySelectorAll("[data-slot=list-item] [data-slot=skeleton]");

describe("보유 종목 — 시세 실패", () => {
  it("처음부터 실패: 끝없는 Skeleton 이 아니라 실패 + [다시 시도], 줄 금액은 '—'", () => {
    st.failed = true;
    draw();
    const band = container.querySelector("[data-slot=price-fail-band]");
    expect(band?.textContent).toContain("detail.priceFail");
    expect(skeletons()).toHaveLength(0);
    expect(container.textContent).toContain("—");
    const retry = [...band!.querySelectorAll("button")].find((b) =>
      /retry|다시/.test(b.textContent ?? ""),
    );
    act(() => retry!.click());
    expect(st.retry).toHaveBeenCalled();
  });

  it("받아 둔 시세가 있는 채 실패: 금액은 그대로(70,000 × 3) — Callout 은 맨 위 금액 카드 하나가 말하고 여기엔 두지 않는다(검수 2차 L5)", () => {
    st.failed = true;
    st.price = 70_000;
    draw();
    expect(container.textContent).toContain("210,000");
    expect(container.querySelector("[data-slot=price-fail-band]")).toBeNull();
    expect(
      container.querySelector("[data-slot=price-stale-callout]"),
    ).toBeNull();
  });

  it("받는 중에만 Skeleton — 받았는데 이 종목 시세가 없으면 끝없이 돌지 않고 '—'(검수 2차 L3)", () => {
    st.pending = false;
    draw();
    expect(skeletons()).toHaveLength(0);
    expect(container.textContent).toContain("—");
  });

  it("실패가 아니면 띠가 없다(받는 중에는 Skeleton 그대로)", () => {
    st.pending = true;
    draw();
    expect(container.querySelector("[data-slot=price-fail-band]")).toBeNull();
    expect(skeletons().length).toBeGreaterThan(0);
  });
});
