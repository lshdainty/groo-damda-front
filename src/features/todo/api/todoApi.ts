import {
  apiClient,
  silentConfig,
  type QuietRequestConfig,
  type SilentOpts,
} from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { Todo, TodoFormValues, TodoStats } from "@/entities/todo";

export interface TodoListParams {
  status?: string;
  priority?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

// API 응답의 isPinned("Y"/"N")를 boolean으로 변환
const mapTodo = (todo: Todo): Todo => ({
  ...todo,
  isPinned: (todo.isPinned as unknown as string) === "Y",
});

export const todoApi = {
  createTodo: async (
    data: TodoFormValues,
    opts?: SilentOpts,
  ): Promise<Todo> => {
    const resp: ApiResponse<Todo> = await apiClient.post(
      "/v1/todo",
      data,
      silentConfig(opts),
    );
    return mapTodo(resp.data);
  },

  getTodos: async (
    params?: TodoListParams,
    opts?: SilentOpts,
  ): Promise<Todo[]> => {
    const resp: ApiResponse<{ todos: Todo[] }> = await apiClient.get(
      "/v1/todos",
      { params, ...silentConfig(opts) },
    );
    return resp.data.todos.map(mapTodo);
  },

  getTodo: async (id: number): Promise<Todo> => {
    const resp: ApiResponse<Todo> = await apiClient.get(`/v1/todo/${id}`);
    return mapTodo(resp.data);
  },

  updateTodo: async (
    id: number,
    data: TodoFormValues,
    opts?: SilentOpts,
  ): Promise<Todo> => {
    const resp: ApiResponse<Todo> = await apiClient.put(
      `/v1/todo/${id}`,
      data,
      silentConfig(opts),
    );
    return mapTodo(resp.data);
  },

  toggleTodoStatus: async (id: number): Promise<Todo> => {
    // silent — 실패는 훅이 되돌리고 자기 글로 알린다(서버 원문 토스트를 띄우지 않는다)
    const config: QuietRequestConfig = { silent: true };
    const resp: ApiResponse<Todo> = await apiClient.patch(
      `/v1/todo/${id}/status`,
      undefined,
      config,
    );
    return mapTodo(resp.data);
  },

  reorderTodos: async (
    items: { todoId: number; sortOrder: number }[],
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.patch("/v1/todos/reorder", {
      items,
    });
    return resp.data;
  },

  deleteTodo: async (id: number, opts?: SilentOpts): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/todo/${id}`,
      silentConfig(opts),
    );
    return resp.data;
  },

  getSubtasks: async (parentId: number): Promise<Todo[]> => {
    const resp: ApiResponse<{ todos: Todo[] }> = await apiClient.get(
      `/v1/todo/${parentId}/subtasks`,
    );
    return resp.data.todos.map(mapTodo);
  },

  updateTags: async (todoId: number, tagIds: number[]): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.patch(
      `/v1/todo/${todoId}/tags`,
      { tagIds },
    );
    return resp.data;
  },

  togglePin: async (id: number): Promise<Todo> => {
    const resp: ApiResponse<Todo> = await apiClient.patch(`/v1/todo/${id}/pin`);
    return mapTodo(resp.data);
  },

  getStats: async (): Promise<TodoStats> => {
    const resp: ApiResponse<TodoStats> = await apiClient.get("/v1/todos/stats");
    return resp.data;
  },
};
