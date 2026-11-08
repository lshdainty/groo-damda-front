// 거래 상세 (I-21 21-1 B · A · I · J) — 읽는 상세 + "더 하기" 동작 줄, 같은 표면 안 환불 단계, [수정] 뒤 상세로 돌아옴, 삭제 · 환불 취소 확인.
// 옛 `TxDetailDialog.quickActions.test.tsx`(원형 동작 한 줄) · `.refund.test.tsx`(확인창 안 날짜 칸)를 이 파일이 대신한다 — 같은 규칙을 새 줄 · 새 단계로 다시 잠근다.
//
// 실제 상세를 띄운다(ds 시트까지). 공용 부품만 검사해 통과시키지 않는다. `t` 는 키를 그대로 돌려주므로 줄 · 버튼은 키로 집는다.
// 날짜를 재는 시험은 데이터가 거래일(과거 고정)과 오늘(`todayLocalKey`)뿐이라 시계를 고정하지 않아도 어제 · 내일에 안 깨진다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense, ExpenseCategory } from "@/entities/expense";
import { todayLocalKey } from "@/shared/lib/date";
import {
  click,
  hasButton,
  lastButton,
  moreRow,
  moreRowText,
  pressEsc,
  setupDetailDom,
} from "./test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type Mut = (
  vars: unknown,
  opts?: Record<string, (...a: never[]) => void>,
) => void;

const api = vi.hoisted(() => ({
  refundCalls: [] as { id: number; refundedAt?: string; silent?: boolean }[],
  cancelCalls: [] as { id: number; silent?: boolean }[],
  deleteCalls: [] as { id: number; silent?: boolean }[],
  /** 서버가 돌려주는 거래 — null 이면 응답이 안 온 것으로 본다. */
  refundReply: null as Expense | null,
  cancelReply: null as Expense | null,
  refundFail: false,
  cancelFail: false,
  deleteFail: false,
  deleteReply: { refundedAmount: null } as { refundedAmount: number | null },
  assets: [] as unknown[],
  categories: [] as ExpenseCategory[],
  splits: [] as unknown[],
  splitsError: false,
  recurrings: [] as unknown[],
  dutchPays: [] as unknown[],
  /** 같은 가맹점 이번 달 조회 결과(이 거래 포함) */
  history: [] as Expense[],
  notified: [] as { result: unknown; context: unknown }[],
  navigated: [] as string[],
  snacks: [] as {
    message: string;
    tone?: string;
    action?: { label: string; onClick: () => void };
  }[],
  confirms: [] as { title: string; danger?: boolean; singleAction?: boolean }[],
  /** 끼운 수정 폼이 값 하나를 치는 단계에 있다 */
  embedInSub: false,
  submitting: false,
  dirtyAll: false,
  begun: null as unknown,
  parts: null as
    | null
    | (Record<string, unknown> & {
        onBack: () => void;
        inSub: boolean;
        onDone: () => void;
      }),
  addTx: null as null | {
    expense?: Expense;
    onSaved?: (e: Expense) => void;
    onBack?: () => void;
    embed?: (parts: Record<string, unknown>) => React.ReactNode;
    onReplaced?: () => void;
    onClose: () => void;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  // 금액을 가리는 문장(`<amt>`)은 Trans 로 그린다 — 키만 남겨 무엇을 골랐는지 본다.
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => (to: string) => api.navigated.push(to),
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: (typeof api.snacks)[number]) => api.snacks.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("@/shared/ui/groo/dialogs", () => ({
  // 확인창 — 공용 어댑터(ds Alert Dialog)의 계약만 흉내 낸다: 마운트 = 열림, 확정은 호출처가 닫는다
  ConfirmDialog: (p: {
    title: string;
    message: unknown;
    confirmLabel?: string;
    danger?: boolean;
    singleAction?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }) => {
    api.confirms.push({
      title: p.title,
      danger: p.danger,
      singleAction: p.singleAction,
    });
    return (
      <div role="alertdialog" data-testid="confirm">
        <h2>{p.title}</h2>
        <div data-testid="confirm-message">{p.message as never}</div>
        <button data-testid="confirm-cancel" onClick={p.onCancel}>
          cancel
        </button>
        <button data-testid="confirm-ok" onClick={p.onConfirm}>
          {p.confirmLabel}
        </button>
      </div>
    );
  },
}));
vi.mock("@/widgets/add-tx", () => ({
  // 수정 폼은 상세가 한 번 들고(useTxForm) 같은 시트 안 한 단계로 끼운다(7a) — 호스트가 넘기는 인자와 조각만 본다
  useTxForm: (p: NonNullable<typeof api.addTx>) => {
    api.addTx = p;
    return {
      main: "2",
      sub: null,
      submitting: api.submitting,
      beginEdit: (seed: unknown) => {
        api.begun = seed;
      },
    };
  },
  useTxSheetParts: (
    _f: unknown,
    o: { onBack?: () => void; onClose: () => void },
  ) => {
    api.parts = {
      title: "addTx.editTitle",
      body: <div data-testid="add-tx-sheet" />,
      footer: () => null,
      dirty: false,
      dirtyAll: api.dirtyAll,
      onBack: () => o.onBack?.(),
      inSub: api.embedInSub,
      onDone: () => {},
      overlays: null,
      bodyRef: { current: null },
    };
    return { embedParts: api.parts, overlays: null };
  },
  // 나누기 단계는 add-tx 묶음에서 가져온다(2525f941) — 아래 use-split-step 목과 같은 조각
  useSplitStep: () => stepStub("split"),
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: () => ({ data: api.categories, isLoading: false }),
  useSearchExpenses: () => ({ data: api.history, isLoading: false }),
  useDeleteExpense: () => ({
    mutate: ((vars, opts) => {
      api.deleteCalls.push(vars as { id: number; silent?: boolean });
      if (api.deleteFail) opts?.onError?.();
      else opts?.onSuccess?.(api.deleteReply as never);
    }) as Mut,
    isPending: false,
  }),
  useLedgerResultToast:
    () =>
    (result: unknown, context: unknown = {}) =>
      api.notified.push({ result, context }),
  useRefundExpense: () => ({
    mutate: ((vars, opts) => {
      api.refundCalls.push(vars as (typeof api.refundCalls)[number]);
      if (api.refundFail) opts?.onError?.();
      else if (api.refundReply) opts?.onSuccess?.(api.refundReply as never);
    }) as Mut,
    reset: () => {},
    isPending: false,
  }),
  useCancelRefund: () => ({
    mutate: ((vars, opts) => {
      api.cancelCalls.push(vars as (typeof api.cancelCalls)[number]);
      if (api.cancelFail) opts?.onError?.();
      else if (api.cancelReply) opts?.onSuccess?.(api.cancelReply as never);
    }) as Mut,
    isPending: false,
  }),
}));
vi.mock("@/features/expense-split", () => ({
  useExpenseSplits: () => ({
    // react-query 처럼 — 처음 불러오기 실패면 값이 없다
    data: api.splitsError ? undefined : api.splits,
    isLoading: false,
    isError: api.splitsError,
    isFetching: false,
    refetch: () => {},
  }),
}));
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => ({ data: api.recurrings, isLoading: false }),
}));
vi.mock("@/features/dutch-pay", () => ({
  useDutchPays: () => ({ data: api.dutchPays, isLoading: false }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: api.assets }, isLoading: false }),
}));
// 나누기 · 반복 설정 · 더치페이 단계의 안쪽은 각자 시험이 있다(더치페이 = use-dutch-step.render.test.tsx · use-dutch-step.fields.test.ts) — 여기서는 상세 표면이 단계로 바뀌는 것만 본다
const stepStub = (name: string) => ({
  title: name,
  body: <div data-testid={`step-${name}`} />,
  footer: () => null,
  dirty: false,
  dirtyAll: false,
  onBack: () => {},
  inSub: false,
  onDone: () => {},
  overlays: null,
  bodyRef: { current: null },
});
vi.mock("@/widgets/add-tx/ui/use-split-step", () => ({
  useSplitStep: () => stepStub("split"),
}));
vi.mock("./use-dutch-step", () => ({
  useDutchStep: () => stepStub("dutch"),
}));
vi.mock("@/features/recurring-transaction/ui/use-recurring-form", () => ({
  useRecurringForm: () => ({
    body: <div data-testid="step-recurring" />,
    heading: "recurring",
    stepTitle: {},
    step: "list",
    inStep: false,
    stepDirty: false,
    dirty: false,
    bodyFog: false,
    isEdit: false,
    submitting: false,
    save: () => {},
    confirmStep: () => {},
    exitStep: () => {},
    focusAmount: () => {},
    lockType: false,
  }),
}));

const { TxDetailDialog } = await import("./TxDetailDialog");
const { i18n: appI18n } = await import("@/shared/i18n/config");

const baseExpense: Expense = {
  rowId: 77,
  categoryRowId: 21,
  assetRowId: 9,
  assetName: "현대카드",
  expenseType: "EXPENSE",
  amount: 3000,
  description: null,
  merchant: "김밥천국",
  expenseDate: "2026-09-05T12:30:00",
  paymentMethod: null,
  installmentMonths: null,
  refundedAt: null,
  refundTransferRowId: null,
  originalAmount: null,
  originalCurrency: null,
  exchangeRate: null,
  calendarEventRowId: null,
  todoRowId: null,
  autoSource: null,
  createAt: "2026-09-05T12:30:00",
  modifyAt: "2026-09-05T12:30:00",
};
const refunded: Expense = {
  ...baseExpense,
  refundedAt: "2026-09-18T12:00:00",
  refundTransferRowId: null,
};
const category = (over: Partial<ExpenseCategory>): ExpenseCategory => ({
  rowId: 21,
  categoryName: "간식",
  icon: null,
  color: null,
  expenseType: "EXPENSE",
  sortOrder: 0,
  parentRowId: null,
  hasChildren: false,
  createAt: "",
  modifyAt: "",
  ...over,
});
/** 같은 가맹점의 다른 거래 */
const other = (id: number): Expense => ({
  ...baseExpense,
  rowId: id,
  expenseDate: `2026-09-${String(10 + (id % 15)).padStart(2, "0")}T12:00:00`,
});
const card = (over: Record<string, unknown> = {}) => ({
  rowId: 9,
  assetName: "현대카드",
  assetType: "CREDIT_CARD",
  institution: "현대",
  paymentAssetRowId: 3,
  cardClosedThrough: null,
  ...over,
});

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

beforeEach(async () => {
  await appI18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupDetailDom(false);
  api.refundCalls = [];
  api.cancelCalls = [];
  api.deleteCalls = [];
  api.refundReply = null;
  api.cancelReply = null;
  api.refundFail = false;
  api.cancelFail = false;
  api.deleteFail = false;
  api.deleteReply = { refundedAmount: null };
  api.assets = [];
  api.categories = [];
  api.splits = [];
  api.splitsError = false;
  api.recurrings = [];
  api.dutchPays = [];
  api.history = [];
  api.notified = [];
  api.navigated = [];
  api.snacks = [];
  api.confirms = [];
  api.addTx = null;
  api.embedInSub = false;
  api.submitting = false;
  api.dirtyAll = false;
  api.begun = null;
  api.parts = null;
  onClose.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  // 시트가 닫히며 되감는 히스토리 popstate 가 이 시험 안에서 다 도착하게 한다 — 다음 시험의 뒤로 가기 셈에 번지지 않게
  await new Promise((r) => setTimeout(r, 200));
});

function render(expense: Expense = baseExpense) {
  act(() =>
    root.render(
      <TxDetailDialog expense={expense} mobile={false} onClose={onClose} />,
    ),
  );
}

const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]")!;
const title = () =>
  sheet().querySelector("[data-slot=bottom-sheet-title]")!.textContent;
const dialogs = () => document.querySelectorAll("[role=dialog]");
const kv = () =>
  document.body.querySelector("[data-slot=tx-detail-kv]")?.textContent ?? "";
const footerButtons = () => [
  ...sheet().querySelectorAll("[data-slot=bottom-sheet-footer] button"),
];
const confirmText = () =>
  document.querySelector("[data-testid=confirm-message]")?.textContent ?? "";
const confirmOk = () =>
  document.querySelector<HTMLButtonElement>("[data-testid=confirm-ok]")!;
const history = () =>
  document.body.querySelector("[data-slot=tx-detail-history]");

describe("B 8 · 9 — 머리와 값 줄", () => {
  it("머리에 이름 · 금액 · 날짜가 있고 값 줄에는 금액 · 날짜 · 시간 줄이 없다", () => {
    render();
    expect(title()).toBe("txDetail.expenseTitle");
    const head = document.querySelector("[data-slot=tx-detail-head]")!;
    expect(head.textContent).toContain("김밥천국");
    expect(head.textContent).toContain("−3,000원");
    expect(
      document.querySelector("[data-slot=tx-detail-datetime]")!.textContent,
    ).toContain("9월 5일");
    expect(kv()).not.toContain("form.amount");
    expect(kv()).not.toContain("dateTime");
  });

  it("메모가 없으면 줄이 없다 — 있으면 값으로 그린다", () => {
    render();
    expect(kv()).not.toContain("memo");
    render({ ...baseExpense, description: "점심" });
    expect(kv()).toContain("memo");
    expect(kv()).toContain("점심");
  });

  it('카테고리는 "{상위} · {하위}" 로 — 상위가 있으면 앞에 붙는다', () => {
    api.categories = [
      category({ rowId: 20, categoryName: "식비" }),
      category({ rowId: 21, categoryName: "간식", parentRowId: 20 }),
    ];
    render();
    expect(kv()).toContain("식비 · 간식");
  });

  it("지운 카테고리 · 자산은 거래가 든 이름으로 그린다", () => {
    render({ ...baseExpense, categoryName: "옛 카테고리" });
    expect(kv()).toContain("옛 카테고리");
    expect(kv()).toContain("현대카드");
  });

  it("해외 결제 줄 — 현지 금액 × 환율", () => {
    render({
      ...baseExpense,
      originalAmount: 12.5,
      originalCurrency: "USD",
      exchangeRate: 1380,
    });
    expect(kv()).toContain("txDetail.foreignPayment");
    expect(kv()).toContain("× 1,380");
  });

  it("값 줄 값은 줄 끝 오른쪽 맞춤 — text-end", () => {
    render({ ...baseExpense, description: "점심" });
    const value = document.querySelector(
      "[data-slot=tx-detail-kv] [data-slot=list-suffix] span",
    )!;
    expect(value.className).toContain("text-end");
  });
});

describe('B 10 — "더 하기" 동작 줄은 개수와 무관하게 한 목록이다', () => {
  const keys = () =>
    [...document.querySelectorAll("[data-slot=tx-detail-more] button")].map(
      (b) => b.getAttribute("data-testid"),
    );

  it("지출 넷(환불 · 내역 분할 · 반복 설정 · 더치페이)", () => {
    render();
    expect(keys()).toEqual([
      "more-refund",
      "more-split",
      "more-recurring",
      "more-dutch",
    ]);
  });

  it("수입 셋 — 환불이 없다", () => {
    render({ ...baseExpense, expenseType: "INCOME" });
    expect(keys()).toEqual(["more-split", "more-recurring", "more-dutch"]);
    expect(title()).toBe("txDetail.incomeTitle");
  });

  it("이미 환불한 지출은 둘 — 환불 · 분할이 빠진다", () => {
    render(refunded);
    expect(keys()).toEqual(["more-recurring", "more-dutch"]);
  });

  it("자동 거래의 반복 설정 · 더치페이는 줄은 그리되 막혀 있다 — 환불 · 분할은 없다", () => {
    render({ ...baseExpense, autoSource: "CARD_CARRYOVER" });
    expect(keys()).toEqual(["more-recurring", "more-dutch"]);
    expect(moreRow("recurring")!.disabled).toBe(true);
    expect(moreRow("dutch")!.disabled).toBe(true);
    // 막힌 줄에는 꺾쇠가 없다
    expect(
      moreRow("recurring")!
        .closest("li")!
        .querySelector("svg.lucide-chevron-right"),
    ).toBeNull();
  });

  it("보통 거래는 켜져 있다 — 꺾쇠가 있다", () => {
    render();
    expect(moreRow("recurring")!.disabled).toBe(false);
    expect(moreRow("dutch")!.disabled).toBe(false);
    expect(
      moreRow("recurring")!
        .closest("li")!
        .querySelector("svg.lucide-chevron-right"),
    ).not.toBeNull();
  });

  it("거래일이 내일이면 환불이 없다 — 다른 줄은 그대로", () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T12:00:00`;
    render({ ...baseExpense, expenseDate: tomorrow });
    expect(moreRow("refund")).toBeNull();
    expect(moreRow("split")).not.toBeNull();
  });

  it("오늘 거래면 환불이 있다 — 시각이 아직 안 왔어도", () => {
    render({ ...baseExpense, expenseDate: `${todayLocalKey()}T23:59:00` });
    expect(moreRow("refund")).not.toBeNull();
  });

  it("연결 수를 줄에 보인다 — 나눔 · 연결됨 · 건수 (앱과 같은 셈)", () => {
    api.splits = [
      {
        rowId: 1,
        categoryRowId: 21,
        categoryName: "간식",
        amount: 1000,
        label: null,
      },
      {
        rowId: 2,
        categoryRowId: 21,
        categoryName: "간식",
        amount: 2000,
        label: null,
      },
    ];
    api.recurrings = [{ rowId: 5, sourceExpenseRowId: 77 }];
    api.dutchPays = [
      { rowId: 6, sourceExpenseRowId: 77 },
      { rowId: 7, sourceExpenseRowId: 77 },
      { rowId: 8, sourceExpenseRowId: 99 },
    ];
    render();
    expect(moreRowText("split")).toContain("txDetail.splitValue");
    expect(moreRowText("recurring")).toContain("txDetail.linked");
    expect(moreRowText("dutch")).toContain("txDetail.countCases");
  });

  it("연결이 없으면 값 글이 없다", () => {
    render();
    expect(moreRowText("recurring")).not.toContain("txDetail.linked");
    expect(moreRowText("dutch")).not.toContain("txDetail.countCases");
    expect(moreRowText("split")).not.toContain("txDetail.splitValue");
  });
});

describe("B 11 — 나눈 내역 묶음은 접지 않고 처음부터 다 보인다", () => {
  const split = (id: number, amount: number) => ({
    rowId: id,
    expenseRowId: 77,
    categoryRowId: 21,
    categoryName: "간식",
    amount,
    label: null,
    sortOrder: id,
    createAt: "",
    modifyAt: "",
  });

  it("묶음 머리 · 막대 · 줄이 있고 접기 단추가 없다", () => {
    api.splits = [split(1, 1000), split(2, 2000)];
    render();
    const sec = document.querySelector("[data-slot=tx-detail-splits]")!;
    expect(sec.querySelectorAll("li")).toHaveLength(2);
    expect(sec.querySelectorAll("button")).toHaveLength(0);
    expect(
      document.querySelector("[data-slot=tx-detail-split-bar]"),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("txDetail.splitHeader");
    expect(document.body.textContent).toContain("txDetail.splitSum");
  });

  it("나눔 줄 비율은 금액에서 계산한 몫이라 점유율 규칙(소수 첫째 자리)이다", () => {
    api.splits = [split(1, 1000), split(2, 2000)];
    render();
    const sec = document.querySelector("[data-slot=tx-detail-splits]")!;
    expect(sec.textContent).toContain("33.3%");
    expect(sec.textContent).toContain("66.7%");
  });

  it("나눈 것이 없으면 묶음이 없다", () => {
    render();
    expect(document.querySelector("[data-slot=tx-detail-splits]")).toBeNull();
  });

  it("나눈 내역을 못 불러오면 묶음 자리 실패 안내 + 다시 시도 — 서버 글은 없다", () => {
    api.splitsError = true;
    render();
    expect(document.body.textContent).toContain("txDetail.splitLoadFailed");
    expect(hasButton("retry")).toBe(true);
  });
});

describe("B 12 — 이 가맹점 이번 달", () => {
  it("다른 거래 3건 — 줄 셋 · 머리는 이 달 전체(이 거래 포함) · 보조 글 없음", () => {
    api.history = [baseExpense, other(1), other(2), other(3)];
    render();
    expect(history()!.querySelectorAll("li")).toHaveLength(3);
    expect(document.body.textContent).toContain("txDetail.merchantTitle");
    expect(document.body.textContent).toContain("txDetail.countCases");
    expect(
      document.querySelector("[data-slot=tx-detail-recent-only]"),
    ).toBeNull();
  });

  it("다른 거래 6건 이상 — 줄은 다섯 + 끝에 보조 글(누르지 않는다)", () => {
    api.history = [baseExpense, ...[1, 2, 3, 4, 5, 6, 7, 8].map(other)];
    render();
    expect(history()!.querySelectorAll("li")).toHaveLength(5);
    const note = document.querySelector("[data-slot=tx-detail-recent-only]")!;
    expect(note.textContent).toBe("txDetail.recentOnly");
    expect(note.querySelector("button")).toBeNull();
  });

  it("다른 거래가 정확히 5건이면 보조 글이 없다", () => {
    api.history = [baseExpense, ...[1, 2, 3, 4, 5].map(other)];
    render();
    expect(history()!.querySelectorAll("li")).toHaveLength(5);
    expect(
      document.querySelector("[data-slot=tx-detail-recent-only]"),
    ).toBeNull();
  });

  it("줄을 누르지 않는다 — 버튼이 없다", () => {
    api.history = [baseExpense, other(1), other(2)];
    render();
    expect(history()!.querySelectorAll("button")).toHaveLength(0);
  });

  it("다른 거래가 없으면 묶음이 없다", () => {
    api.history = [baseExpense];
    render();
    expect(history()).toBeNull();
  });
});

describe("B 12 — 합계에서 환불된 거래를 뺀다", () => {
  it("머리 합계는 환불된 거래를 더하지 않는다 — 환불 안내(합계에서 빠져요)와 같다", () => {
    api.history = [
      baseExpense,
      other(1),
      { ...other(2), refundedAt: "2026-09-12T12:00:00" },
    ];
    render();
    // 3,000 + 3,000 = 6,000 — 환불된 3,000 을 더한 9,000 이 아니다
    const bar = document.body.textContent ?? "";
    expect(bar).toContain("6,000");
    expect(bar).not.toContain("9,000");
  });
});

describe("B 9 — 상태 Callout", () => {
  it("환불됨 — 문장 · [환불 취소]만 있고 수정 · 분할 · 환불은 없다", () => {
    render(refunded);
    expect(document.body.textContent).toContain("txDetail.refundedAt");
    expect(hasButton("txDetail.refundCancel")).toBe(true);
    expect(moreRow("refund")).toBeNull();
    expect(moreRow("split")).toBeNull();
    expect(footerButtons().map((b) => b.textContent)).toEqual(["delete"]);
  });

  it("자동 거래 — 바닥이 없고 왜 못 고치는지 말한다", () => {
    render({ ...baseExpense, autoSource: "CARD_CARRYOVER" });
    expect(footerButtons()).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "addTx.autoSource.CARD_CARRYOVER",
    );
  });

  it("자동 거래 + deletable:true — [삭제]만 있고 수정 · 환불 · 분할은 없다", () => {
    render({ ...baseExpense, autoSource: "TRADE_REALIZED", deletable: true });
    expect(footerButtons().map((b) => b.textContent)).toEqual(["delete"]);
    expect(moreRow("refund")).toBeNull();
    expect(moreRow("split")).toBeNull();
  });

  it("자동 거래 + deletable:false — 바닥이 없다", () => {
    render({ ...baseExpense, autoSource: "TRADE_REALIZED", deletable: false });
    expect(footerButtons()).toHaveLength(0);
  });

  it("기록만 — 닫힌 회차에 적은 카드 지출", () => {
    render({ ...baseExpense, cardSettledThrough: "2026-08-31" });
    expect(
      document.querySelector("[data-testid=record-only-note]")!.textContent,
    ).toContain("txDetail.recordOnlyNote");
  });

  it("할부 — 지난 회차분만 기록용이면 '이 중' 문장", () => {
    render({
      ...baseExpense,
      cardSettledThrough: "2026-08-31",
      recordOnlyAmount: 1000,
    });
    expect(
      document.querySelector("[data-testid=record-only-note]")!.textContent,
    ).toContain("txDetail.recordOnlyPartNote");
  });

  it("정상 거래 · 환불된 거래에는 기록만 안내가 없다", () => {
    render();
    expect(document.querySelector("[data-testid=record-only-note]")).toBeNull();
    render({ ...refunded, cardSettledThrough: "2026-08-31" });
    expect(document.querySelector("[data-testid=record-only-note]")).toBeNull();
  });

  it("결제가 끝난 회차의 환불이면 [잔액 고치기] 가 결제계좌 수정 폼으로 간다(D9)", () => {
    api.assets = [card({ cardClosedThrough: "2026-09-30" })];
    render(refunded);
    click(lastButton("closedCycle.fixBalance"));
    expect(api.navigated).toHaveLength(1);
    expect(api.navigated[0]).toContain("3");
  });

  it("열린 회차의 환불 · 결제계좌 없는 카드에는 [잔액 고치기] 가 없다", () => {
    api.assets = [card({ cardClosedThrough: null })];
    render(refunded);
    expect(hasButton("closedCycle.fixBalance")).toBe(false);
    api.assets = [
      card({ cardClosedThrough: "2026-09-30", paymentAssetRowId: null }),
    ];
    render(refunded);
    expect(hasButton("closedCycle.fixBalance")).toBe(false);
  });
});

describe("B 7 · J 49 — 삭제는 확인창을 거치고 실패는 호출처가 알린다", () => {
  it("바닥은 왼쪽 [삭제] · 오른쪽 [수정] — 삭제는 ghost + critical", () => {
    render();
    const [del, edit] = footerButtons();
    expect(del!.textContent).toBe("delete");
    expect(edit!.textContent).toBe("edit");
    // 큰 빨간 채움이 아니다
    expect(del!.className).toContain("text-fg-critical");
  });

  it("확인창에서 취소하면 아무것도 안 나간다", () => {
    render();
    click(lastButton("delete"));
    expect(document.querySelector("[data-testid=confirm]")).not.toBeNull();
    click(document.querySelector("[data-testid=confirm-cancel]")!);
    expect(document.querySelector("[data-testid=confirm]")).toBeNull();
    expect(api.deleteCalls).toHaveLength(0);
  });

  it("확인창은 지우는 확정이라 critical — 요청은 silent 로 나가고 성공하면 닫힌다", () => {
    render();
    click(lastButton("delete"));
    expect(api.confirms.slice(-1)[0]).toMatchObject({
      title: "deleteConfirm.title",
      danger: true,
    });
    click(confirmOk());
    expect(api.deleteCalls).toEqual([{ id: 77, silent: true }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("삭제 실패는 확인창을 닫고 고정 글 스낵바 + 다시 시도 — 서버 글은 없다", () => {
    api.deleteFail = true;
    render();
    click(lastButton("delete"));
    click(confirmOk());
    expect(document.querySelector("[data-testid=confirm]")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(api.snacks).toHaveLength(1);
    expect(api.snacks[0]).toMatchObject({
      message: "txDetail.deleteFailed",
      tone: "critical",
    });
    expect(api.snacks[0]!.action!.label).toBe("retry");
    // 다시 시도 — 같은 요청을 바로
    api.deleteFail = false;
    act(() => api.snacks[0]!.action!.onClick());
    expect(api.deleteCalls).toHaveLength(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("결제가 끝난 회차의 카드 거래면 확인창이 한 줄 더 말한다", () => {
    api.assets = [card({ cardClosedThrough: "2026-09-30" })];
    render();
    click(lastButton("delete"));
    expect(confirmText()).toContain("closedCycle.note");
  });

  it("열린 회차의 삭제 확인창엔 그 줄이 없다", () => {
    api.assets = [card({ cardClosedThrough: null })];
    render();
    click(lastButton("delete"));
    expect(
      document.querySelector("[data-testid=closed-cycle-note]"),
    ).toBeNull();
  });

  it("삭제 — 응답과 함께 닫힌 회차 여부 · 결제계좌를 알림 훅에 넘긴다(D4 · D9)", () => {
    api.assets = [card({ cardClosedThrough: "2026-09-30" })];
    api.deleteReply = { refundedAmount: null };
    render();
    click(lastButton("delete"));
    click(confirmOk());
    expect(api.notified).toHaveLength(1);
    expect(api.notified[0]!.context).toEqual({
      closed: true,
      paymentAssetRowId: 3,
    });
  });
});

describe("I 46 — 환불은 같은 표면 안 한 단계다", () => {
  const openRefund = () => click(moreRow("refund")!);

  it("환불 줄을 누르면 같은 시트가 환불 폼으로 바뀐다 — 새 시트 · 확인창 0", () => {
    render();
    expect(dialogs()).toHaveLength(1);
    openRefund();
    expect(dialogs()).toHaveLength(1);
    expect(document.querySelector("[data-testid=refund-step]")).not.toBeNull();
    expect(title()).toBe("txDetail.refundConfirmTitle");
    expect(
      sheet().querySelector("[data-slot=bottom-sheet-back]"),
    ).not.toBeNull();
    expect(document.querySelector("[data-testid=confirm]")).toBeNull();
    // 확인창 안 날짜 칸이 없다 — 날짜는 줄이다
    expect(document.querySelector("input[type=date]")).toBeNull();
    expect(
      document.querySelector("[data-testid=refund-date-row]"),
    ).not.toBeNull();
  });

  it("처음 값은 오늘 — 줄 값이 오늘이고 안내가 거래한 날부터 오늘까지다", () => {
    render();
    openRefund();
    expect(
      document.querySelector("[data-testid=refund-date-row]")!.closest("li")!
        .textContent,
    ).toContain("txDetail.refundDateToday");
    expect(document.querySelector("[data-slot=refund-hint]")!.textContent).toBe(
      "txDetail.refundDateHint",
    );
  });

  it("[환불 처리] — 오늘 정오로 silent 요청하고 응답으로 상세로 돌아와 환불됨이 보인다", () => {
    api.refundReply = refunded;
    render();
    openRefund();
    click(lastButton("txDetail.refundConfirm"));
    expect(api.refundCalls).toEqual([
      { id: 77, refundedAt: `${todayLocalKey()}T12:00:00`, silent: true },
    ]);
    expect(document.querySelector("[data-testid=refund-step]")).toBeNull();
    expect(title()).toBe("txDetail.expenseTitle");
    expect(document.body.textContent).toContain("txDetail.refundedAt");
    // 환불한 뒤엔 환불 · 분할 줄과 [수정] 이 사라진다
    expect(moreRow("refund")).toBeNull();
    expect(footerButtons().map((b) => b.textContent)).toEqual(["delete"]);
    expect(api.notified).toHaveLength(1);
    expect(dialogs()).toHaveLength(1);
  });

  it("응답이 안 오면 마크된 척하지 않는다 — 환불 단계에 남는다", () => {
    api.refundReply = null;
    render();
    openRefund();
    click(lastButton("txDetail.refundConfirm"));
    expect(document.querySelector("[data-testid=refund-step]")).not.toBeNull();
    expect(document.body.textContent).not.toContain("txDetail.refundedAt");
  });

  it("실패하면 단계에 남고 고정 글 Callout 이 뜬다 — 서버 글은 없다", () => {
    api.refundFail = true;
    render();
    openRefund();
    click(lastButton("txDetail.refundConfirm"));
    expect(document.querySelector("[data-testid=refund-step]")).not.toBeNull();
    expect(document.body.textContent).toContain("txDetail.refundFailed");
    expect(api.refundCalls[0]!.silent).toBe(true);
  });

  it("← 는 상세로 — 바뀐 값이 없으면 묻지 않는다", () => {
    render();
    openRefund();
    click(sheet().querySelector("[data-slot=bottom-sheet-back]")!);
    expect(document.querySelector("[data-testid=refund-step]")).toBeNull();
    expect(title()).toBe("txDetail.expenseTitle");
    expect(api.refundCalls).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc 도 한 단계 뒤 — 시트 전체를 닫지 않는다", () => {
    render();
    openRefund();
    pressEsc();
    expect(document.querySelector("[data-testid=refund-step]")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(dialogs()).toHaveLength(1);
  });

  it("단계는 입력 폼이라 바깥을 눌러도 안 닫힌다", () => {
    render();
    openRefund();
    const overlay = document.querySelector("[data-slot=bottom-sheet-overlay]")!;
    act(() => {
      overlay.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector("[data-testid=refund-step]")).not.toBeNull();
  });

  it("닫힌 회차면 문장이 표시만 말하고 닫힌 회차 Callout 이 있다 — 돌아간다는 말이 없다", () => {
    api.assets = [card({ cardClosedThrough: "2026-09-30" })];
    render();
    openRefund();
    const step = document.querySelector("[data-testid=refund-step]")!;
    expect(step.textContent).toContain("txDetail.refundConfirmBodyClosed");
    expect(step.textContent).toContain("closedCycle.note");
  });

  it("열린 회차 · 계좌 있음이면 돌아가요 문장(Trans) — Callout 이 없다", () => {
    api.assets = [card({ cardClosedThrough: null })];
    render();
    openRefund();
    const step = document.querySelector("[data-testid=refund-step]")!;
    expect(step.textContent).toContain("txDetail.refundConfirmBody");
    expect(step.querySelector("[data-slot=callout]")).toBeNull();
  });

  it("결제계좌 없는 열린 회차 카드는 잔액만 정리된다는 Callout", () => {
    api.assets = [card({ cardClosedThrough: null, paymentAssetRowId: null })];
    render();
    openRefund();
    expect(
      document.querySelector("[data-testid=refund-step]")!.textContent,
    ).toContain("txDetail.refundConfirmBodyCardNoAccount");
  });

  it("자산이 없는 거래는 '없음(으)로' 문장이 아니라 표시만 말한다(조사 결함)", () => {
    render({ ...baseExpense, assetRowId: null, assetName: null });
    openRefund();
    const step = document.querySelector("[data-testid=refund-step]")!;
    expect(step.textContent).toContain("txDetail.refundConfirmBodyClosed");
    expect(step.textContent).not.toContain("none");
  });
});

describe("J 49 — 환불 취소 확인창", () => {
  it("취소해도 아무것도 안 나간다", () => {
    render(refunded);
    click(lastButton("txDetail.refundCancel"));
    expect(confirmText()).toContain("txDetail.refundCancelConfirm");
    click(document.querySelector("[data-testid=confirm-cancel]")!);
    expect(api.cancelCalls).toHaveLength(0);
  });

  it("neutral — 되돌리는 일이라 critical 이 아니다", () => {
    render(refunded);
    click(lastButton("txDetail.refundCancel"));
    expect(api.confirms.slice(-1)[0]!.danger).toBeFalsy();
  });

  it("확정하면 silent 로 취소하고 응답으로 환불됨이 걷힌다", () => {
    api.cancelReply = baseExpense;
    render(refunded);
    click(lastButton("txDetail.refundCancel"));
    click(confirmOk());
    expect(api.cancelCalls).toEqual([{ id: 77, silent: true }]);
    expect(document.body.textContent).not.toContain("txDetail.refundedAt");
    expect(moreRow("refund")).not.toBeNull();
  });

  it("옛 환급 이체가 묶였으면 '환급된 금액도 되돌아가요' — 닫힌 회차 줄은 없다", () => {
    api.assets = [card({ cardClosedThrough: "2026-09-30" })];
    render({ ...refunded, refundTransferRowId: 41 });
    click(lastButton("txDetail.refundCancel"));
    expect(confirmText()).toContain("txDetail.refundCancelConfirmTransfer");
    expect(confirmText()).not.toContain("closedCycle.note");
  });

  it("표식만 걷는 환불이면 환급 얘기가 없고 닫힌 회차면 한 줄을 붙인다", () => {
    api.assets = [card({ cardClosedThrough: "2026-09-30" })];
    render(refunded);
    click(lastButton("txDetail.refundCancel"));
    expect(confirmText()).not.toContain("refundCancelConfirmTransfer");
    expect(confirmText()).toContain("closedCycle.note");
  });

  it("취소 실패는 확인창을 닫고 스낵바 + 다시 시도", () => {
    api.cancelFail = true;
    render(refunded);
    click(lastButton("txDetail.refundCancel"));
    click(confirmOk());
    expect(document.querySelector("[data-testid=confirm]")).toBeNull();
    expect(api.snacks[0]).toMatchObject({
      message: "txDetail.refundCancelFailed",
      tone: "critical",
    });
  });
});

describe("7a — [수정] 은 상세 위에서 수정 폼을 열고 저장하면 상세로 돌아와 응답 값을 보인다", () => {
  it("[수정] 을 누르면 같은 시트 안 한 단계로 수정 폼이 들어온다 — 새 시트 · 대화상자가 겹치지 않는다", () => {
    render();
    click(lastButton("edit"));
    expect(document.querySelector("[data-testid=add-tx-sheet]")).not.toBeNull();
    expect(api.addTx!.expense!.rowId).toBe(77);
    expect(
      document.querySelectorAll("[data-slot=bottom-sheet-content]").length,
    ).toBe(1);
    expect(document.body.textContent).toContain("addTx.editTitle");
  });

  it("값 하나를 치는 단계에는 mobile 이 아니어도(768 ~ 1279 시트) 머리에 완료가 있다 (H2)", () => {
    api.embedInSub = true;
    render();
    click(lastButton("edit"));
    expect(
      document.querySelector("[data-slot=sheet-step-done]"),
    ).not.toBeNull();
  });

  it("[수정] 은 들고 있던 폼을 그 거래로 갈아 끼우고, [고쳐 쓰기] 는 시드를 받아 다시 갈아 끼운다", () => {
    render();
    click(lastButton("edit"));
    expect(api.begun).toEqual({
      expense: expect.objectContaining({ rowId: 77 }),
    });
    act(() =>
      (
        api.addTx as unknown as {
          onRewrite: (seed: { of: Expense; splits: never[] }) => void;
        }
      ).onRewrite({ of: baseExpense, splits: [] }),
    );
    expect(api.begun).toEqual({
      rewrite: { of: baseExpense, splits: [] },
    });
  });

  it("저장 중에는 닫기 원이 시트를 닫지 않는다 — 닫으면 응답 뒤 상세 갱신 · 알림이 사라진다 (L1)", () => {
    api.submitting = true;
    render();
    click(lastButton("edit"));
    click(
      document.querySelector<HTMLElement>("[data-slot=bottom-sheet-close]")!,
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("상세로 돌아오면 읽던 스크롤 자리로 간다 — 단계 본문이 새로 만들어져도 맨 위로 튀지 않는다 (M5)", () => {
    render();
    const body = () =>
      document.querySelector<HTMLElement>("[data-slot=bottom-sheet-body]")!;
    body().scrollTop = 120;
    act(() => {
      body().dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    click(lastButton("edit"));
    expect(body().scrollTop).toBe(0);
    act(() => api.parts!.onBack());
    expect(body().scrollTop).toBe(120);
  });

  it("수정 단계에서 ← 는 상세로 돌아온다 — 시트는 그대로", () => {
    render();
    click(lastButton("edit"));
    act(() => api.parts!.onBack());
    expect(document.querySelector("[data-testid=add-tx-sheet]")).toBeNull();
    expect(
      document.querySelector("[data-slot=tx-detail-head]")!.textContent,
    ).toContain("김밥천국");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("저장하면 응답 거래로 상세가 다시 그려진다 — 옛 값이 먼저 보이지 않는다", () => {
    render();
    click(lastButton("edit"));
    act(() => {
      api.addTx!.onSaved!({ ...baseExpense, merchant: "새 가맹점" });
      api.addTx!.onClose();
    });
    expect(document.querySelector("[data-testid=add-tx-sheet]")).toBeNull();
    expect(
      document.querySelector("[data-slot=tx-detail-head]")!.textContent,
    ).toContain("새 가맹점");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("고쳐 쓰기 저장은 옛 거래가 지워져 돌아갈 상세가 없다 — 상세까지 모두 닫는다", () => {
    render();
    click(lastButton("edit"));
    act(() => {
      api.addTx!.onReplaced!();
      api.addTx!.onClose();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("저장 없이 닫으면 옛 값 그대로 상세로 돌아온다", () => {
    render();
    click(lastButton("edit"));
    act(() => api.addTx!.onClose());
    expect(
      document.querySelector("[data-slot=tx-detail-head]")!.textContent,
    ).toContain("김밥천국");
  });

  it("환불된 거래에는 [수정] 이 없다 — 먼저 환불을 취소한다", () => {
    render(refunded);
    expect(hasButton("edit")).toBe(false);
  });
});

describe("나누기 · 반복 설정 · 더치페이는 상세 안 한 단계다 (I-21 F · G · H)", () => {
  it("나누기 줄을 누르면 같은 표면의 본문이 나누기 단계로 바뀐다", () => {
    render();
    click(moreRow("split")!);
    expect(document.querySelector("[data-testid=step-split]")).not.toBeNull();
    expect(title()).toBe("split");
    // 상세 본문은 사라진다 — 겹친 대화상자가 아니다
    expect(document.querySelector("[data-slot=tx-detail-head]")).toBeNull();
  });

  it("반복 설정 줄과 더치페이 줄도 각자 단계로 바뀐다", async () => {
    render();
    click(moreRow("recurring")!);
    // 반복 단계는 연결된 반복 목록을 받은 뒤 연다(비동기) — 한 번 기다린다
    await act(async () => {});
    expect(
      document.querySelector("[data-testid=step-recurring]"),
    ).not.toBeNull();
  });

  it("더치페이 줄", () => {
    render();
    click(moreRow("dutch")!);
    expect(document.querySelector("[data-testid=step-dutch]")).not.toBeNull();
  });
});
