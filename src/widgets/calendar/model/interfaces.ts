import type { CalendarEventType, EventReminderInfo } from "@/entities/calendar";

export type TSourceType = "calendar" | "holiday";

export interface IEvent {
  id: number;
  startDate: string;
  endDate: string;
  title: string;
  description: string;
  color: string;
  isAllDay: boolean;
  sourceType: TSourceType;
  /**
   * 일정의 종류. 종전엔 이 칸이 아예 없어서 화면이 수정 폼을 만들 때 `PERSONAL` 을
   * 지어냈고, 그 값이 PUT 에 실려 업무·생일 일정을 개인 일정으로 덮었다(QA #89).
   * 일정이 아닌 소스(공휴일)는 종류가 없으므로 `null` 이다 — 지어내지 않는다.
   */
  eventType: CalendarEventType | null;
  /** 만든 사람(캘린더 일정만) — 수정 · 삭제 권한 판정에 쓴다 */
  userRowId?: number | null;
  calendarRowId: number | null;
  calendarName: string | null;
  calendarColor: string | null;
  labelRowId: number | null;
  labelName: string | null;
  labelColor: string | null;
  location: string | null;
  rrule: string | null;
  recurrenceId: number | null;
  reminders: EventReminderInfo[];
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
