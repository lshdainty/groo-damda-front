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
import { ExpenseOverlays } from "./ExpenseOverlays";
import { useExpenseScreen } from "@/pages/expense/model/expense-screen";

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
  // 연 상세 · 시트 · 걸어 둔 필터는 갈림 밖에서 든다(I-wrap-b1 ε 9)
  const screen = useExpenseScreen();
  // 데이터가 모두 도착하면 hasEverLoaded 를 true 로 — render 중에 동기 set (React 권장 패턴).
  if (!isLoading && !hasEverLoaded) setHasEverLoaded(true);
  if (isLoading && !hasEverLoaded)
    return mobile ? (
      <ExpenseMobileSkeleton month={initialMonth} />
    ) : (
      <ExpenseDesktopSkeleton />
    );
  // 폭으로 갈리는 건 몸통뿐이다 — 시트 · 대화상자는 갈림 밖 한 자리에서 그려, 폭이 768 을 넘나들어도 열린 채 안의 값이 남는다
  return (
    <>
      {mobile ? (
        <ExpenseMobile onAddTx={onAddTx} screen={screen} />
      ) : (
        <ExpenseDesktop screen={screen} />
      )}
      <ExpenseOverlays screen={screen} mobile={mobile} />
    </>
  );
};

export default ExpensePage;
