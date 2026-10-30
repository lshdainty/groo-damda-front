import type {
  RecurringFrequency,
  RecurringTransaction,
} from "@/entities/recurring-transaction";
import { localDateKey, parseLocalDate } from "@/shared/lib/date";

/*
 * 반복 회차 셈 — 목록 묶음 머리 합계 · 줄 · 상세의 "다음 예정일" · 폼 안내가 **한 벌**로 쓴다(I-20 D 22 · 29).
 * 서버 `firstOccurrenceOnOrAfter` · `calculateNextDate` 와 같은 규칙이다: 시작일에서 주기대로, 매월은 말일을 넘기지 않고,
 * 매년은 시작일의 월 · 일, 격주 · 격월은 `intervalValue`. 끝 날짜를 넘는 날 · 최대 횟수를 넘는 차례는 회차가 아니다.
 * '오늘'은 여기서 만들지 않는다 — 부르는 쪽이 넘긴다(시험이 시계를 고정할 수 있게).
 */

export interface ScheduleRule {
  startDate: string;
  frequency: RecurringFrequency;
  intervalValue?: number | null;
  /** 백엔드 ISO 1=월 ~ 7=일 */
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  endDate?: string | null;
  maxOccurrences?: number | null;
}

const MAX_STEPS = 100_000;

function lengthOfMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

/** Java `plusMonths` — 말일을 넘으면 그 달 말일로 */
function plusMonths(d: Date, n: number): Date {
  const total = d.getFullYear() * 12 + d.getMonth() + n;
  const y = Math.floor(total / 12);
  const m = total % 12;
  return new Date(y, m, Math.min(d.getDate(), lengthOfMonth(y, m)));
}

function plusYears(d: Date, n: number): Date {
  return plusMonths(d, n * 12);
}

function plusDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** 서버 `adjustToFrequency` — 시작일을 주기에 맞는 첫 회차로 */
export function firstOccurrence(rule: ScheduleRule): Date | null {
  const start = parseLocalDate(rule.startDate);
  if (!start) return null;
  if (rule.frequency === "WEEKLY" && rule.dayOfWeek != null) {
    const iso = start.getDay() === 0 ? 7 : start.getDay();
    let diff = rule.dayOfWeek - iso;
    if (diff < 0) diff += 7;
    return plusDays(start, diff);
  }
  if (rule.frequency === "MONTHLY" && rule.dayOfMonth != null) {
    let adj = new Date(
      start.getFullYear(),
      start.getMonth(),
      Math.min(
        rule.dayOfMonth,
        lengthOfMonth(start.getFullYear(), start.getMonth()),
      ),
    );
    if (adj.getTime() < start.getTime()) {
      adj = plusMonths(new Date(adj.getFullYear(), adj.getMonth(), 1), 1);
      adj = new Date(
        adj.getFullYear(),
        adj.getMonth(),
        Math.min(
          rule.dayOfMonth,
          lengthOfMonth(adj.getFullYear(), adj.getMonth()),
        ),
      );
    }
    return adj;
  }
  return start;
}

/** 서버 `calculateNextDate` — 다음 회차 */
export function stepOccurrence(cur: Date, rule: ScheduleRule): Date {
  const interval =
    rule.intervalValue && rule.intervalValue > 0 ? rule.intervalValue : 1;
  switch (rule.frequency) {
    case "DAILY":
      return plusDays(cur, interval);
    case "WEEKLY":
      return plusDays(cur, 7 * interval);
    case "MONTHLY": {
      const next = plusMonths(cur, interval);
      if (rule.dayOfMonth == null) return next;
      return new Date(
        next.getFullYear(),
        next.getMonth(),
        Math.min(
          rule.dayOfMonth,
          lengthOfMonth(next.getFullYear(), next.getMonth()),
        ),
      );
    }
    case "YEARLY":
      return plusYears(cur, interval);
  }
}

/**
 * 규칙의 회차 날짜 키들 — `from` ~ `to` (둘 다 포함, 'YYYY-MM-DD') 안에 있는 것만.
 * 최대 횟수는 첫 회차부터 센 차례로 따진다(이미 기록된 회차도 한 차례다). 끝 날짜 뒤 · 최대 횟수 밖은 뺀다.
 */
export function occurrencesBetween(
  rule: ScheduleRule,
  from: string,
  to: string,
): string[] {
  let cur = firstOccurrence(rule);
  if (!cur) return [];
  const out: string[] = [];
  const max = rule.maxOccurrences ?? null;
  for (let n = 1, steps = 0; steps < MAX_STEPS; n++, steps++) {
    const key = localDateKey(cur);
    if (key > to) break;
    if (rule.endDate && key > rule.endDate.slice(0, 10)) break;
    if (max != null && n > max) break;
    if (key >= from) out.push(key);
    cur = stepOccurrence(cur, rule);
  }
  return out;
}

/**
 * 다음 예정일 `count` 개 — 서버가 준 `nextExecutionDate` 에서 센다(상세 · 줄). 끝 날짜를 넘는 날 · 남은 횟수(최대 − 실행)를 넘는 날은 뺀다.
 * 쉬는 중이면 빈 목록.
 */
export function upcomingDates(
  rule: ScheduleRule,
  nextKey: string,
  executedCount: number,
  count: number,
  active = true,
): string[] {
  if (!active) return [];
  let cur = parseLocalDate(nextKey);
  if (!cur) return [];
  const out: string[] = [];
  const remaining =
    rule.maxOccurrences != null
      ? rule.maxOccurrences - executedCount
      : Number.POSITIVE_INFINITY;
  for (let i = 0; i < count && i < remaining; i++) {
    const key = localDateKey(cur);
    if (rule.endDate && key > rule.endDate.slice(0, 10)) break;
    out.push(key);
    cur = stepOccurrence(cur, rule);
  }
  return out;
}

/** 폼 안내 — 시작일에서 센 첫 회차들(끝 · 횟수 안). 지금 폼 값으로 */
export function previewNextDates(
  startIso: string,
  freq: RecurringFrequency,
  dayOfWeekUi: number, // 0=일~6=토
  dayOfMonth: number,
  count: number,
  limits?: { endDate?: string | null; maxOccurrences?: number | null },
): string[] {
  const rule: ScheduleRule = {
    startDate: startIso,
    frequency: freq,
    intervalValue: 1,
    dayOfWeek: dayOfWeekUi === 0 ? 7 : dayOfWeekUi,
    dayOfMonth: freq === "MONTHLY" ? dayOfMonth : null,
    endDate: limits?.endDate ?? null,
    maxOccurrences: limits?.maxOccurrences ?? null,
  };
  let cur = firstOccurrence(rule);
  if (!cur) return [];
  const out: string[] = [];
  for (let n = 1; out.length < count && n <= MAX_STEPS; n++) {
    const key = localDateKey(cur);
    if (rule.endDate && key > rule.endDate.slice(0, 10)) break;
    if (rule.maxOccurrences != null && n > rule.maxOccurrences) break;
    out.push(key);
    cur = stepOccurrence(cur, rule);
  }
  return out;
}

/** 끝남 — 쉬지 않았는데 다음 날짜가 끝 날짜 뒤이거나 실행 수가 최대 횟수에 닿았다 */
export function isFinished(it: RecurringTransaction): boolean {
  if (it.isActive !== "Y") return false;
  if (it.maxOccurrences != null && it.executedCount >= it.maxOccurrences)
    return true;
  if (it.endDate && it.nextExecutionDate > it.endDate.slice(0, 10)) return true;
  return false;
}

function monthBounds(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const last = String(lengthOfMonth(year, month - 1)).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${last}` };
}

/**
 * 이번 달 합 — 켜진 반복의 이 달(1일 ~ 말일) 회차 금액을 모두 더한다. 이미 기록된 회차도 포함(규칙으로 센다).
 * 쉬는 반복은 뺀다. `expenseType` 으로 지출 · 수입을 가른다.
 */
export function monthTotal(
  items: RecurringTransaction[],
  type: "EXPENSE" | "INCOME",
  year: number,
  month: number,
): number {
  const { from, to } = monthBounds(year, month);
  let sum = 0;
  for (const it of items) {
    if (it.isActive !== "Y" || it.expenseType !== type) continue;
    const n = occurrencesBetween(it, from, to).length;
    sum += Math.abs(it.amount) * n;
  }
  return sum;
}
