// 폰 그날 시트 — 기기 뒤로 가기 (I-09b 5). ds `useBackClose` 는 히스토리 칸을 모듈 전역으로 세므로 다른 시험과 파일을 나눈다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import { click, setValue, setupFormDom } from "../event-form/test-utils";

import type { CalendarEventFormValues } from "@/entities/calendar";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
}));

const updates = vi.hoisted(
  () => [] as { id: number; data: CalendarEventFormValues }[],
);
const mocks = vi.hoisted(() => ({
  me: 7,
  roles: { 1: "READ" } as Record<number, string>,
  calendars: [] as unknown[],
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({ data: { rowId: mocks.me } }),
}));
vi.mock("@/features/user-calendar", () => ({
  useUserCalendars: () => ({ data: mocks.calendars }),
}));
vi.mock("@/features/event-label", () => ({
  useEventLabels: () => ({ data: [] }),
}));
vi.mock("@/widgets/calendar/model/useCalendarEvents", () => ({
  useUpdateEvent: () => ({
    mutate: (
      v: { id: number; data: CalendarEventFormValues },
      o?: { onSuccess?: () => void },
    ) => {
      updates.push(v);
      o?.onSuccess?.();
    },
    isPending: false,
  }),
}));

const { EventDetailSurface } = await import("./event-detail-surface");
const { i18n: appI18n } = await import("@/shared/i18n/config");

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await appI18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupFormDom(false);
  __resetPointerBlockForTest();
  updates.length = 0;
  mocks.me = 7;
  mocks.calendars = [
    {
      rowId: 1,
      myRole: "READ",
      color: "#2c70bf",
      calendarName: "내 캘린더",
      isDefault: true,
      isVisible: true,
      isOwner: false,
    },
    {
      rowId: 2,
      myRole: "EDIT",
      color: "#5e60c8",
      calendarName: "팀",
      isDefault: false,
      isVisible: true,
      isOwner: false,
    },
  ];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  // 시트가 닫히며 되감는 히스토리 popstate 가 이 시험 안에서 다 도착하게 한다 — 다음 시험의 뒤로 가기 셈에 번지지 않게
  await new Promise((r) => setTimeout(r, 200));
});

const event = (id: number, over: Partial<IEvent> = {}): IEvent => ({
  id,
  userRowId: 7,
  startDate: "2026-10-22T10:00:00",
  endDate: "2026-10-22T11:00:00",
  title: `일정 ${id}`,
  description: "",
  color: "#2c70bf",
  isAllDay: false,
  sourceType: "calendar",
  eventType: "PERSONAL",
  calendarRowId: 1,
  calendarName: "내 캘린더",
  calendarColor: "#2c70bf",
  labelRowId: null,
  labelName: null,
  labelColor: null,
  location: null,
  rrule: null,
  recurrenceId: null,
  reminders: [],
  ...over,
});

const fns = () => ({
  onClose: vi.fn(),
  onAdd: vi.fn(),
  onRequestDelete: vi.fn(),
});

const phone = (events: IEvent[], f = fns()) => {
  const ui = (list: IEvent[]) => (
    <EventDetailSurface listDate={new Date(2026, 9, 22)} events={list} {...f} />
  );
  act(() => root.render(ui(events)));
  return { f, rerender: (list: IEvent[]) => act(() => root.render(ui(list))) };
};

const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]")!;
const title = () =>
  sheet().querySelector("[data-slot=bottom-sheet-title]")!.textContent;
const rows = () => [...sheet().querySelectorAll("button[data-slot=list-body]")];
const press = (el: Element) => click(el);
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 120));
  });
describe("폰 그날 시트 — 기기 뒤로 가기", () => {
  it("기기 뒤로 가기는 상세에서 목록으로, 한 번 더 누르면 시트를 닫는다", async () => {
    const { f } = phone([event(1)]);
    press(rows()[0]!);
    await settle();
    expect(title()).toBe("eventDetail");
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(title()).toBe("10월 22일 (목)");
    expect(f.onClose).not.toHaveBeenCalled();
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });

  // M-7 — 수정 폼에서 바꾼 채 기기 뒤로 가기: 묻고, [계속 작성] 을 반복해도 칸이 소진되지 않는다(keep)
  it("수정 폼에서 바꾼 뒤 기기 뒤로 가기 → [계속 작성] 을 반복해도 매번 묻고 폼에 남는다", async () => {
    phone([event(1)]);
    press(rows()[0]!);
    press(
      [
        ...sheet().querySelectorAll("[data-slot=bottom-sheet-footer] button"),
      ][1]!,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });
    setValue(sheet().querySelector<HTMLInputElement>("[name=title]")!, "바꾼");
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        window.history.back();
        await new Promise((r) => setTimeout(r, 120));
      });
      const alert = document.querySelector("[role=alertdialog]");
      expect(alert).not.toBeNull();
      const stay = [...alert!.querySelectorAll("button")].find(
        (b) => b.textContent === "계속 작성",
      )!;
      press(stay);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 120));
      });
      expect(title()).toBe("editEvent");
    }
  });
});
