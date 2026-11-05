import {
  apiClient,
  silentConfig,
  type QuietRequestConfig,
  type SilentOpts,
} from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  ExpenseCategory,
  ExpenseCategoryFormValues,
} from "@/entities/expense";

export const expenseCategoryApi = {
  createCategory: async (
    data: ExpenseCategoryFormValues,
    opts?: SilentOpts,
  ): Promise<ExpenseCategory> => {
    const resp: ApiResponse<ExpenseCategory> = await apiClient.post(
      "/v1/expense/category",
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  getCategories: async (opts?: {
    silent?: boolean;
  }): Promise<ExpenseCategory[]> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<{ categories: ExpenseCategory[] }> =
      await apiClient.get("/v1/expense/categories", config);
    return resp.data.categories;
  },

  updateCategory: async (
    id: number,
    data: ExpenseCategoryFormValues,
    opts?: SilentOpts,
  ): Promise<ExpenseCategory> => {
    const resp: ApiResponse<ExpenseCategory> = await apiClient.put(
      `/v1/expense/category/${id}`,
      data,
      silentConfig(opts),
    );
    return resp.data;
  },

  deleteCategory: async (id: number, opts?: SilentOpts): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/expense/category/${id}`,
      silentConfig(opts),
    );
    return resp.data;
  },

  /**
   * 카테고리에 달린 거래를 다른 카테고리로 일괄 이동.
   * 거래가 직접 달린 카테고리는 부모가 될 수 없어 하위를 만들 수 없는데, 그걸 푸는 유일한 방법.
   */
  moveTransactions: async (
    id: number,
    targetCategoryRowId: number,
    opts?: SilentOpts,
  ): Promise<{ expenses: number; recurring: number; splits: number }> => {
    const resp: ApiResponse<{
      expenses: number;
      recurring: number;
      splits: number;
    }> = await apiClient.post(
      `/v1/expense/category/${id}/move-transactions`,
      { targetCategoryRowId },
      silentConfig(opts),
    );
    return resp.data;
  },

  /**
   * 하위 카테고리를 만들면서 이 카테고리의 거래를 그리로 옮긴다.
   * 거래가 있어 하위를 못 만들고, 옮길 하위가 없어 거래도 못 옮기는 교착을 푼다.
   */
  splitIntoChild: async (
    id: number,
    body: { childName: string; icon: string; color: string },
    opts?: SilentOpts,
  ): Promise<{ expenses: number; recurring: number; splits: number }> => {
    const resp: ApiResponse<{
      expenses: number;
      recurring: number;
      splits: number;
    }> = await apiClient.post(
      `/v1/expense/category/${id}/split-into-child`,
      body,
      silentConfig(opts),
    );
    return resp.data;
  },

  reorderCategories: async (
    items: {
      categoryRowId: number;
      sortOrder: number;
      parentRowId: number | null;
    }[],
    opts?: SilentOpts,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.patch(
      "/v1/expense/categories/reorder",
      { items },
      silentConfig(opts),
    );
    return resp.data;
  },
};
