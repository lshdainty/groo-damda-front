import { isEn } from "@/shared/lib/groo/format";
import { formatMonthDayDow } from "@/shared/lib/date";

/** "2026-10-22T19:40:00" → 날짜 키 "2026-10-22" */
export const toDayKey = (iso?: string | null): string =>
  iso ? iso.slice(0, 10) : "";

/** 시각이 00:00 이면 없는 것으로 본다(날짜만 적은 거래) — 지금 규칙 그대로 */
export const toTimeKey = (iso?: string | null): string | null => {
  if (!iso || iso.length < 16) return null;
  const t = iso.slice(11, 16);
  return t === "00:00" ? null : t;
};

/** "19:40" → ko "오후 7:40" / en "7:40 PM" */
export function timeLabel(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3, 5);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (isEn()) return `${h12}:${m} ${h < 12 ? "AM" : "PM"}`;
  return `${h < 12 ? "오전" : "오후"} ${h12}:${m}`;
}

/**
 * 상세 머리의 날짜 · 시각 — ko "10월 22일 (목) 오후 7:40"(다른 해면 "2025년 10월 22일 (수) …") / en "Oct 22 (Thu) 7:40 PM".
 * 시각이 00:00 이면 날짜만.
 */
export function dateTimeLabel(iso: string): string {
  const day = formatMonthDayDow(toDayKey(iso));
  const time = toTimeKey(iso);
  return time ? `${day} ${timeLabel(time)}` : day;
}
