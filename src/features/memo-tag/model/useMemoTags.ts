import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateFor, memoTagKeys } from "@/shared/config";
import { memoTagApi } from "../api/memoTagApi";
import type { MemoTagRequestOptions } from "../api/memoTagApi";
import type { MemoTagFormValues } from "@/entities/memo-tag";

/** `options.silent` — 불러오기 실패를 화면 안 Result Section 이 말한다(전역 서버 원문 토스트를 띄우지 않는다) */
export const useMemoTags = (
  options?: MemoTagRequestOptions & ReferenceOpts,
) => {
  return useQuery({
    queryKey: memoTagKeys.list(),
    queryFn: () => memoTagApi.getTags(referenceSilent(options)),
    ...referenceMeta(options),
  });
};

export const useCreateMemoTag = (options?: MemoTagRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MemoTagFormValues) =>
      memoTagApi.createTag(data, options),
    onSuccess: () => invalidateFor(queryClient, "memo-tag", { wait: true }),
  });
};

/**
 * 개명은 메모까지 바꾼다 — 서버가 `memo.tag` 문자열을 새 이름으로 옮기기 때문이다
 * (`MemoTagServiceImpl.updateTag`). 메모 캐시를 안 버리면 화면엔 옛 이름이 남고,
 * 그 메모를 다음에 저장할 때 옛 이름의 태그가 새로 만들어진다(QA #88 의 되살아남).
 */
export const useUpdateMemoTag = (options?: MemoTagRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MemoTagFormValues }) =>
      memoTagApi.updateTag(id, data, options),
    onSuccess: () =>
      invalidateFor(queryClient, "memo-tag-usage", { wait: true }),
  });
};

/** 삭제도 메모를 바꾼다 — 그 태그를 쓰던 메모의 태그가 서버에서 비워진다. */
export const useDeleteMemoTag = (options?: MemoTagRequestOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => memoTagApi.deleteTag(id, options),
    onSuccess: () =>
      invalidateFor(queryClient, "memo-tag-usage", { wait: true }),
  });
};
