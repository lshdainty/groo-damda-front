import { parseServerUtc, toLocalDateKey } from "@/shared/lib/date";
import type { Notification } from "../model/types";

/** 서버 차례(새것 위)를 지키며 기기 시간대의 달력 날로 묶는다 — 묶음 안 차례도 그대로. */
export function groupByDay(
  items: readonly Notification[],
): { key: string; date: Date; items: Notification[] }[] {
  const groups: { key: string; date: Date; items: Notification[] }[] = [];
  for (const n of items) {
    const date = parseServerUtc(n.createAt);
    const key = toLocalDateKey(n.createAt) ?? "";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(n);
    else groups.push({ key, date: date ?? new Date(0), items: [n] });
  }
  return groups;
}
