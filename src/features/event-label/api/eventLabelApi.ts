import { apiClient, silentConfig, type SilentOpts } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { EventLabel, EventLabelFormValues } from "@/entities/event-label";

export const eventLabelApi = {
  createLabel: async (
    data: EventLabelFormValues,
    opts?: SilentOpts,
  ): Promise<EventLabel> => {
    const resp: ApiResponse<EventLabel> = await apiClient.post(
      "/v1/calendar/label",
      data,
      silentConfig(opts),
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
    opts?: SilentOpts,
  ): Promise<EventLabel> => {
    const resp: ApiResponse<EventLabel> = await apiClient.put(
      `/v1/calendar/label/${id}`,
      data,
      silentConfig(opts),
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
