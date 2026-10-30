import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateFor, recurringTransactionKeys } from "@/shared/config";
import { recurringTransactionApi } from "../api/recurringTransactionApi";
import type { RecurringTransactionFormValues } from "@/entities/recurring-transaction";

export const useRecurringTransactions = (
  params?: {
    upcoming?: boolean;
    limit?: number;
  },
  options?: { silent?: boolean },
) => {
  return useQuery({
    queryKey: recurringTransactionKeys.list(params),
    queryFn: async () => {
      const response = await recurringTransactionApi.getRecurrings(
        params,
        options,
      );
      return response.recurringTransactions;
    },
  });
};

type Options = { silent?: boolean };

export const useCreateRecurringTransaction = (options?: Options) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecurringTransactionFormValues) =>
      recurringTransactionApi.createRecurring(data, options),
    onSuccess: () => invalidateFor(queryClient, "recurring-transaction"),
  });
};

export const useUpdateRecurringTransaction = (options?: Options) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: RecurringTransactionFormValues;
    }) => recurringTransactionApi.updateRecurring(id, data, options),
    onSuccess: () => invalidateFor(queryClient, "recurring-transaction"),
  });
};

export const useDeleteRecurringTransaction = (options?: Options) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      recurringTransactionApi.deleteRecurring(id, options),
    onSuccess: () => invalidateFor(queryClient, "recurring-transaction"),
  });
};

export const useToggleRecurringTransaction = (options?: Options) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      recurringTransactionApi.toggleActive(id, options),
    onSuccess: () => invalidateFor(queryClient, "recurring-transaction"),
  });
};
