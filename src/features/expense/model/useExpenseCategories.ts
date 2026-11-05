import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SilentOpts } from "@/shared/api";
import { expenseKeys, invalidateFor } from "@/shared/config";
import { expenseCategoryApi } from "../api/expenseCategoryApi";
import type {
  ExpenseCategory,
  ExpenseCategoryFormValues,
} from "@/entities/expense";

type ReorderItem = {
  categoryRowId: number;
  sortOrder: number;
  parentRowId: number | null;
};

/** `silent` — 불러오기 실패를 호출처가 직접 알릴 때(실패 Result Section) 전역 서버 원문 토스트를 끈다 */
export const useExpenseCategories = (opts?: { silent?: boolean }) => {
  return useQuery({
    queryKey: expenseKeys.categories(),
    queryFn: () => expenseCategoryApi.getCategories(opts),
  });
};

export const useCreateExpenseCategory = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseCategoryFormValues) =>
      expenseCategoryApi.createCategory(data, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useUpdateExpenseCategory = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: ExpenseCategoryFormValues;
    }) => expenseCategoryApi.updateCategory(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useDeleteExpenseCategory = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => expenseCategoryApi.deleteCategory(id, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useMoveCategoryTransactions = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      targetCategoryRowId,
    }: {
      id: number;
      targetCategoryRowId: number;
    }) => expenseCategoryApi.moveTransactions(id, targetCategoryRowId, opts),
    // 분류만 손대는 게 아니라 거래의 분류가 실제로 바뀐다 — 목록·통계가 함께 늙으므로
    // 분류 목록만 비우는 좁은 이름을 쓰지 않는다.
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useSplitCategoryIntoChild = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
      childName: string;
      icon: string;
      color: string;
    }) => expenseCategoryApi.splitIntoChild(id, body, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useReorderExpenseCategories = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: ReorderItem[]) =>
      expenseCategoryApi.reorderCategories(items, opts),
    // 낙관적 업데이트: 드롭 즉시 캐시 순서를 갱신해 네트워크 왕복을 기다리지 않게 한다.
    onMutate: async (items: ReorderItem[]) => {
      await queryClient.cancelQueries({ queryKey: expenseKeys.categories() });
      const prev = queryClient.getQueryData<ExpenseCategory[]>(
        expenseKeys.categories(),
      );
      if (prev) {
        const patch = new Map(items.map((i) => [i.categoryRowId, i]));
        queryClient.setQueryData<ExpenseCategory[]>(
          expenseKeys.categories(),
          prev.map((c) => {
            const m = patch.get(c.rowId);
            return m
              ? { ...c, sortOrder: m.sortOrder, parentRowId: m.parentRowId }
              : c;
          }),
        );
      }
      return { prev };
    },
    onError: (_err, _items, ctx) => {
      // 실패 시 이전 순서로 롤백 (안내는 호출처가 silent 로 부르고 스낵바로 한다).
      if (ctx?.prev)
        queryClient.setQueryData(expenseKeys.categories(), ctx.prev);
    },
    onSettled: () => invalidateFor(queryClient, "expense-category-order"),
  });
};
