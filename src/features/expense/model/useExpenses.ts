import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseKeys, invalidateFor } from "@/shared/config";
import {
  isHttpStatus,
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { expenseApi } from "../api/expenseApi";
import type { ExpenseListParams, ExpenseSearchParams } from "../api/expenseApi";
import type { ExpenseFormValues } from "@/entities/expense";

/** `silent` — 실패를 호출처 화면이 자기 자리에서 말할 때 서버 원문 토스트를 끈다 */
export const useExpenses = (
  filters?: ExpenseListParams,
  opts?: ReferenceOpts,
) => {
  return useQuery({
    queryKey: expenseKeys.list(filters),
    queryFn: () => expenseApi.getExpenses(filters, referenceSilent(opts)),
    ...referenceMeta(opts),
  });
};

export const useCreateExpense = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseFormValues) =>
      expenseApi.createExpense(data, opts),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

/**
 * 고정 표식 일괄 변경. 합계가 아니라 분류가 바뀌지만 통계(고정/변동)·목록이 모두 달라지므로
 * 다른 거래 변경과 같은 범위(`"ledger"`)로 턴다.
 */
export const useBulkMarkFixed = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ids,
      isFixed,
      silent,
    }: {
      ids: number[];
      isFixed: boolean;
      /** 실패를 호출처가 자기 스낵바로 알리면 true — 기본(생략)은 전역 오류 토스트 */
      silent?: boolean;
    }) => expenseApi.bulkMarkFixed(ids, isFixed, { silent }),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

export const useUpdateExpense = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseFormValues }) =>
      expenseApi.updateExpense(id, data, opts),
    // 다시 받기를 기다린 뒤 호출처 콜백이 불린다 — 저장 · 삭제 · 환불 뒤 상세가 옛 값을 보이거나 지운 거래의 버튼이 남지 않게
    onSuccess: () => invalidateFor(queryClient, "ledger", { wait: true }),
  });
};

/**
 * 환불 마크·취소.
 *
 * 무효화 범위가 이 훅의 핵심이다. 환불은 **원거래 달**의 합계를 바꾼다 — 오늘 누른
 * 환불이 지난달 지출을 줄인다. 그래서 이 거래의 달만 털면 안 되고, 다른 거래 변경과
 * 같은 범위(`"ledger"`)로 통째로 턴다. 카드였다면 **잔액·이체까지 움직이므로**
 * 자산 쪽도 함께 무효화되는 그 범위가 맞다.
 */
export const useRefundExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      refundedAt,
      silent,
    }: {
      id: number;
      refundedAt?: string;
      /** 실패를 호출처가 자기 자리에서 알리면 true — 기본(생략)은 전역 오류 토스트 */
      silent?: boolean;
    }) => expenseApi.refund(id, refundedAt, { silent }),
    // 다시 받기를 기다린 뒤 호출처 콜백이 불린다 — 저장 · 삭제 · 환불 뒤 상세가 옛 값을 보이거나 지운 거래의 버튼이 남지 않게
    onSuccess: () => invalidateFor(queryClient, "ledger", { wait: true }),
  });
};

export const useCancelRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, silent }: { id: number; silent?: boolean }) =>
      expenseApi.cancelRefund(id, { silent }),
    // 다시 받기를 기다린 뒤 호출처 콜백이 불린다 — 저장 · 삭제 · 환불 뒤 상세가 옛 값을 보이거나 지운 거래의 버튼이 남지 않게
    onSuccess: () => invalidateFor(queryClient, "ledger", { wait: true }),
  });
};

/**
 * 고쳐 쓰기 — 잠긴 거래를 새 거래로 교체한다(D13). 옛 거래가 사라지고 새 거래가 생기므로
 * 거래 CRUD 와 같은 범위(`"ledger"`)를 턴다 — 카드 청구·잔액·분할·더치페이가 함께 움직인다.
 */
export const useReplaceExpense = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseFormValues }) =>
      expenseApi.replaceExpense(id, data, opts),
    // 성공했을 때와 **404** 일 때 턴다. 404 는 옛 거래가 이미 없다는 뜻이다 — 응답만 못
    // 받은 채 다시 눌렀으면 교체는 앞선 요청에서 끝났다(다른 기기에서 지웠어도 같다). 안
    // 털면 목록에 사라진 옛 행이 남아 보인다(QA 26차 5). 그 밖의 실패는 서버가 아무것도
    // 안 바꿨으므로 그대로 둔다.
    onSettled: (_data, error) => {
      if (error == null || isHttpStatus(error, 404)) {
        invalidateFor(queryClient, "ledger");
      }
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // 숫자 하나(밀기 삭제 등 기존 호출처)나 { id, silent } — 실패를 호출처가 알리면 silent
    mutationFn: (arg: number | { id: number; silent?: boolean }) =>
      typeof arg === "number"
        ? expenseApi.deleteExpense(arg)
        : expenseApi.deleteExpense(arg.id, { silent: arg.silent }),
    // 다시 받기를 기다린 뒤 호출처 콜백이 불린다 — 저장 · 삭제 · 환불 뒤 상세가 옛 값을 보이거나 지운 거래의 버튼이 남지 않게
    onSuccess: () => invalidateFor(queryClient, "ledger", { wait: true }),
  });
};

/** 고른 거래를 한 번에 지운다. 단건 삭제와 같은 범위(`"ledger"`)를 턴다 — 카드 청구 · 잔액 · 목록 · 요약이 함께 움직인다 */
export const useBulkDeleteExpenses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => expenseApi.bulkDeleteExpenses(ids),
    onSuccess: () => invalidateFor(queryClient, "ledger"),
  });
};

export const useRangeSummary = (
  startDate: string,
  endDate: string,
  assetId?: number | null,
  opts?: ReferenceOpts,
) => {
  return useQuery({
    queryKey: expenseKeys.rangeSummary(startDate, endDate, assetId),
    queryFn: () =>
      expenseApi.getRangeSummary(
        startDate,
        endDate,
        assetId,
        referenceSilent(opts),
      ),
    enabled: !!startDate && !!endDate,
    ...referenceMeta(opts),
  });
};

export const useMonthlyTrend = (months = 6) => {
  return useQuery({
    queryKey: expenseKeys.monthlyTrend(months),
    queryFn: () => expenseApi.getMonthlyTrend(months),
    enabled: months > 0,
  });
};

export const useMerchantSummary = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: expenseKeys.merchantSummary({ startDate, endDate }),
    queryFn: () => expenseApi.getMerchantSummary(startDate, endDate),
  });
};

export const useExpenseHeatmap = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: expenseKeys.heatmap(startDate, endDate),
    queryFn: () => expenseApi.getHeatmap(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
};

export const useSearchExpenses = (
  params: ExpenseSearchParams,
  opts?: { silent?: boolean },
) => {
  return useQuery({
    queryKey: expenseKeys.search(params),
    queryFn: () => expenseApi.searchExpenses(params, opts),
    enabled: Object.values(params).some((v) => v !== undefined && v !== ""),
  });
};
