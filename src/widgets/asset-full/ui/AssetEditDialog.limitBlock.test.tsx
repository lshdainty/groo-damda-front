// 상한(1,000억) 위 금액은 **저장을 막는다** — 안내(오류)가 뜨는 칸은 모두(디자인시스템 확정).
//
// 마이너스 통장 약정 한도 · 투자 예수금도 같다(앱과 같은 칸 집합). 상한 전에 저장된 옛 값을 열었을 때를 잠근다:
// ① 칸 아래 오류가 보인다  ② [저장] 이 요청(onUpdate)을 보내지 않는다  ③ 값을 깎지 않는다(칸 값 그대로).
// 상한 안(1,000억 이하)이면 같은 칸이 저장된다 — 막는 테스트가 헛돌지 않게 짝을 둔다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import { installDomStubs } from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// 라벨 키를 그대로 흘려보내되, 보간값은 붙여 준다 — 초과 **금액**까지 봐야
// "배지만 뜨고 얼마인지는 안 알려 준다" 를 잡을 수 있다.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts ? `${k}|${Object.values(opts).join("|")}` : k,
    i18n: { language: "ko" },
  }),
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
vi.mock("@/features/stock/model/useLivePrices", () => ({
  useLivePrices: () => ({
    quoteOf: () => undefined,
    unitKrw: () => null,
    prevUnitKrw: () => null,
    currencyOf: () => undefined,
  }),
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => ({ data: undefined }),
}));
// 설정의 기본 통화 — 실제 훅은 react-query 를 타므로 값만 흘려보낸다(D7).
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: "KRW",
    ready: true,
    ensure: async () => true,
  }),
}));

const { AssetEditDialog } = await import("./AssetEditDialog");

const baseAsset = {
  userRowId: 1,
  cashBalance: 0,
  holdingBalance: 0,
  color: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  currency: "KRW",
  exchangeRate: 1,
  memo: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
} as const;

const OVER = 200_000_000_000;

const overdraft = (limit: number): Asset => ({
  ...baseAsset,
  rowId: 31,
  assetName: "신한 마통",
  assetType: "BANK_ACCOUNT",
  balance: -1_000_000,
  institution: "신한",
  creditLimit: limit,
});

/** 보유 종목이 없는 투자 계좌 — 예수금 칸이 선다(보유가 있으면 평가액 합계 읽기 전용) */
const invest = (cash: number): Asset =>
  ({
    ...baseAsset,
    rowId: 32,
    assetName: "주식계좌",
    assetType: "INVESTMENT",
    balance: cash,
    cashBalance: cash,
    institution: "키움증권",
    holdings: [],
  }) as unknown as Asset;

const mounted: { container: HTMLDivElement; root: Root }[] = [];

function unmountAll() {
  for (const m of mounted.splice(0)) {
    act(() => m.root.unmount());
    m.container.remove();
  }
}

function open(item: Asset) {
  unmountAll();
  __resetPointerBlockForTest();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  const onUpdate = vi.fn();
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        onClose={() => {}}
        onCreate={() => {}}
        onUpdate={onUpdate}
      />,
    ),
  );
  const save = () => {
    const btn = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "save",
    );
    if (!btn) throw new Error("저장 버튼을 찾지 못했다");
    act(() => btn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  };
  return { save, onUpdate };
}

/** 칸 아래 상한 오류 글 — 오류가 선 Field 의 바닥 */
const limitError = () =>
  [...document.body.querySelectorAll("[data-slot=field][data-invalid]")]
    .map((f) => f.textContent ?? "")
    .find((t) => t.includes("amountTooLargeAt")) ?? null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installDomStubs();
});

afterEach(unmountAll);

describe("상한(1,000억) 위 금액은 저장을 막는다", () => {
  it("마이너스 통장 약정 한도: 상한 위면 칸 아래 오류가 뜨고 저장 요청이 나가지 않는다", () => {
    const { save, onUpdate } = open(overdraft(OVER));
    expect(limitError()).toContain("1,000억원");
    save();
    expect(onUpdate).not.toHaveBeenCalled();
    // 깎지 않는다 — 칸 값은 옛 값 그대로
    const inputs = [...document.body.querySelectorAll("input")].map(
      (i) => i.value,
    );
    expect(inputs).toContain("200,000,000,000");
  });

  it("마이너스 통장 약정 한도: 상한 안이면 저장된다", () => {
    const { save, onUpdate } = open(overdraft(100_000_000_000));
    expect(limitError()).toBeNull();
    save();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0]?.[0].creditLimit).toBe(100_000_000_000);
  });

  it("투자 예수금: 상한 위면 칸 아래 오류가 뜨고 저장 요청이 나가지 않는다", () => {
    const { save, onUpdate } = open(invest(OVER));
    expect(limitError()).toContain("1,000억원");
    save();
    expect(onUpdate).not.toHaveBeenCalled();
    const inputs = [...document.body.querySelectorAll("input")].map(
      (i) => i.value,
    );
    expect(inputs).toContain("200,000,000,000");
  });

  it("투자 예수금: 상한 안이면 저장된다", () => {
    const { save, onUpdate } = open(invest(100_000_000_000));
    expect(limitError()).toBeNull();
    save();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
