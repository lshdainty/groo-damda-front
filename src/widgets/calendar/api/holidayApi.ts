import { apiClient, silentConfig, type SilentOpts } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { Holiday } from "@/entities/calendar";

/**
 * 공휴일 조회 API.
 *
 * 공휴일은 백엔드 스케줄러가 한국천문연구원 특일정보 API 와 매일 동기화하므로 조회 전용이다.
 */
export const holidayApi = {
  getHolidays: async (
    startDate: string,
    endDate: string,
    opts?: SilentOpts,
  ): Promise<Holiday[]> => {
    const resp: ApiResponse<{ holidays: Holiday[] }> = await apiClient.get(
      "/v1/holidays",
      {
        params: { startDate, endDate },
        ...silentConfig(opts),
      },
    );
    return resp.data.holidays;
  },
};
