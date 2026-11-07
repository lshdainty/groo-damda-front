// 목록 보기 (I-wrap-b1 γ) — 날짜 머리 = List 머리(formatMonthDayDow) · 줄 = 그날 패널과 같은 DayEventList · 빈 상태 = Result Section.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const mocks = vi.hoisted(() => ({ selected: new Date(2026, 9, 21) }));
vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({ selectedDate: mocks.selected }),
}));

const { CalendarAgendaView } = await import("./calendar-agenda-view");
const { CalendarAgendaViewSkeleton } =
  await import("./calendar-agenda-view-skeleton");
const { i18n: appI18n } = await import("@/shared/i18n/config");

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  await appI18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0, 0));
  mocks.selected = new Date(2026, 9, 21);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const event = (id: number, over: Partial<IEvent> = {}): IEvent => ({
  id,
  startDate: "2026-10-05T14:00:00",
  endDate: "2026-10-05T15:00:00",
  title: `일정 ${id}`,
  description: "",
  color: "#2c70bf",
  isAllDay: false,
  sourceType: "calendar",
  eventType: null,
  calendarRowId: 1,
  calendarName: null,
  calendarColor: null,
  labelRowId: null,
  labelName: null,
  labelColor: null,
  location: null,
  rrule: null,
  recurrenceId: null,
  reminders: [],
  ...over,
});

const holiday = event(9, {
  title: "개천절",
  sourceType: "holiday",
  isAllDay: true,
  startDate: "2026-10-03T00:00:00",
  endDate: "2026-10-03T23:59:59",
});
const trip = event(3, {
  title: "출장",
  isAllDay: true,
  startDate: "2026-10-10T00:00:00",
  endDate: "2026-10-12T23:59:59",
});

const render = (single: IEvent[], multi: IEvent[], onEventClick = vi.fn()) => {
  act(() =>
    root.render(
      <CalendarAgendaView
        singleDayEvents={single}
        multiDayEvents={multi}
        onEventClick={onEventClick}
      />,
    ),
  );
  return onEventClick;
};

const headers = () =>
  [...container.querySelectorAll("[data-slot=list-header]")].map(
    (h) => h.textContent,
  );

describe("목록 보기 날짜 머리", () => {
  it('"10월 5일 (월)" — 0 을 붙이지 않고 요일을 줄인다', () => {
    render([event(1)], [holiday, trip]);
    expect(headers()).toEqual([
      "10월 3일 (토)",
      "10월 5일 (월)",
      "10월 10일 (토)",
      "10월 11일 (일)",
      "10월 12일 (월)",
    ]);
  });

  it('다른 해는 "2025년 10월 5일 (일)"', () => {
    vi.setSystemTime(new Date(2027, 0, 10));
    render([event(1, { startDate: "2026-10-05T14:00:00" })], []);
    expect(headers()).toEqual(["2026년 10월 5일 (월)"]);
  });

  it("고른 달 밖의 날은 나오지 않는다", () => {
    render(
      [
        event(1, {
          startDate: "2026-09-30T10:00:00",
          endDate: "2026-09-30T11:00:00",
        }),
      ],
      [],
    );
    expect(headers()).toEqual([]);
  });
});

describe("목록 보기 줄", () => {
  it("줄은 그날 패널과 같은 DayEventList 다 — 누르는 줄 + 공휴일은 누르지 않는 줄", () => {
    render([event(1, { title: "회의" })], [holiday]);
    const lists = container.querySelectorAll("[data-slot=list]");
    expect(lists).toHaveLength(2);
    expect(lists[0]!.getAttribute("aria-label")).toBe("10월 3일 (토)");
    // 공휴일 줄은 button 이 아니다
    expect(lists[0]!.querySelector("button")).toBeNull();
    expect(lists[0]!.textContent).toContain("개천절");
    const row = lists[1]!.querySelector<HTMLButtonElement>("button")!;
    expect(row.textContent).toContain("회의");
    expect(row.textContent).toContain("오후 2:00 ~ 오후 3:00");
    expect(
      row.closest("li")!.querySelector("[data-slot=list-tile]"),
    ).not.toBeNull();
  });

  it("누르면 일정과 누른 요소를 넘긴다", () => {
    const e = event(1, { title: "회의" });
    const onClick = render([e], []);
    const row = container.querySelector<HTMLButtonElement>("button")!;
    act(() => row.click());
    expect(onClick).toHaveBeenCalledWith(e, row);
  });

  it("여러 날 일정은 날마다 같은 줄이 나온다(하루 패널과 같은 줄 글)", () => {
    render([], [trip]);
    const rows = [...container.querySelectorAll("button")];
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.textContent).toContain("출장");
      expect(r.textContent).toContain("종일 · 10월 10일 ~ 12일");
    }
  });

  it("한 날 안 차례는 시작 시각이다", () => {
    render(
      [
        event(1, {
          title: "늦은 일정",
          startDate: "2026-10-05T18:00:00",
          endDate: "2026-10-05T19:00:00",
        }),
        event(2, {
          title: "이른 일정",
          startDate: "2026-10-05T08:00:00",
          endDate: "2026-10-05T09:00:00",
        }),
      ],
      [],
    );
    const titles = [...container.querySelectorAll("button")].map(
      (b) => b.textContent,
    );
    expect(titles[0]).toContain("이른 일정");
    expect(titles[1]).toContain("늦은 일정");
  });
});

describe("목록 보기 빈 상태 · 클래스", () => {
  it("빈 상태는 Result Section empty — 해요체, 손 <p> 가 아니다", () => {
    render([], []);
    const status = container.querySelector("[role=status]")!;
    expect(status).not.toBeNull();
    expect(status.textContent).toBe("일정이 없어요");
    expect(container.querySelector("p")).toBeNull();
  });

  it("옛 색 · 글자 · 모서리 클래스와 손 role=button 이 없다", () => {
    render([event(1)], [holiday, trip]);
    expect(container.querySelector("[role=button]")).toBeNull();
    expect(container.innerHTML).not.toMatch(
      /text-muted-foreground|bg-background|text-(?:xs|sm|base)\b|rounded-(?:md|lg)\b|animate-pulse/,
    );
  });
});

describe("목록 보기 스켈레톤", () => {
  it("펄스 · 옛 색이 없고 ds Skeleton + List 줄이다", () => {
    act(() => root.render(<CalendarAgendaViewSkeleton />));
    expect(container.innerHTML).not.toMatch(
      /animate-pulse|bg-muted|rounded-lg/,
    );
    expect(
      container.querySelectorAll("[data-slot=skeleton]").length,
    ).toBeGreaterThan(0);
    expect(container.querySelectorAll("[data-slot=list]").length).toBe(5);
  });
});
