import { dsMoney } from "@/shared/ds/i18n";
import { MINUS } from "@/shared/lib/groo/format";
import type { ExpenseTemplate } from "@/entities/expense-template";

/** 고정 금액이 켜져 있고 값이 있는가 — 서버 `resolveAmount`(고정 켬 ⇔ 금액 > 0)와 같은 뜻 */
export const presetHasAmount = (p: ExpenseTemplate) =>
  p.lockAmount === "Y" && p.amount != null;

/** 금액 글 — 지출 "−" · 수입 "+" · 이체는 부호 없음. 원까지(dsMoney) */
export function presetAmountText(p: ExpenseTemplate): string | null {
  if (!presetHasAmount(p)) return null;
  const sign =
    p.expenseType === "TRANSFER"
      ? ""
      : p.expenseType === "EXPENSE"
        ? MINUS
        : "+";
  return `${sign}${dsMoney(p.amount as number)}`;
}

/** 금액 글 색 — 수입만 fg-brand, 지출 · 이체는 fg-neutral(list.md Suffix) */
export const presetAmountColor = (p: ExpenseTemplate) =>
  p.expenseType === "INCOME" ? "text-fg-brand" : "text-fg-neutral";
