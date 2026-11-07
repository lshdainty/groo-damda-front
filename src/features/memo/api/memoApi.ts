import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { Memo, MemoFormValues } from "@/entities/memo";

export interface MemoListParams {
  search?: string;
}

// 서버 isPinned 는 YNType('Y'/'N' 문자열) — boolean 으로 정규화 (todoApi mapTodo 패턴).
// 'N' 문자열이 truthy 로 평가돼 전부 고정으로 분류되던 버그 fix.
const mapMemo = (m: Memo): Memo => ({
  ...m,
  isPinned: (m.isPinned as unknown) === "Y" || m.isPinned === true,
});

/**
 * `silent` 는 이 요청의 실패를 호출처가 자기 자리에서 알린다는 **표식**이다(동작은 없다 — base.ts `QuietRequestConfig`) — 실패를 자기 자리
 * (폼 Callout · 스낵바)로 고정 글로 알리는 화면이 true 로 넘긴다. 전역 서버 원문 토스트는 없다.
 */
export type MemoRequestOptions = { silent?: boolean };

const quiet = (options?: MemoRequestOptions): QuietRequestConfig | undefined =>
  options?.silent ? { silent: true } : undefined;

export const memoApi = {
  createMemo: async (
    data: MemoFormValues,
    options?: MemoRequestOptions,
  ): Promise<Memo> => {
    const resp: ApiResponse<Memo> = await apiClient.post(
      "/v1/memo",
      data,
      quiet(options),
    );
    return mapMemo(resp.data);
  },

  getMemos: async (
    params?: MemoListParams,
    options?: MemoRequestOptions,
  ): Promise<Memo[]> => {
    const resp: ApiResponse<{ memos: Memo[] }> = await apiClient.get(
      "/v1/memos",
      { params, ...quiet(options) },
    );
    return resp.data.memos.map(mapMemo);
  },

  getMemo: async (id: number): Promise<Memo> => {
    const resp: ApiResponse<Memo> = await apiClient.get(`/v1/memo/${id}`);
    return mapMemo(resp.data);
  },

  updateMemo: async (
    id: number,
    data: MemoFormValues,
    options?: MemoRequestOptions,
  ): Promise<Memo> => {
    const resp: ApiResponse<Memo> = await apiClient.put(
      `/v1/memo/${id}`,
      data,
      quiet(options),
    );
    return mapMemo(resp.data);
  },

  togglePin: async (
    id: number,
    options?: MemoRequestOptions,
  ): Promise<Memo> => {
    const resp: ApiResponse<Memo> = await apiClient.patch(
      `/v1/memo/${id}/pin`,
      undefined,
      quiet(options),
    );
    return mapMemo(resp.data);
  },

  deleteMemo: async (
    id: number,
    options?: MemoRequestOptions,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/memo/${id}`,
      quiet(options),
    );
    return resp.data;
  },
};
