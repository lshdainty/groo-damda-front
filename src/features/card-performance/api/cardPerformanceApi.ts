import { apiClient, silentConfig, type SilentOpts } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { CardPerformance } from "@/entities/card";

export const cardPerformanceApi = {
  getPerformance: async (
    assetRowId: number,
    yearMonth: string,
    opts?: SilentOpts,
  ): Promise<CardPerformance> => {
    const resp: ApiResponse<CardPerformance> = await apiClient.get(
      "/v1/card-performance",
      {
        params: { assetRowId, yearMonth },
        ...silentConfig(opts),
      },
    );
    return resp.data;
  },
};
