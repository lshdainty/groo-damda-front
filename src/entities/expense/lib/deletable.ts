import type { Expense } from "../model/types";

/**
 * 이 사용자가 지금 이 거래를 직접 지울 수 있나 — 삭제 버튼 · 밀어서 [삭제] · 고르기(일괄 삭제)의 유일한 판정.
 * 서버가 알려 주는 `deletable` 을 따른다(자동 생성이라도 그 기록을 만든 증권 자산이 이미 삭제됐으면 true).
 * 필드가 없는 옛 서버 응답은 예전 규칙(손으로 쓴 거래만)으로 되돌아간다.
 *
 * 수정 · 환불 · 분할 숨김은 이 값과 무관하게 `autoSource` 기준 그대로다.
 */
export function isExpenseDeletable(
  e: Pick<Expense, "deletable" | "autoSource">,
): boolean {
  return e.deletable ?? e.autoSource == null;
}
