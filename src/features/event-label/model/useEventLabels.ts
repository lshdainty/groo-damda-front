import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventLabelKeys, invalidateFor } from "@/shared/config";
import { eventLabelApi } from "../api/eventLabelApi";
import type { EventLabelFormValues } from "@/entities/event-label";

export const useEventLabels = (opts?: { silent?: boolean }) => {
  return useQuery({
    queryKey: eventLabelKeys.list(),
    queryFn: () => eventLabelApi.getLabels(opts),
  });
};

/** `silent` — 실패를 폼 맨 위 Callout 이 고정 글로 말한다(서버 원문 알림을 끈다) */
export const useCreateEventLabel = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EventLabelFormValues) =>
      eventLabelApi.createLabel(data, opts),
    onSuccess: () => invalidateFor(queryClient, "event-label"),
  });
};

export const useUpdateEventLabel = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EventLabelFormValues }) =>
      eventLabelApi.updateLabel(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "event-label-usage"),
  });
};

export const useDeleteEventLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // silent — 실패는 호출처가 확인창 뒤 스낵바(useConfirmFail)로 말한다
    mutationFn: (id: number) => eventLabelApi.deleteLabel(id, { silent: true }),
    onSuccess: () => invalidateFor(queryClient, "event-label-usage"),
  });
};
