// 프리셋 줄 금액 글 · 색 (I-20 C 15) — 지출 "−" · 수입 "+" · 이체 부호 없음, 지출 · 이체는 fg-neutral · 수입은 fg-brand,
// 고정 금액이 꺼졌거나 금액이 없으면 글이 없다("금액 비움" 은 줄이 그린다).
import { describe, expect, it } from "vitest";
import type { ExpenseTemplate } from "@/entities/expense-template";
import {
  presetAmountColor,
  presetAmountText,
  presetHasAmount,
} from "./preset-view";

const p = (o: Partial<ExpenseTemplate>) =>
  ({
    expenseType: "EXPENSE",
    amount: 1234567890,
    lockAmount: "Y",
    ...o,
  }) as ExpenseTemplate;

describe("프리셋 금액 글", () => {
  it("지출은 −(U+2212), 수입은 +, 이체는 부호 없음 — 원까지, 쉼표 포함", () => {
    expect(presetAmountText(p({}))).toBe("−1,234,567,890원");
    expect(presetAmountText(p({ expenseType: "INCOME" }))).toBe(
      "+1,234,567,890원",
    );
    expect(presetAmountText(p({ expenseType: "TRANSFER" }))).toBe(
      "1,234,567,890원",
    );
  });

  it("고정 금액이 꺼졌거나 금액이 없으면 글이 없다", () => {
    expect(presetAmountText(p({ lockAmount: "N" }))).toBeNull();
    expect(presetAmountText(p({ amount: null }))).toBeNull();
    expect(presetHasAmount(p({ lockAmount: "N" }))).toBe(false);
  });

  it("수입만 fg-brand — 지출 · 이체는 fg-neutral", () => {
    expect(presetAmountColor(p({ expenseType: "INCOME" }))).toBe(
      "text-fg-brand",
    );
    expect(presetAmountColor(p({}))).toBe("text-fg-neutral");
    expect(presetAmountColor(p({ expenseType: "TRANSFER" }))).toBe(
      "text-fg-neutral",
    );
  });
});
