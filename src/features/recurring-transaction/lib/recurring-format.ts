import type { TFunction } from "i18next";

import type { RecurringTransaction } from "@/entities/recurring-transaction";
import {
  formatDateLong,
  formatDateSmart,
  parseLocalDate,
} from "@/shared/lib/date";
import { isEn } from "@/shared/lib/groo/format";
import { isFinished } from "./recurring-schedule";

/*
 * 반복 거래 표시 문구 — 목록 줄 · 상세 · 폼이 같은 문장을 쓴다(I-20 D 22 · 24 · 27).
 * 순수 함수라 도메인 쪽(lib)이 제자리다.
 */
export function displayTitle(it: RecurringTransaction, t: TFunction): string {
  return it.merchant || it.description || it.categoryName || t("defaultTitle");
}

/** 백엔드 ISO 1=월 ~ 7=일 → recurring `dow.*` 키 */
const ISO_DOW = ["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type CycleParts = {
  frequency: RecurringTransaction["frequency"];
  /** ISO 1=월 ~ 7=일 */
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  startDate: string;
};

/** 주기 문장 — 줄 · 상세 · 폼이 같이 쓴다. 매일 · 매주 월요일 · 매월 25일 · 매년 10월 14일 */
export function cycleSentence(r: CycleParts, t: TFunction): string {
  switch (r.frequency) {
    case "DAILY":
      return t("cycle.daily");
    case "WEEKLY": {
      const key = r.dayOfWeek != null ? ISO_DOW[r.dayOfWeek] : undefined;
      return t("cycle.weekly", { day: key ? t(`dow.${key}`) : "" });
    }
    case "MONTHLY":
      return t("cycle.monthly", {
        day: r.dayOfMonth ?? Number(r.startDate.slice(8, 10)),
      });
    case "YEARLY":
      return t("cycle.yearly", {
        month: Number(r.startDate.slice(5, 7)),
        day: Number(r.startDate.slice(8, 10)),
      });
  }
}

/** 끝 조각 — 끝 날짜 "2027년 12월까지" · 횟수 "12번 중 3번"(횟수가 먼저). 없으면 null */
export function endPiece(
  it: RecurringTransaction,
  t: TFunction,
): string | null {
  if (it.maxOccurrences != null)
    return t("cycle.countOf", {
      total: it.maxOccurrences,
      done: it.executedCount,
    });
  if (it.endDate)
    return t("cycle.untilMonth", {
      year: Number(it.endDate.slice(0, 4)),
      month: Number(it.endDate.slice(5, 7)),
    });
  return null;
}

/** 다음 날짜 글 — 올해는 "10월 25일", 다른 해는 "2027년 1월 25일" */
export function nextDateText(key: string, now?: Date): string {
  return formatDateSmart(key, now);
}

/**
 * 줄 설명 조각 — Tag Group t3 한 줄 말줄임에 들어간다. 켜짐 "다음 10월 25일 · 매월 25일" · 쉬는 중 "쉬는 중 · …" · 끝남 "끝남 · …"
 * (뒤에 끝 조각이 있으면 이어 붙인다 — "· 2027년 12월까지")
 */
export function rowDetailParts(
  it: RecurringTransaction,
  t: TFunction,
): string[] {
  const lead = isFinished(it)
    ? t("rowFinished")
    : it.isActive !== "Y"
      ? t("rowPaused")
      : t("rowNext", { date: nextDateText(it.nextExecutionDate) });
  const end = endPiece(it, t);
  return [lead, cycleSentence(it, t), ...(end ? [end] : [])];
}

/** 'HH:mm(:ss)' → "오전 9시" · "오전 9:30" (영어 "9 AM" · "9:30 AM") */
export function clockText(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(3, 5));
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(isEn() ? "en-US" : "ko-KR", {
    hour: "numeric",
    minute: m === 0 ? undefined : "2-digit",
    hour12: true,
  }).format(d);
}

/** "{M월 D일} {오전 9시}" — 상세 문장의 다음 회차 */
export function nextMoment(it: RecurringTransaction): string {
  const d = parseLocalDate(it.nextExecutionDate);
  const day = d ? nextDateText(it.nextExecutionDate) : it.nextExecutionDate;
  return `${day} ${clockText((it.executionTime ?? "09:00:00").slice(0, 5))}`;
}

/** 상세의 끝 문장 — 끝 없음 · 끝 날짜 · 횟수 */
export function endSentence(it: RecurringTransaction, t: TFunction): string {
  if (it.maxOccurrences != null)
    return t("endSentenceCount", {
      total: it.maxOccurrences,
      done: it.executedCount,
    });
  if (it.endDate)
    return t("endSentenceDate", { date: formatDateLong(it.endDate) });
  return t("endSentenceNone");
}

/**
 * 금액의 부호와 색 — 이체는 지출도 수입도 아니다. 지출은 `fg-neutral`(빨강으로 칠하지 않는다 · C 15 와 같은 규칙),
 * 수입은 `fg-brand`, 이체는 부호 없이 중립. 금액 0 은 부호 없이 "0원". 반복 목록에는 볼 기준 계좌가 없으므로 이체는 언제나 중립이다.
 */
export function recurringAmountTone(it: RecurringTransaction): {
  sign: string;
  className: string;
} {
  if (it.expenseType === "TRANSFER")
    return { sign: "", className: "text-fg-neutral" };
  // 0 은 부호 없이 "0원"(앱 recAmountText 와 같다 — 서버가 금액을 안 주면 0 으로 온다). 색은 종류를 따른다.
  const zero = it.amount === 0;
  return it.expenseType === "EXPENSE"
    ? { sign: zero ? "" : "−", className: "text-fg-neutral" }
    : { sign: zero ? "" : "+", className: "text-fg-brand" };
}
