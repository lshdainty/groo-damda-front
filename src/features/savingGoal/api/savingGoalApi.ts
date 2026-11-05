import {
  apiClient,
  silentConfig,
  type QuietRequestConfig,
  type SilentOpts,
} from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  SavingGoal,
  SavingGoalFormValues,
  SavingGoalUpdateFormValues,
  SavingGoalContributeValues,
  SavingGoalReorderItem,
} from "@/entities/savingGoal";

export const savingGoalApi = {
  createSavingGoal: async (
    data: SavingGoalFormValues,
    opts?: SilentOpts,
  ): Promise<SavingGoal> => {
    const resp: ApiResponse<SavingGoal> = await apiClient.post(
      "/v1/saving-goal",
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  getSavingGoals: async (): Promise<{ goals: SavingGoal[] }> => {
    const resp: ApiResponse<{ goals: SavingGoal[] }> =
      await apiClient.get("/v1/saving-goals");
    return resp.data;
  },

  getSavingGoal: async (id: number): Promise<SavingGoal> => {
    const resp: ApiResponse<SavingGoal> = await apiClient.get(
      `/v1/saving-goal/${id}`,
    );
    return resp.data;
  },

  updateSavingGoal: async (
    id: number,
    data: SavingGoalUpdateFormValues,
    opts?: SilentOpts,
  ): Promise<SavingGoal> => {
    const resp: ApiResponse<SavingGoal> = await apiClient.put(
      `/v1/saving-goal/${id}`,
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  contributeSavingGoal: async (
    id: number,
    data: SavingGoalContributeValues,
    opts?: SilentOpts,
  ): Promise<SavingGoal> => {
    const resp: ApiResponse<SavingGoal> = await apiClient.patch(
      `/v1/saving-goal/${id}/contribute`,
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  deleteSavingGoal: async (id: number): Promise<void> => {
    // silent — 호출처(SavingGoalManager)가 실패를 자기 스낵바로 알린다. 서버 원문 전역 토스트를 겹치지 않는다
    const config: QuietRequestConfig = { silent: true };
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/saving-goal/${id}`,
      config,
    );
    return resp.data;
  },

  reorderSavingGoals: async (items: SavingGoalReorderItem[]): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.patch(
      "/v1/saving-goals/reorder",
      { items },
    );
    return resp.data;
  },
};
