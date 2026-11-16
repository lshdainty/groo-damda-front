import { useTranslation } from "react-i18next";
import type { ClosedCycleSpan } from "@/entities/expense";
import { closedCycleNoteText } from "../lib/closed-cycle-note";

/**
 * 확인창의 **안내 한 줄** — 결제가 끝난 회차의 카드 거래를 바꾸면 기록만 바뀐다(D1).
 *
 * 삭제·환불·환불 취소·스와이프 삭제가 같은 문장을 쓴다(저장 확인은 문장 목록을 받아
 * `closedCycleNoteText` 를 직접 쓴다). 무엇을 말할지는 거래 날짜와 카드의
 * `cardClosedThrough` 만으로 정해진다 — 서버에 묻지 않으므로 확인창이 네트워크를 기다리는
 * 일도, 못 물어서 폴백 문구로 넘어가는 일도 없다(D4 로 미리보기를 걷었다).
 */
export function ClosedCycleNote({ span }: { span: ClosedCycleSpan | null }) {
  const { t } = useTranslation("expense");
  if (!span) return null;
  return (
    <span
      data-testid="closed-cycle-note"
      style={{
        display: "block",
        marginTop: 10,
        fontSize: "var(--text-t4)",
        color: "var(--fg-secondary)",
      }}
    >
      {closedCycleNoteText(t, span)}
    </span>
  );
}
