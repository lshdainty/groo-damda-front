import { describe, expect, it } from "vitest";
import type { Expense } from "@/entities/expense";
import type { RecurringTransaction } from "@/entities/recurring-transaction";
import { recurringInitialState } from "./use-recurring-form";

const expense = {
  rowId: 5,
  expenseType: "EXPENSE",
  amount: -12000,
  expenseDate: "2026-10-23T12:30:00",
  merchant: "점심",
  description: "메모",
  paymentMethod: "CARD",
  assetRowId: 9,
  categoryRowId: 3,
  isFixed: true,
} as unknown as Expense;

describe("recurringInitialState", () => {
  it("거래 씨앗 — 거래 값 · 시작일 거래일 · 매월 그날 · 끝 없음 · 오전 9시", () => {
    const f = recurringInitialState(undefined, undefined, expense);
    expect(f).toMatchObject({
      type: "EXPENSE",
      amount: "12000",
      merchant: "점심",
      assetRowId: 9,
      startDate: "2026-10-23",
      frequency: "MONTHLY",
      dayOfMonth: 23,
      endMode: "NONE",
      executionTime: "09:00",
      isFixed: true,
    });
  });

  it("연결된 반복을 고칠 때는 반복 값 그대로 — 비어 있던 계좌를 거래 값으로 채우지 않는다", () => {
    const rec = {
      rowId: 1,
      expenseType: "EXPENSE",
      amount: 12000,
      assetRowId: null,
      merchant: null,
      description: null,
      paymentMethod: null,
      categoryRowId: 3,
      frequency: "MONTHLY",
      startDate: "2026-10-23",
    } as unknown as RecurringTransaction;
    // 씨앗은 새로 만들 때만 넘어온다(훅이 recurring 이 있으면 seed 를 undefined 로 쓴다)
    const f = recurringInitialState(rec, undefined, undefined);
    expect(f.assetRowId).toBeNull();
    expect(f.merchant).toBe("");
    expect(f.description).toBe("");
  });
});
