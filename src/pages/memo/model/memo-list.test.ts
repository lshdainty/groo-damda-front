import { describe, expect, it } from "vitest";
import type { Memo } from "@/entities/memo";
import type { MemoTag } from "@/entities/memo-tag";
import { NO_TAG_KEY } from "../lib/memo-tags";
import { filterMemos, memoTagChips } from "./memo-list";

const memo = (rowId: number, o: Partial<Memo> = {}): Memo => ({
  rowId,
  title: `메모 ${rowId}`,
  content: null,
  tag: null,
  color: null,
  isPinned: false,
  createAt: "2026-10-01T00:00:00",
  modifyAt: `2026-10-0${rowId}T00:00:00`,
  ...o,
});
const tag = (rowId: number, tagName: string): MemoTag => ({
  rowId,
  userRowId: 1,
  tagName,
  color: "#2c70bf",
  createAt: "",
  modifyAt: "",
});

describe("memoTagChips — 차례 (I-15 8)", () => {
  it("설정 태그 차례 → 메모에만 남은 이름 → 태그 없음(맨 뒤)", () => {
    const memos = [
      memo(1, { tag: null }), // 데이터가 '태그 없음' 으로 먼저 나와도 맨 뒤다
      memo(2, { tag: "남은이름" }),
      memo(3, { tag: "여행" }),
      memo(4, { tag: "아이디어" }),
    ];
    const chips = memoTagChips(memos, [tag(1, "아이디어"), tag(2, "여행")]);
    expect(chips.map((c) => c.key)).toEqual([
      "아이디어",
      "여행",
      "남은이름",
      NO_TAG_KEY,
    ]);
  });

  it("메모가 없는 태그는 칩을 만들지 않고, 태그 없는 메모가 없으면 '태그 없음' 도 없다", () => {
    const chips = memoTagChips(
      [memo(1, { tag: "여행" })],
      [tag(1, "독서"), tag(2, "여행")],
    );
    expect(chips).toEqual([{ key: "여행", count: 1 }]);
  });

  it("건수는 전체 기준이다", () => {
    const chips = memoTagChips(
      [memo(1, { tag: "여행" }), memo(2, { tag: "여행" }), memo(3)],
      [tag(1, "여행")],
    );
    expect(chips).toEqual([
      { key: "여행", count: 2 },
      { key: NO_TAG_KEY, count: 1 },
    ]);
  });
});

describe("filterMemos — 거르기 · 정렬 (동작 변화 0)", () => {
  const memos = [
    memo(1, { title: "Apple", content: "red" }),
    memo(2, { title: "banana", content: "YELLOW", isPinned: true }),
    memo(3, { title: "cherry", tag: "과일" }),
  ];
  it("고정이 먼저, 그 안에서 수정 시각 내림", () => {
    expect(filterMemos(memos, "", "all").map((m) => m.rowId)).toEqual([
      2, 3, 1,
    ]);
  });
  it("검색은 제목 + 본문, 대소문자를 무시한다", () => {
    expect(filterMemos(memos, " yellow ", "all").map((m) => m.rowId)).toEqual([
      2,
    ]);
    expect(filterMemos(memos, "APPLE", "all").map((m) => m.rowId)).toEqual([1]);
  });
  it("태그로 거른다 — 태그 없음은 sentinel", () => {
    expect(filterMemos(memos, "", "과일").map((m) => m.rowId)).toEqual([3]);
    expect(filterMemos(memos, "", NO_TAG_KEY).map((m) => m.rowId)).toEqual([
      2, 1,
    ]);
  });
});
