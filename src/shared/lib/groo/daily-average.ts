/*
 * 하루 평균 — groo-design #259(DESIGN.md 숫자 "하루 평균"). 홈 · 통계(비교 · 요약 · 하이라이트) · 예산이 모두 이 셈을 쓴다.
 *
 *   날수 = 기간이 오늘을 품으면 기간 첫날부터 오늘까지(오늘 포함), 지난 기간이면 기간 전체.
 *          아직 오지 않은 기간(첫날이 오늘 뒤)도 기간 전체다(쓴 돈이 없어 0 이다).
 *   값   = 합 ÷ 날수, 원 단위 half-up — 0.5 는 0 에서 먼 쪽으로(1.5 → 2, −1.5 → −2). `Math.round` 는 −1.5 → −1 이라 쓰지 않는다.
 *
 * 날짜는 사용자 시계(이 기기의 로컬 달력)의 날짜다 — 시각은 버리고 연 · 월 · 일만 본다. 일광 절약 시각으로 하루가 23 · 25 시간인
 * 곳에서도 날수가 어긋나지 않게 연 · 월 · 일을 UTC 자정으로 옮겨 센다. 앱(Dart DateTime.now() 로컬 날짜)과 같은 셈이다.
 */

const DAY_MS = 86_400_000;

/** 로컬 달력의 그 날 — 연 · 월 · 일만 남긴 UTC 자정(ms) */
const dayNumber = (d: Date): number =>
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;

/**
 * 하루 평균의 날수 — [from] ~ [to] 기간(둘 다 포함)에서 [today] 를 품으면 첫날부터 오늘까지, 아니면 기간 전체. 늘 1 이상.
 * 예: 11월 1일 ~ 30일, 오늘 11월 18일 → 18 · 지난달 10월 → 31 · 오늘이 첫날 → 1.
 */
export function dailyAverageDays(
  from: Date,
  to: Date,
  today: Date = new Date(),
): number {
  const first = dayNumber(from);
  const last = dayNumber(to);
  const now = dayNumber(today);
  const end = now >= first && now <= last ? now : last;
  return Math.max(1, end - first + 1);
}

/** 원 단위 half-up — 0.5 는 0 에서 먼 쪽(1.5 → 2, −1.5 → −2, 2.4 → 2). 나눗셈은 정수 몫 · 나머지로 해서 소수 오차가 끼지 않는다 */
export function divideWonHalfUp(total: number, days: number): number {
  const d = Math.max(1, Math.trunc(days));
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const q = Math.floor(abs / d);
  const r = abs - q * d;
  // + 0 — 0 이 −0 으로 남지 않게
  return sign * (r * 2 >= d ? q + 1 : q) + 0;
}

/** 하루 평균(원) — [total] 을 [dailyAverageDays] 로 나눠 원 단위 half-up */
export function dailyAverage(
  total: number,
  from: Date,
  to: Date,
  today: Date = new Date(),
): number {
  return divideWonHalfUp(total, dailyAverageDays(from, to, today));
}

/** 한 달(year, month 는 1 ~ 12)의 하루 평균 — 홈 · 예산처럼 달 하나를 보는 곳 */
export function monthDailyAverage(
  total: number,
  year: number,
  month: number,
  today: Date = new Date(),
): number {
  return dailyAverage(
    total,
    new Date(year, month - 1, 1),
    new Date(year, month, 0),
    today,
  );
}
