import { useSearchParams } from "react-router-dom";
import { useAssets } from "@/features/asset";
import { useExpenseCategories } from "@/features/expense";
import { monthPeriodOf } from "@/features/expense/model/filter";
import { FilterDialog } from "@/features/expense/ui/FilterDialog";
import { AddTxSheet } from "@/widgets/add-tx";
import { TransferDetailDialog } from "@/widgets/expense-detail/ui/TransferDetailDialog";
import { TxDetailDialog } from "@/widgets/expense-detail/ui/TxDetailDialog";
import { monthFromQuery } from "@/pages/expense/lib/month-query";
import type { ExpenseScreen } from "@/pages/expense/model/expense-screen";
import { SwipeConfirmDialog } from "./ExpenseSwipeRow";

/**
 * 가계부의 시트 · 대화상자 — 폰 · 넓은 화면 갈림 밖 한 자리(ExpensePage)에서 그린다(I-wrap-b1 ε 9).
 * `mobile` 은 표면 안 모양만 바꾼다(같은 부품이 남아 안의 값 · 단계가 이어진다). 표면 경계(시트 ↔ 대화상자)는 부품이 1280 으로 가른다.
 */
export function ExpenseOverlays({
  screen,
  mobile,
}: {
  screen: ExpenseScreen;
  mobile: boolean;
}) {
  const [searchParams] = useSearchParams();
  const month = monthFromQuery(searchParams.get("month"));
  const categoriesQ = useExpenseCategories({ reference: true });
  const assetsQ = useAssets({ reference: true });
  const {
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
  } = screen;
  return (
    <>
      {detail && !editing && (
        <TxDetailDialog
          expense={detail}
          mobile={mobile}
          onClose={() => setDetail(null)}
        />
      )}
      {editing && (
        <AddTxSheet
          expense={editing}
          mobile={mobile}
          onClose={() => setEditing(null)}
        />
      )}
      {transferDetail && (
        <TransferDetailDialog
          transfer={transferDetail}
          mobile={mobile}
          onClose={() => setTransferDetail(null)}
        />
      )}
      {filterOpen && (
        <FilterDialog
          initial={filterValue}
          defaultPeriod={monthPeriodOf(month)}
          categories={categoriesQ.data ?? []}
          assets={assetsQ.data?.assets ?? []}
          onClose={() => setFilterOpen(false)}
          onApply={(v) => {
            setFilterValue(v);
            setFilterOpen(false);
          }}
        />
      )}
      <SwipeConfirmDialog
        action={pendingAction}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}
