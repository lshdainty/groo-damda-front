// [수정][삭제]는 서버가 허락하는 사람에게만 (I-09b 7) — 판정 = 만든 사람이거나 그 캘린더의 내 권한이 OWNER · EDIT
import { describe, expect, it } from "vitest";

import type { CalendarRole } from "@/entities/user-calendar";

import { canEditEvent } from "./use-can-edit-event";

const ME = 7;
const roles: Record<number, CalendarRole> = {
  1: "READ",
  2: "EDIT",
  3: "OWNER",
};
const roleOf = (id: number) => roles[id];

const ev = (over: Record<string, unknown> = {}) => ({
  sourceType: "calendar" as const,
  userRowId: 99,
  calendarRowId: 1,
  ...over,
});

describe("canEditEvent", () => {
  it("읽기 전용 캘린더라도 내가 만든 일정에는 버튼이 있다", () => {
    expect(canEditEvent(ev({ userRowId: ME }), ME, roleOf)).toBe(true);
  });
  it("읽기 전용 캘린더의 남이 만든 일정에는 없다", () => {
    expect(canEditEvent(ev(), ME, roleOf)).toBe(false);
  });
  it("편집 가능 · 소유자 캘린더에서는 남이 만든 일정에도 있다", () => {
    expect(canEditEvent(ev({ calendarRowId: 2 }), ME, roleOf)).toBe(true);
    expect(canEditEvent(ev({ calendarRowId: 3 }), ME, roleOf)).toBe(true);
  });
  it("공휴일 · 일정이 아닌 것은 늘 없다 — 내가 만든 것처럼 보여도", () => {
    expect(
      canEditEvent(
        ev({ sourceType: "holiday", userRowId: ME, calendarRowId: 3 }),
        ME,
        roleOf,
      ),
    ).toBe(false);
    expect(canEditEvent(ev({ sourceType: "expense" }), ME, roleOf)).toBe(false);
  });
  it("권한을 아직 모르면(목록 불러오는 중) 남의 일정에는 없고 내 일정에는 있다", () => {
    const unknown = () => undefined;
    expect(canEditEvent(ev(), ME, unknown)).toBe(false);
    expect(canEditEvent(ev({ userRowId: ME }), ME, unknown)).toBe(true);
  });
  it("나를 아직 모르면 만든 사람 판정은 하지 않는다", () => {
    expect(canEditEvent(ev({ userRowId: ME }), undefined, roleOf)).toBe(false);
    expect(
      canEditEvent(
        ev({ userRowId: null, calendarRowId: 2 }),
        undefined,
        roleOf,
      ),
    ).toBe(true);
  });
});
