import type { AssetTransfer } from "../model/types";

/**
 * 이 사용자가 지금 이 이체를 직접 지울 수 있나 — 이체 상세의 삭제 버튼 판정.
 * 서버가 알려 주는 `deletable` 을 따르고, 필드가 없는 옛 서버 응답은 예전 규칙
 * (사용자가 직접 만든 이체만)으로 되돌아간다. 수정 · 반복 설정 숨김은 `autoSource` 기준 그대로다.
 */
export function isTransferDeletable(
  t: Pick<AssetTransfer, "deletable" | "autoSource">,
): boolean {
  return t.deletable ?? t.autoSource == null;
}
