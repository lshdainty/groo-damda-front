import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePendingIds } from "@/shared/lib/groo/use-pending-ids";
import { invalidateFor, memoKeys } from "@/shared/config";
import { memoApi } from "../api/memoApi";
import type { MemoListParams, MemoRequestOptions } from "../api/memoApi";
import type { MemoFormValues } from "@/entities/memo";

/** `options.silent` — 불러오기 실패를 화면 안 Result Section 이 말하므로 전역 서버 원문 토스트를 띄우지 않는다 */
export const useMemos = (
  filters?: MemoListParams,
  options?: MemoRequestOptions,
) => {
  return useQuery({
    queryKey: memoKeys.list(filters),
    queryFn: () => memoApi.getMemos(filters, options),
  });
};

export const useMemo = (id: number) => {
  return useQuery({
    queryKey: memoKeys.detail(id),
    queryFn: () => memoApi.getMemo(id),
    enabled: id > 0,
  });
};

export const useCreateMemo = (options?: MemoRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MemoFormValues) => memoApi.createMemo(data, options),
    onSuccess: () => invalidateFor(queryClient, "memo", { wait: true }),
  });
};

export const useUpdateMemo = (options?: MemoRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MemoFormValues }) =>
      memoApi.updateMemo(id, data, options),
    onSuccess: () => invalidateFor(queryClient, "memo", { wait: true }),
  });
};

export const useToggleMemoPin = (options?: MemoRequestOptions) => {
  const queryClient = useQueryClient();
  const { pendingIds, begin, end } = usePendingIds();

  const mutation = useMutation({
    mutationFn: (id: number) => memoApi.togglePin(id, options),
    onMutate: (id: number) => begin(id),
    onSettled: (_data, _error, id) => end(id),
    onSuccess: () => invalidateFor(queryClient, "memo", { wait: true }),
  });
  /** 진행 중인 항목 id — 그 항목만 스피너·잠금. */
  return { ...mutation, pendingIds };
};

export const useDeleteMemo = (options?: MemoRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => memoApi.deleteMemo(id, options),
    onSuccess: () => invalidateFor(queryClient, "memo", { wait: true }),
  });
};
