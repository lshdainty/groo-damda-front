import { parseServerUtc, toLocalDateKey } from "@/shared/lib/date";
import type { Notification } from "../model/types";

export interface DayGroup {
  key: string;
  /** 읽지 못한 시각만 있는 묶음(맨 끝)은 null — 머리 없이 줄만 둔다 */
  date: Date | null;
  items: Notification[];
}

/** 서버 차례(새것 위)를 지키며 기기 시간대의 달력 날로 묶는다 — 묶음 안 차례도 그대로. 시각을 읽지 못한 줄은 맨 끝 묶음에 둔다. */
export function groupByDay(items: readonly Notification[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const unknown: Notification[] = [];
  for (const n of items) {
    const date = parseServerUtc(n.createAt);
    const key = toLocalDateKey(n.createAt);
    if (!date || !key) {
      unknown.push(n);
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(n);
    else groups.push({ key, date, items: [n] });
  }
  if (unknown.length) groups.push({ key: "", date: null, items: unknown });
  return groups;
}
