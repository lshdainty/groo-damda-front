// 일정 질의 실패는 빈 달력이 아니다(I-09 12 · 19) — 실패를 알리고 "다시 시도" 는 그 질의만 다시 받는다.
// 공휴일 질의 실패는 격자를 그대로 그린다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type Props = {
  isLoading: boolean;
  isFailed: boolean;
  onRetry: () => void;
  events: unknown[];
};
const mocks = vi.hoisted(() => ({
  props: null as unknown,
  events: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  holidays: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({
    selectedDate: new Date(2026, 9, 22),
    view: "month",
    isBuiltinSourceEnabled: (id: string) => id === "holiday",
  }),
}));
vi.mock("@/widgets/calendar/model/useCalendarEvents", () => ({
  useCalendarEvents: () => mocks.events,
}));
vi.mock("@/widgets/calendar/model/useCalendarHolidays", () => ({
  useCalendarHolidays: () => mocks.holidays,
}));
vi.mock("@/widgets/calendar/ui/CalendarContainer", () => ({
  CalendarContainer: (p: unknown) => {
    mocks.props = p;
    return null;
  },
}));

const { CalendarContent } = await import("./CalendarContent");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.events = {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  mocks.holidays = {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const props = () => mocks.props as Props;
const render = () => act(() => root.render(<CalendarContent />));

describe("일정 질의 실패", () => {
  it("내용 없이 실패하면 실패로 알린다", () => {
    mocks.events = { ...mocks.events, isError: true };
    render();
    expect(props().isFailed).toBe(true);
    expect(props().isLoading).toBe(false);
  });

  it('"다시 시도" 는 일정 질의만 다시 받는다 — 공휴일은 건드리지 않는다', () => {
    mocks.events = { ...mocks.events, isError: true };
    render();
    props().onRetry();
    expect(mocks.events.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.holidays.refetch).not.toHaveBeenCalled();
  });

  it("이미 받아 둔 일정이 있으면 다시 받기가 실패해도 그 값을 둔다", () => {
    mocks.events = { ...mocks.events, isError: true, data: [] };
    render();
    expect(props().isFailed).toBe(false);
  });

  it("공휴일 질의 실패는 격자를 그린다 — 실패로 알리지 않는다", () => {
    mocks.events = { ...mocks.events, data: [] };
    mocks.holidays = { ...mocks.holidays, isError: true };
    render();
    expect(props().isFailed).toBe(false);
    expect(props().events).toEqual([]);
  });

  it("처음 받는 중이면 불러오는 중이다", () => {
    mocks.events = { ...mocks.events, isLoading: true };
    render();
    expect(props().isLoading).toBe(true);
    expect(props().isFailed).toBe(false);
  });
});
