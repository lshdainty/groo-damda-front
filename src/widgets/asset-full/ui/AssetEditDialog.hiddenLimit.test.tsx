// 상한(1,000억) 검사는 **지금 보이는 칸만** 센다(디자인시스템 확정, B4 후속).
//
// 상한 전에 저장된 옛 값이 남은 칸이 종류 바꾸기 · 보유 종목 추가로 사라지면, 오류 칸도 없이 저장만 막혔다.
// 사라진 칸의 값은 저장 요청에도 실리지 않는다(AssetEditDialog: 종류마다 쓰는 칸만 싣는다)
// — 보내지도 않는 값이 막을 까닭이 없다. 보이는 칸이 상한 위면 여전히 막힌다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import { installDomStubs } from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

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
const { useAssetForm } = await import("./asset-form/use-asset-form");
type Form = ReturnType<typeof useAssetForm>;

const OVER = 200_000_000_000; // 2,000억 — 상한 1,000억 위

const base = {
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

/** 한도 칸이 있는 마이너스 통장 — 한도 · 쓴 돈 모두 상한 위(옛 값) */
const overdraft: Asset = {
  ...base,
  rowId: 31,
  assetName: "마통",
  assetType: "BANK_ACCOUNT",
  balance: -1_000,
  institution: "신한",
  creditLimit: OVER,
};
/** 예수금이 상한 위인 투자 계좌(보유 없음) */
const invest: Asset = {
  ...base,
  rowId: 32,
  assetName: "증권",
  assetType: "INVESTMENT",
  balance: OVER,
  institution: "키움증권",
  holdings: [],
} as unknown as Asset;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  installDomStubs();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function probe(item: Asset) {
  const ref: { f: Form | null } = { f: null };
  function Probe() {
    const f = useAssetForm({ item });
    useEffect(() => {
      ref.f = f;
    });
    return null;
  }
  act(() => root.render(<Probe />));
  return ref as { f: Form };
}

describe("금액 상한은 보이는 칸만 센다", () => {
  it("① 보유 종목이 생겨 예수금 칸이 사라지면 옛 예수금이 상한 위여도 저장된다", () => {
    const r = probe(invest);
    // 보유가 없을 땐 예수금 칸이 보이고 상한 위라 막힌다
    expect(r.f.issues.amountTooLarge).toBe(true);
    expect(r.f.canSubmit).toBe(false);
    act(() =>
      r.f.setHoldings([
        {
          key: "k1",
          holdingType: "GOLD",
          linked: false,
          holdingName: "금",
          holdingValue: 1_000,
        } as never,
      ]),
    );
    expect(r.f.issues.amountTooLarge).toBe(false);
    expect(r.f.canSubmit).toBe(true);
  });

  it("② 마이너스 통장 → 입출금으로 바꿔 한도 칸이 사라지면 옛 한도가 상한 위여도 저장된다", () => {
    const r = probe(overdraft);
    expect(r.f.kind).toBe("마이너스통장");
    expect(r.f.issues.amountTooLarge).toBe(true);
    act(() => r.f.setKind("입출금"));
    expect(r.f.issues.amountTooLarge).toBe(false);
    expect(r.f.canSubmit).toBe(true);
  });

  it("③ 보이는 칸이 상한 위면 여전히 막힌다 — 저장 단추가 안 나가고, 칸 오류가 선다", () => {
    unmount();
    const container2 = document.createElement("div");
    document.body.appendChild(container2);
    const root2 = createRoot(container2);
    let updated: unknown = null;
    act(() =>
      root2.render(
        <AssetEditDialog
          item={overdraft}
          onClose={() => {}}
          onCreate={() => {}}
          onUpdate={(v) => {
            updated = v;
          }}
        />,
      ),
    );
    const btn = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "save",
    );
    act(() => btn?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(updated).toBeNull();
    act(() => root2.unmount());
    container2.remove();
  });
});

function unmount() {
  act(() => root.unmount());
  root = createRoot(container);
}
