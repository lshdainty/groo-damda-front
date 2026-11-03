import type { TFunction } from "i18next";
import type { RecurringFrequency } from "@/entities/recurring-transaction";

/** 반복 폼 단계(거래처 · 메모 · 반복 · 끝)의 값 모양과 상한 — 화면 부품이 아니라 값이다 */
export const MERCHANT_MAX = 50;
export const MEMO_MAX = 200;
/** 끝 횟수 상한 — 웹 · 앱 999 하나(I-20 D 28) */
export const END_COUNT_MAX = 999;

export interface RepeatDraft {
  frequency: RecurringFrequency;
  dayOfMonth: number;
  /** 0=일 ~ 6=토 */
  dayOfWeek: number;
  /** HH:mm */
  time: string;
}

export type EndMode = "NONE" | "DATE" | "COUNT";

export interface EndDraft {
  mode: EndMode;
  /** yyyy-MM-dd */
  date: string;
  count: string;
}

/** 끝 줄 값 — "없음" · "2027년 10월 25일까지" · "12번" */
export function endRowValue(
  mode: EndMode,
  date: string,
  count: string,
  t: TFunction,
  formatDate: (d: string) => string,
): string {
  if (mode === "DATE") return t("endValueDate", { date: formatDate(date) });
  if (mode === "COUNT") return t("endValueCount", { count: Number(count) });
  return t("endValueNone");
}
