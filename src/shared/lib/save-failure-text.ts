import { useTranslation } from "react-i18next";
import { isWriteUnconfirmed } from "@/shared/api/base";

/**
 * 저장 폼 맨 위 Callout 글을 고른다(앱 saveFailureText 와 같은 규칙, I-wrap-b2b 판단 (나) · (2)).
 * 쓰기 결과를 확인하지 못했으면(PARSE · 응답 없음 — 서버는 처리했을 수 있다) 실패라 말하지 않고
 * "저장됐는지 확인하지 못했어요. 목록에서 확인해주세요." — 결제는 청구 내역, 해지는 다시 열어 확인. 아니면 그 폼의 실패 글.
 */
export function useSaveFailureText() {
  const { t } = useTranslation("common");
  return (
    error: unknown,
    fallback: string,
    kind: "save" | "pay" | "withdraw" = "save",
  ): string =>
    isWriteUnconfirmed(error)
      ? t(
          kind === "pay"
            ? "query.payUnconfirmed"
            : kind === "withdraw"
              ? "query.withdrawUnconfirmed"
              : "query.saveUnconfirmed",
        )
      : fallback;
}
