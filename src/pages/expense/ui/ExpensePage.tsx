import { useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { monthFromQuery } from "@/pages/expense/lib/month-query";
import {
  useExpenses,
  useRangeSummary,
  useExpenseCategories,
} from "@/features/expense";
import { useAssets } from "@/features/asset";
import { monthRange } from "@/pages/expense/model/ledger-data";
import { ExpenseDesktop, ExpenseDesktopSkeleton } from "./ExpenseDesktop";
import { ExpenseMobile, ExpenseMobileSkeleton } from "./ExpenseMobile";

type OutletCtx = { onAddTx: () => void; mobile: boolean };

/** Expense 페이지 진입 시 사용하는 모든 useQuery 의 isLoading 을 한곳에서 집계. */
function useExpensePageData(month: string) {
  const { startDate, endDate } = monthRange(month);
  const expensesQ = useExpenses({ startDate, endDate });
  const summaryQ = useRangeSummary(startDate, endDate);
  const categoriesQ = useExpenseCategories({ reference: true });
  const assetsQ = useAssets({ reference: true });
  return {
    isLoading:
      expensesQ.isLoading ||
      summaryQ.isLoading ||
      categoriesQ.isLoading ||
      assetsQ.isLoading,
  };
}

export const ExpensePage = () => {
  const { onAddTx, mobile } = useOutletContext<OutletCtx>();
  const [searchParams] = useSearchParams();
  const initialMonth = monthFromQuery(searchParams.get("month"));
  const { isLoading } = useExpensePageData(initialMonth);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  // 데이터가 모두 도착하면 hasEverLoaded 를 true 로 — render 중에 동기 set (React 권장 패턴).
  if (!isLoading && !hasEverLoaded) setHasEverLoaded(true);
  if (isLoading && !hasEverLoaded)
    return mobile ? (
      <ExpenseMobileSkeleton month={initialMonth} />
    ) : (
      <ExpenseDesktopSkeleton />
    );
  return mobile ? <ExpenseMobile onAddTx={onAddTx} /> : <ExpenseDesktop />;
};

export default ExpensePage;
