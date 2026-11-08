// 가계부 행 스와이프의 [수정 · 삭제] — 상세와 **같은 말**을 하는지(QA 23차 13).
//
// 스와이프만 옛 안내("이미 결제된 회차의 거래라면 결제계좌로 환급돼요")를 달고, 환불된
// 행에도 [수정]을 띄우고(누르면 EXP_043), 지운 뒤 토스트도 없었다. 잠그는 것:
//   (1) 결제가 끝난 회차의 카드 거래면 확인창에 상세와 같은 한 줄(D1) — 서버에 묻지 않는다
//   (2) 환불된 거래엔 [수정]이 없다(앱 `canEdit` 과 같은 조건)
//   (3) 지운 뒤 응답과 "닫힌 회차였나 · 결제계좌" 를 토스트 훅에 넘긴다(D4 · D9)
import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { Expense } from "@/entities/expense";
import type { ExpenseSwipeAction } from "./use-expense-swipe-actions";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  deleted: [] as number[],
  deleteReply: { refundedAmount: null } as { refundedAmount: number | null },
  notified: [] as { result: unknown; context: unknown }[],
  edited: [] as number[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/expense", () => ({
  useDeleteExpense: () => ({
    // 확인창 뒤 실패는 호출처가 알린다 — 요청은 silent 로 보낸다(전역 서버 글 토스트 없음)
    mutateAsync: async ({ id, silent }: { id: number; silent?: boolean }) => {
      expect(silent).toBe(true);
      st.deleted.push(id);
      return st.deleteReply;
    },
    isPending: false,
  }),
  useLedgerResultToast:
    () =>
    (result: unknown, context: unknown = {}) =>
      st.notified.push({ result, context }),
}));

const { useExpenseSwipeActions } = await import("./use-expense-swipe-actions");

/** 결제일 12일 카드 — 8월 회차까지 결제가 끝났다. */
const card = {
  rowId: 9,
  assetName: "현대카드",
  assetType: "CREDIT_CARD",
  paymentDay: 12,
  paymentAssetRowId: 1,
  cardClosedThrough: "2026-08-31",
} as unknown as Asset;
const bank = {
  rowId: 3,
  assetName: "주거래",
  assetType: "BANK_ACCOUNT",
  cardClosedThrough: null,
} as unknown as Asset;

const tx: Expense = {
  rowId: 77,
  categoryRowId: 11,
  assetRowId: 9,
  assetName: "현대카드",
  expenseType: "EXPENSE",
  amount: 40_000,
  description: null,
  merchant: "버스",
  expenseDate: "2026-08-20T08:00:00",
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
  createAt: "2026-08-20T08:00:00",
  modifyAt: "2026-08-20T08:00:00",
};

let actionsFor: ((e: Expense) => ExpenseSwipeAction[]) | null = null;
function Probe() {
  const fn = useExpenseSwipeActions({
    assets: [card, bank],
    onEdit: (e) => st.edited.push(e.rowId),
  });
  // 렌더 중에 바깥 변수를 건드리지 않는다 — effect 로 옮긴다(`act` 가 flush 한다).
  useEffect(() => {
    actionsFor = fn;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  st.deleted = [];
  st.deleteReply = { refundedAmount: null };
  st.notified = [];
  st.edited = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** 확인창 본문을 실제로 그려 글자를 읽는다(선언형이라 액션을 만들 때 굳는다). */
function textOf(node: ReactNode): string {
  const host = document.createElement("div");
  const r = createRoot(host);
  act(() => r.render(<>{node}</>));
  const text = host.textContent ?? "";
  act(() => r.unmount());
  return text;
}

const deleteAction = (e: Expense) =>
  actionsFor!(e).find((a) => a.kind === "destructive")!;

describe("삭제 확인창 — 상세와 같은 한 줄(D1)", () => {
  it("결제가 끝난 회차의 카드 거래면 '기록만 바뀌고 계좌 잔액은 그대로'", () => {
    const text = textOf(deleteAction(tx).confirm!.message);

    expect(text).toContain("txDetail.deleteMessage");
    expect(text).toContain("closedCycle.note");
    // 옛 폴백 안내는 걷었다 — 기한 지난 회차에 "환급돼요" 라는 거짓 안내였다.
    expect(text).not.toContain("paidDeleteFallback");
  });

  it("할부가 닫힌 회차와 열린 회차에 걸치면 '지난 회차분만'", () => {
    const text = textOf(
      deleteAction({ ...tx, installmentMonths: 3 }).confirm!.message,
    );

    expect(text).toContain("closedCycle.partialNote");
  });

  it("열린 회차의 카드 거래·계좌 거래엔 한 줄이 없다", () => {
    const open = textOf(
      deleteAction({ ...tx, expenseDate: "2026-09-05T08:00:00" }).confirm!
        .message,
    );
    const account = textOf(
      deleteAction({ ...tx, assetRowId: 3 }).confirm!.message,
    );

    expect(open).not.toContain("closedCycle.");
    expect(account).not.toContain("closedCycle.");
  });
});

describe("[수정]", () => {
  it("평소엔 [수정, 삭제] 순서다 — 누르면 수정으로 간다", () => {
    const actions = actionsFor!(tx);
    expect(actions.map((a) => a.kind)).toEqual(["primary", "destructive"]);

    void actions[0]!.onSelect();
    expect(st.edited).toEqual([77]);
  });

  it("환불된 거래엔 없다 — 서버가 EXP_043 으로 막는다", () => {
    const actions = actionsFor!({ ...tx, refundedAt: "2026-09-18T12:00:00" });

    expect(actions.map((a) => a.kind)).toEqual(["destructive"]);
  });
});

describe("자동 생성 거래 — 서버 deletable 로 [삭제] 만 가른다", () => {
  const auto = { ...tx, autoSource: "TRADE_REALIZED" };

  it("deletable:true 면 [삭제] 만 — 수정은 없다", () => {
    const actions = actionsFor!({ ...auto, deletable: true });
    expect(actions.map((a) => a.kind)).toEqual(["destructive"]);
  });

  it("deletable:false 이거나 필드가 없으면(옛 서버) 밀어도 아무것도 없다", () => {
    expect(actionsFor!({ ...auto, deletable: false })).toEqual([]);
    expect(actionsFor!(auto)).toEqual([]);
  });
});

describe("지운 뒤의 토스트(D4 · D9) — 예전엔 스와이프 삭제만 토스트가 없었다", () => {
  it("닫힌 회차 거래 — 응답과 함께 닫힌 회차·결제계좌를 넘긴다", async () => {
    await act(async () => {
      await deleteAction(tx).onSelect();
    });

    expect(st.deleted).toEqual([77]);
    expect(st.notified).toEqual([
      {
        result: { refundedAmount: null },
        context: { closed: true, paymentAssetRowId: 1 },
      },
    ]);
  });

  it("열린 회차 거래 — 미리 낸 돈이 돌아왔으면 그 응답을 넘긴다", async () => {
    st.deleteReply = { refundedAmount: 40_000 };
    await act(async () => {
      await deleteAction({
        ...tx,
        expenseDate: "2026-09-05T08:00:00",
      }).onSelect();
    });

    expect(st.notified).toEqual([
      {
        result: { refundedAmount: 40_000 },
        context: { closed: false, paymentAssetRowId: 1 },
      },
    ]);
  });
});
