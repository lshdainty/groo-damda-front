import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { holidayKeys } from "@/shared/config";
import { holidayApi } from "../api/holidayApi";

/**
 * 캘린더 뷰에서 공휴일 데이터를 조회하는 훅
 * holiday 캘린더 소스가 enabled일 때만 쿼리를 실행하여 성능 최적화
 *
 * 공휴일은 백엔드 스케줄러가 매일 동기화하므로 프론트에서 등록·수정하지 않는다.
 */
export const useCalendarHolidays = (
  startDate: string,
  endDate: string,
  enabled: boolean,
  opts?: ReferenceOpts,
) => {
  return useQuery({
    queryKey: holidayKeys.list({ startDate, endDate }),
    queryFn: () =>
      holidayApi.getHolidays(startDate, endDate, referenceSilent(opts)),
    enabled: enabled && !!startDate && !!endDate,
    ...referenceMeta(opts),
  });
};
