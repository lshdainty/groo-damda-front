import { apiClient } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { EventLabel, EventLabelFormValues } from "@/entities/event-label";

/** silent — 실패를 호출처가 화면 안에서 고정 글로 말한다(전역 서버 원문 토스트와 겹치지 않게, 호출처 단위) */
type SilentOpts = { silent?: boolean };
const silentConfig = (opts?: SilentOpts) =>
  (opts?.silent
    ? { silent: true }
    : {}) as import("axios").AxiosRequestConfig & { silent?: boolean };

export const eventLabelApi = {
  createLabel: async (data: EventLabelFormValues): Promise<EventLabel> => {
    const resp: ApiResponse<EventLabel> = await apiClient.post(
      "/v1/calendar/label",
      data,
    );
    return resp.data;
  },

  getLabels: async (opts?: SilentOpts): Promise<EventLabel[]> => {
    const resp: ApiResponse<{ labels: EventLabel[] }> = await apiClient.get(
      "/v1/calendar/labels",
      silentConfig(opts),
    );
    return resp.data.labels;
  },

  updateLabel: async (
    id: number,
    data: EventLabelFormValues,
  ): Promise<EventLabel> => {
    const resp: ApiResponse<EventLabel> = await apiClient.put(
      `/v1/calendar/label/${id}`,
      data,
    );
    return resp.data;
  },

  deleteLabel: async (id: number, opts?: SilentOpts): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/calendar/label/${id}`,
      silentConfig(opts),
    );
    return resp.data;
  },
};
