import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { expenseKeys } from "@/shared/config";
import { expenseApi } from "@/features/expense";
import type { ExpenseListParams } from "@/features/expense";

/**
 * 캘린더 뷰에서 가계부 데이터를 조회하는 훅
 * expense 캘린더 소스가 enabled일 때만 쿼리를 실행하여 성능 최적화
 */
export const useCalendarExpenses = (
  params: { startDate: string; endDate: string },
  enabled: boolean,
  opts?: ReferenceOpts,
) => {
  const filters: ExpenseListParams = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  return useQuery({
    queryKey: [
      ...expenseKeys.list(filters as unknown as Record<string, unknown>),
      "calendar",
    ],
    queryFn: () => expenseApi.getExpenses(filters, referenceSilent(opts)),
    enabled,
    ...referenceMeta(opts),
  });
};
