import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { editAssetPath } from "@/entities/asset";
import { useSnackbar } from "@/shared/ds/snackbar";
import { money } from "@/shared/lib/groo/format";

/** 거래를 바꾼 요청 하나의 응답 — 선결제 환급액만 본다. */
type ChangeResult = { refundedAmount?: number | null } | null | undefined;

type ChangeContext = {
  /** 결제가 끝난 회차의 거래였나 — 그러면 통장은 그대로다(D1). */
  closed?: boolean;
  /** 그 카드의 결제계좌 — [잔액 고치기]가 여는 곳. 없으면 버튼이 없다. */
  paymentAssetRowId?: number | null;
};

/**
 * 거래를 지우거나·환불하거나·고치거나·고쳐 쓴 **뒤**의 토스트 한 곳(D4 · D9).
 *
 * 말하는 것은 둘이다.
 *  - 열린 회차에서 미리 낸 돈이 남아 결제계좌로 돌려줬으면 그 금액(D4). 미리 예고하지
 *    않는다 — 예고하려면 저장 전에 서버에 물어야 했고, 그 조회가 늦거나 실패할 때마다
 *    예고 없이 돈이 움직이거나 거짓 안내가 떴다(QA 23·24차).
 *  - 결제가 끝난 회차의 거래였으면 통장은 그대로라는 것과 [잔액 고치기](D9). 카드사가
 *    실제로 돈을 돌려줬다면 결제계좌 잔액은 사용자가 고친다 — 그 폼으로 바로 보낸다.
 *    결제계좌가 없는 카드는 고칠 통장이 없어 버튼도 없다.
 *
 * 둘 다 아니면 아무 말도 안 한다 — 저장·삭제는 화면이 바뀌는 것으로 충분하다.
 *
 * 토스트는 띄운 화면이 닫힌 뒤에도 남는다. [잔액 고치기]의 `navigate` 는 라우터 것이라
 * 상세가 닫혀도 그대로 움직인다.
 */
export function useLedgerResultToast() {
  const { t } = useTranslation("expense");
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  return (result: ChangeResult, context: ChangeContext = {}) => {
    const refunded = result?.refundedAmount ?? 0;
    const fixTarget = context.closed
      ? (context.paymentAssetRowId ?? null)
      : null;
    const action =
      fixTarget != null
        ? {
            label: t("closedCycle.fixBalance"),
            onClick: () => navigate(editAssetPath(fixTarget)),
          }
        : undefined;
    const message =
      refunded > 0
        ? t("closedCycle.prepaidRefunded", { amount: money(refunded) })
        : action
          ? t("closedCycle.noteToast")
          : null;
    if (!message) return;
    // 둘 다 neutral(D1 · D2) — 돈이 돌아온 것도, 통장이 그대로라는 안내도 이정표가 아니다.
    // 액션이 있으면 스낵바가 6초 동안 둔다(시간은 ds 가 정한다).
    snackbar.show({ message, action });
  };
}
