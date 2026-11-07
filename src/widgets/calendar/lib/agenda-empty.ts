import { endOfMonth, parseISO, startOfMonth } from "date-fns";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

/**
 * 목록 보기가 비었을 때의 까닭(result-section.md "비어 있는 까닭마다").
 * - "filtered": 이 달에 일정이 있는데 거르느라 0건이거나, 캘린더를 모두 숨겼다 — "조건에 맞는 일정이 없어요", 추가 버튼 없음
 * - "month": 이 달에 정말 없다 — "10월 일정이 없어요" + [일정 추가]
 * `allEvents` 는 거르기 전(받아 온 그대로) 목록이다.
 */
export function agendaEmptyReason(
  allEvents: IEvent[],
  month: Date,
  calendarRowIds: number[],
  isCalendarVisible: (rowId: number) => boolean,
): "month" | "filtered" {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const hasEventInMonth = allEvents.some(
    (e) => parseISO(e.startDate) <= end && parseISO(e.endDate) >= start,
  );
  const allHidden =
    calendarRowIds.length > 0 &&
    calendarRowIds.every((id) => !isCalendarVisible(id));
  return hasEventInMonth || allHidden ? "filtered" : "month";
}
