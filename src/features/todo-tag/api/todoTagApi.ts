import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { TodoTag, TodoTagFormValues } from "@/entities/todo-tag";

/** `silent` 는 호출처가 고른다 — 실패를 자기 자리(폼 Callout · 스낵바)에서 고정 글로 알리는 화면만 true */
export type TodoTagRequestOptions = { silent?: boolean };

const quiet = (
  options?: TodoTagRequestOptions,
): QuietRequestConfig | undefined =>
  options?.silent ? { silent: true } : undefined;

export const todoTagApi = {
  createTag: async (
    data: TodoTagFormValues,
    options?: TodoTagRequestOptions,
  ): Promise<TodoTag> => {
    const resp: ApiResponse<TodoTag> = await apiClient.post(
      "/v1/todo-tag",
      data,
      quiet(options),
    );
    return resp.data;
  },

  getTags: async (options?: TodoTagRequestOptions): Promise<TodoTag[]> => {
    const resp: ApiResponse<{ tags: TodoTag[] }> = await apiClient.get(
      "/v1/todo-tags",
      quiet(options),
    );
    return resp.data.tags;
  },

  updateTag: async (
    id: number,
    data: TodoTagFormValues,
    options?: TodoTagRequestOptions,
  ): Promise<TodoTag> => {
    const resp: ApiResponse<TodoTag> = await apiClient.put(
      `/v1/todo-tag/${id}`,
      data,
      quiet(options),
    );
    return resp.data;
  },

  deleteTag: async (
    id: number,
    options?: TodoTagRequestOptions,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/todo-tag/${id}`,
      quiet(options),
    );
    return resp.data;
  },
};
