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

const render = (
  single: IEvent[],
  multi: IEvent[],
  onEventClick = vi.fn(),
  extra: { emptyReason?: "month" | "filtered"; onAdd?: () => void } = {},
) => {
  act(() =>
    root.render(
      <CalendarAgendaView
        singleDayEvents={single}
        multiDayEvents={multi}
        onEventClick={onEventClick}
        {...extra}
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
    // 이름은 위 날짜 머리에서 얻는다(aria-labelledby) — 같은 글을 두 번 달지 않는다
    const head = container.querySelector("[data-slot=list-header]")!;
    expect(lists[0]!.getAttribute("aria-labelledby")).toBe(head.id);
    expect(lists[0]!.hasAttribute("aria-label")).toBe(false);
    // 공휴일 줄은 button 이 아니다
    expect(lists[0]!.querySelector("button")).toBeNull();
    expect(lists[0]!.textContent).toContain("개천절");
    const row = lists[1]!.querySelector<HTMLButtonElement>("button")!;
    expect(row.textContent).toContain("회의");
    expect(row.textContent).toContain("오후 2:00~오후 3:00");
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
      expect(r.textContent).toContain("종일 · 10월 10일~12일");
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
  it('이 달에 없음 — 제목 "10월 일정이 없어요" · 설명 · [일정 추가] 가 머리와 같은 일을 부른다', () => {
    const onAdd = vi.fn();
    render([], [], vi.fn(), { emptyReason: "month", onAdd });
    const status = container.querySelector("[role=status]")!;
    expect(status.textContent).toContain("10월 일정이 없어요");
    expect(status.textContent).toContain("일정을 추가하면 여기에 모여요.");
    const btn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("일정 추가"),
    )!;
    act(() => btn.click());
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("보는 달을 제목에 말한다 — 11월이면 11월", () => {
    mocks.selected = new Date(2026, 10, 3);
    render([], [], vi.fn(), { onAdd: vi.fn() });
    expect(container.textContent).toContain("11월 일정이 없어요");
  });

  it('걸러서 0건 — "조건에 맞는 일정이 없어요" · "보일 캘린더를 골라보세요." · 버튼 없음', () => {
    render([], [], vi.fn(), { emptyReason: "filtered", onAdd: vi.fn() });
    const status = container.querySelector("[role=status]")!;
    expect(status.textContent).toContain("조건에 맞는 일정이 없어요");
    expect(status.textContent).toContain("보일 캘린더를 골라보세요.");
    expect(container.querySelector("button")).toBeNull();
  });

  it("날마다 region 랜드마크가 생기지 않는다(section aria-label 없음)", () => {
    render([event(1)], [holiday, trip]);
    expect(container.querySelectorAll("section, [role=region]")).toHaveLength(
      0,
    );
  });

  it("달 경계를 넘는 여러 날 일정은 이 달의 날만 나온다(9/29 ~ 10/2 → 10월 1 · 2일)", () => {
    render(
      [],
      [
        event(7, {
          title: "걸친 일정",
          isAllDay: true,
          startDate: "2026-09-29T00:00:00",
          endDate: "2026-10-02T23:59:59",
        }),
      ],
    );
    expect(headers()).toEqual(["10월 1일 (목)", "10월 2일 (금)"]);
  });

  it("스크롤 칸에 scroll-padding-top 이 있다(붙은 날짜 머리가 초점 줄을 가리지 않는다)", () => {
    render([event(1)], []);
    expect(
      container.querySelector("[data-slot=agenda-view]")!.className,
    ).toMatch(/scroll-pt-/);
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
