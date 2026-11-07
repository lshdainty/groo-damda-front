import { formatTimeValue } from "@/shared/ds/time-picker";
import {
  formatDateLong,
  formatMonthDay,
  parseServerUtc,
} from "@/shared/lib/date";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";

/** 색이 없는 메모의 색 — 파랑(차트 색 base hex). 저장 값은 라이트 hex 그대로다 */
export const DEFAULT_MEMO_COLOR = "#2c70bf";

/** 메모 줄 앞 점 · 메타 점의 색 — 그 메모 색의 차트 색(다크는 토큰이 스스로 바꾼다). 팔레트 밖 hex 도 그린다 */
export const memoSwatch = (color: string | null | undefined): string =>
  getPaletteByColor(color || DEFAULT_MEMO_COLOR).color;

/**
 * 수정 시각 — 올해는 줄임 날짜 + 시각 "10월 22일 오후 5:10", 다른 해는 표준 날짜 "2025년 12월 3일"(웹 · 앱 한 벌).
 *
 * modifyAt 은 서버가 시간대 없이 주는 `[UTC]` 라 [parseServerUtc] 로 읽고 로컬로 옮긴다. 못 읽는 값은 ""
 * — 틀린 시각을 그리지 않는다(메타 줄이 빈 조각을 빼므로 " ·" 만 남지 않는다). `now` 는 시험용(올해를 고정한다).
 */
export function formatMemoStamp(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  const d = parseServerUtc(iso);
  if (!d) return "";
  if (d.getFullYear() !== now.getFullYear()) return formatDateLong(d);
  return `${formatMonthDay(d)} ${formatTimeValue(d)}`;
}
