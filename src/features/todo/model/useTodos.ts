import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isWriteUnconfirmed, type SilentOpts } from "@/shared/api";
import { useToggleFail } from "@/shared/lib/confirm-fail";
import { i18n } from "@/shared/i18n/config";
import { usePendingIds } from "@/shared/lib/groo/use-pending-ids";
import { useHoldIds } from "@/shared/lib/groo/use-hold-ids";
import { invalidateFor, todoKeys } from "@/shared/config";
import { todoApi } from "../api/todoApi";
import type { TodoListParams } from "../api/todoApi";
import type { Todo, TodoFormValues } from "@/entities/todo";

export const useTodos = (filters?: TodoListParams, opts?: ReferenceOpts) => {
  return useQuery({
    queryKey: todoKeys.list(filters),
    queryFn: () => todoApi.getTodos(filters, referenceSilent(opts)),
    ...referenceMeta(opts),
  });
};

export const useTodo = (id: number) => {
  return useQuery({
    queryKey: todoKeys.detail(id),
    queryFn: () => todoApi.getTodo(id),
    enabled: id > 0,
  });
};

export const useCreateTodo = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TodoFormValues) => todoApi.createTodo(data, opts),
    onSuccess: () => invalidateFor(queryClient, "todo"),
  });
};

export const useUpdateTodo = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TodoFormValues }) =>
      todoApi.updateTodo(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "todo"),
  });
};

export const useToggleTodoStatus = () => {
  const queryClient = useQueryClient();
  const toggleFail = useToggleFail();
  const { pendingIds, begin, end } = usePendingIds();
  // 낙관 갱신이 행을 목록에서 빼도 잠깐은 자리를 지킨다 — 자리 유지를 시작하는 자리는
  // 낙관 갱신을 하는 여기여야 화면마다 배선이 복제되지 않는다(QA #29).
  const { holdIds, hold } = useHoldIds();

  const mutation = useMutation({
    mutationFn: (id: number) => todoApi.toggleTodoStatus(id),
    onMutate: async (id: number) => {
      begin(id);
      hold(id);
      // 진행 중인 refetch 취소하여 optimistic update 덮어쓰기 방지
      await queryClient.cancelQueries({ queryKey: todoKeys.all });

      // 현재 캐시된 모든 todo list 쿼리 스냅샷 저장
      const previousQueries = queryClient.getQueriesData<Todo[]>({
        queryKey: todoKeys.all,
      });

      // 모든 todo list 캐시에서 해당 항목의 status를 즉시 토글
      queryClient.setQueriesData<Todo[]>({ queryKey: todoKeys.all }, (old) => {
        if (!old) return old;
        return old.map((todo) =>
          todo.rowId === id
            ? {
                ...todo,
                status:
                  todo.status === "COMPLETED"
                    ? ("PENDING" as const)
                    : ("COMPLETED" as const),
                completedAt:
                  todo.status === "COMPLETED" ? null : new Date().toISOString(),
              }
            : todo,
        );
      });

      return { previousQueries };
    },
    onError: (err, _id, context) => {
      // 요청이 silent 라 서버 원문 토스트가 없다 — 되돌린 자리에서 우리 글로 알린다(바로 바뀌는 값이라 다시 시도 없음)
      toggleFail(err, i18n.t("todo:toggleFailed"));
      // 응답을 못 받았으면 되돌리지 않는다 — 서버는 바꿨을 수 있다. onSettled 가 다시 받아 서버 값으로 맞춘다(판단 ②)
      if (isWriteUnconfirmed(err)) return;
      // 에러 시 이전 상태로 롤백
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: (_data, _error, id) => {
      end(id);
      invalidateFor(queryClient, "todo-status");
    },
  });
  /** pendingIds — 진행 중인 항목 id. 그 항목만 스피너·잠금(낙관 갱신과 별개로 "아직 서버 확인 전"을 보인다).
   *  holdIds — 방금 토글해 목록에서 빠질 항목 id. 잠깐 자리를 지켜, 아래 행이 올라와
   *  두 번째 탭을 대신 받는 걸 막는다. 잠금은 *같은* 행을, 자리 유지는 *다른* 행을 지킨다. */
  return { ...mutation, pendingIds, holdIds };
};

export const useReorderTodos = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: { todoId: number; sortOrder: number }[]) =>
      todoApi.reorderTodos(items),
    onSuccess: () => invalidateFor(queryClient, "todo"),
  });
};

export const useDeleteTodo = (opts?: SilentOpts) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => todoApi.deleteTodo(id, opts),
    onSuccess: () => invalidateFor(queryClient, "todo"),
  });
};

export const useSubtasks = (parentId: number) => {
  return useQuery({
    queryKey: todoKeys.subtasks(parentId),
    queryFn: () => todoApi.getSubtasks(parentId),
    enabled: parentId > 0,
  });
};

export const useUpdateTodoTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ todoId, tagIds }: { todoId: number; tagIds: number[] }) =>
      todoApi.updateTags(todoId, tagIds),
    onSuccess: () => invalidateFor(queryClient, "todo"),
  });
};

export const useToggleTodoPin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => todoApi.togglePin(id),
    onSuccess: () => invalidateFor(queryClient, "todo"),
  });
};

export const useTodoStats = () => {
  return useQuery({
    queryKey: todoKeys.stats(),
    queryFn: () => todoApi.getStats(),
  });
};
