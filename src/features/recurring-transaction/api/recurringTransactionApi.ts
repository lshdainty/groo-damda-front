import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  RecurringTransaction,
  RecurringTransactionFormValues,
} from "@/entities/recurring-transaction";

/** `silent` — 실패를 호출처가 자기 글로 알린다(서버 원문 전역 토스트를 끈다) */
type ApiOptions = { silent?: boolean };
const quiet = (o?: ApiOptions): QuietRequestConfig | undefined =>
  o?.silent ? { silent: true } : undefined;

export const recurringTransactionApi = {
  createRecurring: async (
    data: RecurringTransactionFormValues,
    options?: ApiOptions,
  ): Promise<RecurringTransaction> => {
    const resp: ApiResponse<RecurringTransaction> = await apiClient.post(
      "/v1/recurring-transaction",
      data,
      quiet(options),
    );
    return resp.data;
  },

  getRecurrings: async (
    params?: {
      upcoming?: boolean;
      limit?: number;
    },
    options?: ApiOptions,
  ): Promise<{ recurringTransactions: RecurringTransaction[] }> => {
    const q: Record<string, string> = {};
    if (params?.upcoming) q.upcoming = "true";
    if (params?.limit) q.limit = String(params.limit);
    const resp: ApiResponse<{ recurringTransactions: RecurringTransaction[] }> =
      await apiClient.get("/v1/recurring-transactions", {
        params: q,
        ...quiet(options),
      });
    return resp.data;
  },

  updateRecurring: async (
    id: number,
    data: RecurringTransactionFormValues,
    options?: ApiOptions,
  ): Promise<RecurringTransaction> => {
    const resp: ApiResponse<RecurringTransaction> = await apiClient.put(
      `/v1/recurring-transaction/${id}`,
      data,
      quiet(options),
    );
    return resp.data;
  },

  deleteRecurring: async (id: number, options?: ApiOptions): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/recurring-transaction/${id}`,
      quiet(options),
    );
    return resp.data;
  },

  toggleActive: async (
    id: number,
    options?: ApiOptions,
  ): Promise<RecurringTransaction> => {
    const resp: ApiResponse<RecurringTransaction> = await apiClient.patch(
      `/v1/recurring-transaction/${id}/toggle`,
      undefined,
      quiet(options),
    );
    return resp.data;
  },
};
