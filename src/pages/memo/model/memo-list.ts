import type { Memo } from "@/entities/memo";
import type { MemoTag } from "@/entities/memo-tag";
import { NO_TAG_KEY, memoTagKey, memoTagOptions } from "../lib/memo-tags";

/** 칩 하나 — key 는 거르기 값(`NO_TAG_KEY` 가 "태그 없음"), count 는 늘 전체 기준 */
export interface MemoTagChip {
  key: string;
  count: number;
}

/**
 * 칩 줄 차례 — **설정 태그 차례**(서버 목록) → 메모에만 남은 이름 → **"태그 없음"(그런 메모가 있을 때만, 맨 뒤)**.
 * 메모가 하나도 없는 태그는 칩을 만들지 않는다(거르면 0건이 되는 칩을 두지 않는다). "전체" 는 호출처가 맨 앞에 둔다.
 */
export function memoTagChips(
  memos: readonly Memo[],
  serverTags: readonly MemoTag[] | undefined,
): MemoTagChip[] {
  const counts = new Map<string, number>();
  for (const memo of memos) {
    const k = memoTagKey(memo);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const named = memoTagOptions(serverTags, memos)
    .filter((name) => counts.has(name))
    .map((key) => ({ key, count: counts.get(key)! }));
  const none = counts.get(NO_TAG_KEY);
  return none ? [...named, { key: NO_TAG_KEY, count: none }] : named;
}

/** 검색(제목 + 본문, 대소문자 무시) + 태그 거르기 → 고정 먼저 → 수정 시각 내림 */
export function filterMemos(
  memos: readonly Memo[],
  query: string,
  tagFilter: string,
): Memo[] {
  const q = query.trim().toLowerCase();
  return memos
    .filter((m) => {
      if (tagFilter !== "all" && memoTagKey(m) !== tagFilter) return false;
      if (q) {
        const hay = `${m.title}\n${m.content ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.modifyAt || "").localeCompare(a.modifyAt || "");
    });
}
