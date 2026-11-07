import { describe, it, expect } from "vitest";
import {
  convertCalendarEventToIEvent,
  eventBadgeTone,
  eventColorKey,
  withOpenedOccurrence,
} from "./helpers";
import type {
  CalendarEvent,
  CalendarEventFormValues,
} from "@/entities/calendar";

/**
 * 종류(eventType)는 화면까지 살아서 가야 한다.
 *
 * IEvent 에 종류 칸이 아예 없어서, 수정 폼을 만들 때 화면이 "PERSONAL" 을 지어냈고
 * 그 값이 PUT 에 실려 업무·생일 일정을 개인 일정으로 덮었다(QA #89).
 */
function calEvent(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    rowId: 1,
    title: "주간회의",
    description: null,
    eventType: "WORK",
    color: "#2c70bf",
    startDate: "2026-09-07T09:00:00",
    endDate: "2026-09-07T10:00:00",
    isAllDay: false,
    ...over,
  } as CalendarEvent;
}

describe("convertCalendarEventToIEvent.eventType", () => {
  it("업무 일정은 업무로 남는다 — 종전엔 이 칸이 없어 화면이 PERSONAL 을 지어냈다", () => {
    expect(convertCalendarEventToIEvent(calEvent({})).eventType).toBe("WORK");
  });

  it("생일도 마찬가지", () => {
    const ev = convertCalendarEventToIEvent(
      calEvent({ eventType: "BIRTHDAY" }),
    );
    expect(ev.eventType).toBe("BIRTHDAY");
  });
});

describe("withOpenedOccurrence — 반복 일정은 연 회차를 함께 알린다(QA 30 2)", () => {
  const form: CalendarEventFormValues = {
    title: "헬스",
    eventType: "PERSONAL",
    color: "#2c70bf",
    startDate: "2026-09-21T10:00",
    endDate: "2026-09-21T11:00",
    isAllDay: false,
    rrule: "FREQ=WEEKLY",
  };

  it("반복 일정 — 셋째 회차를 열었으면 그 회차의 원래 시작을 싣는다", () => {
    const out = withOpenedOccurrence(form, {
      rrule: "FREQ=WEEKLY",
      startDate: "2026-09-21T10:00:00",
    });

    expect(out.occurrenceStartDate).toBe("2026-09-21T10:00:00");
    expect(out.startDate).toBe(form.startDate);
  });

  it("반복이 아닌 일정은 본문을 그대로 둔다", () => {
    const out = withOpenedOccurrence(form, {
      rrule: null,
      startDate: "2026-09-21T10:00:00",
    });

    expect(out).not.toHaveProperty("occurrenceStartDate");
  });
});

/**
 * 일정 색은 한 식으로 고른다(I-09 5) — 라벨 색 → 캘린더 색 → 일정에 저장된 색.
 * 격자 칩 · 그날 시트 · 상세가 모두 같은 결과를 내야 한다.
 */
describe("일정 색 고르기", () => {
  const BLUE = "#2c70bf";
  const GREEN = "#2d8060";
  const PINK = "#b83b7a";
  const base = {
    sourceType: "calendar" as const,
    labelColor: null,
    calendarColor: null,
    color: PINK,
  };

  it("라벨 색이 있으면 라벨 → 없으면 캘린더 → 없으면 저장된 색", () => {
    expect(
      eventColorKey({ ...base, labelColor: GREEN, calendarColor: BLUE }),
    ).toBe(GREEN);
    expect(eventColorKey({ ...base, calendarColor: BLUE })).toBe(BLUE);
    expect(eventColorKey(base)).toBe(PINK);
  });

  it("변환기가 저장 색 자리에 캘린더 색을 먼저 담아도 결과가 같다", () => {
    const ev = convertCalendarEventToIEvent({
      rowId: 1,
      title: "회의",
      eventType: "PERSONAL",
      color: PINK,
      startDate: "2026-10-22T10:00:00",
      endDate: "2026-10-22T11:00:00",
      isAllDay: false,
      calendarColor: BLUE,
      labelColor: null,
    } as unknown as CalendarEvent);
    expect(eventColorKey(ev)).toBe(BLUE);
    expect(eventBadgeTone(ev).bg).toBe("var(--color-chart-blue-weak)");
  });

  it("칩 바탕 · 글은 chart-{색}-weak · -contrast 토큰이다(섞은 색 없음)", () => {
    const tone = eventBadgeTone({ ...base, labelColor: GREEN });
    expect(tone.color).toBe("var(--color-chart-green)");
    expect(tone.bg).toBe("var(--color-chart-green-weak)");
    expect(tone.fg).toBe("var(--color-chart-green-contrast)");
    expect(`${tone.bg}${tone.fg}`).not.toContain("color-mix");
  });

  it("공휴일은 chart-red 짝이다", () => {
    const holiday = {
      ...base,
      sourceType: "holiday" as const,
      color: "#c73838",
    };
    expect(eventBadgeTone(holiday)).toEqual({
      color: "var(--color-chart-red)",
      bg: "var(--color-chart-red-weak)",
      fg: "var(--color-chart-red-contrast)",
    });
  });
});
