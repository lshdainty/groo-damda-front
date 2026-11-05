// 카드 거래 저장 확인 — 결제가 끝난 회차에 드는 카드 거래면 저장 **전에** "이미 결제가 끝난
// 회차예요. 기록만 바뀌고 계좌 잔액은 그대로예요." 를 한 번 묻는다(D1).
//
// 무엇을 말할지는 거래 날짜와 카드의 `cardClosedThrough` 만으로 정한다 — 서버에 미리 묻지
// 않는다(D4). 예전엔 미리보기를 불러 문장을 골랐고, 그 조회가 늦거나 실패하면 묻지 않고
// 저장해 예고 없이 돈이 움직였다(QA 24차 1). 여기서 잠그는 것:
//   (1) 물어야 할 자리(닫힌 회차)에서만 묻고, 열린 회차·카드 아닌 거래는 바로 저장한다
//   (2) 확인해야 저장이 나간다 — 새 거래·문자 저장, 그리고 열린 회차 거래를 닫힌 회차
//       날짜·카드로 옮기는 편집 저장(새 날짜·새 카드 기준)
//   (3) 잠긴 거래(moneyLocked)의 편집 저장은 묻지 않는다 — 카테고리·가맹점·메모만 바뀌어
//       돈과 무관하다(사용자 확정 2026-09-21). 확인창은 돈과 기록이 갈리는 자리에만 남긴다
//   (4) 할부가 닫힌 회차와 열린 회차에 걸치면 "지난 회차분만" 으로 말한다
//   (5) 저장 응답에 미리 낸 돈의 환급이 실리면 토스트 훅으로 넘긴다(D4)
//   (6) 시트 제목이 빈 채로 그려지지 않는다(a262255 회귀)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import { setupFormDom } from "@/widgets/calendar/ui/event-form/test-utils";
import type { Expense, ExpenseCategory } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  create: null as Record<string, unknown> | null,
  update: null as Record<string, unknown> | null,
  /** 수정 PUT 이 몇 번 나갔나 — 확인창 없이 한 번에 나가는지 본다. */
  updates: 0,
  sms: null as Record<string, unknown> | null,
  /** 수정 응답 — 열린 회차에서 미리 낸 돈이 돌아오면 금액이 실린다. */
  updateReply: { refundedAmount: null } as Record<string, unknown>,
  notified: [] as { result: unknown; context: unknown }[],
  /** 문자에서 읽은 거래 날짜 — 회차를 가른다. */
  smsDate: "2026-08-20T10:00:00",
  smsInstallment: null as number | null,
  /** 카드가 결제를 끝낸 마지막 회차의 말일. */
  closedThrough: "2026-08-31" as string | null,
  /** 수정 저장 요청이 실패한다 */
  updateFail: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
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
    data: [category],
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
    mutate: (data: Record<string, unknown>) => {
      st.create = data;
    },
    isPending: false,
    isError: false,
  }),
  useUpdateExpense: () => ({
    mutate: (
      { data }: { id: number; data: Record<string, unknown> },
      opts?: {
        onSuccess?: (r: unknown) => void;
        onSettled?: () => void;
      },
    ) => {
      st.update = data;
      st.updates += 1;
      if (!st.updateFail) opts?.onSuccess?.(st.updateReply);
      opts?.onSettled?.();
    },
    isPending: false,
  }),
  useReplaceExpense: () => ({ mutate: () => {}, isPending: false }),
  useLedgerResultToast:
    () =>
    (result: unknown, context: unknown = {}) =>
      st.notified.push({ result, context }),
  useCreateExpenseTemplate: () => ({ mutate: () => {}, isPending: false }),
  useTouchExpenseTemplate: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: {
      assets: [
        { ...card, cardClosedThrough: st.closedThrough },
        otherCard,
        bank,
      ],
    },
    isPending: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateTransfer: () => ({ mutate: () => {}, isPending: false }),
  useUpdateTransfer: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/sms", () => ({
  looksLikePaymentSms: () => true,
  parseSms: async () => ({
    matched: true,
    confidence: "HIGH",
    cancel: false,
    amount: 5500,
    merchant: "스타벅스",
    expenseDate: st.smsDate,
    installmentMonths: st.smsInstallment,
    cardHint: null,
    issuerName: null,
    cardLast4: null,
    assetRowId: 9,
    assetRemembered: true,
    assetCandidates: [],
    categoryRowId: 11,
    categoryName: "식비",
    originalAmount: null,
    originalCurrency: null,
  }),
  useCommitSms: () => ({
    mutate: (data: Record<string, unknown>) => {
      st.sms = data;
    },
    isPending: false,
    isError: false,
  }),
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
  useExpenseSplits: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/features/user", () => ({
  useDefaultCurrency: () => "KRW",
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

/** 결제일 12일 신용카드 — 결제계좌가 있다. 닫힌 회차 경계는 `st.closedThrough`. */
const card = {
  rowId: 9,
  assetName: "현대카드",
  assetType: "CREDIT_CARD",
  paymentDay: 12,
  paymentAssetRowId: 1,
  balance: 0,
  isIncludedInTotal: "Y",
  sortOrder: 0,
};

/** 다른 신용카드 — 9월 회차까지 결제가 끝났다(결제일 5일). 옮겨 가면 새 카드 기준으로 가른다. */
const otherCard = {
  rowId: 10,
  assetName: "삼성카드",
  assetType: "CREDIT_CARD",
  paymentDay: 5,
  paymentAssetRowId: 1,
  cardClosedThrough: "2026-09-30",
  balance: 0,
  isIncludedInTotal: "Y",
  sortOrder: 1,
};

/** 입출금 계좌 — 회차가 없다. */
const bank = {
  rowId: 3,
  assetName: "주거래",
  assetType: "BANK_ACCOUNT",
  balance: 1_000_000,
  isIncludedInTotal: "Y",
  sortOrder: 1,
};

const cardExpense: Expense = {
  rowId: 501,
  categoryRowId: 11,
  assetRowId: 9,
  assetName: "현대카드",
  expenseType: "EXPENSE",
  amount: 12_000,
  description: null,
  expenseDate: "2026-09-05T12:30:00",
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
  createAt: "2026-09-05T12:30:00",
  modifyAt: "2026-09-05T12:30:00",
};

const { AddTxSheet } = await import("./AddTxSheet");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupFormDom(false);
  __resetPointerBlockForTest();
  st.create = null;
  st.update = null;
  st.updates = 0;
  st.sms = null;
  st.updateReply = { refundedAmount: null };
  st.notified = [];
  st.smsDate = "2026-08-20T10:00:00";
  st.smsInstallment = null;
  st.closedThrough = "2026-08-31";
  st.updateFail = false;
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

function render(expense: Expense | null = null) {
  act(() =>
    root.render(<AddTxSheet onClose={() => {}} mobile expense={expense} />),
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

/** 시트의 저장 — 새 거래는 `addTx.add`, 편집은 `save`. 확인창의 `save` 는 나중에 붙는다. */
const sheetSave = () => buttons("addTx.add")[0] ?? buttons("save")[0]!;
const dialogSave = () => {
  const all = buttons("save");
  return all[all.length - 1]!;
};
const bodyText = () => document.body.textContent ?? "";

/** 리액트가 관리하는 입력에 값을 넣는다(setter 를 우회하면 상태가 안 바뀐다). */
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
/** 결제 문자 단계로 들어가 읽는다 — 성공하면 2단계로 간다(1-2A) */
async function smsFill() {
  const open = [...document.body.querySelectorAll("button")].find((b) =>
    b.textContent?.startsWith("sms.pasteOpen"),
  )!;
  await click(open);
  setValue(
    document.body.querySelector("[role=dialog] textarea")!,
    "[Web발신] 현대카드 5,500원 스타벅스",
  );
  await click(buttons("sms.pasteAction")[0]!);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const byValue = (v: string) =>
  [...document.body.querySelectorAll<HTMLInputElement>("input")].find(
    (el) => el.value === v,
  );

describe("새 카드 지출", () => {
  it("결제가 끝난 회차면 한 줄을 묻고, 확인해야 저장한다", async () => {
    render();
    await smsFill();
    await click(sheetSave());

    expect(bodyText()).toContain("addTx.saveConfirmTitle");
    expect(bodyText()).toContain("closedCycle.note");
    expect(st.sms).toBeNull();

    await click(dialogSave());

    expect(st.sms).not.toBeNull();
    expect(st.sms!.assetRowId).toBe(9);
  });

  it("결제일 당일 회차도 닫힌 회차다 — 경계 날짜(말일)도 묻는다(D2)", async () => {
    st.smsDate = "2026-08-31T23:00:00";
    render();
    await smsFill();
    await click(sheetSave());

    expect(bodyText()).toContain("closedCycle.note");
    expect(st.sms).toBeNull();
  });

  it("할부가 닫힌 회차와 열린 회차에 걸치면 '지난 회차분만'", async () => {
    // 8/20 시작 3개월 = 8·9·10월 회차. 8월까지 닫혔다.
    st.smsInstallment = 3;
    render();
    await smsFill();
    await click(sheetSave());

    expect(bodyText()).toContain("closedCycle.partialNote");
    expect(bodyText()).not.toContain("closedCycle.note");
  });

  it("열린 회차는 묻지 않고 바로 저장한다", async () => {
    st.smsDate = "2026-09-10T10:00:00";
    render();
    await smsFill();
    await click(sheetSave());

    expect(bodyText()).not.toContain("closedCycle.");
    expect(st.sms).not.toBeNull();
  });

  it("닫힌 회차가 없는 카드(결제일 없음·새 카드)는 묻지 않는다", async () => {
    st.closedThrough = null;
    render();
    await smsFill();
    await click(sheetSave());

    expect(st.sms).not.toBeNull();
  });
});

/** 계좌·카드 줄을 눌러 고르기 시트에서 고른다 */
async function pickAsset(_from: string, to: string) {
  const rowBtn = [...document.body.querySelectorAll("button")].find((b) =>
    b.textContent?.startsWith("addTx.account"),
  )!;
  await click(rowBtn);
  await click(buttons(to)[0]!);
}

describe("카드 거래 수정", () => {
  it("잠긴 거래(결제 끝남)의 저장은 묻지 않고 바로 PUT 한 번 — 카테고리·가맹점·메모만 바뀐다", async () => {
    st.closedThrough = "2026-09-30";
    render({ ...cardExpense, moneyLocked: true });
    setValue(byValue("김밥천국")!, "김밥나라");
    await click(sheetSave());

    expect(bodyText()).not.toContain("closedCycle.");
    expect(st.updates).toBe(1);
    expect(st.update!.merchant).toBe("김밥나라");
  });

  it("열린 회차의 거래는 다른 카드로 옮겨 그 카드의 닫힌 회차에 들면 묻는다 — 새 카드 기준", async () => {
    // 현대카드로는 9/5 가 열린 회차지만, 삼성카드는 9월 회차까지 결제가 끝났다.
    render(cardExpense);
    await pickAsset("현대카드", "삼성카드");
    await click(sheetSave());

    expect(bodyText()).toContain("closedCycle.note");
    expect(st.updates).toBe(0);

    await click(dialogSave());

    expect(st.updates).toBe(1);
    expect(st.update!.assetRowId).toBe(10);
  });

  it("열린 회차의 거래는 고쳐도 묻지 않고 저장한다", async () => {
    render(cardExpense);
    await click(sheetSave());

    expect(bodyText()).not.toContain("closedCycle.");
    expect(st.updates).toBe(1);
  });

  it("카드가 그 회차까지 결제를 끝냈으면(날짜가 닫힌 회차에 든다) 저장 전에 묻는다 — 기록만 남는다", async () => {
    st.closedThrough = "2026-09-30";
    render(cardExpense);
    await click(sheetSave());

    expect(bodyText()).toContain("closedCycle.note");
    expect(st.updates).toBe(0);
    expect(st.update).toBeNull();
  });

  it("미리 낸 돈이 돌아왔으면 응답을 토스트 훅으로 넘긴다(D4) — 닫힌 회차 버튼은 없다", async () => {
    st.updateReply = { rowId: 501, refundedAmount: 7000 };
    render(cardExpense);
    await click(sheetSave());

    expect(st.notified).toEqual([
      { result: { rowId: 501, refundedAmount: 7000 }, context: {} },
    ]);
  });
});

describe("시트 제목", () => {
  // 한때 식이 빠져 값 없는 `title` prop 만 남았다 — 제목 자리가 비어 그려졌다(a262255).
  it("새 거래는 '거래 추가', 수정은 '거래 수정' 이다", () => {
    render();
    expect(bodyText()).toContain("addTx.newTitle");

    act(() => root.unmount());
    root = createRoot(container);
    render(cardExpense);
    expect(bodyText()).toContain("addTx.editTitle");
  });
});

/**
 * 날짜를 정해 넣는 새 거래 — 날짜 줄을 거쳐 고르든 `defaultDate` 로 열든 저장 때 날짜가 가르는 것은 같다(결제가 끝난 회차면 기록만 남는다).
 * 돈과 얽힌 규칙이라 문자 · 수정 길뿐 아니라 새로 넣는 길도 잠근다.
 */
describe("날짜가 닫힌 회차에 드는 새 카드 거래", () => {
  const rowButton = (title: string) =>
    [...document.body.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith(title),
    )!;
  async function fillNew(date: string) {
    act(() =>
      root.render(<AddTxSheet onClose={() => {}} mobile defaultDate={date} />),
    );
    setValue(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="form.amount"]',
      )!,
      "5000",
    );
    await click(buttons("addTx.next")[0]!);
    await click(rowButton("addTx.category"));
    await click(buttons("식비")[0]!);
    await click(rowButton("addTx.account"));
    await click(buttons("현대카드")[0]!);
  }

  it("8월 거래(8월 회차까지 결제 끝남)는 저장 전에 기록만 바뀐다고 묻고, 확인해야 저장한다", async () => {
    await fillNew("2026-08-20");
    await click(sheetSave());

    expect(bodyText()).toContain("addTx.saveConfirmTitle");
    expect(bodyText()).toContain("closedCycle.note");
    expect(st.create).toBeNull();

    await click(dialogSave());

    expect(st.create).not.toBeNull();
    expect(st.create!.assetRowId).toBe(9);
    expect(st.create!.expenseDate).toContain("2026-08-20");
  });

  it("9월 거래(열린 회차)는 묻지 않고 바로 저장한다", async () => {
    await fillNew("2026-09-10");
    await click(sheetSave());

    expect(bodyText()).not.toContain("closedCycle.");
    expect(st.create).not.toBeNull();
  });

  it("결제일 당일 회차의 마지막 날(8/31)도 닫힌 회차다 — 경계 날짜", async () => {
    await fillNew("2026-08-31");
    await click(sheetSave());

    expect(bodyText()).toContain("closedCycle.note");
    expect(st.create).toBeNull();
  });
});

describe("확인창을 거친 저장이 실패하면 (M1)", () => {
  it("확인창이 닫혀 폼 맨 위 알림이 가려지지 않고, 폼은 그대로 남는다", async () => {
    st.closedThrough = "2026-09-30";
    st.updateFail = true;
    render(cardExpense);
    await click(sheetSave());
    expect(bodyText()).toContain("closedCycle.note");

    await click(dialogSave());

    expect(st.updates).toBe(1);
    expect(bodyText()).not.toContain("closedCycle.note");
    expect(bodyText()).toContain("addTx.editTitle");
  });
});
