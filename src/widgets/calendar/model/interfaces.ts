import type { CalendarEventType, EventReminderInfo } from "@/entities/calendar";

export type TSourceType = "calendar" | "expense" | "todo" | "holiday";

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
   * 일정이 아닌 소스(지출·할 일)는 종류가 없으므로 `null` 이다 — 지어내지 않는다.
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
  /**
   * expense 이벤트의 **일별 합계용** 금액 — 지출 음수 / 수입 양수 /
   * 환불된 거래 0(삭제와 똑같이 합계에서 빠진다. 칩은 `title` 로 그리므로
   * 셀에는 제 금액으로 남는다).
   * title 에서 금액을 되파싱하면 en 로케일의 `-₩50,000`(부호와 숫자 사이 ₩)이나
   * 숫자로 시작하는 카테고리명에서 깨진다.
   */
  expenseAmount?: number;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
