// 자산 상세 내역 줄(I-17 49 · 51) — 줄을 누르면 거래 상세가 열리고, 일 합계는 환불된 거래 · 이체를 뺀다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { Expense } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
// 줄 부품은 껍데기 — 누르면 onClick 으로 거래를 넘기는 것만 본다
// 이체 줄이 계좌 통화를 읽는다(useAssets 참조 조회) — 모르면 원화로 찍힌다
vi.mock("@/features/asset", () => ({
  useAssetCurrencyOf: () => () => null,
}));
vi.mock("@/entities/expense", () => ({
  ExpenseRow: ({
    expense,
    onClick,
  }: {
    expense: Expense;
    onClick?: (e: Expense) => void;
  }) => (
    <button
      type="button"
      data-row={expense.rowId}
      onClick={() => onClick?.(expense)}
    >
      {expense.merchant}
    </button>
  ),
  isRefundedTx: (e: Expense) => e.refundedAt != null,
}));
vi.mock("@/entities/asset", () => ({
  TransferRow: ({
    transfer,
    onClick,
  }: {
    transfer: { rowId: number };
    onClick?: (t: { rowId: number }) => void;
  }) => (
    <button
      type="button"
      data-transfer={transfer.rowId}
      onClick={() => onClick?.(transfer)}
    >
      이체
    </button>
  ),
}));

const { LedgerGroups } = await import("./LedgerGroups");

const ex = (rowId: number, amount: number, extra: Partial<Expense> = {}) =>
  ({
    rowId,
    amount,
    expenseType: "EXPENSE",
    expenseDate: "2026-10-29T12:00:00",
    merchant: `가게${rowId}`,
    refundedAt: null,
    ...extra,
  }) as unknown as Expense;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const asset = { rowId: 1 } as Asset;
const click = (el: Element) =>
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("LedgerGroups", () => {
  it("거래 줄을 누르면 그 거래를, 이체 줄을 누르면 그 이체를 연다", () => {
    const opened: string[] = [];
    act(() =>
      root.render(
        <LedgerGroups
          asset={asset}
          groups={[
            [
              "2026-10-29",
              [
                { kind: "expense", at: "2026-10-29", expense: ex(1, 5000) },
                {
                  kind: "transfer",
                  at: "2026-10-29",
                  transfer: { rowId: 7 } as never,
                },
              ],
            ],
          ]}
          onExpense={(e) => opened.push(`e${e.rowId}`)}
          onTransfer={(t) => opened.push(`t${t.rowId}`)}
        />,
      ),
    );
    click(container.querySelector("[data-row='1']")!);
    click(container.querySelector("[data-transfer='7']")!);
    expect(opened).toEqual(["e1", "t7"]);
  });

  it("일 합계는 환불된 거래 · 이체를 뺀다 — 환불 11,000 뿐인 날은 합계가 없다", () => {
    act(() =>
      root.render(
        <LedgerGroups
          asset={asset}
          groups={[
            [
              "2026-10-29",
              [
                {
                  kind: "expense",
                  at: "2026-10-29",
                  expense: ex(1, 11000, { refundedAt: "2026-10-29T13:00:00" }),
                },
                {
                  kind: "transfer",
                  at: "2026-10-29",
                  transfer: { rowId: 7 } as never,
                },
              ],
            ],
          ]}
          onExpense={() => {}}
          onTransfer={() => {}}
        />,
      ),
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("11,000");
  });

  it("묶음마다 날짜 머리(월 일 + 요일)와 지출 합계를 그린다", () => {
    act(() =>
      root.render(
        <LedgerGroups
          asset={asset}
          groups={[
            [
              "2026-10-29",
              [
                { kind: "expense", at: "2026-10-29", expense: ex(1, 5000) },
                { kind: "expense", at: "2026-10-29", expense: ex(2, 2500) },
              ],
            ],
          ]}
          onExpense={() => {}}
          onTransfer={() => {}}
        />,
      ),
    );
    expect(container.querySelector("h2")?.textContent).toMatch(/29/);
    expect(container.textContent).toContain("7,500");
  });
});
