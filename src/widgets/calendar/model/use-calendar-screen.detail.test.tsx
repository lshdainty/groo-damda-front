// 일정을 눌렀을 때의 화면 상태 (I-09b 15 · 16) — 칩은 그 날을 고르고 상세를 열며, 공휴일 칩은 날만 고른다. 지운 일정의 상세는 닫힌다
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const mocks = vi.hoisted(() => ({
  setSelectedDate: vi.fn(),
  mutate: vi.fn(),
  selected: new Date(2026, 9, 22),
  view: "month",
}));
vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({
    selectedDate: mocks.selected,
    setSelectedDate: mocks.setSelectedDate,
    view: mocks.view,
    isBuiltinSourceEnabled: () => true,
    isCalendarVisible: () => true,
  }),
}));
vi.mock("@/widgets/calendar/model/useCalendarEvents", () => ({
  useDeleteEvent: () => ({ mutate: mocks.mutate, isPending: false }),
}));

const { useCalendarScreen } = await import("./use-calendar-screen");
type Screen = ReturnType<typeof useCalendarScreen>;

let container: HTMLDivElement;
let root: Root;
// 화면 상태를 시험 밖으로 꺼낸다 — 렌더 중에 바깥 변수를 바꾸지 않고 효과에서 담는다
const holder: { current: Screen | null } = { current: null };
const screen = () => holder.current!;
function Probe({ events }: { events: IEvent[] }) {
  const s = useCalendarScreen(events);
  useEffect(() => {
    holder.current = s;
  });
  return null;
}

const event = (id: number, over: Partial<IEvent> = {}): IEvent => ({
  id,
  startDate: "2026-10-16T10:00:00",
  endDate: "2026-10-16T11:00:00",
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

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.selected = new Date(2026, 9, 22);
  mocks.view = "month";
  mocks.setSelectedDate.mockReset();
  // 고른 날을 실제 컨텍스트처럼 바꾼다 — 칩이 날을 고르고 상세를 여는 한 묶음이 그대로 서 있어야 한다
  mocks.setSelectedDate.mockImplementation((d: Date) => {
    mocks.selected = d;
  });
  mocks.mutate.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe events={[]} />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("일정 누름", () => {
  it("칩을 누르면 그 칩이 놓인 날을 고르고, 그 일정의 상세를 연다 — 연 순간 고른 날을 적어 둔다", () => {
    act(() => screen().openDetail(event(3), undefined, new Date(2026, 9, 16)));
    expect(mocks.setSelectedDate).toHaveBeenCalledTimes(1);
    expect((mocks.setSelectedDate.mock.calls[0]![0] as Date).getDate()).toBe(
      16,
    );
    expect(screen().detail).toEqual({
      ref: { id: 3, day: "2026-10-16" },
      day: "2026-10-16",
    });
  });

  it("패널 줄을 누르면 날은 그대로 두고 지금 고른 날로 상세를 연다", () => {
    act(() => screen().openDetail(event(3)));
    expect(mocks.setSelectedDate).not.toHaveBeenCalled();
    expect(screen().detail?.day).toBe("2026-10-22");
  });

  it("공휴일 칩은 날만 고른다 — 상세가 열리지 않는다", () => {
    act(() =>
      screen().openDetail(
        event(9, { sourceType: "holiday" }),
        undefined,
        new Date(2026, 9, 9),
      ),
    );
    expect(mocks.setSelectedDate).toHaveBeenCalledTimes(1);
    expect(screen().detail).toBeNull();
  });
});

const rerender = () => act(() => root.render(<Probe events={[]} />));

// 가리기만 하면 22일 → 23일 → 22일 에서 지난 상세가 되살아나고, 보기를 바꾸면 누르지 않은 대화상자가 뜬다
describe("고른 날 · 보기가 바뀌면 상세는 비워진다 (I-09b 15)", () => {
  it("22일 상세 → 23일 → 22일 이어도 되살아나지 않는다", () => {
    act(() => screen().openDetail(event(3)));
    expect(screen().detail).not.toBeNull();
    mocks.selected = new Date(2026, 9, 23);
    rerender();
    expect(screen().detail).toBeNull();
    mocks.selected = new Date(2026, 9, 22);
    rerender();
    expect(screen().detail).toBeNull();
  });

  it("보기를 바꾸면 비워진다 — 월 → 주 에서 대화상자가 저절로 뜨지 않는다", () => {
    act(() => screen().openDetail(event(3)));
    mocks.view = "week";
    rerender();
    expect(screen().detail).toBeNull();
    mocks.view = "month";
    rerender();
    expect(screen().detail).toBeNull();
  });

  it("같은 날 · 같은 보기로 다시 그려도 그대로다", () => {
    act(() => screen().openDetail(event(3)));
    rerender();
    expect(screen().detail?.ref.id).toBe(3);
  });

  it("달을 옮기면(고른 날이 다른 달로) 비워진다", () => {
    act(() => screen().openDetail(event(3)));
    mocks.selected = new Date(2026, 10, 22);
    rerender();
    expect(screen().detail).toBeNull();
  });
});

describe("삭제", () => {
  it("반복 일정은 확인창이 모든 회차를 말하게 반복 표식을 든다", () => {
    act(() => screen().requestDelete(event(3, { rrule: "FREQ=WEEKLY" })));
    expect(screen().deleting).toEqual({
      id: 3,
      title: "일정 3",
      recurring: true,
    });
    act(() => screen().requestDelete(event(4)));
    expect(screen().deleting?.recurring).toBe(false);
  });

  // W8 — 삭제 실패는 서버 글 대신 호출처가 알린다: 요청은 silent, 실패하면 확인창을 닫고 호출처 알림
  it("삭제 요청은 silent 로 부른다 — 전역 토스트(서버 글)가 겹치지 않는다", () => {
    act(() => screen().requestDelete(event(3)));
    act(() => screen().handleConfirmDelete());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.mutate.mock.calls[0]![0]).toEqual({ id: 3, silent: true });
  });

  it("삭제가 실패하면 확인창을 닫고 호출처 알림을 부른다 — 상세는 그대로", () => {
    mocks.mutate.mockImplementation((_v: unknown, o: { onError: () => void }) =>
      o.onError(),
    );
    const failed = vi.fn();
    act(() => screen().openDetail(event(3)));
    act(() => screen().requestDelete(event(3)));
    act(() => screen().handleConfirmDelete(failed));
    expect(failed).toHaveBeenCalledTimes(1);
    expect(screen().deleting).toBeNull();
    expect(screen().detail?.ref.id).toBe(3);
  });

  it("지운 일정의 상세는 닫힌다 — 다른 일정의 상세는 그대로", () => {
    mocks.mutate.mockImplementation(
      (_id: number, o: { onSuccess: () => void }) => o.onSuccess(),
    );
    act(() => screen().openDetail(event(3)));
    act(() => screen().requestDelete(event(3)));
    act(() => screen().handleConfirmDelete());
    expect(screen().deleting).toBeNull();
    expect(screen().detail).toBeNull();

    act(() => screen().openDetail(event(5)));
    act(() => screen().requestDelete(event(3)));
    act(() => screen().handleConfirmDelete());
    expect(screen().detail?.ref.id).toBe(5);
  });
});
