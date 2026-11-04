import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dutchPayKeys, invalidateFor } from "@/shared/config";
import { dutchPayApi } from "../api/dutchPayApi";
import type { DutchPayFormValues } from "@/entities/dutch-pay";

export const useDutchPays = () => {
  return useQuery({
    queryKey: dutchPayKeys.list(),
    queryFn: () => dutchPayApi.getDutchPays(),
  });
};

export const useDutchPay = (id: number) => {
  return useQuery({
    queryKey: dutchPayKeys.detail(id),
    queryFn: () => dutchPayApi.getDutchPay(id),
    enabled: id > 0,
  });
};

export const useCreateDutchPay = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DutchPayFormValues) =>
      dutchPayApi.createDutchPay(data, opts),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay"),
  });
};

export const useUpdateDutchPay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DutchPayFormValues }) =>
      dutchPayApi.updateDutchPay(id, data),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay"),
  });
};

export const useDeleteDutchPay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => dutchPayApi.deleteDutchPay(id),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay"),
  });
};

export const useMarkParticipantPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dutchPayId,
      participantId,
    }: {
      dutchPayId: number;
      participantId: number;
    }) => dutchPayApi.markParticipantPaid(dutchPayId, participantId),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay"),
  });
};

export const useSettleAll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => dutchPayApi.settleAll(id),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay"),
  });
};
