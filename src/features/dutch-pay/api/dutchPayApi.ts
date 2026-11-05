import type { QuietRequestConfig } from "@/shared/api";
import { apiClient } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { DutchPay, DutchPayFormValues } from "@/entities/dutch-pay";

export const dutchPayApi = {
  createDutchPay: async (
    data: DutchPayFormValues,
    opts?: { silent?: boolean },
  ): Promise<DutchPay> => {
    const resp: ApiResponse<DutchPay> = await apiClient.post(
      "/v1/dutch-pay",
      data,
      { silent: opts?.silent } as QuietRequestConfig,
    );
    return resp.data;
  },

  getDutchPays: async (): Promise<DutchPay[]> => {
    const resp: ApiResponse<{ dutchPays: DutchPay[] }> =
      await apiClient.get("/v1/dutch-pays");
    return resp.data.dutchPays;
  },

  getDutchPay: async (id: number): Promise<DutchPay> => {
    const resp: ApiResponse<DutchPay> = await apiClient.get(
      `/v1/dutch-pay/${id}`,
    );
    return resp.data;
  },

  updateDutchPay: async (
    id: number,
    data: DutchPayFormValues,
  ): Promise<DutchPay> => {
    const resp: ApiResponse<DutchPay> = await apiClient.put(
      `/v1/dutch-pay/${id}`,
      data,
    );
    return resp.data;
  },

  deleteDutchPay: async (id: number): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/dutch-pay/${id}`,
    );
    return resp.data;
  },

  markParticipantPaid: async (
    dutchPayId: number,
    participantId: number,
  ): Promise<DutchPay> => {
    const resp: ApiResponse<DutchPay> = await apiClient.patch(
      `/v1/dutch-pay/${dutchPayId}/participant/${participantId}/paid`,
    );
    return resp.data;
  },

  settleAll: async (id: number): Promise<DutchPay> => {
    const resp: ApiResponse<DutchPay> = await apiClient.patch(
      `/v1/dutch-pay/${id}/settle`,
    );
    return resp.data;
  },
};
