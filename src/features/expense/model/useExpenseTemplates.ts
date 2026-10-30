import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseKeys, invalidateFor } from "@/shared/config";
import { expenseTemplateApi } from "../api/expenseTemplateApi";
import type { ExpenseTemplateFormValues } from "@/entities/expense-template";

export const useExpenseTemplates = () => {
  return useQuery({
    queryKey: expenseKeys.templates(),
    queryFn: () => expenseTemplateApi.getTemplates(),
  });
};

export const useCreateExpenseTemplate = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseTemplateFormValues) =>
      expenseTemplateApi.createTemplate(data, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-template"),
  });
};

export const useUpdateExpenseTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: ExpenseTemplateFormValues;
    }) => expenseTemplateApi.updateTemplate(id, data),
    onSuccess: () => invalidateFor(queryClient, "expense-template"),
  });
};

export const useDeleteExpenseTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expenseTemplateApi.deleteTemplate(id),
    onSuccess: () => invalidateFor(queryClient, "expense-template"),
  });
};

export const useTouchExpenseTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expenseTemplateApi.touchTemplate(id),
    onSuccess: () => invalidateFor(queryClient, "expense-template"),
  });
};
