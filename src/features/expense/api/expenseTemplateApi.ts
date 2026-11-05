import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  ExpenseTemplate,
  ExpenseTemplateFormValues,
} from "@/entities/expense-template";

/** 호출처가 실패를 직접 알릴 때 전역 오류 토스트를 끈다 */
export interface QuietOpts {
  silent?: boolean;
}

export const expenseTemplateApi = {
  getTemplates: async (opts?: QuietOpts): Promise<ExpenseTemplate[]> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<{ templates: ExpenseTemplate[] }> =
      await apiClient.get("/v1/expense-templates", config);
    return resp.data.templates;
  },

  createTemplate: async (
    data: ExpenseTemplateFormValues,
    opts?: QuietOpts,
  ): Promise<ExpenseTemplate> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<ExpenseTemplate> = await apiClient.post(
      "/v1/expense-template",
      data,
      config,
    );
    return resp.data;
  },

  updateTemplate: async (
    id: number,
    data: ExpenseTemplateFormValues,
    opts?: QuietOpts,
  ): Promise<ExpenseTemplate> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<ExpenseTemplate> = await apiClient.put(
      `/v1/expense-template/${id}`,
      data,
      config,
    );
    return resp.data;
  },

  deleteTemplate: async (id: number, opts?: QuietOpts): Promise<void> => {
    const config: QuietRequestConfig = { silent: opts?.silent };
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/expense-template/${id}`,
      config,
    );
    return resp.data;
  },

  /**
   * 프리셋을 칩으로 적용한 뒤 폼을 수정해 일반 거래로 저장한 경우,
   * 거래 저장 성공 후 이 호출로 useCount/lastUsedAt 만 갱신한다.
   */
  // 사용 기록만 올리는 뒷일이다 — 실패해도 사용자가 할 일이 없어 알림 없이 둔다(silent)
  touchTemplate: async (id: number): Promise<ExpenseTemplate> => {
    const resp: ApiResponse<ExpenseTemplate> = await apiClient.post(
      `/v1/expense-template/${id}/touch`,
      undefined,
      { silent: true } as import("axios").AxiosRequestConfig & {
        silent?: boolean;
      },
    );
    return resp.data;
  },
};
