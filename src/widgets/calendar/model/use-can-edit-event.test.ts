// [수정][삭제]는 서버가 허락하는 사람에게만 (I-09b 7) — 판정 = 그 캘린더의 내 권한이 OWNER · EDIT
import { describe, expect, it } from "vitest";

import type { CalendarRole } from "@/entities/user-calendar";

import { canEditEvent } from "./use-can-edit-event";

const roles: Record<number, CalendarRole> = {
  1: "READ",
  2: "EDIT",
  3: "OWNER",
};
const roleOf = (id: number) => roles[id];

const ev = (over: Record<string, unknown> = {}) => ({
  sourceType: "calendar" as const,
  calendarRowId: 1,
  ...over,
});

describe("canEditEvent", () => {
  it("읽기 전용 캘린더에서는 내가 만든 일정에도 버튼이 없다", () => {
    expect(canEditEvent(ev(), roleOf)).toBe(false);
  });
  it("편집 가능 · 소유자 캘린더에서는 있다", () => {
    expect(canEditEvent(ev({ calendarRowId: 2 }), roleOf)).toBe(true);
    expect(canEditEvent(ev({ calendarRowId: 3 }), roleOf)).toBe(true);
  });
  it("공휴일 · 일정이 아닌 것은 늘 없다", () => {
    expect(
      canEditEvent(ev({ sourceType: "holiday", calendarRowId: 3 }), roleOf),
    ).toBe(false);
  });
  it("권한을 아직 모르면(목록 불러오는 중) 없다", () => {
    expect(canEditEvent(ev({ calendarRowId: 2 }), () => undefined)).toBe(false);
  });
});
