import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { usePendingIds } from "@/shared/lib/groo/use-pending-ids";
import { invalidateFor, notificationKeys } from "@/shared/config";
import { notificationApi } from "../api/notificationApi";

export const useNotifications = () => {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationApi.getNotifications(),
  });
};

export const useUnreadCount = (opts?: ReferenceOpts) => {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(referenceSilent(opts)),
    ...referenceMeta(opts),
  });
};

export const useMarkRead = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation("notification");
  const confirmFail = useConfirmFail();
  const { pendingIds, begin, end } = usePendingIds();
  const run = async (id: number) => {
    await notificationApi.markRead(id);
    await invalidateFor(queryClient, "notification");
  };

  const mutation = useMutation({
    mutationFn: run,
    onMutate: (id: number) => begin(id),
    onSettled: (_data, _error, id) => end(id),
    // 실패: critical 스낵바 한 문장 + [다시 시도](바로 다시 요청) — 요청은 silent
    onError: (error, id) =>
      confirmFail({
        error,
        message: t("markReadFailed"),
        retry: () => run(id),
      }),
  });
  /** 진행 중인 항목 id — 그 항목만 스피너·잠금. */
  return { ...mutation, pendingIds };
};

export const useMarkAllRead = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation("notification");
  const confirmFail = useConfirmFail();
  const run = async () => {
    await notificationApi.markAllRead();
    // 안 읽은 수는 낡은 값이 남지 않게 바로 0 — 이어서 다시 받는다
    queryClient.setQueryData(notificationKeys.unreadCount(), 0);
    await invalidateFor(queryClient, "notification");
  };

  return useMutation({
    mutationFn: run,
    onError: (error) =>
      confirmFail({ error, message: t("markAllFailed"), retry: run }),
  });
};

/** 지우기 — 실패 알림은 확인창(AlertConfirm onError)이 맡는다: 창을 닫고 critical 스낵바 + [다시 시도] */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await notificationApi.deleteNotification(id);
      await invalidateFor(queryClient, "notification");
    },
  });
};
