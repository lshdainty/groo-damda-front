import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateFor, todoTagKeys } from "@/shared/config";
import { todoTagApi } from "../api/todoTagApi";
import type { TodoTagRequestOptions } from "../api/todoTagApi";
import type { TodoTagFormValues } from "@/entities/todo-tag";

/** `options.silent` — 불러오기 실패를 화면 안 Result Section 이 말한다(전역 서버 원문 토스트를 띄우지 않는다) */
export const useTodoTags = (options?: TodoTagRequestOptions) => {
  return useQuery({
    queryKey: todoTagKeys.list(),
    queryFn: () => todoTagApi.getTags(options),
  });
};

export const useCreateTodoTag = (options?: TodoTagRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TodoTagFormValues) =>
      todoTagApi.createTag(data, options),
    onSuccess: () => invalidateFor(queryClient, "todo-tag", { wait: true }),
  });
};

export const useUpdateTodoTag = (options?: TodoTagRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TodoTagFormValues }) =>
      todoTagApi.updateTag(id, data, options),
    onSuccess: () =>
      invalidateFor(queryClient, "todo-tag-usage", { wait: true }),
  });
};

export const useDeleteTodoTag = (options?: TodoTagRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => todoTagApi.deleteTag(id, options),
    onSuccess: () =>
      invalidateFor(queryClient, "todo-tag-usage", { wait: true }),
  });
};
