import { useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";
import { SwipeActions, type SwipeAction } from "@/shared/ds/swipe-actions";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { ExpenseRow, type Expense } from "@/entities/expense";
import type { ExpenseSwipeAction } from "@/pages/expense/lib/use-expense-swipe-actions";

/**
 * 가계부 거래 줄 — 밀면 [수정, 삭제], 줄 끝 ⋮ 로 같은 동작(I-07 6).
 *
 * 줄 자체는 `ExpenseRow` 그대로(거래 줄 공용 부품은 I-06 28 몫)이고 이 부품은 **줄을 감싸기만** 한다. 밀기와 ⋮ 는 한 배열에서
 * 나온다 — 스와이프로만 닿는 동작이 없다. 삭제는 확인창부터(`onAsk`) — 글은 상세에서 지울 때와 같다.
 * 시스템이 만든 거래(`actions` 가 빈 배열)는 밀기도 ⋮ 도 없다.
 *
 * 알림 · 검색에서 들어온 줄(`highlighted`)은 List 강조 바탕(bg-brand-weak — list.md Highlight)으로 알린다.
 */
export function ExpenseSwipeRow({
  expense,
  actions,
  rowLabel,
  highlighted,
  rowRef,
  onOpen,
  onAsk,
}: {
  expense: Expense;
  actions: ExpenseSwipeAction[];
  rowLabel: string;
  highlighted?: boolean;
  rowRef?: Ref<HTMLDivElement>;
  onOpen: (e: Expense) => void;
  onAsk: (a: ExpenseSwipeAction) => void;
}) {
  const dsActions: SwipeAction[] = actions.map((a) => ({
    label: a.label,
    icon: a.icon,
    kind: a.kind,
    onSelect: () => {
      if (a.confirm) onAsk(a);
      else void a.onSelect();
    },
  }));
  // 줄 끝 ⋮ 는 두지 않는다(10-24 사용자 결정) — 수정 · 삭제는 밀기 + 줄 누름(상세)에서. 줄 · 강조 바탕은 화면 끝까지, 금액 끝은 줄 끝 24
  const row = (
    <ExpenseRow
      gutter
      highlighted={highlighted}
      expense={expense}
      onClick={onOpen}
    />
  );
  return (
    <div ref={rowRef}>
      <SwipeActions actions={dsActions} rowLabel={rowLabel} enabled>
        {row}
      </SwipeActions>
    </div>
  );
}

/**
 * 밀기 · ⋮ 로 삭제를 누르면 뜨는 확인창 — ds Alert Dialog. 글은 상세 삭제와 같다(제목 · 설명은 hook 이 넘긴다),
 * 확인 버튼은 누른 동작의 라벨 그대로("삭제"). 요청 중에는 열린 채 로딩, 실패하면 닫고 스낵바 + [다시 시도](confirmFail).
 */
export function SwipeConfirmDialog({
  action,
  onClose,
}: {
  action: ExpenseSwipeAction | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const confirmFail = useConfirmFail();
  const [running, setRunning] = useState(false);
  return (
    <AlertDialog
      open={action != null}
      onOpenChange={(open) => {
        if (!open && !running) onClose();
      }}
    >
      {action?.confirm && (
        <AlertDialogContent>
          <AlertDialogTitle>{action.confirm.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {action.confirm.message}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="criticalSolid"
              loading={running}
              onClick={async (e) => {
                e.preventDefault();
                setRunning(true);
                try {
                  await action.onSelect();
                  onClose();
                } catch {
                  // 실패하면 확인창을 닫고 스낵바 한 문장 + [다시 시도](같은 요청을 바로) — 요청은 silent 라 서버 글은 안 뜬다
                  onClose();
                  confirmFail({
                    message: t("txDetail.deleteFailed"),
                    retry: () => action.onSelect() as Promise<unknown>,
                  });
                } finally {
                  setRunning(false);
                }
              }}
            >
              {action.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
