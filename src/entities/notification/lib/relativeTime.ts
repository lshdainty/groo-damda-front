import { i18n } from "@/shared/i18n/config";
import { formatTimeValue } from "@/shared/ds/time-picker";
import { parseServerUtc } from "@/shared/lib/date";

/**
 * 알림 줄의 시각 — 날짜 묶음 아래에서 쓴다(I-15 Q6 = B).
 *
 * 오늘 묶음은 "방금 전" / "n분 전" / "n시간 전", 다른 날 묶음은 그 날의 시각 "오후 9:00"(머리가 날짜를 말하므로 "어제" · "n일 전" 을 다시 쓰지 않는다).
 * 오늘인지는 기기 시간대의 달력 날로 가른다.
 *
 * createAt 은 서버가 시간대 없이 주는 `[UTC]` 시각이라 [parseServerUtc] 로 읽는다.
 * [now] 는 기준점이며 **필수**다 — 호출부가 `useNow()` 를 넘겨 벨 · 화면이 같은 순간을 본다.
 */
export function relativeTime(createAt: string, now: number): string {
  const then = parseServerUtc(createAt);
  if (!then) return "";
  const today = new Date(now);
  const sameDay =
    then.getFullYear() === today.getFullYear() &&
    then.getMonth() === today.getMonth() &&
    then.getDate() === today.getDate();
  if (!sameDay)
    return formatTimeValue({
      hour: then.getHours(),
      minute: then.getMinutes(),
    });
  const m = Math.floor((now - then.getTime()) / 60_000);
  if (m < 1) return i18n.t("date:justNow");
  if (m < 60) return i18n.t("date:minutesAgo", { count: m });
  return i18n.t("date:hoursAgo", { count: Math.floor(m / 60) });
}
