/** `yyyy-MM`, 달은 01~12. */
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 달 고르기 휠의 연 범위(오늘 ± 100년) */
const YEAR_SPAN = 100;

function currentMonthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 주소의 `?month=` 를 가계부가 보여 줄 달로 푼다 — 못 읽으면 **이번 달**.
 *
 * 그대로 믿으면 `?month=8`(연도 없음)·`?year=2026&month=8` 같은 주소에서 달 계산이
 * `NaN` 이 되어 머리가 "NaN년 NaN월" 로 뜨고 목록이 빈다(QA 24차 9). 알아볼 수 없는
 * 값을 고쳐 읽으려 들지 않는다 — 어느 달을 뜻했는지 추측이 틀리면 엉뚱한 달을 보여
 * 주는 쪽이 빈 화면보다 더 헷갈린다.
 */
export function monthFromQuery(
  raw: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!raw || !MONTH_KEY.test(raw)) return currentMonthKey(now);
  // 달 고르기 휠이 닿는 해(오늘 ± 100년 — month-picker.tsx yearRange 기본) 밖은 손으로 고친 주소다 — 이번 달로(I-wrap-b1 ε 9)
  const year = Number(raw.slice(0, 4));
  return Math.abs(year - now.getFullYear()) > YEAR_SPAN
    ? currentMonthKey(now)
    : raw;
}
