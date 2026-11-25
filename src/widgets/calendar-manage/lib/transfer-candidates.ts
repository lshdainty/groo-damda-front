import type { CalendarMember } from "@/entities/user-calendar";

/**
 * 소유자를 넘겨받을 수 있는 멤버(사용자 결정 2026-11-24 · 서버 `CAL_020` 과 같은 규칙).
 * 나(소유자)를 뺀 멤버 가운데 편집 가능(EDIT)만 고를 수 있다. 편집 가능 멤버가 하나도 없으면
 * 읽기 전용(READ) 멤버를 고를 수 있다(넘기면 OWNER 가 된다).
 *
 * `others` 는 넘겨받을 후보로 보이는 줄 전부(나 · 소유자 줄 제외), `eligible` 은 그 가운데 고를 수 있는 멤버 행 id 다.
 * `readOnlyFallback` 은 편집 가능 멤버가 없어 읽기 전용에게 넘기는 경우다 — 안내 글이 달라진다.
 */
export function transferCandidates(members: CalendarMember[]): {
  others: CalendarMember[];
  eligible: Set<number>;
  readOnlyFallback: boolean;
} {
  const others = members.filter((m) => m.permission !== "OWNER");
  const editors = others.filter((m) => m.permission === "EDIT");
  const pool = editors.length > 0 ? editors : others;
  return {
    others,
    eligible: new Set(pool.map((m) => m.rowId)),
    readOnlyFallback: editors.length === 0 && others.length > 0,
  };
}

/** 서버 오류 코드(`CAL_019` …)를 읽는다 — 글이 아니라 코드로 가른다 */
export function calendarErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { code?: unknown } } })?.response
    ?.data;
  return typeof data?.code === "string" ? data.code : null;
}
