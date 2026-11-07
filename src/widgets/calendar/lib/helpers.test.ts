import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { i18n } from "@/shared/i18n/config";
import {
  convertCalendarEventToIEvent,
  convertExpenseToIEvent,
  eventBadgeTone,
  eventColorKey,
  withOpenedOccurrence,
} from "./helpers";
import type {
  CalendarEvent,
  CalendarEventFormValues,
} from "@/entities/calendar";
import type { Expense } from "@/entities/expense";

/**
 * 캘린더 일별 합계는 title 이 아니라 expenseAmount 를 쓴다.
 *
 * 예전엔 title 을 `([+-])?([\d,]+)` 로 되파싱했는데,
 *  - en 로케일 `-₩50,000` 은 부호와 숫자 사이 ₩ 때문에 부호를 놓쳐
 *    지출이 전부 환불(양수)로 뒤집혔고,
 *  - `2차회식 -50,000원` 은 카테고리명의 `2` 를 금액으로 읽었다.
 * 그래서 converter 가 부호 값을 직접 실어 준다 — 지출 음수 / 수입·환불 양수.
 */
function tx(over: Partial<Expense>): Expense {
  return {
    rowId: 1,
    categoryRowId: 1,
    categoryName: "식비",
    assetRowId: null,
    assetName: null,
    expenseType: "EXPENSE",
    amount: 50000,
    merchant: "가맹점",
    description: "",
    expenseDate: "2026-09-01T12:00:00",
    ...over,
  } as Expense;
}

describe("convertExpenseToIEvent.expenseAmount", () => {
  const orig = i18n.language;
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(async () => {
    await i18n.changeLanguage(orig);
  });

  it("지출은 음수 — en 로케일 ₩ 가 부호를 가리지 않는다", () => {
    const ev = convertExpenseToIEvent(tx({}));
    // 부호는 U+2212(−) — 하이픈과 섞이면 tabular-nums 정렬이 어긋난다(QA #22).
    expect(ev.title).toContain("−₩50,000");
    expect(ev.expenseAmount).toBe(-50000);
  });

  it("수입은 양수", () => {
    const ev = convertExpenseToIEvent(tx({ expenseType: "INCOME" }));
    expect(ev.expenseAmount).toBe(50000);
  });

  it("환불된 지출은 합계 기여가 0 — 칩은 제 금액·색으로 남는다", () => {
    // 마크 모델에서는 환불이 수입 행을 만들지 않는다. 그 거래는 여전히 지출이라
    // 셀에 남아 있어야 "환불한 그 건" 을 찾을 수 있고, 일별 합계에서는 삭제와
    // 똑같이 빠져야 한다. 그래서 칩(title)과 합계(expenseAmount)가 갈린다.
    const ev = convertExpenseToIEvent(
      tx({
        expenseType: "EXPENSE",
        refundedAt: "2026-09-18T12:00:00",
        amount: 3000,
      }),
    );
    expect(ev.expenseAmount).toBe(0);
    expect(ev.title).toContain("₩3,000");
    expect(ev.color).toBe("#c73838");
  });

  it("숫자로 시작하는 카테고리명도 금액과 섞이지 않는다", () => {
    const ev = convertExpenseToIEvent(tx({ categoryName: "2차회식" }));
    expect(ev.expenseAmount).toBe(-50000);
  });
});

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

  it("일정이 아닌 소스(지출)는 종류가 없다 — 지어내지 않는다", () => {
    expect(convertExpenseToIEvent(tx({})).eventType).toBeNull();
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
