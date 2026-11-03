import { useEffect, useLayoutEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { format } from "date-fns";

import { CHART_PAIRS } from "@/shared/lib/groo/chart-palette";
import { isCalendarShown } from "@/entities/user-calendar";
import { useUserCalendars } from "@/features/user-calendar";
import type {
  CalendarEvent,
  CalendarEventFormValues,
} from "@/entities/calendar";

/** 제목·본문 입력 상한 — 서버 `FieldLimits`(TITLE_MAX 200 · CONTENT_MAX 10,000)와 같은 값.
 *  제한이 없어 500자 제목이 서버 500 으로 터지던 자리다(QA #30 · #33). */
export const TITLE_MAX = 200;
export const CONTENT_MAX = 10_000;
/** 장소 입력 상한 — 서버 `CalendarEventApiDto` 의 `@Size(max = FieldLimits.SHORT_NOTE_MAX)` "장소는 500자까지" */
export const LOCATION_MAX = 500;

// 기본 일정 색 = 팔레트 blue #2c70bf (캘린더 기본색 미지정 시 fallback).
const DEFAULT_EVENT_COLOR = CHART_PAIRS.find((p) => p.key === "blue")!.base;

export type RecurrenceOption =
  "none" | "daily" | "weekly" | "monthly" | "yearly";

export const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

const recurrenceToRrule: Record<RecurrenceOption, string | undefined> = {
  none: undefined,
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};

export const rruleToRecurrence = (
  rrule: string | null | undefined,
): RecurrenceOption => {
  if (!rrule) return "none";
  if (rrule.includes("FREQ=DAILY")) return "daily";
  if (rrule.includes("FREQ=WEEKLY")) return "weekly";
  if (rrule.includes("FREQ=MONTHLY")) return "monthly";
  if (rrule.includes("FREQ=YEARLY")) return "yearly";
  return "none";
};

export const REMINDER_OPTIONS = [5, 15, 30, 60, 1440]; // minutes

// 시작 datetime 변경 시 종료가 시작 이전/같으면 자동 보정 (Google 캘린더 패턴).
// allDay=true: YYYY-MM-DD 사전식 비교, 종료 = max(종료, 시작).
// allDay=false: ISO 비교, 종료 = 시작 + 1h.
export const ensureEndAfterStart = (
  newStart: string,
  currentEnd: string,
  allDay: boolean,
): string => {
  if (allDay) return newStart > currentEnd ? newStart : currentEnd;
  const start = new Date(newStart);
  // 시작이 날짜로 안 읽히면 종료를 건드리지 않는다. 종전엔 키를 누르는 동안의 미완성 값이
  // 여기까지 와서 종료에 `NaN-NaN-NaNTNaN:NaN` 이 적혔고, 그대로 저장까지 나갔다.
  if (isNaN(start.getTime())) return currentEnd;
  if (start < new Date(currentEnd)) return currentEnd;
  const d = new Date(start);
  d.setHours(d.getHours() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

/** 새 일정의 시작 값 — 종일이 아니면 시각을 붙인다(종일 줄을 끌 때와 같은 기본 09:00 ~ 10:00) */
function newEventValues(
  day: string,
  endDay: string,
  calendar: { rowId: number; color: string } | undefined,
  title: string,
  allDay: boolean,
): CalendarEventFormValues {
  return {
    title,
    description: "",
    eventType: "PERSONAL",
    color: calendar?.color ?? DEFAULT_EVENT_COLOR,
    startDate: allDay ? day : `${day}T09:00`,
    endDate: allDay ? endDay : `${endDay}T10:00`,
    isAllDay: allDay,
    labelRowId: undefined,
    location: "",
    rrule: undefined,
    reminderMinutes: [],
    calendarRowId: calendar?.rowId,
  };
}

/** 빠른 추가에서 "자세히" 로 넘어올 때 들고 오는 값 */
export interface EventFormInitial {
  title?: string;
  isAllDay?: boolean;
  calendarRowId?: number;
}

export interface UseEventFormArgs {
  event?: CalendarEvent | null;
  selectedDate?: Date;
  selectedEndDate?: Date;
  /** 새 일정의 시작 값(빠른 추가에서 들고 온 값) */
  initial?: EventFormInitial;
  onSubmit: (data: CalendarEventFormValues) => void;
}

/**
 * 일정 폼의 상태 · 저장 본문 — 표면(1280 미만 시트 · 이상 대화상자)과 무관하다.
 * 부모(`EventForm`)가 한 번 들고 두 표면이 같은 값을 읽으므로 1280 을 넘나들어도 값이 남는다(I-09 31 · 36).
 */
export function useEventForm({
  event,
  selectedDate,
  selectedEndDate,
  initial,
  onSubmit,
}: UseEventFormArgs) {
  const {
    data: userCalendars = [],
    isLoading: calendarsLoading,
    refetch: refetchCalendars,
  } = useUserCalendars();

  const defaultDate = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const defaultEndDate = selectedEndDate
    ? format(selectedEndDate, "yyyy-MM-dd")
    : defaultDate;

  /**
   * 고를 수 있는 캘린더 — **숨긴 캘린더는 뺀다.** 캘린더 목록에서 껐다는 건
   * "지금 안 본다" 는 뜻이라, 새 일정을 거기 넣을 이유가 없다.
   *
   * 예외가 하나 있다 — **편집 중인 일정이 이미 숨긴 캘린더에 있으면 그 캘린더 하나는 남긴다.**
   * 안 그러면 그 일정을 여는 순간 목록에 없는 값이 선택돼 있다가, 캘린더 칸을 건드리지도
   * 않았는데 저장 때 다른 캘린더로 옮겨진다. 사용자가 안 건드린 값이 조용히 바뀌는 게 제일 나쁘다.
   */
  const selectableCalendars = userCalendars.filter(
    (c) => isCalendarShown(c) || c.rowId === event?.calendarRowId,
  );

  // 기본 선택도 **같은 목록에서** 고른다. 목록만 거르고 여기를 두면 기본 캘린더가 숨겨져 있을 때
  // 목록에 없는 값이 선택돼 있는 상태가 된다.
  const defaultCalendar =
    selectableCalendars.find((c) => c.rowId === initial?.calendarRowId) ??
    selectableCalendars.find((c) => c.isDefault) ??
    selectableCalendars[0];
  const initialTitle = initial?.title ?? "";
  const initialAllDay = initial?.isAllDay ?? true;

  // 반복·알림은 `event` 에서 시드한다. 마운트는 초기값으로, 이후 `event` 가 바뀌면
  // 렌더 중 조정으로 다시 맞춘다 — effect 안에서 setState 하면 커밋을 한 번 더 태운다.
  const [recurrence, setRecurrence] = useState<RecurrenceOption>(() =>
    rruleToRecurrence(event?.rrule),
  );
  const [selectedReminders, setSelectedReminders] = useState<number[]>(
    () => event?.reminders?.map((r) => r.minutesBefore) ?? [],
  );
  const [seededEvent, setSeededEvent] = useState(event);
  if (seededEvent !== event) {
    setSeededEvent(event);
    setRecurrence(rruleToRecurrence(event?.rrule));
    setSelectedReminders(event?.reminders?.map((r) => r.minutesBefore) ?? []);
  }

  const form = useForm<CalendarEventFormValues>({
    defaultValues: newEventValues(
      defaultDate,
      defaultEndDate,
      defaultCalendar,
      initialTitle,
      initialAllDay,
    ),
  });
  const { handleSubmit, reset, setValue, getValues, control } = form;

  // 렌더에서 값을 구독할 땐 `useWatch` 를 쓴다. `useForm().watch` 는 매번 새 함수를
  // 돌려주는 API 라 React Compiler 가 이 컴포넌트 최적화를 통째로 건너뛴다
  // (`react-hooks/incompatible-library`). 핸들러 안 1 회 읽기는 `getValues` 다.
  const startDate = useWatch({ control, name: "startDate" });
  const endDate = useWatch({ control, name: "endDate" });
  // 서버(CAL_002)가 거절할 범위는 저장 때 종료 칸 아래에서 알린다 — 둘 다 같은 형식(날짜 또는 날짜T시각)이라 문자열 비교로 충분하다.
  const dateRangeInvalid = !!startDate && !!endDate && endDate < startDate;
  const isAllDay = useWatch({ control, name: "isAllDay" });
  const selectedLabelRowId = useWatch({ control, name: "labelRowId" });
  const selectedCalendarRowId = useWatch({ control, name: "calendarRowId" });
  const title = useWatch({ control, name: "title" });
  const location = useWatch({ control, name: "location" });
  const description = useWatch({ control, name: "description" });

  // Update default calendar when userCalendars load
  useEffect(() => {
    if (defaultCalendar && !selectedCalendarRowId) {
      setValue("calendarRowId", defaultCalendar.rowId);
      if (!event) {
        setValue("color", defaultCalendar.color);
      }
    }
  }, [defaultCalendar, selectedCalendarRowId, setValue, event]);

  // 폼 값이 어느 일정으로 맞춰졌나 — reset 이 **끝난** 뒤에 적는다. 제목 같은 값으로 "맞춰졌나" 를 짐작하면 같은 이름의 일정 · 나갔다 다시 연 같은 일정에서 reset 보다 먼저 참이 된다.
  // 일정 객체 자체(참조)로 가르므로 같은 일정을 다시 열어도(새 스냅샷) 새로 맞춰져야 참이다
  const [syncedEvent, setSyncedEvent] = useState<
    CalendarEvent | null | undefined
  >(undefined);
  // 그리기 전에(layout) 맞춘다 — 폼 칸이 이미 붙은 뒤 reset 이 오면 RHF 가 등록(`_fields`)을 비워 칸이 다시 등록되지 않고 값이 사라진다(상세 → 수정 때 제목이 빈 칸으로 열림).
  // 일정 상세가 든 시트는 칸을 그린 뒤가 아니라 이 맞춤이 끝난 뒤에 그린다(`EventDetailSurface` 의 formReady).
  useLayoutEffect(() => {
    if (event) {
      const reminderMins = event.reminders?.map((r) => r.minutesBefore) ?? [];
      reset({
        title: event.title,
        description: event.description || "",
        eventType: event.eventType,
        color: event.color,
        startDate: event.startDate.substring(0, event.isAllDay ? 10 : 16),
        endDate: event.endDate.substring(0, event.isAllDay ? 10 : 16),
        isAllDay: event.isAllDay,
        labelRowId: event.labelRowId ?? undefined,
        location: event.location || "",
        rrule: event.rrule ?? undefined,
        reminderMinutes: reminderMins,
        calendarRowId: event.calendarRowId ?? defaultCalendar?.rowId,
      });
    } else {
      reset(
        newEventValues(
          defaultDate,
          defaultEndDate,
          defaultCalendar,
          initialTitle,
          initialAllDay,
        ),
      );
    }
    // reset 이 끝났다는 신호를 렌더로 알린다 — 값(제목 등)으로 짐작하지 않으려고 effect 안에서 상태로 적는다(reset 보다 먼저 참이 될 길이 없다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncedEvent(event ?? null);
  }, [
    event,
    reset,
    defaultDate,
    defaultEndDate,
    defaultCalendar,
    initialTitle,
    initialAllDay,
  ]);

  const handleRecurrenceChange = (option: RecurrenceOption) => {
    // 같은 값을 다시 고르면 건드리지 않는다 — 원래 RRULE(BYDAY · INTERVAL 등)이 단순 규칙으로 덮이거나 다섯 밖 규칙이 풀린다(select.md:91 · I-09 27)
    if (option === recurrence) return;
    setRecurrence(option);
    setValue("rrule", recurrenceToRrule[option], { shouldDirty: true });
  };

  const handleRemindersChange = (next: number[]) => {
    const sorted = [...next].sort((a, b) => a - b);
    setSelectedReminders(sorted);
    setValue("reminderMinutes", sorted, { shouldDirty: true });
  };

  /** 캘린더를 고른다 — 일정 색 칸은 없고, 저장값은 그 캘린더 색으로 채운 그대로다 */
  const handleCalendarChange = (rowId: number) => {
    // 같은 캘린더를 다시 고르면 저장 색을 캘린더 색으로 덮지 않는다
    if (rowId === selectedCalendarRowId) return;
    const cal = selectableCalendars.find((c) => c.rowId === rowId);
    if (!cal) return;
    setValue("calendarRowId", cal.rowId, { shouldDirty: true });
    setValue("color", cal.color, { shouldDirty: true });
  };

  const handleLabelChange = (rowId: number | undefined) =>
    setValue("labelRowId", rowId, { shouldDirty: true });

  /** 종일 켜고 끌 때 날짜 · 시각 보정 */
  const handleAllDayChange = (checked: boolean) => {
    setValue("isAllDay", checked, { shouldDirty: true });

    // 핸들러 안에서의 1 회 읽기라 `getValues` 가 맞다 — `watch` 는 구독을
    // 만드는 API 라 컴파일러가 이 컴포넌트 최적화를 통째로 건너뛴다.
    const currentStart = getValues("startDate");
    const currentEnd = getValues("endDate");

    if (checked) {
      // datetime-local → date: strip time
      setValue("startDate", currentStart.substring(0, 10));
      setValue("endDate", currentEnd.substring(0, 10));
    } else {
      // date → datetime-local: add default time
      if (!currentStart.includes("T")) {
        setValue("startDate", `${currentStart}T09:00`);
      }
      if (!currentEnd.includes("T")) {
        setValue("endDate", `${currentEnd}T10:00`);
      }
    }
  };

  /** 시작 날짜(yyyy-MM-dd)를 넣는다 — 시각이 있으면 시각을 지키고, 종료가 앞서면 뒤로 민다 */
  const setStartDay = (d: string) => {
    const allDay = getValues("isAllDay");
    const time = getValues("startDate").substring(11, 16) || "09:00";
    const newStart = allDay ? d : `${d}T${time}`;
    setValue("startDate", newStart, { shouldDirty: true });
    const adjusted = ensureEndAfterStart(
      newStart,
      getValues("endDate"),
      allDay,
    );
    if (adjusted !== getValues("endDate"))
      setValue("endDate", adjusted, { shouldDirty: true });
  };

  /** 시작 시각("HH:mm")을 넣는다 — 종료가 앞서면 뒤로 민다 */
  const setStartTime = (hhmm: string) => {
    const date = getValues("startDate").substring(0, 10);
    const newStart = `${date}T${hhmm}`;
    setValue("startDate", newStart, { shouldDirty: true });
    const adjusted = ensureEndAfterStart(newStart, getValues("endDate"), false);
    if (adjusted !== getValues("endDate"))
      setValue("endDate", adjusted, { shouldDirty: true });
  };

  const setEndDay = (d: string) => {
    const allDay = getValues("isAllDay");
    const time = getValues("endDate").substring(11, 16) || "10:00";
    setValue("endDate", allDay ? d : `${d}T${time}`, { shouldDirty: true });
  };

  const setEndTime = (hhmm: string) => {
    const date = getValues("endDate").substring(0, 10);
    setValue("endDate", `${date}T${hhmm}`, { shouldDirty: true });
  };

  /**
   * 저장 본문을 만든다.
   *
   * <b>규칙 하나로 간다 — 이 화면이 가진 칸은 지금 상태를 싣고, 비었으면 `null`.</b>
   * 수정(PUT)은 세 갈래다(`Patch`: 키 없음=유지 · `null`=지움 · 값=교체, QA #96) —
   * 자산·거래·할 일이 먼저 이 규칙으로 넘어갔고(desk-front #363) 일정이 네 번째다.
   *
   * 종전엔 널 허용 칸을 전부 `|| undefined` 로 키째 뺐다. 서버가 무조건 덮어쓰던
   * 시절엔 그래도 **우연히** 지워졌는데, desk-back #325 가 이 다섯 칸을
   * `Optional` 로 옮기면서 "안 보낸 칸=유지" 가 되어 <b>비우고 저장해도 안 지워졌다</b> —
   * 화면은 지워진 척 닫히고 옛 설명·장소·라벨·반복이 서버에 남았다(QA #112).
   *
   * 손대지 않는 칸도 이유가 있다.
   * - `color` — 고르는 칸이 없다(QA 30 12). 캘린더 색으로 채우거나 지금 값이라 **비는 일이
   *   없다.** 널 허용 칸이지만(`Optional<String> color`) 위 전개로 충분하다.
   * - `calendarRowId` — 혼자만 `Optional` 이 **아니다.** 서버가 맨 `Long` 으로 받아
   *   "null 이면 안 옮긴다" 로 읽으므로(`updateEvent` 의 `if (calendarRowId != null)`)
   *   키를 빼든 `null` 을 싣든 결과가 같고, 화면에도 '캘린더 없음' 이 없다.
   */
  const onFormSubmit = (data: CalendarEventFormValues) => {
    onSubmit({
      ...data,
      // 넷 다 이 화면이 그리는 칸이다 — 비운 채 저장하면 지워져야 한다(QA #112).
      description: data.description || null,
      location: data.location || null,
      // '라벨 없음' 은 `undefined` 로 들어온다.
      labelRowId: data.labelRowId ?? null,
      // '반복 안 함' 은 `undefined` 로 들어온다(recurrenceToRrule.none).
      rrule: data.rrule || null,
      // 고른 알림을 **늘** 그대로 싣는다. 0 개일 때 키를 빼면 서버가 "안 고침" 으로
      // 읽어 옛 알림이 그대로 울렸다 — 화면은 다 끈 것처럼 닫히고서(QA #109).
      // 이 칸은 목록을 통째로 바꾸는 자리라 계약이 "null=미변경 · 리스트=교체" 다
      // (`CalendarEventServiceImpl.syncReminders`) — 빈 배열이 "전부 해제" 다.
      reminderMinutes: selectedReminders,
      calendarRowId: data.calendarRowId || undefined,
    });
  };

  return {
    form,
    /** 폼 값이 이 일정으로 맞춰졌다(reset 끝남) — 칸을 그려도 된다. 맞춰지기 전에 칸이 먼저 붙으면 RHF 가 등록을 비워 칸이 빈 채 값이 안 먹는다 */
    isSyncedWith: (e: CalendarEvent | null | undefined) =>
      syncedEvent !== undefined && syncedEvent === (e ?? null),
    handleSubmit,
    onFormSubmit,
    selectableCalendars,
    calendarsLoading,
    refetchCalendars,
    recurrence,
    selectedReminders,
    handleRecurrenceChange,
    handleRemindersChange,
    handleCalendarChange,
    handleLabelChange,
    handleAllDayChange,
    setStartDay,
    setStartTime,
    setEndDay,
    setEndTime,
    startDate,
    endDate,
    isAllDay,
    dateRangeInvalid,
    selectedLabelRowId,
    selectedCalendarRowId,
    title,
    location,
    description,
  };
}
