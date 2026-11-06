// 자산 하나에 붙은 숨김이 **상세 안까지** 닿는지 (QA 22차 #1).
//
// 목록 행은 가려지는데 상세를 열면 히어로 잔액이 그대로 보였다. 자리마다 `force=` 를
// 달던 방식이라, 하위 컴포넌트(카드 청구·보유종목) 안쪽까지 손이 닿지 않았고 실제로
// 차트 축 하나만 가려졌다. 지금은 상세 본문을 `HideForce` 로 감싼다 —
// **화면 카드는 안 가린 상태**(`useHideAmounts` → false)에서 자산 플래그만으로
// 가려지는지가 이 파일의 주장이다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => {} }));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

// 화면 카드 가리기는 **꺼 둔다** — 자산 플래그만으로 가려지는지를 본다.
vi.mock("@/shared/lib/groo/hide-amounts-core", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useHideAmounts: () => false,
}));

// 차트·거래창·확인창은 이 주장과 무관하다 — 껍데기로 바꿔 recharts 까지 들어오지 않게 한다.
vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
vi.mock("@/shared/ds/chart", () => ({
  Chart: () => null,
  ChartDataTable: () => null,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  chartAxisProps: () => ({}),
  chartGridProps: {},
  formatAxisWon: (v: number) => String(v),
}));
vi.mock("@/widgets/add-tx", () => ({ AddTxSheet: () => null }));
vi.mock("@/widgets/expense-detail/ui/TxDetailDialog", () => ({
  TxDetailDialog: () => null,
}));
vi.mock("@/widgets/expense-detail/ui/TransferDetailDialog", () => ({
  TransferDetailDialog: () => null,
}));
vi.mock("./AssetTradeDialog", () => ({ AssetTradeDialog: () => null }));

const empty = { data: undefined, isLoading: false, isFetching: false };
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: [] }, isLoading: false }),
  useAssetBalanceTrend: () => empty,
  useAssetTrades: () => empty,
  useAssetTransfers: () => empty,
  useCardBilling: () => empty,
  useCardPerformance: () => empty,
  useInvestValuation: () => empty,
  useInvestValuationState: () => ({
    map: empty,
    priceFailed: false,
    retryPrices: () => {},
  }),
  useDeleteTrade: () => ({ mutate: () => {} }),
  useCancelCardPayment: () => ({ mutate: () => {} }),
  useInstallmentPayoff: () => ({ mutate: () => {} }),
  usePayCard: () => ({ mutate: () => {} }),
  useUpdateAsset: () => ({ mutate: () => {} }),
  holdingsOf: () => [],
}));
vi.mock("@/features/expense", () => ({ useSearchExpenses: () => empty }));
vi.mock("@/features/card-performance", () => ({
  useCardPerformance: () => empty,
}));
vi.mock("@/features/subscription/model/useSubscription", () => ({
  useMyFeatures: () => ({ data: undefined }),
}));
vi.mock("@/features/stock/model/useLivePrices", () => ({
  useLivePrices: () => ({
    quoteOf: () => undefined,
    unitKrw: () => null,
    prevUnitKrw: () => null,
    currencyOf: () => undefined,
  }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSymbolName: () => ({ data: undefined }),
}));
vi.mock("@/entities/expense", () => ({
  ExpenseRow: () => null,
  isScheduledTx: () => false,
}));

const { AssetDetailView } = await import("./AssetDetailView");

const account: Asset = {
  userRowId: 1,
  rowId: 9,
  assetName: "신한 주거래",
  assetType: "BANK_ACCOUNT",
  balance: 1_200_000,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  institution: "신한",
  memo: null,
  color: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

let container: HTMLDivElement;
let root: Root;

function render(asset: Asset) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <AssetDetailView
        asset={asset}
        desk={false}
        mobile={false}
        onEdit={() => {}}
      />,
    ),
  );
  return document.body.textContent ?? "";
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("자산 상세(페이지 본문) — 자산 하나에 붙은 숨김", () => {
  it("안 가려 둔 자산은 히어로 잔액이 보인다", () => {
    const text = render(account);
    expect(text).toContain("1,200,000");
  });

  it("자산만 Y 면 히어로 잔액이 ••••• 로 가려진다 — 카드 설정과 무관하다", () => {
    const text = render({ ...account, isAmountHidden: "Y" });
    expect(text).not.toContain("1,200,000");
    expect(text).toContain("••••");
  });

  it("단위('원')도 함께 숨는다 — '••••원' 이 남지 않는다", () => {
    const text = render({ ...account, isAmountHidden: "Y" });
    // 히어로 뒤에 붙는 '원' 은 HideUnit 이라 함께 사라진다.
    expect(text).not.toContain("1,200,000원");
  });
});
