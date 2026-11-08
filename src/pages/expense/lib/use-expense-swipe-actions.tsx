import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import type { Asset } from "@/entities/asset";
import {
  closedCycleSpan,
  isExpenseDeletable,
  isRefundedTx,
  type Expense,
} from "@/entities/expense";
import { useDeleteExpense, useLedgerResultToast } from "@/features/expense";
import { ClosedCycleNote } from "@/features/expense/ui/ClosedCycleNote";

/**
 * 밀기 · ⋮ 의 동작 한 칸. ds `SwipeAction` 에 **삭제 확인창의 글**을 더한 것이다 — ds 부품은 확인창을 소유하지 않고
 * (swipe-actions.tsx "destructive 는 확인 창부터 — 제목 · 설명은 부르는 쪽이 넘긴다"), 화면이 이 글로 Alert Dialog 를 띄운다.
 * 글은 상세에서 지울 때와 같다(같은 동작은 같은 글).
 */
export interface ExpenseSwipeAction {
  label: string;
  icon: ReactNode;
  kind: "primary" | "destructive";
  /** 있으면 바로 실행하지 않고 확인창부터 — 누르면 [onSelect] */
  confirm?: { title: string; message: ReactNode };
  onSelect: () => void | Promise<unknown>;
}

/**
 * 가계부 행을 밀었을 때 드러나는 액션 — 상세 다이얼로그와 같은 뮤테이션·같은 확인 문구를
 * 쓴다. 의미 순서 그대로 [수정, 삭제] 로 돌려준다. 컴포넌트가 뒤집어 삭제를 가장 안쪽에
 * 놓으므로, 조금만 밀면 수정부터 닿는다.
 *
 * 페이지에서 떼어 둔 건 이 자리가 상세와 **같은 말을 하는지**를 페이지 전체를 세우지
 * 않고 잠그려는 것이다 — 스와이프만 옛 안내("환급돼요")를 달고 토스트도 없이 남아
 * 있었다(QA 23차 13).
 *
 * @param assets 자산 목록 — 거래의 카드가 결제가 끝난 회차인지·결제계좌가 어딘지 본다
 * @param onEdit [수정] — 상세를 닫고 수정 시트를 연다(상세 footer 의 수정과 같은 목적지)
 */
export function useExpenseSwipeActions({
  assets,
  onEdit,
}: {
  assets: Asset[];
  onEdit: (e: Expense) => void;
}): (e: Expense) => ExpenseSwipeAction[] {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const deleteExpense = useDeleteExpense();
  const notifyResult = useLedgerResultToast();

  return (e: Expense) => {
    const asset = assets.find((a) => a.rowId === e.assetRowId);
    const card = asset?.assetType === "CREDIT_CARD" ? asset : null;
    // 결제가 끝난 회차의 카드 거래면 지워도 통장은 그대로다(D1) — 상세 삭제와 같은 한 줄.
    // 서버에 묻지 않으므로 액션을 만들 때 굳는 선언형 확인창에도 그대로 실린다.
    const closedSpan = card
      ? closedCycleSpan(
          e.expenseDate,
          e.installmentMonths,
          card.cardClosedThrough,
        )
      : null;
    const name =
      e.merchant ?? e.description ?? e.categoryName ?? tc("transaction");
    // 지울 수 없는 자동 생성 거래는 밀어도 아무것도 없다
    if (!isExpenseDeletable(e)) return [];
    return [
      // 환불된 거래는 고칠 수 없다(서버 EXP_043) — 상세 footer 처럼 [수정]을 빼고
      // 삭제만 남긴다(앱 `canEdit` 과 같은 조건).
      // 시스템이 만든 거래도 [수정]은 없다(deletable 이어도 금액·날짜는 계산 결과).
      ...(isRefundedTx(e) || e.autoSource != null
        ? []
        : [
            {
              label: tc("edit"),
              icon: <Pencil />,
              kind: "primary" as const,
              onSelect: () => onEdit(e),
            },
          ]),
      {
        label: tc("delete"),
        icon: <Trash2 />,
        kind: "destructive" as const,
        confirm: {
          title: t("deleteConfirm.title"),
          // 달린 환불을 경고할 필요가 없어졌다 — 환불은 원거래에 찍는 표식이라
          // "이 거래에 달린 환불" 이 존재하지 않는다.
          message: (
            <>
              {t("txDetail.deleteMessage", { name })}
              <ClosedCycleNote span={closedSpan} />
            </>
          ),
        },
        // 지운 뒤는 상세 삭제와 같다 — 미리 낸 돈이 돌아왔으면 그 금액, 닫힌 회차였으면
        // [잔액 고치기](D4·D9).
        onSelect: async () => {
          const result = await deleteExpense.mutateAsync({
            id: e.rowId,
            silent: true,
          });
          notifyResult(result, {
            closed: closedSpan != null,
            paymentAssetRowId: card?.paymentAssetRowId ?? null,
          });
        },
      },
    ];
  };
}
