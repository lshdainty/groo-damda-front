import { format, isSameDay, parseISO } from "date-fns";
import { useCallback, useMemo, useState } from "react";

import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { useDeleteEvent } from "@/widgets/calendar/model/useCalendarEvents";
import { refOf, type EventRef } from "@/widgets/calendar/lib/event-key";
import { eventsOnDay } from "@/widgets/calendar/lib/helpers";

import type { CalendarEvent } from "@/entities/calendar";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

/** 지우려는 일정 — 확인창이 이름과 반복 여부(모든 회차가 지워진다)를 말한다 */
export interface DeleteTarget {
  id: number;
  title: string;
  recurring: boolean;
}

export const deleteTargetOf = (e: {
  id: number;
  title: string;
  rrule: string | null;
}): DeleteTarget => ({ id: e.id, title: e.title, recurring: !!e.rrule });

/** 고른 날의 키 — 그날 패널이 상세를 보인 날과 지금 고른 날이 같은지 가린다 */
export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export function iEventToCalendarEvent(event: IEvent): CalendarEvent {
  return {
    rowId: event.id,
    userRowId: event.userRowId,
    title: event.title,
    description: event.description || null,
    // 종류는 서버가 준 값 그대로다. 종전엔 여기서 "PERSONAL" 을 지어냈고 그 값이
    // 수정 PUT 에 실려 업무·생일 일정을 개인 일정으로 덮었다(QA #89).
    // 수정 폼이 열리는 건 일정(sourceType "calendar") 뿐이라 이 자리에 null 은 오지 않는다.
    eventType: event.eventType ?? "PERSONAL",
    color: event.color,
    startDate: event.startDate,
    endDate: event.endDate,
    isAllDay: event.isAllDay,
    labelRowId: event.labelRowId,
    labelName: event.labelName,
    labelColor: event.labelColor,
    location: event.location,
    rrule: event.rrule,
    recurrenceId: event.recurrenceId,
    isException: false,
    reminders: event.reminders,
    calendarRowId: event.calendarRowId,
    calendarName: event.calendarName,
    calendarColor: event.calendarColor,
    createAt: "",
    modifyAt: "",
  };
}

/**
 * 캘린더 화면이 폰 · 데스크톱/태블릿에서 함께 쓰는 상태 — 거르기(`filteredEvents`) · 그날 일정(`dayEvents`) ·
 * 상세 · 수정 · 삭제 · 일별 시트 상태와 그 동작. 화면 모양은 `CalendarMobile` · `CalendarDesktop` 이 맡는다.
 */
export function useCalendarScreen(events: IEvent[]) {
  const {
    selectedDate,
    setSelectedDate,
    view,
    isBuiltinSourceEnabled,
    isCalendarVisible,
  } = useCalendar();
  // 상세 — 데스크톱 · 태블릿에서 어느 일정을 보고 있나(폰 그날 시트는 시트가 제 단계를 들고 있다).
  // `day` · `view` 는 연 순간 고른 날 · 보기 — 날이나 보기가 바뀌면 상세는 **비운다**(가리기만 하면 22일 → 23일 → 22일 에서 되살아나고,
  // 보기를 바꾸면 누르지 않은 대화상자가 뜬다 — I-09b 15 "다른 날을 고르면 패널은 그 날의 목록 단계로")
  const [detail, setDetail] = useState<{
    ref: EventRef;
    day: string;
    view: string;
  } | null>(null);
  if (detail && (detail.day !== dayKey(selectedDate) || detail.view !== view)) {
    setDetail(null);
  }

  // Edit/Delete state
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  // 모바일 월간뷰 일별 이벤트 시트 (앱 _DayEventsSheetBody 정합) + 시트의 [+] 생성 폼
  const [dayDate, setDayDate] = useState<Date | null>(null);
  const [creatingDate, setCreatingDate] = useState<Date | null>(null);

  const deleteEvent = useDeleteEvent();

  /**
   * 일정을 눌렀다 — 월 격자 칩이면 그 칩이 놓인 날(`day`)을 고르고, 그 일정의 상세를 연다(I-09b 16 · 18).
   * 어느 표면이 그리는지는 부르는 쪽이 폭 · 보기로 정한다(1280 이상 월 보기 = 그날 패널, 그 밖 = 대화상자 · 480 시트).
   */
  const openDetail = useCallback(
    (event: IEvent, _el?: HTMLElement, day?: Date) => {
      const picked = day ?? selectedDate;
      if (day) setSelectedDate(day);
      // 공휴일 칩은 날만 고른다 — 공휴일 상세는 없다(I-09b 5 · 16)
      if (event.sourceType !== "calendar") return;
      setDetail({ ref: refOf(event), day: dayKey(picked), view });
    },
    [selectedDate, setSelectedDate, view],
  );

  const closeDetail = useCallback(() => setDetail(null), []);

  /** [수정] — 그날 패널의 상세에서는 "자세히" 대화상자(수정은 처음부터 대화상자) */
  const editEvent = useCallback((event: IEvent) => {
    setEditingEvent(iEventToCalendarEvent(event));
  }, []);

  const requestDelete = useCallback((event: IEvent) => {
    setDeleting(deleteTargetOf(event));
  }, []);

  /**
   * 삭제 확정. 실패는 서버 글 대신 호출처가 알린다(`onFailed` — 확인창은 닫고 고정 문구 스낵바, 28-3 규칙) — 전역 오류 토스트는 끈다(`silent`).
   */
  const handleConfirmDelete = useCallback(
    (onFailed?: () => void) => {
      if (deleting === null) return;
      deleteEvent.mutate(
        { id: deleting.id, silent: true },
        {
          onSuccess: () => {
            setDeleting(null);
            // 지운 일정을 보던 상세는 닫는다 — 그날 패널은 목록으로, 480 시트 · 대화상자는 닫힘
            setDetail((d) => (d?.ref.id === deleting.id ? null : d));
          },
          onError: () => {
            setDeleting(null);
            onFailed?.();
          },
        },
      );
    },
    [deleting, deleteEvent],
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const eventStartDate = parseISO(event.startDate);
      const eventEndDate = parseISO(event.endDate);

      // Source filtering
      if (event.sourceType === "holiday" && !isBuiltinSourceEnabled("holiday"))
        return false;
      if (event.sourceType === "expense" && !isBuiltinSourceEnabled("expense"))
        return false;
      if (event.sourceType === "todo" && !isBuiltinSourceEnabled("todo"))
        return false;
      if (
        event.sourceType === "calendar" &&
        event.calendarRowId &&
        !isCalendarVisible(event.calendarRowId)
      )
        return false;

      if (view === "year") {
        const yearStart = new Date(selectedDate.getFullYear(), 0, 1);
        const yearEnd = new Date(
          selectedDate.getFullYear(),
          11,
          31,
          23,
          59,
          59,
          999,
        );
        const isInSelectedYear =
          eventStartDate <= yearEnd && eventEndDate >= yearStart;
        return isInSelectedYear;
      }

      if (view === "month" || view === "agenda") {
        const monthStart = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          1,
        );
        const monthEnd = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        const isInSelectedMonth =
          eventStartDate <= monthEnd && eventEndDate >= monthStart;
        return isInSelectedMonth;
      }

      if (view === "week") {
        const dayOfWeek = selectedDate.getDay();

        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const isInSelectedWeek =
          eventStartDate <= weekEnd && eventEndDate >= weekStart;
        return isInSelectedWeek;
      }

      if (view === "day") {
        const dayStart = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          0,
          0,
          0,
        );
        const dayEnd = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23,
          59,
          59,
        );
        const isInSelectedDay =
          eventStartDate <= dayEnd && eventEndDate >= dayStart;
        return isInSelectedDay;
      }

      return true;
    });
  }, [selectedDate, events, view, isBuiltinSourceEnabled, isCalendarVisible]);

  // 모바일 일별 시트 이벤트 — 앱 _eventsOnDay 정합 (해당 일과 겹침 + 시작시각 정렬).
  // 캘린더 이벤트 + 공휴일만 (지출/할일 pseudo-event 제외). 공휴일은 읽기 전용 행.
  const dayEvents = useMemo(
    () => (dayDate ? eventsOnDay(filteredEvents, dayDate) : []),
    [dayDate, filteredEvents],
  );

  const singleDayEvents = filteredEvents.filter((event) => {
    if (event.isAllDay) return false;
    const startDate = parseISO(event.startDate);
    const endDate = parseISO(event.endDate);
    return isSameDay(startDate, endDate);
  });

  const multiDayEvents = filteredEvents.filter((event) => {
    if (event.isAllDay) return true;
    const startDate = parseISO(event.startDate);
    const endDate = parseISO(event.endDate);
    return !isSameDay(startDate, endDate);
  });

  const eventStartDates = useMemo(() => {
    return filteredEvents.map((event) => ({
      ...event,
      endDate: event.startDate,
    }));
  }, [filteredEvents]);

  return {
    // 상세
    detail,
    openDetail,
    closeDetail,
    // 수정 · 삭제 · 생성
    editingEvent,
    setEditingEvent,
    editEvent,
    deleting,
    setDeleting,
    requestDelete,
    creatingDate,
    setCreatingDate,
    dayDate,
    setDayDate,
    deleteEvent,
    handleConfirmDelete,
    // 거른 일정
    filteredEvents,
    dayEvents,
    singleDayEvents,
    multiDayEvents,
    eventStartDates,
  };
}

export type CalendarScreen = ReturnType<typeof useCalendarScreen>;
