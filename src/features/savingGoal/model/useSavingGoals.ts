import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateFor, savingGoalKeys } from "@/shared/config";
import type { SilentOpts } from "@/shared/api";
import { savingGoalApi } from "../api/savingGoalApi";
import type {
  SavingGoalFormValues,
  SavingGoalUpdateFormValues,
  SavingGoalContributeValues,
  SavingGoalReorderItem,
} from "@/entities/savingGoal";

export const useSavingGoals = () => {
  return useQuery({
    queryKey: savingGoalKeys.list(),
    queryFn: () => savingGoalApi.getSavingGoals(),
  });
};

export const useSavingGoal = (id: number) => {
  return useQuery({
    queryKey: savingGoalKeys.detail(id),
    queryFn: () => savingGoalApi.getSavingGoal(id),
    enabled: id > 0,
  });
};

export const useCreateSavingGoal = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SavingGoalFormValues) =>
      savingGoalApi.createSavingGoal(data, opts),
    onSuccess: () => invalidateFor(queryClient, "saving-goal"),
  });
};

export const useUpdateSavingGoal = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: SavingGoalUpdateFormValues;
    }) => savingGoalApi.updateSavingGoal(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "saving-goal"),
  });
};

export const useContributeSavingGoal = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: SavingGoalContributeValues;
    }) => savingGoalApi.contributeSavingGoal(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "saving-goal"),
  });
};

export const useDeleteSavingGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => savingGoalApi.deleteSavingGoal(id),
    onSuccess: () => invalidateFor(queryClient, "saving-goal"),
  });
};

export const useReorderSavingGoals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: SavingGoalReorderItem[]) =>
      savingGoalApi.reorderSavingGoals(items),
    onSuccess: () => invalidateFor(queryClient, "saving-goal"),
  });
};
