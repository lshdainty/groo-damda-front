import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dutchPayKeys, invalidateFor } from "@/shared/config";
import { dutchPayApi } from "../api/dutchPayApi";
import type { DutchPayFormValues } from "@/entities/dutch-pay";

export const useDutchPays = (opts?: { silent?: boolean }) => {
  return useQuery({
    queryKey: dutchPayKeys.list(),
    queryFn: () => dutchPayApi.getDutchPays(opts),
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
    onSuccess: () => invalidateFor(queryClient, "dutch-pay", { wait: true }),
  });
};

export const useUpdateDutchPay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DutchPayFormValues }) =>
      dutchPayApi.updateDutchPay(id, data),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay", { wait: true }),
  });
};

export const useDeleteDutchPay = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => dutchPayApi.deleteDutchPay(id, opts),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay", { wait: true }),
  });
};

export const useMarkParticipantPaid = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dutchPayId,
      participantId,
    }: {
      dutchPayId: number;
      participantId: number;
    }) => dutchPayApi.markParticipantPaid(dutchPayId, participantId, opts),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay", { wait: true }),
  });
};

export const useSettleAll = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => dutchPayApi.settleAll(id, opts),
    onSuccess: () => invalidateFor(queryClient, "dutch-pay", { wait: true }),
  });
};
