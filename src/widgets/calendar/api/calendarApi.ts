import { apiClient, type QuietRequestConfig } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  CalendarEvent,
  CalendarEventFormValues,
} from "@/entities/calendar";

/**
 * 백엔드 YNType("Y"/"N") → boolean 변환
 */
export function ynToBoolean(value: unknown): boolean {
  return value === "Y" || value === true;
}

/**
 * 백엔드 API 응답의 CalendarEvent를 프론트엔드 타입으로 변환
 * - isAllDay: "Y"/"N" → boolean
 * - isException: "Y"/"N" → boolean
 */
export function fromApiEvent(event: Record<string, unknown>): CalendarEvent {
  return {
    ...event,
    isAllDay: ynToBoolean(event.isAllDay),
    isException: ynToBoolean(event.isException),
  } as CalendarEvent;
}

/**
 * CalendarEventFormValues를 백엔드 API 형식으로 변환
 * - isAllDay: boolean → "Y"/"N" (YNType)
 * - startDate/endDate: "yyyy-MM-dd" → "yyyy-MM-ddTHH:mm:ss" (LocalDateTime)
 */
function toApiPayload(data: CalendarEventFormValues) {
  const isAllDay = data.isAllDay;

  // 날짜에 시간 컴포넌트가 없으면 추가
  const formatDate = (dateStr: string, isStart: boolean) => {
    if (dateStr.includes("T")) {
      // datetime-local input gives "yyyy-MM-ddTHH:mm", backend needs seconds
      if (dateStr.length === 16) return `${dateStr}:00`;
      return dateStr;
    }
    return isAllDay
      ? `${dateStr}T${isStart ? "00:00:00" : "23:59:59"}`
      : `${dateStr}T${isStart ? "09:00:00" : "10:00:00"}`;
  };

  return {
    ...data,
    isAllDay: isAllDay ? "Y" : "N",
    startDate: formatDate(data.startDate, true),
    endDate: formatDate(data.endDate, false),
  };
}

/**
 * `silent` 는 **호출처가 고른다**(기본은 전역 토스트가 실패를 알린다) — 실패를 자기 자리
 * (폼 Callout)로 알리는 화면만 true 로 넘겨 서버 글이 겹쳐 뜨지 않게 한다.
 */
export type EventRequestOptions = { silent?: boolean };

const quiet = (
  options?: EventRequestOptions,
): QuietRequestConfig | undefined =>
  options?.silent ? { silent: true } : undefined;

export const calendarApi = {
  createEvent: async (
    data: CalendarEventFormValues,
    options?: EventRequestOptions,
  ): Promise<CalendarEvent> => {
    const resp: ApiResponse<CalendarEvent> = await apiClient.post(
      "/v1/calendar/event",
      toApiPayload(data),
      quiet(options),
    );
    return fromApiEvent(resp.data as unknown as Record<string, unknown>);
  },

  getEvents: async (
    startDate: string,
    endDate: string,
  ): Promise<CalendarEvent[]> => {
    // 백엔드는 LocalDateTime(ISO.DATE_TIME) 형식을 기대하므로 시간 부분 추가
    const startDateTime = startDate.includes("T")
      ? startDate
      : `${startDate}T00:00:00`;
    const endDateTime = endDate.includes("T") ? endDate : `${endDate}T23:59:59`;
    const resp: ApiResponse<{ events: CalendarEvent[] }> = await apiClient.get(
      "/v1/calendar/events",
      {
        params: { startDate: startDateTime, endDate: endDateTime },
      },
    );
    return (resp.data.events as unknown as Record<string, unknown>[]).map(
      fromApiEvent,
    );
  },

  updateEvent: async (
    id: number,
    data: CalendarEventFormValues,
    options?: EventRequestOptions,
  ): Promise<CalendarEvent> => {
    // 종류(eventType)는 수정 본문에 싣지 않는다. 수정 폼에 종류를 고르는 칸이 없으니
    // 여기서 보내는 값은 늘 화면이 지어낸 추측이고, 그 추측이 업무·생일 일정을
    // 개인 일정으로 덮었다(QA #89). 서버는 값이 없으면 기존 종류를 그대로 둔다
    // (CalendarEvent.updateEvent 의 `if (eventType != null)`).
    // 폼에 종류 선택이 생기는 날 여기서 다시 실으면 된다.
    const { eventType: _dropped, ...payload } = toApiPayload(data);
    const resp: ApiResponse<CalendarEvent> = await apiClient.put(
      `/v1/calendar/event/${id}`,
      payload,
      quiet(options),
    );
    return fromApiEvent(resp.data as unknown as Record<string, unknown>);
  },

  deleteEvent: async (
    id: number,
    options?: EventRequestOptions,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/calendar/event/${id}`,
      quiet(options),
    );
    return resp.data;
  },
};
