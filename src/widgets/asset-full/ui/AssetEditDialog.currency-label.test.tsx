// 금액 칸의 단위는 **고른 통화**를 따른다 (QA 12차 결정).
//
// 단위는 칸 뒤 글자다(I-17 12 — 라벨 괄호에서 옮겼다). 예전엔 라벨이 `잔액 (원)` 으로 박혀 있어 통화를 USD 로 골라도 원화처럼 보였다. 잔액도
// 한도도 이 폼의 통화로 적는 값이다 — 초과 안내는 이미 그 통화로 나가고 있었으므로
// (`formatOriginalAmount(…, currency)`) 한 폼 안에서 단위가 갈려 있었다.
//
// 여기서 잠그는 건 셋이다:
// ① 자산의 통화를 따른다 ② 새 자산은 설정의 기본 통화를 따른다(D7)
// ③ 연동 합계만은 안 따른다 — 그 값은 시세를 원화로 환산해 더한 값이라
//    고른 통화를 붙이면 라벨이 값을 속인다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { i18n } from "@/shared/i18n/config";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Asset } from "@/entities/asset";
import type { AssetKind } from "../lib/asset-kind";
import { installDomStubs, unitOf } from "./asset-form/test-helpers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({ defaultCurrency: "KRW" }));

// 키를 그대로 흘려보내되 보간값은 붙여 준다 — 단위가 그 라벨에 실제로 실렸는지를 본다.
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
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: state.defaultCurrency,
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

const account = (currency: string): Asset => ({
  ...baseAsset,
  rowId: 31,
  assetName: "외화통장",
  assetType: "BANK_ACCOUNT",
  balance: 1_000,
  institution: "하나",
  currency,
  exchangeRate: currency === "KRW" ? 1 : 1_380,
});

/** 마이너스통장은 별도 타입이 아니라 **잔액이 음수인 계좌** 다(QA #17). */
const overdraft = (currency: string): Asset => ({
  ...account(currency),
  rowId: 32,
  balance: -1_000,
  creditLimit: 5_000,
});

const card = (currency: string): Asset => ({
  ...baseAsset,
  rowId: 33,
  assetName: "해외 카드",
  assetType: "CREDIT_CARD",
  balance: -1_000,
  institution: "신한카드",
  creditLimit: 5_000,
  paymentDay: 14,
  currency,
  exchangeRate: currency === "KRW" ? 1 : 1_380,
});

/** 연동 합계가 잡히는 투자 자산 — 수동 항목은 적어 둔 평가액이 그대로 합계가 된다. */
const investWithHoldings = (currency: string): Asset =>
  ({
    ...baseAsset,
    rowId: 34,
    assetName: "해외 주식",
    assetType: "INVESTMENT",
    balance: 0,
    institution: null,
    currency,
    exchangeRate: currency === "KRW" ? 1 : 1_380,
    holdings: [
      {
        rowId: 1,
        holdingType: "STOCK",
        linked: false,
        holdingName: "APPL",
        holdingValue: 500_000,
      },
    ],
  }) as unknown as Asset;

let container: HTMLDivElement;
let root: Root;

function open(item: Asset | null, kind?: AssetKind) {
  __resetPointerBlockForTest();
  act(() =>
    root.render(
      <AssetEditDialog
        item={item}
        kind={kind}
        onClose={() => {}}
        onCreate={() => {}}
        onUpdate={() => {}}
      />,
    ),
  );
}

/**
 * 로케일은 **진짜 i18n** 을 세운다 — 단위 규칙(원화만 ko `원`/en `₩`)이 그 값을 읽는다.
 * 위에서 흉내 낸 `t` 는 키만 흘려보내는 것이라 여기엔 안 걸린다.
 */
const origLang = i18n.language;
beforeAll(async () => {
  await i18n.changeLanguage("ko");
});
afterAll(async () => {
  await i18n.changeLanguage(origLang);
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.defaultCurrency = "KRW";
  installDomStubs();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("금액 칸의 단위는 고른 통화를 따른다", () => {
  it("원화 계좌는 `원` — 한국어 화면은 `₩` 를 안 쓴다", () => {
    open(account("KRW"));
    expect(unitOf("editDialog.balanceLabelAccount")).toBe("원");
  });

  it("달러 계좌는 `$` — 여기가 `원` 이면 통화를 골라도 원화로 읽힌다", () => {
    open(account("USD"));
    expect(unitOf("editDialog.balanceLabelAccount")).toBe("$");
  });

  it("유로·엔도 같은 매핑을 탄다", () => {
    open(account("EUR"));
    expect(unitOf("editDialog.balanceLabelAccount")).toBe("€");
    open(account("JPY"));
    expect(unitOf("editDialog.balanceLabelAccount")).toBe("¥");
  });

  it("마이너스통장은 쓴 돈과 약정 한도가 **같은 단위**다", () => {
    open(overdraft("USD"));
    expect(unitOf("editDialog.balanceLabelOverdraft")).toBe("$");
    expect(unitOf("editDialog.overdraftLimitLabel")).toBe("$");
  });

  it("카드는 사용액과 신용한도가 **같은 단위**다", () => {
    open(card("USD"));
    expect(unitOf("editDialog.balanceLabelCard")).toBe("$");
    expect(unitOf("editDialog.creditLimit")).toBe("$");
  });

  it("새 자산은 설정의 기본 통화를 따른다 — 적어 둔 통화가 없다(D7)", () => {
    state.defaultCurrency = "USD";
    open(null, "입출금");
    expect(unitOf("editDialog.balanceLabelAccount")).toBe("$");
  });

  it("연동 합계만은 안 따른다 — 시세를 원화로 환산해 더한 값이다", () => {
    open(investWithHoldings("USD"));
    expect(unitOf("editDialog.balanceLabelInvest")).toBe("원");
  });

  it("영어 화면의 원화는 `₩` — `Balance (원)` 은 남의 글자다", async () => {
    await i18n.changeLanguage("en");
    open(account("KRW"));
    expect(unitOf("editDialog.balanceLabelAccount")).toBe("₩");
    open(account("USD"));
    expect(unitOf("editDialog.balanceLabelAccount")).toBe("$");
    await i18n.changeLanguage("ko");
  });
});
