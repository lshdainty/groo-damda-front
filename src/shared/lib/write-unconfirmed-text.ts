import { useTranslation } from "react-i18next";
import { isWriteUnconfirmed, type WriteKind } from "@/shared/api/base";

const SNACK_KEY: Record<WriteKind, string> = {
  save: "query.unconfirmedSave",
  delete: "query.unconfirmedDelete",
  action: "query.unconfirmedAction",
  toggle: "query.unconfirmedToggle",
  connect: "query.unconfirmedConnect",
  // 결제 · 해지는 지금 글 그대로(두 문장 — 어디서 확인하는지가 다르다)
  pay: "query.payUnconfirmed",
  withdraw: "query.withdrawUnconfirmedRefresh",
};

/**
 * 확인 못 한 쓰기의 스낵바 글을 고르는 **한 곳**(I-wrap-b2b 디자인시스템 판단 ①).
 * 스낵바는 한 문장 — 목록은 저절로 다시 받으니 "목록에서 확인해주세요" 를 붙이지 않는다.
 * 종류는 자리가 넘긴 것(`kind`)이 먼저, 없으면 요청 방식으로 고른 것(DELETE → 삭제, 그 밖 → 저장).
 * 확인 못 함이 아니면 null — 호출처가 자기 실패 글 + [다시 시도] 를 띄운다. 확인 못 함엔 [다시 시도] 를 두지 않는다.
 */
export function useUnconfirmedSnackText() {
  const { t } = useTranslation("common");
  return (error: unknown, kind?: WriteKind): string | null =>
    isWriteUnconfirmed(error) ? t(SNACK_KEY[kind ?? error.kind]) : null;
}
