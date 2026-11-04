import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { calendarKeys, invalidateFor } from "@/shared/config";
import { calendarApi } from "../api/calendarApi";
import type { CalendarEventFormValues } from "@/entities/calendar";

export const useCalendarEvents = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: calendarKeys.events({ startDate, endDate }),
    queryFn: () => calendarApi.getEvents(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      silent,
    }: {
      data: CalendarEventFormValues;
      /** 실패를 호출처가 자기 자리에서 알리면 true — 기본(생략)은 전역 오류 토스트 */
      silent?: boolean;
    }) => calendarApi.createEvent(data, { silent }),
    // 다시 받기를 기다린 뒤 호출처 콜백이 불린다 — 저장 · 삭제 뒤 상세 · 목록이 옛 값 · 지운 일정을 보이지 않게
    onSuccess: () =>
      invalidateFor(queryClient, "calendar-event", { wait: true }),
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      silent,
    }: {
      id: number;
      data: CalendarEventFormValues;
      /** 실패를 호출처가 자기 자리에서 알리면 true — 기본(생략)은 전역 오류 토스트 */
      silent?: boolean;
    }) => calendarApi.updateEvent(id, data, { silent }),
    // 다시 받기를 기다린 뒤 호출처 콜백이 불린다 — 저장 · 삭제 뒤 상세 · 목록이 옛 값 · 지운 일정을 보이지 않게
    onSuccess: () =>
      invalidateFor(queryClient, "calendar-event", { wait: true }),
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      silent,
    }: {
      id: number;
      /** 실패를 호출처가 자기 자리(확인창을 닫고 스낵바)에서 알리면 true — 기본(생략)은 전역 오류 토스트 */
      silent?: boolean;
    }) => calendarApi.deleteEvent(id, { silent }),
    // 다시 받기를 기다린 뒤 호출처 콜백이 불린다 — 저장 · 삭제 뒤 상세 · 목록이 옛 값 · 지운 일정을 보이지 않게
    onSuccess: () =>
      invalidateFor(queryClient, "calendar-event", { wait: true }),
  });
};
