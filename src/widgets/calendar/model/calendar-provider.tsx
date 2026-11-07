import { useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  TCalendarView,
  TBadgeVariant,
  TWorkingHours,
  TVisibleHours,
  TCalendarSourceType,
  IBuiltinSource,
} from "./types";
import type { IEvent } from "./interfaces";
import { BUILTIN_SOURCES, normalizeCalendarView } from "./types";
import {
  useUserCalendars,
  useToggleCalendarVisibility,
} from "@/features/user-calendar";
import { isCalendarShown } from "@/entities/user-calendar";
import { useToggleFail } from "@/shared/lib/confirm-fail";
import { i18n } from "@/shared/i18n/config";
import { CalendarContext, type CalendarContextValue } from "./calendar-context";

interface CalendarProviderProps {
  children: ReactNode;
  events: IEvent[];
  initialView?: TCalendarView;
  initialDate?: Date;
}

export const CalendarProvider = ({
  children,
  events: externalEvents,
  initialView = "month",
  initialDate,
}: CalendarProviderProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate ?? new Date(),
  );
  const [view, setViewState] = useState<TCalendarView>(() =>
    normalizeCalendarView(initialView),
  );
  const setView = useCallback(
    (next: TCalendarView) => setViewState(normalizeCalendarView(next)),
    [],
  );
  const [badgeVariant, setBadgeVariant] = useState<TBadgeVariant>("dot");
  const [workingHours, setWorkingHours] = useState<TWorkingHours>({
    start: 9,
    end: 18,
  });
  const [visibleHours, setVisibleHours] = useState<TVisibleHours>({
    start: 0,
    end: 24,
  });
  const [localEvents, setLocalEvents] = useState<IEvent[]>([]);
  const [builtinSources, setBuiltinSources] =
    useState<IBuiltinSource[]>(BUILTIN_SOURCES);

  // Fetch user calendars
  const { data: userCalendarsData } = useUserCalendars({ reference: true });
  const userCalendars = useMemo(
    () => userCalendarsData ?? [],
    [userCalendarsData],
  );

  const toggleVisibilityMutation = useToggleCalendarVisibility();
  const toggleFail = useToggleFail();

  const events = useMemo(() => {
    return localEvents.length > 0 ? localEvents : externalEvents;
  }, [localEvents, externalEvents]);

  const handleSetLocalEvents = useCallback((newEvents: IEvent[]) => {
    setLocalEvents(newEvents);
  }, []);

  const toggleBuiltinSource = useCallback((sourceId: TCalendarSourceType) => {
    setBuiltinSources((prev) =>
      prev.map((source) =>
        source.id === sourceId
          ? { ...source, enabled: !source.enabled }
          : source,
      ),
    );
  }, []);

  const isBuiltinSourceEnabled = useCallback(
    (sourceId: TCalendarSourceType) => {
      return builtinSources.find((s) => s.id === sourceId)?.enabled ?? false;
    },
    [builtinSources],
  );

  // 보임 판정은 `entities/user-calendar` 의 `isCalendarShown` 하나로 모은다 —
  // 필터(여기)와 목록(캘린더 소스 드롭다운)이 갈리면 켜진 것으로 보이는 캘린더의
  // 일정이 화면에서 빠지는 상태가 생긴다.
  const isCalendarVisible = useCallback(
    (calendarRowId: number) =>
      isCalendarShown(userCalendars.find((c) => c.rowId === calendarRowId)),
    [userCalendars],
  );

  const handleToggleCalendarVisibility = useCallback(
    (calendarRowId: number) => {
      // 바로 바뀌는 값 — 실패하면 서버 값 그대로(되돌림) + critical 스낵바 한 문장, 다시 시도 없음.
      // 응답을 못 받았으면 다시 받은 서버 값 + "바뀌었는지 확인하지 못했어요."(판단 ②)
      toggleVisibilityMutation.mutate(calendarRowId, {
        onError: (error) =>
          toggleFail(error, i18n.t("calendar:filter.visibilityFailed")),
      });
    },
    [toggleVisibilityMutation, toggleFail],
  );

  const value = useMemo<CalendarContextValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      view,
      setView,
      badgeVariant,
      setBadgeVariant,
      workingHours,
      setWorkingHours,
      visibleHours,
      setVisibleHours,
      events,
      setLocalEvents: handleSetLocalEvents,
      builtinSources,
      toggleBuiltinSource,
      isBuiltinSourceEnabled,
      userCalendars,
      isCalendarVisible,
      toggleCalendarVisibility: handleToggleCalendarVisibility,
      pendingCalendarIds: toggleVisibilityMutation.pendingIds,
    }),
    [
      selectedDate,
      view,
      setView,
      badgeVariant,
      workingHours,
      visibleHours,
      events,
      handleSetLocalEvents,
      builtinSources,
      toggleBuiltinSource,
      isBuiltinSourceEnabled,
      userCalendars,
      isCalendarVisible,
      handleToggleCalendarVisibility,
      toggleVisibilityMutation.pendingIds,
    ],
  );

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};
