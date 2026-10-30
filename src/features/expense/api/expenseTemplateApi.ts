import { apiClient } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  ExpenseTemplate,
  ExpenseTemplateFormValues,
} from "@/entities/expense-template";

export const expenseTemplateApi = {
  getTemplates: async (): Promise<ExpenseTemplate[]> => {
    const resp: ApiResponse<{ templates: ExpenseTemplate[] }> =
      await apiClient.get("/v1/expense-templates");
    return resp.data.templates;
  },

  createTemplate: async (
    data: ExpenseTemplateFormValues,
    opts?: { silent?: boolean },
  ): Promise<ExpenseTemplate> => {
    const resp: ApiResponse<ExpenseTemplate> = await apiClient.post(
      "/v1/expense-template",
      data,
      { silent: opts?.silent } as import("axios").AxiosRequestConfig & {
        silent?: boolean;
      },
    );
    return resp.data;
  },

  updateTemplate: async (
    id: number,
    data: ExpenseTemplateFormValues,
  ): Promise<ExpenseTemplate> => {
    const resp: ApiResponse<ExpenseTemplate> = await apiClient.put(
      `/v1/expense-template/${id}`,
      data,
    );
    return resp.data;
  },

  deleteTemplate: async (id: number): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/expense-template/${id}`,
    );
    return resp.data;
  },

  /**
   * 프리셋을 칩으로 적용한 뒤 폼을 수정해 일반 거래로 저장한 경우,
   * 거래 저장 성공 후 이 호출로 useCount/lastUsedAt 만 갱신한다.
   */
  touchTemplate: async (id: number): Promise<ExpenseTemplate> => {
    const resp: ApiResponse<ExpenseTemplate> = await apiClient.post(
      `/v1/expense-template/${id}/touch`,
    );
    return resp.data;
  },
};
