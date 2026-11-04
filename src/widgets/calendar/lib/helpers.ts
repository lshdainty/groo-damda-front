import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInDays,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { MINUS, money } from "@/shared/lib/groo/format";
import type {
  CalendarEvent,
  CalendarEventFormValues,
  Holiday,
} from "@/entities/calendar";
import {
  isCardCarryoverTx,
  isRefundedTx,
  type Expense,
} from "@/entities/expense";
import type {
  IEvent,
  ICalendarCell,
} from "@/widgets/calendar/model/interfaces";
import type {
  TCalendarView,
  TVisibleHours,
  TWorkingHours,
} from "@/widgets/calendar/model/types";

// ================ Header helper functions ================ //

export function navigateDate(
  date: Date,
  view: TCalendarView,
  direction: "previous" | "next",
): Date {
  const operations = {
    agenda: direction === "next" ? addMonths : subMonths,
    year: direction === "next" ? addYears : subYears,
    month: direction === "next" ? addMonths : subMonths,
    week: direction === "next" ? addWeeks : subWeeks,
    day: direction === "next" ? addDays : subDays,
  };

  return operations[view](date, 1);
}

// ================ Week and day view helper functions ================ //

export function getCurrentEvents(events: IEvent[]) {
  const now = new Date();
  return (
    events.filter((event) =>
      isWithinInterval(now, {
        start: parseISO(event.startDate),
        end: parseISO(event.endDate),
      }),
    ) || null
  );
}

export function groupEvents(dayEvents: IEvent[]) {
  const sortedEvents = dayEvents.sort(
    (a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
  );
  const groups: IEvent[][] = [];

  for (const event of sortedEvents) {
    const eventStart = parseISO(event.startDate);

    let placed = false;
    for (const group of groups) {
      const lastEventInGroup = group[group.length - 1];
      if (!lastEventInGroup) continue;
      const lastEventEnd = parseISO(lastEventInGroup.endDate);

      if (eventStart >= lastEventEnd) {
        group.push(event);
        placed = true;
        break;
      }
    }

    if (!placed) groups.push([event]);
  }

  return groups;
}

export function getEventBlockStyle(
  event: IEvent,
  day: Date,
  groupIndex: number,
  groupSize: number,
  visibleHoursRange?: { from: number; to: number },
) {
  const startDate = parseISO(event.startDate);
  const dayStart = new Date(day.setHours(0, 0, 0, 0));
  const eventStart = startDate < dayStart ? dayStart : startDate;
  const startMinutes = differenceInMinutes(eventStart, dayStart);

  let top;

  if (visibleHoursRange) {
    const visibleStartMinutes = visibleHoursRange.from * 60;
    const visibleEndMinutes = visibleHoursRange.to * 60;
    const visibleRangeMinutes = visibleEndMinutes - visibleStartMinutes;
    top = ((startMinutes - visibleStartMinutes) / visibleRangeMinutes) * 100;
  } else {
    top = (startMinutes / 1440) * 100;
  }

  const width = 100 / groupSize;
  const left = groupIndex * width;

  return { top: `${top}%`, width: `${width}%`, left: `${left}%` };
}

export function isWorkingHour(hour: number, workingHours: TWorkingHours) {
  return hour >= workingHours.start && hour < workingHours.end;
}

export function getVisibleHours(
  visibleHours: TVisibleHours,
  singleDayEvents: IEvent[],
) {
  let earliestEventHour = visibleHours.start;
  let latestEventHour = visibleHours.end;

  singleDayEvents.forEach((event) => {
    const startHour = parseISO(event.startDate).getHours();
    const endTime = parseISO(event.endDate);
    const endHour = endTime.getHours() + (endTime.getMinutes() > 0 ? 1 : 0);
    if (startHour < earliestEventHour) earliestEventHour = startHour;
    if (endHour > latestEventHour) latestEventHour = endHour;
  });

  latestEventHour = Math.min(latestEventHour, 24);

  const hours = Array.from(
    { length: latestEventHour - earliestEventHour },
    (_, i) => i + earliestEventHour,
  );

  return { hours, earliestEventHour, latestEventHour };
}

/**
 * 그 날과 겹치는 일정 + 공휴일(지출/할일 pseudo-event 제외), 시작 시각 차례 — 앱 `_eventsOnDay` 정합.
 * 폰 일별 시트와 데스크톱 · 태블릿 그날 패널이 같은 목록을 쓴다.
 */
export function eventsOnDay(events: IEvent[], date: Date): IEvent[] {
  const ds = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const de = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
  return events
    .filter((e) => e.sourceType === "calendar" || e.sourceType === "holiday")
    .filter((e) => parseISO(e.startDate) <= de && parseISO(e.endDate) >= ds)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// ================ Month view helper functions ================ //

/**
 * 이벤트의 고유 키 생성.
 *
 * <p>반복 일정은 서버가 발생(occurrence)마다 같은 rowId 로 전개해 내려온다
 * (수정·삭제가 시리즈에 걸리도록). id 만으로는 발생들끼리 키가 겹쳐 월뷰
 * 포지션 맵이 서로를 덮어쓴다 — 발생마다 다른 startDate 를 합성한다.
 */
export function getEventUniqueKey(event: IEvent): string {
  return `${event.id}-${event.startDate}`;
}

export function getCalendarCells(selectedDate: Date): ICalendarCell[] {
  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth();

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
  const daysInPrevMonth = getDaysInMonth(currentYear, currentMonth - 1);
  const totalDays = firstDayOfMonth + daysInMonth;

  const prevMonthCells = Array.from({ length: firstDayOfMonth }, (_, i) => ({
    day: daysInPrevMonth - firstDayOfMonth + i + 1,
    currentMonth: false,
    date: new Date(
      currentYear,
      currentMonth - 1,
      daysInPrevMonth - firstDayOfMonth + i + 1,
    ),
  }));

  const currentMonthCells = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    currentMonth: true,
    date: new Date(currentYear, currentMonth, i + 1),
  }));

  const nextMonthCells = Array.from(
    { length: (7 - (totalDays % 7)) % 7 },
    (_, i) => ({
      day: i + 1,
      currentMonth: false,
      date: new Date(currentYear, currentMonth + 1, i + 1),
    }),
  );

  return [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];
}

export function calculateMonthEventPositions(
  multiDayEvents: IEvent[],
  singleDayEvents: IEvent[],
  selectedDate: Date,
) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const eventPositions: { [key: string]: number } = {};
  const occupiedPositions: { [key: string]: boolean[] } = {};

  eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach((day) => {
    const dayKey = startOfDay(day).toISOString();
    occupiedPositions[dayKey] = [];
  });

  const sortedEvents = [
    ...multiDayEvents.sort((a, b) => {
      const aDuration = differenceInDays(
        parseISO(a.endDate),
        parseISO(a.startDate),
      );
      const bDuration = differenceInDays(
        parseISO(b.endDate),
        parseISO(b.startDate),
      );
      return (
        bDuration - aDuration ||
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
      );
    }),
    ...singleDayEvents.sort(
      (a, b) =>
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
    ),
  ];

  sortedEvents.forEach((event) => {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    const eventKey = getEventUniqueKey(event);

    const eventDays = eachDayOfInterval({
      start: eventStart < monthStart ? monthStart : startOfDay(eventStart),
      end: eventEnd > monthEnd ? monthEnd : startOfDay(eventEnd),
    });

    // 칸 수에 위쪽 한도를 두지 않는다 — 몇 줄이 보이는지는 칸 높이가 정하고(칩 + "+N개"), 위치는 모든 일정이 받는다
    let position = 0;
    while (
      !eventDays.every((day) => {
        const dayPositions = occupiedPositions[startOfDay(day).toISOString()];
        return dayPositions && !dayPositions[position];
      })
    ) {
      position += 1;
      if (position > 200) {
        position = -1;
        break;
      }
    }

    if (position !== -1) {
      eventDays.forEach((day) => {
        const dayKey = startOfDay(day).toISOString();
        if (occupiedPositions[dayKey]) {
          occupiedPositions[dayKey][position] = true;
        }
      });
      eventPositions[eventKey] = position;
    }
  });

  return eventPositions;
}

export function getMonthCellEvents(
  date: Date,
  events: IEvent[],
  eventPositions: Record<string, number>,
) {
  const eventsForDate = events.filter((event) => {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    const cellDateStart = startOfDay(date);

    return (
      isSameDay(cellDateStart, eventStart) ||
      isSameDay(cellDateStart, eventEnd) ||
      (cellDateStart >= startOfDay(eventStart) &&
        cellDateStart <= startOfDay(eventEnd))
    );
  });

  return eventsForDate
    .map((event) => ({
      ...event,
      position: eventPositions[getEventUniqueKey(event)] ?? -1,
      isMultiDay: event.startDate !== event.endDate,
    }))
    .sort((a, b) => {
      if (a.isMultiDay && !b.isMultiDay) return -1;
      if (!a.isMultiDay && b.isMultiDay) return 1;
      return a.position - b.position;
    });
}

// ================ Data conversion functions ================ //

/**
 * Expense (가계부 데이터)를 IEvent 인터페이스로 변환
 */
export function convertExpenseToIEvent(expense: Expense): IEvent {
  // 환불된 거래도 제 부호·색으로 그린다 — 지출은 빨강 음수 그대로다. 합계에서만
  // 빠진다(아래 `expenseAmount`).
  const isIncome = expense.expenseType === "INCOME";
  const color = isIncome ? "#0147ad" : "#c73838";
  // 지출만 음수. 부호 문자열을 되비교하지 않고 불린을 기준으로 둔다 — 기호를 바꿔도
  // (하이픈 → U+2212, QA #22) 아래 금액 계산이 따라 깨지지 않게.
  const negative = !isIncome;
  const sign = negative ? MINUS : "+";
  const amount = money(expense.amount, { abs: true });
  const categoryName = expense.categoryName || "";
  const title = categoryName
    ? `${categoryName} ${sign}${amount}`
    : `${sign}${amount}`;
  // 지출 음수 / 수입 양수 — title 의 sign·color 와 같은 규칙.
  //
  // 환불된 거래만 **0** 이다. 이 값은 일별 합계에만 쓰이는데(`buildExpenseSummaryMap`),
  // 환불은 삭제와 똑같이 합계에서 빠져야 한다 — 그러면서도 셀의 칩은 제 금액·색으로
  // 남아야 사용자가 "환불한 그 건" 을 찾을 수 있다. 칩은 `title` 을 쓰므로 두 요구가
  // 여기서 갈린다. 금액 0 인 거래는 저장할 수 없어(금액 > 0) 값이 겹칠 일도 없다.
  const expenseAmount =
    isRefundedTx(expense) || isCardCarryoverTx(expense)
      ? 0
      : negative
        ? -Math.abs(expense.amount)
        : Math.abs(expense.amount);

  return {
    id: expense.rowId,
    expenseAmount,
    startDate: expense.expenseDate,
    endDate: expense.expenseDate,
    title,
    description: expense.description || "",
    color,
    isAllDay: true,
    sourceType: "expense",
    eventType: null,
    calendarRowId: null,
    calendarName: null,
    calendarColor: null,
    labelRowId: null,
    labelName: null,
    labelColor: null,
    location: null,
    rrule: null,
    recurrenceId: null,
    reminders: [],
  };
}

/**
 * Holiday (공휴일 데이터)를 IEvent 인터페이스로 변환
 */
/** 일정 색을 고르는 차례 — 라벨 색 → 캘린더 색 → 일정에 저장된 색(I-09 5). 격자 칩 · 그날 시트 · 상세가 모두 이 식 하나를 쓴다 */
export function eventColorKey(
  event: Pick<IEvent, "labelColor" | "calendarColor" | "color">,
): string {
  return event.labelColor ?? event.calendarColor ?? event.color;
}

/** 공휴일은 `chart-red` 짝(글 · 옅은 바탕 · 바탕 위 글) — 모든 칩 · 타일 · 점이 같은 빨강이다 */
const HOLIDAY_TONE = {
  color: "var(--color-chart-red)",
  bg: "var(--color-chart-red-weak)",
  fg: "var(--color-chart-red-contrast)",
} as const;

type ToneSource = Pick<
  IEvent,
  "sourceType" | "labelColor" | "calendarColor" | "color"
>;

/**
 * 이벤트 칩/뱃지/점 색 — 공휴일은 `chart-red`. 일반 이벤트는 `eventColorKey` 순서로 고른 색의
 * chart palette alias(다크 자동 swap).
 */
export function eventBadgeColor(event?: ToneSource | null): string {
  if (!event) return getPaletteByColor(undefined).color;
  if (event.sourceType === "holiday") return HOLIDAY_TONE.color;
  return getPaletteByColor(eventColorKey(event)).color;
}

/** 이벤트 칩 바탕 · 글 — 팔레트 색은 v111 짝(chart-{hue}-weak · -contrast), 공휴일은 chart-red 짝. */
export function eventBadgeTone(event?: ToneSource | null): {
  color: string;
  bg: string;
  fg: string;
} {
  if (event?.sourceType === "holiday") return { ...HOLIDAY_TONE };
  return getPaletteByColor(event ? eventColorKey(event) : undefined);
}

export function convertHolidayToIEvent(holiday: Holiday): IEvent {
  return {
    id: holiday.rowId + 1000000,
    startDate: `${holiday.holidayDate}T00:00:00`,
    endDate: `${holiday.holidayDate}T23:59:59`,
    title: holiday.holidayName,
    description: "",
    color: "#c73838",
    isAllDay: true,
    sourceType: "holiday",
    eventType: "HOLIDAY",
    calendarRowId: null,
    calendarName: null,
    calendarColor: null,
    labelRowId: null,
    labelName: null,
    labelColor: null,
    location: null,
    rrule: null,
    recurrenceId: null,
    reminders: [],
  };
}

/**
 * CalendarEvent (API 응답)를 IEvent 인터페이스로 변환
 */
export function convertCalendarEventToIEvent(
  calendarEvent: CalendarEvent,
): IEvent {
  return {
    id: calendarEvent.rowId,
    startDate: calendarEvent.startDate,
    endDate: calendarEvent.endDate,
    title: calendarEvent.title,
    description: calendarEvent.description ?? "",
    color: calendarEvent.calendarColor || calendarEvent.color || "#0147ad",
    isAllDay: calendarEvent.isAllDay,
    sourceType: "calendar",
    // 서버가 준 종류를 그대로 들고 다닌다 — 여기서 흘리면 수정 폼이 값을 지어낸다(QA #89).
    eventType: calendarEvent.eventType ?? null,
    userRowId: calendarEvent.userRowId ?? null,
    calendarRowId: calendarEvent.calendarRowId ?? null,
    calendarName: calendarEvent.calendarName ?? null,
    calendarColor: calendarEvent.calendarColor ?? null,
    labelRowId: calendarEvent.labelRowId ?? null,
    labelName: calendarEvent.labelName ?? null,
    labelColor: calendarEvent.labelColor ?? null,
    location: calendarEvent.location ?? null,
    rrule: calendarEvent.rrule ?? null,
    recurrenceId: calendarEvent.recurrenceId ?? null,
    reminders: calendarEvent.reminders ?? [],
  };
}

/**
 * 반복 일정의 수정 본문에 **연 회차의 원래 시작**을 싣는다(QA 30 2).
 *
 * 조회는 회차마다 그 회차의 날짜로 내려오고 수정 폼도 그 날짜로 채워진다. 그 날짜만 보내면
 * 서버가 반복의 시작을 그 회차로 옮겨, 뒤 회차를 열어 아무것도 안 바꾸고 저장해도 앞 회차들이
 * 사라졌다. 연 회차를 알려 주면 서버가 그 회차에서 바뀐 만큼만 반복 전체를 옮긴다.
 * 반복이 아닌 일정은 본문을 그대로 둔다.
 */
export function withOpenedOccurrence(
  data: CalendarEventFormValues,
  opened: Pick<CalendarEvent, "rrule" | "startDate">,
): CalendarEventFormValues {
  return opened.rrule
    ? { ...data, occurrenceStartDate: opened.startDate }
    : data;
}
