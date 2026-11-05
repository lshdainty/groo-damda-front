// 결제가 끝난 카드 거래의 **돈 칸 잠금**과 **[고쳐 쓰기]**(D12 · D13).
//
// 결제일이 된 회차분이 있는 신용카드 거래는 금액·날짜·자산·할부·통화·결제수단을 못 고친다
// (서버가 `moneyLocked` 로 판정해 내려 준다). 카테고리·가맹점·메모는 그대로 고친다. 돈 칸을
// 바꾸려면 [고쳐 쓰기] — 값이 전부 채워진 **새 거래 모드** 시트가 열리고, 저장하면 서버가
// 옛 거래를 지우고 새 거래로 교체한다(`POST /expense/{id}/replace`).
//
// 잠그는 것:
//   (1) 잠긴 칸 — 금액·날짜뿐 아니라 통화·결제수단·할부 칸도 잠긴다(환율이 금액을 다시
//       계산하고, 결제수단이 자산을 풀어서 옆길로 돈 칸이 바뀐다)
//   (2) 잠긴 거래의 수정 저장은 비울 수 있는 돈 칸을 싣지 않는다(서버가 지금 값을 지킨다)
//   (3) [고쳐 쓰기] — 새 거래 모드로 바뀌고 값이 그대로 채워진다
//   (4) 교체 본문 = 생성 본문 + 시트가 불러 둔 분할. 확인창이 새 날짜의 회차를 말한다
//   (5) 교체 뒤 토스트는 원래 카드의 결제계좌로 [잔액 고치기](D9)
//   (6) 고쳐 쓸 수 없는 잠긴 거래(중도 정리한 할부 — `replaceable: false`)엔 버튼이 없고
//       안내도 버튼을 가리키지 않는다(QA 26차 3)
//   (7) 결제일 변경이 대기 중인 카드는 확인창이 서버가 준 실제 결제일을 말한다(26차 4)
//   (8) 교체가 404 면(옛 거래가 이미 없다) 시트를 닫고, 그 밖의 실패면 둔다(26차 5)
//   (9) 분할을 다 불러오기 전엔 [고쳐 쓰기]를 못 연다 — 분할이 빠진 교체가 나가지 않는다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import { setupFormDom } from "@/widgets/calendar/ui/event-form/test-utils";
import { formatDay } from "@/shared/lib/groo/format";
import type { Expense, ExpenseCategory } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  update: null as Record<string, unknown> | null,
  replace: null as { id: number; data: Record<string, unknown> } | null,
  replaceReply: { rowId: 902, refundedAmount: null } as Record<string, unknown>,
  notified: [] as { result: unknown; context: unknown }[],
  /** 교체 요청의 실패 — 있으면 onError 로 돌려준다. */
  replaceError: null as unknown,
  /** 카드 자산에 덧씌울 값 — 결제일 변경 대기 같은 경우를 만든다. */
  cardOver: {} as Record<string, unknown>,
  /** 분할 조회 상태 — 불러오는 중·실패. */
  splitsPending: false,
  splitsError: false,
  /** 편집 시트가 불러 두는 그 거래의 분할. */
  splits: [] as {
    rowId: number;
    categoryRowId: number;
    amount: number;
    label: string | null;
    sortOrder: number;
  }[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // 날짜가 들어간 문장은 키 뒤에 날짜를 붙인다 — 어느 결제일을 말했는지 본다.
    t: (k: string, o?: Record<string, unknown>) =>
      o?.date != null ? `${k}|${String(o.date)}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
vi.mock("@/shared/lib/groo/hide-amounts", () => ({
  MaskAmount: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: () => ({
    data: [category, incomeCategory],
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
  useExpenseTemplates: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateExpense: () => ({
    mutate: () => {},
    isPending: false,
    isError: false,
  }),
  useUpdateExpense: () => ({
    mutate: (
      { data }: { id: number; data: Record<string, unknown> },
      opts?: { onSuccess?: (r: unknown) => void },
    ) => {
      st.update = data;
      opts?.onSuccess?.({ refundedAmount: null });
    },
    isPending: false,
    isError: false,
  }),
  useReplaceExpense: () => ({
    mutate: (
      vars: { id: number; data: Record<string, unknown> },
      opts?: {
        onSuccess?: (r: unknown) => void;
        onError?: (e: unknown) => void;
      },
    ) => {
      st.replace = vars;
      if (st.replaceError != null) opts?.onError?.(st.replaceError);
      else opts?.onSuccess?.(st.replaceReply);
    },
    isPending: false,
    isError: false,
  }),
  useLedgerResultToast:
    () =>
    (result: unknown, context: unknown = {}) =>
      st.notified.push({ result, context }),
  useCreateExpenseTemplate: () => ({ mutate: () => {}, isPending: false }),
  useTouchExpenseTemplate: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: { assets: [{ ...card, ...st.cardOver }] },
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateTransfer: () => ({ mutate: () => {}, isPending: false }),
  useUpdateTransfer: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/sms", () => ({
  parseSms: async () => ({ matched: false }),
  looksLikePaymentSms: () => true,
  useCommitSms: () => ({ mutate: () => {}, isPending: false, isError: false }),
}));
vi.mock("@/features/expense-split", () => ({
  useReplaceExpenseSplits: () => ({
    mutateAsync: async () => ({}),
    isPending: false,
  }),
  useDeleteAllExpenseSplits: () => ({
    mutateAsync: async () => ({}),
    isPending: false,
  }),
  useExpenseSplits: (id: number | null) =>
    id == null || st.splitsPending
      ? { data: undefined, isPending: true, isError: false }
      : st.splitsError
        ? { data: undefined, isPending: false, isError: true }
        : { data: st.splits, isPending: false, isError: false },
}));
vi.mock("@/features/user", () => ({
  useDefaultCurrencyState: () => ({
    currency: "KRW",
    ready: true,
    ensure: async () => true,
  }),
}));

const category: ExpenseCategory = {
  rowId: 11,
  categoryName: "식비",
  icon: null,
  color: "#2c70bf",
  expenseType: "EXPENSE",
  sortOrder: 0,
  parentRowId: null,
  hasChildren: false,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};
const incomeCategory: ExpenseCategory = {
  ...category,
  rowId: 21,
  categoryName: "캐시백",
  expenseType: "INCOME",
};

/** 결제일 12일 신용카드. 8월 회차까지 결제가 끝났다(오늘 9월). */
const card = {
  rowId: 9,
  assetName: "현대카드",
  assetType: "CREDIT_CARD",
  paymentDay: 12,
  paymentAssetRowId: 1,
  cardClosedThrough: "2026-08-31",
  balance: -12_000,
  isIncludedInTotal: "Y",
  sortOrder: 0,
};

/** 8월 회차에 들어 9/12 에 결제된 거래 — 돈 칸이 잠겼다. */
const locked: Expense = {
  rowId: 501,
  categoryRowId: 11,
  assetRowId: 9,
  assetName: "현대카드",
  expenseType: "EXPENSE",
  amount: 12_000,
  description: "점심",
  expenseDate: "2026-08-20T12:30:00",
  merchant: "김밥천국",
  paymentMethod: "CARD",
  installmentMonths: null,
  refundedAt: null,
  refundTransferRowId: null,
  originalAmount: null,
  originalCurrency: null,
  exchangeRate: null,
  calendarEventRowId: null,
  todoRowId: null,
  autoSource: null,
  moneyLocked: true,
  createAt: "2026-08-20T12:30:00",
  modifyAt: "2026-08-20T12:30:00",
};

const { AddTxSheet } = await import("./AddTxSheet");

let container: HTMLDivElement;
let root: Root;
let closed = 0;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupFormDom(false);
  setupFormDom(false);
  __resetPointerBlockForTest();
  st.update = null;
  st.replace = null;
  st.replaceReply = { rowId: 902, refundedAmount: null };
  st.notified = [];
  st.splits = [];
  st.replaceError = null;
  st.cardOver = {};
  st.splitsPending = false;
  st.splitsError = false;
  closed = 0;
  // Radix Select 는 포인터 캡처·스크롤 API 를 쓴다 — jsdom 엔 없어서 채워 준다.
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(expense: Expense) {
  act(() =>
    root.render(
      <AddTxSheet
        onClose={() => {
          closed += 1;
        }}
        mobile
        expense={expense}
      />,
    ),
  );
}

const buttons = (text: string) =>
  [...document.body.querySelectorAll("button")].filter(
    (b) => b.textContent?.trim() === text,
  );
async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
const bodyText = () => document.body.textContent ?? "";
/** 줄 칸 — 제목 키로 시작하는 줄 버튼 */
const rowButton = (title: string) =>
  [...document.body.querySelectorAll("button")].find((b) =>
    b.textContent?.startsWith(title),
  )!;
const byValue = (v: string) =>
  [
    ...document.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea",
    ),
  ].find((el) => el.value === v);
function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
/** 확인창의 저장 — 시트의 저장보다 나중에 붙는다. */
const lastSave = () => {
  const all = buttons("save");
  return all[all.length - 1]!;
};

async function openRewrite() {
  render(locked);
  await click(buttons("addTx.rewrite")[0]!);
}

describe("돈 칸 잠금(D12)", () => {
  it("금액·날짜·통화·결제수단·자산·할부가 잠기고, 그 자리에 안내와 [고쳐 쓰기]가 있다", () => {
    render(locked);

    // 금액 · 계좌 · 결제 수단 · 할부 · 날짜가 막힌 줄이다(값은 보이고 누르지 않는다)
    expect(document.body.querySelectorAll("[data-locked]").length).toBe(5);
    expect(bodyText()).toContain("12,000원");
    expect(bodyText()).toContain("addTx.moneyLockedNote");
    expect(buttons("addTx.rewrite")[0]?.disabled).toBe(false);
    // 가맹점은 그대로 고친다.
    expect(byValue("김밥천국")?.disabled).toBe(false);
    expect(bodyText()).toContain("점심");
  });

  it("잠기지 않은 거래엔 안내도 [고쳐 쓰기]도 없다", () => {
    render({
      ...locked,
      moneyLocked: false,
      expenseDate: "2026-09-05T12:30:00",
    });

    expect(document.body.querySelector("[data-locked]")).toBeNull();
    expect(bodyText()).not.toContain("addTx.moneyLockedNote");
    expect(buttons("addTx.rewrite")).toHaveLength(0);
  });

  it("잠긴 거래의 저장은 비울 수 있는 돈 칸을 싣지 않는다 — 서버가 지금 값을 지킨다", async () => {
    render(locked);
    setValue(byValue("김밥천국")!, "김밥나라");
    // 확인창 없이 한 번에 나간다 — 잠긴 거래는 돈 칸이 안 바뀌어 물을 게 없다(2026-09-21).
    await click(buttons("save")[0]!);

    expect(bodyText()).not.toContain("closedCycle.");
    expect(st.update).not.toBeNull();
    expect(st.update!.merchant).toBe("김밥나라");
    for (const key of [
      "assetRowId",
      "paymentMethod",
      "installmentMonths",
      "originalAmount",
      "originalCurrency",
      "exchangeRate",
    ]) {
      expect(st.update!, key).not.toHaveProperty(key);
    }
    // 뼈대는 싣는다 — 잠긴 칸이라 값이 같다(서버가 분 단위로 견준다).
    expect(st.update!.amount).toBe(12_000);
    expect(st.update!.expenseDate).toBe("2026-08-20T12:30");
    expect(st.update!.expenseType).toBe("EXPENSE");
  });
});

describe("[고쳐 쓰기](D13)", () => {
  it("값이 전부 채워진 새 거래 모드 시트로 바뀐다", async () => {
    await openRewrite();

    expect(bodyText()).toContain("addTx.rewrite");
    expect(bodyText()).not.toContain("addTx.moneyLockedNote");
    expect(document.body.querySelector("[data-locked]")).toBeNull();
    expect(bodyText()).toContain("12,000원");
    expect(byValue("김밥천국")).toBeDefined();
    expect(bodyText()).toContain("점심");
    // 옮겨 적는 중이라 프리셋·문자 붙여넣기는 없다(값을 덮거나 문자 경로로 새 저장이 된다).
    expect(bodyText()).not.toContain("addTx.presetLoad");
    expect(bodyText()).not.toContain("sms.pasteOpen");
    // 거래를 거래로 바꾼다 — 이체로는 못 바꾼다.
    expect(buttons("addTx.transfer")[0]?.disabled).toBe(true);
  });

  it("닫힌 회차로 저장하면 '원래 거래는 지워지고 … 기록만' 을 묻고, 교체 본문을 보낸다", async () => {
    st.splits = [
      { rowId: 1, categoryRowId: 11, amount: 8_000, label: "밥", sortOrder: 0 },
      { rowId: 2, categoryRowId: 11, amount: 4_000, label: null, sortOrder: 1 },
    ];
    await openRewrite();
    await click(buttons("save")[0]!);

    expect(bodyText()).toContain(
      "addTx.rewriteConfirmBody addTx.rewriteClosedNote",
    );
    expect(st.replace).toBeNull();

    await click(lastSave());

    expect(st.replace).not.toBeNull();
    expect(st.replace!.id).toBe(501);
    const data = st.replace!.data;
    expect(data.amount).toBe(12_000);
    expect(data.assetRowId).toBe(9);
    expect(data.expenseDate).toBe("2026-08-20T12:30");
    expect(data.categoryRowId).toBe(11);
    // 분할은 편집 시트가 불러 둔 그대로 싣는다.
    expect(data.splits).toEqual([
      { categoryRowId: 11, amount: 8_000, label: "밥", sortOrder: 0 },
      { categoryRowId: 11, amount: 4_000, label: null, sortOrder: 1 },
    ]);
    // 교체 뒤 토스트 — 원래 카드의 결제계좌로 [잔액 고치기].
    expect(st.notified).toEqual([
      {
        result: { rowId: 902, refundedAmount: null },
        context: { closed: true, paymentAssetRowId: 1 },
      },
    ]);
    expect(closed).toBe(1);
  });

  it("금액을 바꿔 분할 합과 어긋나면 교체 전에 분할부터 맞춘다", async () => {
    st.splits = [
      {
        rowId: 1,
        categoryRowId: 11,
        amount: 12_000,
        label: null,
        sortOrder: 0,
      },
    ];
    await openRewrite();
    await click(rowButton("form.amount"));
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="form.amount"]',
      )!,
      "13000",
    );
    await click(buttons("done")[0]!);

    expect(buttons("addTx.saveSplitAndSave")).toHaveLength(1);
    await click(buttons("addTx.saveSplitAndSave")[0]!);

    // 맞추기는 폼 위 대화상자가 아니라 같은 표면의 한 단계다
    expect(bodyText()).toContain("splitStep.reconcileTitle");
    expect(st.replace).toBeNull();
  });

  it("종류를 바꾸면 옛 분할을 옮기지 않는다 — 분류가 다른 종류다", async () => {
    st.splits = [
      {
        rowId: 1,
        categoryRowId: 11,
        amount: 12_000,
        label: null,
        sortOrder: 0,
      },
    ];
    await openRewrite();
    await click(buttons("income")[0]!);
    await click(rowButton("addTx.category"));
    await click(
      [...document.body.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes("캐시백"),
      )!,
    );
    await click(buttons("save")[0]!);
    await click(lastSave());

    expect(st.replace!.data.expenseType).toBe("INCOME");
    expect(st.replace!.data.splits).toEqual([]);
  });
});

describe("고쳐 쓸 수 없는 잠긴 거래(QA 26차 3)", () => {
  it("중도 정리한 할부는 [고쳐 쓰기]가 없고, 안내가 버튼을 가리키지 않는다", () => {
    render({ ...locked, installmentMonths: 3, replaceable: false });

    expect(buttons("addTx.rewrite")).toHaveLength(0);
    expect(bodyText()).toContain("addTx.moneyLockedPaidOffNote");
    expect(bodyText()).not.toContain("addTx.moneyLockedNote");
    // 돈 칸은 그대로 잠겨 있다.
    expect(
      document.body.querySelectorAll("[data-locked]").length,
    ).toBeGreaterThan(0);
  });

  it("서버가 고쳐 쓸 수 있다고 하면 버튼과 안내가 그대로다", () => {
    render({ ...locked, replaceable: true });

    expect(buttons("addTx.rewrite")).toHaveLength(1);
    expect(bodyText()).toContain("addTx.moneyLockedNote");
  });

  it("옛 서버(값 없음)는 잠금으로 본다 — 잠긴 거래엔 버튼이 있다", () => {
    render(locked);

    expect(buttons("addTx.rewrite")).toHaveLength(1);
  });
});

describe("결제일 변경이 대기 중인 카드(QA 26차 4)", () => {
  // 25일 카드를 21일로, 다시 10일로 바꿨다 — 8월분은 처음 결제일(9/25)에 나가고 9월분부터
  // 10일이다. 서버가 첫 열린 회차의 실제 결제일을 `nextPaymentDate` 로 내려 준다.
  beforeEach(() => {
    st.cardOver = {
      paymentDay: 10,
      cardClosedThrough: "2026-07-31",
      nextPaymentDate: "2026-09-25",
    };
  });

  it("대기 중인 회차로 고쳐 쓰면 그 회차의 실제 결제일을 말한다", async () => {
    await openRewrite();
    await click(buttons("save")[0]!);

    expect(bodyText()).toContain(
      `addTx.rewriteOpenNote|${formatDay("2026-09-25").md}`,
    );
  });
});

describe("고쳐 쓰기 실패 뒷처리(QA 26차 5)", () => {
  it("404(옛 거래가 이미 없다)면 시트를 닫는다 — 목록은 훅이 비운다", async () => {
    st.replaceError = { response: { status: 404 } };
    await openRewrite();
    await click(buttons("save")[0]!);
    await click(lastSave());

    expect(st.replace).not.toBeNull();
    expect(closed).toBe(1);
    // 성공이 아니므로 결과 토스트는 없다.
    expect(st.notified).toEqual([]);
  });

  it("그 밖의 실패면 시트를 둔다 — 고친 값을 잃지 않고 다시 시도한다", async () => {
    st.replaceError = { response: { status: 500 } };
    await openRewrite();
    await click(buttons("save")[0]!);
    await click(lastSave());

    expect(closed).toBe(0);
    expect(bodyText()).toContain("12,000원");
    expect(bodyText()).toContain("addTx.rewrite");
  });
});

describe("분할을 다 불러오기 전엔 고쳐 쓰기를 못 연다", () => {
  // 고쳐 쓰기는 편집 시트가 불러 둔 분할을 본문에 싣는다. 모르는 채 열리면 분할이 빠진
  // 교체가 나가 서버가 옛 분할을 옮기고, 금액을 바꿨다면 합이 안 맞아 400 이 난다
  // (앱에서 난 경로 — QA 26차). 웹은 입구에서 막는다.
  it("불러오는 중이면 [고쳐 쓰기]가 눌리지 않는다", () => {
    st.splitsPending = true;
    render(locked);

    expect(buttons("addTx.rewrite")[0]?.disabled).toBe(true);
  });

  it("불러오지 못했으면 [고쳐 쓰기]가 눌리지 않는다", () => {
    st.splitsError = true;
    render(locked);

    expect(buttons("addTx.rewrite")[0]?.disabled).toBe(true);
  });
});
