// 데스크톱 · 태블릿 월 격자 (I-09 16 · 18) — 칸 104, 고른 날, 오늘, 이웃 달 fg-disabled, 칩 20 · 시각 없음 · "+N개", 칩을 누르면 상세
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const mocks = vi.hoisted(() => ({
  setSelectedDate: vi.fn(),
  openQuickAdd: vi.fn(),
  selected: new Date(2026, 9, 22),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) =>
      o?.count != null ? `${k}:${o.count}` : k,
    i18n: { language: "ko" },
  }),
}));
vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({
    selectedDate: mocks.selected,
    setSelectedDate: mocks.setSelectedDate,
    setView: () => {},
  }),
}));
// 일정 추가 폼을 끌고 오는 프로바이더는 갈음한다 — 여기서 볼 것은 칸이다
vi.mock("@/widgets/calendar/model/drag-select-provider", async () => {
  const { DragSelectContext: Ctx } =
    await import("@/widgets/calendar/model/drag-select-context");
  return {
    DragSelectProvider: ({ children }: { children: React.ReactNode }) => (
      <Ctx.Provider
        value={{
          isDragSelecting: false,
          selectionStart: null,
          selectionEnd: null,
          startSelection: () => {},
          updateSelection: () => {},
          endSelection: () => {},
          isDateInSelection: () => false,
          openQuickAdd: mocks.openQuickAdd,
        }}
      >
        {children}
      </Ctx.Provider>
    ),
  };
});

const { CalendarMonthViewDesktop } =
  await import("./calendar-month-view-desktop");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.setSelectedDate.mockClear();
  mocks.openQuickAdd.mockClear();
  mocks.selected = new Date(2026, 9, 22);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 25, 9, 0, 0));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const event = (
  id: number,
  day: number,
  over: Partial<IEvent> = {},
): IEvent => ({
  id,
  startDate: `2026-10-${String(day).padStart(2, "0")}T10:00:00`,
  endDate: `2026-10-${String(day).padStart(2, "0")}T11:00:00`,
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

const render = (events: IEvent[], onEventClick = vi.fn()) => {
  act(() =>
    root.render(
      <CalendarMonthViewDesktop
        singleDayEvents={events}
        multiDayEvents={[]}
        onEventClick={onEventClick}
      />,
    ),
  );
  return onEventClick;
};
const cells = () => [
  ...container.querySelectorAll<HTMLElement>("[data-slot=month-cell]"),
];
const cellOf = (day: string) =>
  cells().find(
    (c) => c.querySelector("[data-slot=month-day-number]")!.textContent === day,
  )!;

describe("데스크톱 월 격자", () => {
  it("칸 높이는 104 하나 — 폭으로 갈리지 않고 화면 높이로 채우지 않는다", () => {
    render([]);
    expect(cells()).toHaveLength(35);
    expect(cells().every((c) => c.className.includes("h-[104px]"))).toBe(true);
    expect(container.innerHTML).not.toContain("96px");
    expect(container.innerHTML).not.toContain("auto-rows-fr");
  });

  it("고른 날은 칸이 bg-brand-weak 이고 숫자는 짙은 원 + 700", () => {
    render([]);
    const c = cellOf("22");
    expect(c.className).toContain("bg-bg-brand-weak");
    const n = c.querySelector("[data-slot=month-day-number]")!;
    expect(n.className).toContain("bg-bg-neutral-inverted");
    expect(n.className).toContain("font-bold");
    expect(n.getAttribute("aria-pressed")).toBe("true");
    expect(cellOf("21").className).not.toContain("bg-bg-brand-weak");
  });

  it("오늘(고르지 않았을 때)은 옅은 원 + 700, 브랜드 채움 아님", () => {
    render([]);
    const n = cellOf("25").querySelector("[data-slot=month-day-number]")!;
    expect(n.className).toContain("bg-bg-neutral-weak");
    expect(n.className).toContain("font-bold");
    expect(n.className).not.toContain("bg-bg-brand");
    expect(n.getAttribute("aria-current")).toBe("date");
  });

  it("이웃 달 숫자만 fg-disabled — 불투명도 클래스가 한 곳에도 없다", () => {
    render([
      event(1, 30, {
        startDate: "2026-09-30T10:00:00",
        endDate: "2026-10-01T10:00:00",
        isAllDay: true,
      }),
    ]);
    const first = cells()[0]!.querySelector("[data-slot=month-day-number]")!;
    expect(first.textContent).toBe("27");
    expect(first.className).toContain("text-fg-disabled");
    expect(
      cellOf("15").querySelector("[data-slot=month-day-number]")!.className,
    ).not.toContain("text-fg-disabled");
    expect(container.querySelectorAll("[class*='opacity-']")).toHaveLength(0);
  });

  it("숫자를 누르면 그 날을 고른다 — 일 보기로 가지 않는다", () => {
    render([]);
    act(() => cellOf("17").querySelector<HTMLButtonElement>("button")!.click());
    expect(mocks.setSelectedDate).toHaveBeenCalledTimes(1);
    expect((mocks.setSelectedDate.mock.calls[0]![0] as Date).getDate()).toBe(
      17,
    );
  });

  it('22일 일정 다섯 → 칩 둘 + "+3개" 한 줄, 칩 안에 시각이 없다', () => {
    render([1, 2, 3, 4, 5].map((i) => event(i, 22)));
    const c = cellOf("22");
    expect(c.querySelectorAll("[data-slot=month-chip]")).toHaveLength(2);
    expect(c.querySelector("[data-slot=month-more]")!.textContent).toBe(
      "monthView.moreCount:3",
    );
    expect(c.textContent).not.toMatch(/\d{1,2}:\d{2}/);
    expect(c.textContent).not.toMatch(/오전|오후/);
  });

  it("칩을 누르면 그 일정 상세로 간다(칸 선택은 건드리지 않는다)", () => {
    const onClick = render([event(7, 22)]);
    const chip = cellOf("22").querySelector<HTMLElement>("[role=button]")!;
    act(() => chip.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect((onClick.mock.calls[0]![0] as IEvent).id).toBe(7);
    // 칩이 놓인 칸의 날을 함께 알린다(상세를 여는 쪽이 그 날을 고른다) — 칩 누름이 칸 누름으로 번지지 않는다
    expect((onClick.mock.calls[0]![2] as Date).getDate()).toBe(22);
    expect(mocks.setSelectedDate).not.toHaveBeenCalled();
    expect(mocks.openQuickAdd).not.toHaveBeenCalled();
  });

  it("긴 칩 제목은 칸 안에서 말줄임이고 칸을 넘지 않는다", () => {
    render([event(1, 22, { title: "아주 긴 일정".repeat(10) })]);
    const chip = cellOf("22").querySelector<HTMLElement>(
      "[data-slot=month-chip]",
    )!;
    expect(chip.className).toContain("truncate");
  });
});
