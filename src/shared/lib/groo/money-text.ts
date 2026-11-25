import { dsMoney } from "@/shared/ds/i18n";
import { MINUS, minusOf } from "@/shared/lib/groo/format";
import {
  HIDE_AMOUNTS_MASK,
  useHideAmounts,
} from "@/shared/lib/groo/hide-amounts-core";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";

/*
 * 금액 글 — ds 부품에 글로 넘긴다(쉼표 뒤 줄바꿈 · 원까지). 가리면 점(HIDE_AMOUNTS_MASK).
 */

/** 원까지, 빼기는 U+2212 */
export const won = (n: number) => (n < 0 ? MINUS : "") + dsMoney(Math.abs(n));
/** 크기만 든 지출 값 — 0 은 부호 없이, 음수(선결제)는 "+" */
export const wonOut = (n: number) => minusOf(n) + dsMoney(Math.abs(n));
/** 크기만 든 수입 값 — 0 은 부호 없이 */
export const wonIn = (n: number) =>
  (n > 0 ? "+" : n < 0 ? MINUS : "") + dsMoney(Math.abs(n));

/** 카드가 가려졌으면 점(HIDE_AMOUNTS_MASK), 아니면 만든 글 */
export function useMasked(
  card: HideCardKey,
  kind?: "income" | "expense" | "net",
) {
  const hidden = useHideAmounts(card, kind);
  return (text: string) => (hidden ? HIDE_AMOUNTS_MASK : text);
}
