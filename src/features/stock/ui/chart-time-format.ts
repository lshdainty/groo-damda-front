import { formatTimeValue } from "@/shared/ds/time-picker";
import { formatDailyTick } from "@/shared/lib/date";

/** UTCTimestamp(초) → 로컬(기기 타임존, KR 사용자는 KST) Date. Lightweight Charts 는 기본 UTC 표시라 직접 변환. */
function localDate(time: unknown): Date {
  const sec = typeof time === "number" ? time : Number(time);
  return new Date(sec * 1000);
}

/**
 * 축 틱 라벨 — 1m=시각 12시간("오전 9:00" · "9:00 AM"), 1d=점 표기 날짜("11. 5." · "Nov 5").
 * 0 을 채우지 않는다(DESIGN.desk.md 날짜 · 시각). 로컬 타임존.
 */
export function fmtTick(time: unknown, interval: "1m" | "1d"): string {
  const d = localDate(time);
  return interval === "1m" ? formatTimeValue(d) : formatDailyTick(d);
}

/**
 * 크로스헤어 시간 라벨 — 1m="11. 5. 오전 9:05"(날짜 점 표기 + 12시간), 1d="11. 5.". 올해가 아니면 연도를 붙인다
 * ("2025. 11. 5."). 로컬 타임존.
 */
export function fmtCrosshairTime(time: unknown, interval: "1m" | "1d"): string {
  const d = localDate(time);
  const date = formatDailyTick(d, d.getFullYear() !== new Date().getFullYear());
  return interval === "1m" ? `${date} ${formatTimeValue(d)}` : date;
}
