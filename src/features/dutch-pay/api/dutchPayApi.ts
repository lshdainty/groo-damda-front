import type { QuietRequestConfig } from "@/shared/api";
import { apiClient } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { DutchPay, DutchPayFormValues } from "@/entities/dutch-pay";

/** `silent` 는 호출처가 고른다 — 실패를 화면 안 고정 글(스낵바 · Callout · Result Section)로 알리는 곳만 true */
type Opts = { silent?: boolean };
const quiet = (o?: Opts): QuietRequestConfig | undefined =>
  o?.silent ? ({ silent: true } as QuietRequestConfig) : undefined;

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

  getDutchPays: async (opts?: Opts): Promise<DutchPay[]> => {
    const resp: ApiResponse<{ dutchPays: DutchPay[] }> = await apiClient.get(
      "/v1/dutch-pays",
      quiet(opts),
    );
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

  deleteDutchPay: async (id: number, opts?: Opts): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/dutch-pay/${id}`,
      quiet(opts),
    );
    return resp.data;
  },

  markParticipantPaid: async (
    dutchPayId: number,
    participantId: number,
    opts?: Opts,
  ): Promise<DutchPay> => {
    const resp: ApiResponse<DutchPay> = await apiClient.patch(
      `/v1/dutch-pay/${dutchPayId}/participant/${participantId}/paid`,
      undefined,
      quiet(opts),
    );
    return resp.data;
  },

  settleAll: async (id: number, opts?: Opts): Promise<DutchPay> => {
    const resp: ApiResponse<DutchPay> = await apiClient.patch(
      `/v1/dutch-pay/${id}/settle`,
      undefined,
      quiet(opts),
    );
    return resp.data;
  },
};
