import { apiClient } from "@/shared/api";
import type { QuietRequestConfig } from "@/shared/api/base";
import type { ApiResponse } from "@/shared/types";
import type { Notification } from "@/entities/notification";

// 동작 실패는 호출처가 critical 스낵바 + [다시 시도] 로 말한다 — 전역 서버 글을 띄우지 않는다
const SILENT: QuietRequestConfig = { silent: true };

export const notificationApi = {
  getNotifications: async (): Promise<Notification[]> => {
    const resp: ApiResponse<{ notifications: Notification[] }> =
      await apiClient.get("/v1/notifications");
    return resp.data.notifications;
  },

  getUnreadCount: async (opts?: { silent?: boolean }): Promise<number> => {
    const resp: ApiResponse<{ count: number }> = await apiClient.get(
      "/v1/notifications/unread-count",
      opts?.silent ? SILENT : undefined,
    );
    return resp.data.count;
  },

  markRead: async (id: number): Promise<void> => {
    await apiClient.patch(`/v1/notification/${id}/read`, undefined, SILENT);
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch("/v1/notifications/read-all", undefined, SILENT);
  },

  deleteNotification: async (id: number): Promise<void> => {
    await apiClient.delete(`/v1/notification/${id}`, SILENT);
  },
};
