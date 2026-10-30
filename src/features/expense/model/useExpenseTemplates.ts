import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseKeys, invalidateFor } from "@/shared/config";
import { expenseTemplateApi } from "../api/expenseTemplateApi";
import type { QuietOpts } from "../api/expenseTemplateApi";
import type { ExpenseTemplateFormValues } from "@/entities/expense-template";

/** `silent` — 불러오기 실패를 호출처가 직접 알릴 때(목록 화면의 실패 Result Section) 전역 서버 원문 토스트를 끈다 */
export const useExpenseTemplates = (opts?: QuietOpts) => {
  return useQuery({
    queryKey: expenseKeys.templates(),
    queryFn: () => expenseTemplateApi.getTemplates(opts),
  });
};

export const useCreateExpenseTemplate = (opts?: QuietOpts) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseTemplateFormValues) =>
      expenseTemplateApi.createTemplate(data, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-template"),
  });
};

export const useUpdateExpenseTemplate = (opts?: QuietOpts) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: ExpenseTemplateFormValues;
    }) => expenseTemplateApi.updateTemplate(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "expense-template"),
  });
};

export const useDeleteExpenseTemplate = (opts?: QuietOpts) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expenseTemplateApi.deleteTemplate(id, opts),
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
