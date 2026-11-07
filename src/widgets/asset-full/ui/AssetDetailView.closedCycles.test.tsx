// 카드 상세 회차 선택기의 **닫힌 회차**(D10 · 닫힌 회차 규칙 R4).
//
// 과거 회차는 서버의 `closedCycles` 로 그린다. 머리 금액은 **지금 기록 합**
// (`recordedAmount`)이다 — 결제가 끝난 뒤 거래를 지우거나 고쳐 써도 통장은 그대로라(D1)
// 실제로 나간 돈과 갈릴 수 있고, 그때만 머리 아래 한 줄로 말한다. 세 갈래다:
//   기록 > 결제 — "계좌에서 나간 돈은 …이에요. 나머지 …은 기록만 남긴 금액이에요"
//   기록 < 결제 — "기록은 …인데 계좌에서는 …이 나갔어요"
//   결제 = 0   — "결제 완료" 대신 "기록 회차"
// 닫힌 회차 화면엔 [지금 결제]가 없고(24차 7), 할부 회차분을 한 줄씩 보여 준다(24차 8).
// 결제 취소는 닫힌 회차·환급이 나간 회차의 결제엔 없다(D6).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 저장 · 실패 알림이 useSnackbar 를 쓴다 — 앱 맨 위(src/app/index.tsx)처럼 공급자로 감싼다
import { SnackbarProvider } from "@/shared/ds/snackbar";
import type { Asset } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  // 금액을 가리는 문장은 Trans 로 그린다 — 키만 남겨 무엇을 골랐는지 본다.
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
const nav = vi.hoisted(() => ({ to: [] as string[] }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => (to: string) => nav.to.push(to),
}));

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
const billing = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: [] }, isLoading: false }),
  useAssetBalanceTrend: () => empty,
  useAssetTrades: () => empty,
  useAssetTransfers: () => empty,
  useCardBilling: () => ({ ...empty, data: billing.data }),
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
  isRefundedTx: () => false,
}));

const { AssetDetailView } = await import("./AssetDetailView");

const card: Asset = {
  userRowId: 1,
  rowId: 9,
  assetName: "현대카드",
  assetType: "CREDIT_CARD",
  balance: 0,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  institution: "현대",
  memo: null,
  color: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  paymentDay: 12,
  paymentAssetRowId: 1,
  creditLimit: 5_000_000,
  createAt: "2026-09-01T00:00:00",
  modifyAt: "2026-09-01T00:00:00",
} as Asset;

/** 8월분 — 100,000 을 결제했고 지금 기록은 125,000(뒤늦게 적은 25,000). */
const augCycle = {
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
  paymentDate: "2026-09-12",
  paidAmount: 100_000,
  recordedAmount: 125_000,
  recordedOnlyAmount: 25_000,
  preRegistration: false,
  refundableUntil: null,
  installmentDues: [
    {
      expenseRowId: 71,
      merchant: "QC90000",
      description: null,
      principalAmount: 90_000,
      installmentMonths: 3,
      sequence: 2,
      amount: 30_000,
      paidOff: false,
      recordOnly: true,
    },
  ],
};
/** 7월분 — 앱이 한 푼도 안 뺐다(카드 등록 전). 기록만 40,000. */
const julCycle = {
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  paymentDate: "2026-08-12",
  paidAmount: 0,
  recordedAmount: 40_000,
  recordedOnlyAmount: 40_000,
  preRegistration: true,
  refundableUntil: null,
  installmentDues: [],
};
/** 6월분 — 70,000 을 결제했는데 그 뒤 거래를 지워 기록은 50,000. */
const junCycle = {
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  paymentDate: "2026-07-12",
  paidAmount: 70_000,
  recordedAmount: 50_000,
  recordedOnlyAmount: 0,
  preRegistration: false,
  refundableUntil: null,
  installmentDues: [],
};
/** 5월분 — 기록과 결제가 같다. */
const mayCycle = {
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  paymentDate: "2026-06-12",
  paidAmount: 33_000,
  recordedAmount: 33_000,
  recordedOnlyAmount: 0,
  preRegistration: false,
  refundableUntil: null,
  installmentDues: [],
};

const billingItem = (over: Record<string, unknown>) => ({
  rowId: 1,
  cardAssetRowId: 9,
  paymentAssetRowId: 1,
  billingAmount: 100_000,
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
  paymentDate: "2026-09-12",
  status: "COMPLETED",
  transferRowId: 11,
  failureReason: null,
  ...over,
});

let container: HTMLDivElement;
let root: Root;

function render(asset: Asset = card, onEdit?: (a: Asset) => void) {
  act(() =>
    root.render(
      <SnackbarProvider>
        <AssetDetailView
          asset={asset}
          desk={false}
          mobile={false}
          onEdit={() => onEdit?.(asset)}
        />
      </SnackbarProvider>,
    ),
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  billing.data = {
    cardAssetRowId: 9,
    upcomingAmount: 30_000,
    upcomingLumpSumAmount: 30_000,
    upcomingAlreadyPaidAmount: 0,
    upcomingInstallments: [],
    upcomingPeriodStart: "2026-09-01",
    upcomingPeriodEnd: "2026-09-30",
    nextPaymentDate: "2026-10-12",
    paymentDay: 12,
    paymentAssetRowId: 1,
    history: [],
    nextCycle: null,
    closedCycles: [augCycle, julCycle, junCycle, mayCycle],
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const buttonWith = (text: string) =>
  [...document.body.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  );
const click = (el: Element) =>
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

/** 회차 선택 시트를 열어 그 금액의 회차를 고른다. */
function pick(amountText: string) {
  click(buttonWith("assetDetail.scheduledTag")!);
  // 고르기 줄은 라디오 줄(ListRadioItem) — 줄의 글(label)이 가리키는 라디오를 누른다
  const label = [...document.body.querySelectorAll("label")].find(
    (l) =>
      (l.textContent ?? "").includes(amountText) &&
      !(l.textContent ?? "").includes("assetDetail.scheduledTag"),
  );
  const radio = label && document.getElementById(label.htmlFor);
  if (!radio) throw new Error(`회차를 찾지 못했다: ${amountText}`);
  click(radio);
}

const byTestId = (id: string) =>
  document.body.querySelector(`[data-testid='${id}']`);

const bodyText = () => document.body.textContent ?? "";

describe("닫힌 회차 머리 = 지금 기록 합(D10)", () => {
  it("기록이 결제보다 많으면 머리는 기록 합이고, 나간 돈과 나머지를 한 줄로 말한다", () => {
    render();
    pick("125,000");

    expect(bodyText()).toContain("125,000");
    expect(byTestId("recorded-diff-note")?.textContent).toBe(
      "assetDetail.recordedMoreNote",
    );
    expect(bodyText()).toContain("assetDetail.paidDone");
    expect(byTestId("record-cycle-label")).toBeNull();
    expect(byTestId("pre-registration-note")).toBeNull();
  });

  it("기록이 결제보다 적으면(결제 뒤 지움·환불) '기록은 …인데 계좌에서는 …' 이다", () => {
    render();
    pick("50,000");

    expect(byTestId("recorded-diff-note")?.textContent).toBe(
      "assetDetail.recordedLessNote",
    );
  });

  it("기록과 결제가 같으면 한 줄이 없다", () => {
    render();
    pick("33,000");

    expect(byTestId("recorded-diff-note")).toBeNull();
    expect(bodyText()).toContain("assetDetail.paidDone");
  });

  it("앱이 한 푼도 안 뺀 회차는 '결제 완료' 가 아니라 '기록 회차' 다(24차 7)", () => {
    render();
    pick("40,000");

    expect(byTestId("record-cycle-label")?.textContent).toBe(
      "assetDetail.recordCycle",
    );
    // "계좌에서 나간 돈은 0원이에요…" 는 라벨과 같은 말이라 붙이지 않는다(QA 26차).
    expect(byTestId("recorded-diff-note")).toBeNull();
    expect(bodyText()).not.toContain("assetDetail.paidDone");
    // 카드 등록 전 회차 주의(R4)는 그대로다.
    expect(byTestId("pre-registration-note")?.textContent).toBe(
      "assetDetail.preRegistrationNote",
    );
  });

  it("옛 서버(recordedAmount 없음)는 결제 + 기록만 으로 머리를 잡는다", () => {
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      closedCycles: [{ ...augCycle, recordedAmount: undefined }],
    };
    render();
    pick("125,000");

    expect(byTestId("recorded-diff-note")?.textContent).toBe(
      "assetDetail.recordedMoreNote",
    );
  });
});

describe("닫힌 회차 화면", () => {
  it("[지금 결제] 단추가 없다 — 예정 회차엔 있다(24차 7)", () => {
    render();
    expect(buttonWith("assetDetail.payNow")).toBeDefined();

    pick("125,000");
    expect(buttonWith("assetDetail.payNow")).toBeUndefined();
  });

  it("할부 회차분을 한 줄씩 보여 주고 기록용이면 '기록만' 을 단다(24차 8)", () => {
    render();
    pick("125,000");

    const rows = byTestId("closed-installments");
    expect(rows).not.toBeNull();
    expect(rows!.textContent).toContain("QC90000");
    expect(rows!.textContent).toContain("assetDetail.installmentSeq");
    // 원금 — 다가오는 회차 줄·앱과 같은 모양(사용자 결정 2026-09-22).
    expect(rows!.textContent).toContain("assetDetail.installmentPrincipal");
    expect(rows!.textContent).toContain("recordOnly");
    expect(rows!.textContent).toContain("30,000");
  });

  it("다가오는 회차에는 닫힌 회차 줄이 없다", () => {
    render();

    expect(byTestId("recorded-diff-note")).toBeNull();
    expect(byTestId("record-cycle-label")).toBeNull();
    expect(byTestId("closed-installments")).toBeNull();
  });
});

describe("결제 취소(D6)", () => {
  const cancelTile = () => buttonWith("assetDetail.cancelPayment");

  it("열린 회차의 결제는 되돌릴 수 있다", () => {
    // 9월분(10/12 결제 예정)을 미리 낸 결제.
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      history: [
        billingItem({
          periodStart: "2026-09-01",
          periodEnd: "2026-09-30",
          paymentDate: "2026-09-15",
        }),
      ],
    };
    render({ ...card, cardClosedThrough: "2026-08-31" } as Asset);

    expect(cancelTile()).toBeDefined();
  });

  it("결제일이 지난 회차의 결제는 없다", () => {
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      history: [billingItem({})],
    };
    render({ ...card, cardClosedThrough: "2026-08-31" } as Asset);

    expect(cancelTile()).toBeUndefined();
  });

  it("환급이 나간 회차의 결제는 없다", () => {
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      closedCycles: [],
      history: [
        billingItem({
          periodStart: "2026-09-01",
          periodEnd: "2026-09-30",
          paymentDate: "2026-09-15",
        }),
        billingItem({
          rowId: 2,
          periodStart: "2026-09-01",
          periodEnd: "2026-09-30",
          paymentDate: "2026-09-16",
          status: "REFUNDED",
          billingAmount: 30_000,
        }),
      ],
    };
    render({ ...card, cardClosedThrough: "2026-08-31" } as Asset);

    expect(cancelTile()).toBeUndefined();
  });

  it("최근 결제가 닫힌 회차여도 열린 회차의 선결제는 되돌릴 수 있다", () => {
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      history: [
        billingItem({
          rowId: 3,
          periodStart: "2026-09-01",
          periodEnd: "2026-09-30",
          paymentDate: "2026-09-05",
        }),
        // 8월분 자동 결제 — 더 최근이지만 결제일이 지난 회차다.
        billingItem({ rowId: 4, paymentDate: "2026-09-12" }),
      ],
    };
    render({ ...card, cardClosedThrough: "2026-08-31" } as Asset);

    expect(cancelTile()).toBeDefined();
  });
});

describe("결제일 없는 신용카드(D8 · QA 26차 6)", () => {
  // 서버는 이제 결제일을 필수로 받는다. 이미 결제일 없이 만든 옛 카드는 늘 열린 회차로
  // 보이니, 결제일 행 자리에서 넣으라고 말하고 그 카드의 수정 폼으로 보낸다.
  const noDay = { ...card, paymentDay: null } as Asset;
  const missing = () => byTestId("payment-day-missing");

  beforeEach(() => {
    nav.to = [];
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      paymentDay: null,
      nextPaymentDate: null,
      upcomingPeriodStart: null,
      upcomingPeriodEnd: null,
      closedCycles: [],
    };
  });

  it("결제일 행 자리에 '결제일을 넣어 주세요' 가 뜨고, 누르면 수정 폼을 연다(페이지 위 — 주소를 옮기지 않는다)", () => {
    const edited: number[] = [];
    render(noDay, (a) => edited.push(a.rowId));

    expect(missing()?.textContent).toContain("assetDetail.paymentDayMissing");
    click(buttonWith("assetDetail.paymentDayMissing")!);
    expect(edited).toEqual([9]);
    expect(nav.to).toEqual([]);
  });

  it("결제일이 있는 카드엔 없다", () => {
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      paymentDay: 12,
    };
    render();

    expect(missing()).toBeNull();
  });
});

describe("회차 없음 · 한도 · 동작 줄(I-17 46 · 47)", () => {
  it("회차가 하나도 없으면 회차 단추 없이 '이번 달 결제 예정 · 0원' 이고 '—' 는 어디에도 없다", () => {
    billing.data = {
      ...(billing.data as Record<string, unknown>),
      upcomingAmount: 0,
      nextPaymentDate: null,
      upcomingPeriodStart: null,
      upcomingPeriodEnd: null,
      nextCycle: null,
      closedCycles: [],
      history: [],
    };
    render();
    expect(bodyText()).toContain("assetDetail.valueCard");
    expect(bodyText()).toContain("0원");
    expect(bodyText()).not.toContain("—");
    expect(buttonWith("assetDetail.dueOn")).toBeUndefined();
  });

  it("한도 사용 — 80% 를 넘어도 경고 색이 없고, 넘치면 '초과' 글이 fg-critical 이다", () => {
    render({ ...card, balance: -4_500_000 } as Asset);
    const warn = [...document.body.querySelectorAll("*")].filter((e) =>
      /chart-red|--color-chart-red/.test(e.getAttribute("style") ?? ""),
    );
    expect(warn).toHaveLength(0);
    expect(bodyText()).toContain("assetDetail.limitPctUsed");

    render({ ...card, balance: -6_000_000 } as Asset);
    expect(document.body.querySelector("[role='meter']")).not.toBeNull();
    expect(document.body.querySelector(".text-fg-critical")).not.toBeNull();
  });

  it("동작은 ds 버튼 둘이다 — 타일 · 알약 · '한도 · 결제 설정' 이 없다", () => {
    render();
    expect(buttonWith("assetDetail.payNow")).toBeDefined();
    expect(buttonWith("assetDetail.limitSettings")).toBeUndefined();
    expect(buttonWith("assetDetail.limitEdit")).toBeUndefined();
  });
});
