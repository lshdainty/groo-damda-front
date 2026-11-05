import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { expenseKeys, invalidateFor } from "@/shared/config";
import { expenseBudgetApi } from "../api/expenseBudgetApi";
import type { BudgetListParams, QuietOpts } from "../api/expenseBudgetApi";
import type { ExpenseBudgetFormValues } from "@/entities/expense";

export const useExpenseBudgets = (
  params: BudgetListParams,
  opts?: ReferenceOpts,
) => {
  return useQuery({
    queryKey: expenseKeys.budgets(params),
    queryFn: () => expenseBudgetApi.getBudgets(params, referenceSilent(opts)),
    enabled: params.year > 0 && params.month > 0,
    ...referenceMeta(opts),
  });
};

export const useCreateExpenseBudget = (opts?: QuietOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseBudgetFormValues) =>
      expenseBudgetApi.createBudget(data, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useUpdateExpenseBudget = (opts?: QuietOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, budgetAmount }: { id: number; budgetAmount: number }) =>
      expenseBudgetApi.updateBudget(id, { budgetAmount }, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useDeleteExpenseBudget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => expenseBudgetApi.deleteBudget(id),
    onSuccess: () => invalidateFor(queryClient, "expense-meta"),
  });
};

export const useBudgetCompliance = (months = 6) => {
  return useQuery({
    queryKey: expenseKeys.budgetCompliance(months),
    queryFn: () => expenseBudgetApi.getCompliance(months),
    enabled: months > 0,
  });
};
