import { useState } from "react";
import type { AssetTransfer } from "@/entities/asset";
import type { Expense } from "@/entities/expense";
import type { FilterValue } from "@/features/expense/model/filter";
import type { ExpenseSwipeAction } from "@/pages/expense/lib/use-expense-swipe-actions";

/**
 * 가계부가 연 것 · 고른 것 — 폰(ExpenseMobile) · 넓은 화면(ExpenseDesktop) 갈림 밖(ExpensePage)에서 든다.
 * 폭이 768 을 넘나들어도 열린 상세 · 수정 · 이체 상세 · 필터 시트 · 밀기 확인창과 걸어 둔 필터가 남는다(I-wrap-b1 ε 9).
 * 그리는 자리도 갈림 밖 한 곳(`ExpenseOverlays`)이다 — 상태만 올리고 두 갈래 안에서 그리면 다시 붙으며 안의 값이 빈다.
 * 고른 달은 주소의 `?month=` 가 든다(두 갈래가 같은 주소를 읽는다).
 */
export function useExpenseScreen() {
  // 상세 → 수정은 상세 안에서(넓은 화면 · 폰 같다). 폰 밀기 [수정] 은 상세 없이 바로 수정 시트(editing)
  const [detail, setDetail] = useState<Expense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [transferDetail, setTransferDetail] = useState<AssetTransfer | null>(
    null,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValue, setFilterValue] = useState<FilterValue | null>(null);
  // 밀기 · ⋮ 의 삭제 — 확인창을 기다리는 동작
  const [pendingAction, setPendingAction] = useState<ExpenseSwipeAction | null>(
    null,
  );
  return {
    detail,
    setDetail,
    editing,
    setEditing,
    transferDetail,
    setTransferDetail,
    filterOpen,
    setFilterOpen,
    filterValue,
    setFilterValue,
    pendingAction,
    setPendingAction,
  };
}

export type ExpenseScreen = ReturnType<typeof useExpenseScreen>;
