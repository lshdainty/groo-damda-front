import { useRangeSummary } from "@/features/expense";

/** 폰 "이번 달 가계부" 안내 한 줄의 값 — 하루 평균 · 전월 대비(전월 합계는 따로 받는다) */
export function useMonthNote(year: number, month: number, expense: number) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const prevDate = new Date(year, month - 2, 1);
  const prevY = prevDate.getFullYear();
  const prevM = prevDate.getMonth() + 1;
  const prevStart = `${prevY}-${pad2(prevM)}-01`;
  const prevEnd = `${prevY}-${pad2(prevM)}-${pad2(new Date(prevY, prevM, 0).getDate())}`;
  const prevMonthlyQ = useRangeSummary(prevStart, prevEnd, undefined, {
    reference: true,
  });
  const prevExpense = prevMonthlyQ.data?.totalExpense ?? 0;

  const today = new Date();
  const isCurMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = isCurMonth ? today.getDate() : daysInMonth;
  const dailyAvg = Math.round(expense / Math.max(1, dayOfMonth));
  const savingsPct =
    prevExpense > 0 ? ((prevExpense - expense) / prevExpense) * 100 : 0;
  return { dailyAvg, prevExpense, savingsPct };
}
