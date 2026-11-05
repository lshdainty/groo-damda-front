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

export const useCreateEventLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EventLabelFormValues) => eventLabelApi.createLabel(data),
    onSuccess: () => invalidateFor(queryClient, "event-label"),
  });
};

export const useUpdateEventLabel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EventLabelFormValues }) =>
      eventLabelApi.updateLabel(id, data),
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
