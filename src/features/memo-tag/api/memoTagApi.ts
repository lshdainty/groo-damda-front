import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { MemoTag, MemoTagFormValues } from "@/entities/memo-tag";

// 경로·본문·응답이 `/todo-tag` 와 같은 모양이다(서버 MemoTagApiController 주석).
// 설정 화면이 두 태그를 나란히 놓으므로 클라이언트도 갈라 둘 이유가 없다.
/** `silent` 는 호출처가 고른다 — 실패를 자기 자리(폼 Callout · 스낵바)에서 고정 글로 알리는 화면만 true */
export type MemoTagRequestOptions = { silent?: boolean };

const quiet = (
  options?: MemoTagRequestOptions,
): QuietRequestConfig | undefined =>
  options?.silent ? { silent: true } : undefined;

export const memoTagApi = {
  createTag: async (
    data: MemoTagFormValues,
    options?: MemoTagRequestOptions,
  ): Promise<MemoTag> => {
    const resp: ApiResponse<MemoTag> = await apiClient.post(
      "/v1/memo-tag",
      data,
      quiet(options),
    );
    return resp.data;
  },

  getTags: async (options?: MemoTagRequestOptions): Promise<MemoTag[]> => {
    const resp: ApiResponse<{ tags: MemoTag[] }> = await apiClient.get(
      "/v1/memo-tags",
      quiet(options),
    );
    return resp.data.tags;
  },

  updateTag: async (
    id: number,
    data: MemoTagFormValues,
    options?: MemoTagRequestOptions,
  ): Promise<MemoTag> => {
    const resp: ApiResponse<MemoTag> = await apiClient.put(
      `/v1/memo-tag/${id}`,
      data,
      quiet(options),
    );
    return resp.data;
  },

  deleteTag: async (
    id: number,
    options?: MemoTagRequestOptions,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/memo-tag/${id}`,
      quiet(options),
    );
    return resp.data;
  },
};
