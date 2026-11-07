import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";

import { useCalendar } from "@/widgets/calendar/model/calendar-context";
import { useCalendarEvents } from "@/widgets/calendar/model/useCalendarEvents";
import { useCalendarHolidays } from "@/widgets/calendar/model/useCalendarHolidays";
import {
  convertCalendarEventToIEvent,
  convertHolidayToIEvent,
} from "@/widgets/calendar/lib/helpers";
import { CalendarContainer } from "@/widgets/calendar/ui/CalendarContainer";

const CalendarContent = () => {
  const { selectedDate, view, isBuiltinSourceEnabled } = useCalendar();

  const isHolidayEnabled = isBuiltinSourceEnabled("holiday");

  const eventRange = useMemo(() => {
    let start: Date;
    let end: Date;

    switch (view) {
      case "month":
      case "agenda":
        start = startOfMonth(selectedDate);
        end = endOfMonth(selectedDate);
        break;
      case "week":
        start = startOfWeek(selectedDate);
        end = endOfWeek(selectedDate);
        break;
      default:
        start = startOfMonth(selectedDate);
        end = endOfMonth(selectedDate);
    }

    return { start, end };
  }, [selectedDate, view]);

  const startDate = format(eventRange.start, "yyyy-MM-dd'T'HH:mm:ss");
  const endDate = format(eventRange.end, "yyyy-MM-dd'T'HH:mm:ss");

  const {
    data: apiEvents,
    isLoading: isEventsLoading,
    isError: isEventsError,
    refetch: refetchEvents,
  } = useCalendarEvents(startDate, endDate);

  // holiday 캘린더가 ON일 때만 공휴일 데이터 조회 (성능 최적화)
  const holidayDateRange = useMemo(
    () => ({
      startDate: format(eventRange.start, "yyyy-MM-dd"),
      endDate: format(eventRange.end, "yyyy-MM-dd"),
    }),
    [eventRange],
  );

  const { data: holidayData, isLoading: isHolidaysLoading } =
    useCalendarHolidays(
      holidayDateRange.startDate,
      holidayDateRange.endDate,
      isHolidayEnabled,
      { reference: true },
    );

  const events = useMemo(() => {
    const scheduleEvents = apiEvents
      ? apiEvents.map(convertCalendarEventToIEvent)
      : [];
    const holidayEvents =
      isHolidayEnabled && holidayData
        ? holidayData.map(convertHolidayToIEvent)
        : [];
    return [...scheduleEvents, ...holidayEvents];
  }, [apiEvents, holidayData, isHolidayEnabled]);

  const isLoading = isEventsLoading || (isHolidayEnabled && isHolidaysLoading);

  // 일정 질의가 내용 없이 실패했다 — 빈 달력으로 그리지 않는다. 이미 받아 둔 값이 있으면(다시 받기 실패) 그대로 둔다.
  // 공휴일 · 라벨 질의 실패는 여기 들지 않는다(공휴일 없이 그린다).
  const isFailed = isEventsError && apiEvents === undefined;

  return (
    <CalendarContainer
      events={events}
      isLoading={isLoading}
      isFailed={isFailed}
      onRetry={() => void refetchEvents()}
    />
  );
};

export { CalendarContent };
