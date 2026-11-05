import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  ExpenseBudget,
  ExpenseBudgetFormValues,
  BudgetComplianceMonth,
} from "@/entities/expense";

export interface BudgetListParams {
  year: number;
  month: number;
}

/** 호출처가 실패를 직접 알릴 때 전역 오류 토스트를 끈다 */
export interface QuietOpts {
  silent?: boolean;
}

export const expenseBudgetApi = {
  createBudget: async (
    data: ExpenseBudgetFormValues,
    opts?: QuietOpts,
  ): Promise<ExpenseBudget> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<ExpenseBudget> = await apiClient.post(
      "/v1/expense/budget",
      data,
      config,
    );
    return resp.data;
  },

  getBudgets: async (
    params: BudgetListParams,
    opts?: QuietOpts,
  ): Promise<ExpenseBudget[]> => {
    const resp: ApiResponse<{ budgets: ExpenseBudget[] }> = await apiClient.get(
      "/v1/expense/budgets",
      { params, silent: opts?.silent } as import("axios").AxiosRequestConfig & {
        silent?: boolean;
      },
    );
    return resp.data.budgets;
  },

  updateBudget: async (
    id: number,
    data: { budgetAmount: number },
    opts?: QuietOpts,
  ): Promise<ExpenseBudget> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<ExpenseBudget> = await apiClient.put(
      `/v1/expense/budget/${id}`,
      data,
      config,
    );
    return resp.data;
  },

  deleteBudget: async (id: number): Promise<void> => {
    // silent — 호출처(BudgetManager)가 실패를 자기 스낵바("…하지 못했어요 + 다시 시도")로 알린다. 서버 원문 전역 토스트를 겹치지 않는다
    const config: QuietRequestConfig = { silent: true };
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/expense/budget/${id}`,
      config,
    );
    return resp.data;
  },

  getCompliance: async (months = 6): Promise<BudgetComplianceMonth[]> => {
    const resp: ApiResponse<{ months: BudgetComplianceMonth[] }> =
      await apiClient.get("/v1/expense/budgets/compliance", {
        params: { months },
      });
    return resp.data.months;
  },
};
