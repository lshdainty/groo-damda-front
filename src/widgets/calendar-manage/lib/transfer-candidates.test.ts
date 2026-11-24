import { describe, expect, it } from "vitest";
import type { CalendarMember } from "@/entities/user-calendar";
import { calendarErrorCode, transferCandidates } from "./transfer-candidates";

const m = (rowId: number, permission: CalendarMember["permission"]) =>
  ({
    rowId,
    userRowId: rowId + 100,
    userName: `멤버 ${rowId}`,
    userEmail: `m${rowId}@example.com`,
    permission,
    joinedAt: "2026-11-24T00:00:00",
  }) satisfies CalendarMember;

describe("소유자를 넘겨받을 수 있는 멤버", () => {
  it("편집 가능 멤버가 있으면 그들만 고를 수 있다(읽기 전용은 막힌다)", () => {
    const r = transferCandidates([m(1, "OWNER"), m(2, "EDIT"), m(3, "READ")]);
    expect(r.others.map((x) => x.rowId)).toEqual([2, 3]);
    expect([...r.eligible]).toEqual([2]);
    expect(r.readOnlyFallback).toBe(false);
  });

  it("편집 가능 멤버가 없으면 읽기 전용 멤버를 고를 수 있다", () => {
    const r = transferCandidates([m(1, "OWNER"), m(3, "READ"), m(4, "READ")]);
    expect([...r.eligible]).toEqual([3, 4]);
    expect(r.readOnlyFallback).toBe(true);
  });

  it("나(소유자)만 있으면 고를 사람이 없다", () => {
    const r = transferCandidates([m(1, "OWNER")]);
    expect(r.others).toEqual([]);
    expect(r.eligible.size).toBe(0);
    expect(r.readOnlyFallback).toBe(false);
  });
});

describe("서버 오류 코드", () => {
  it("응답 본문의 code 를 읽고, 없으면 null", () => {
    expect(calendarErrorCode({ response: { data: { code: "CAL_019" } } })).toBe(
      "CAL_019",
    );
    expect(calendarErrorCode(new Error("x"))).toBeNull();
    expect(calendarErrorCode(undefined)).toBeNull();
  });
});
