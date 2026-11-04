import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  CardCatalogSummary,
  CardCatalogDetail,
  CardCatalogSearchParams,
  PageResponse,
} from "@/entities/card";

export const cardCatalogApi = {
  /** `silent` — 실패를 전역 서버 원문 토스트로 띄우지 않는다(호출처가 고정 글로 알린다) */
  search: async (
    params?: CardCatalogSearchParams,
    options?: { silent?: boolean },
  ): Promise<PageResponse<CardCatalogSummary>> => {
    const config: QuietRequestConfig = { params };
    if (options?.silent) config.silent = true;
    const resp: ApiResponse<PageResponse<CardCatalogSummary>> =
      await apiClient.get("/v1/card-catalogs", config);
    return resp.data;
  },

  getDetail: async (
    id: number,
    options?: { silent?: boolean },
  ): Promise<CardCatalogDetail> => {
    const config: QuietRequestConfig | undefined = options?.silent
      ? { silent: true }
      : undefined;
    const resp: ApiResponse<CardCatalogDetail> = await apiClient.get(
      `/v1/card-catalogs/${id}`,
      config,
    );
    return resp.data;
  },
};
