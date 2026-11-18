// 하루 평균 시험 — 화면마다 같은 경우를 돌려 같은 값이 나오는지 본다(groo-design #259). 오늘은 사용자 시계(로컬)의 날짜다.
//   · 이번 달 — 11월, 오늘 18일 → 1일 ~ 18일(18일). 29,439 ÷ 18 = 1,635.5 → 1,636
//   · 지난 달 — 오늘 2월 18일, 1월 전체(31일). 46,516 ÷ 31 = 1,500.5… → 1,501
//   · 오늘이 기간 첫날 — 11월 1일 → 1일. 29,439
//   · 음수 — 환불이 더 큰 달. −29,439 ÷ 18 = −1,635.5 → −1,636(half-up, Math.round 면 −1,635)
export interface DailyAverageCase {
  name: string;
  /** 지금(사용자 시계) */
  today: Date;
  year: number;
  /** 1 ~ 12 */
  month: number;
  total: number;
  /** 나누는 날수 */
  days: number;
  expected: number;
}

export const DAILY_AVERAGE_CASES: DailyAverageCase[] = [
  {
    name: "이번 달(오늘 18일) — 1일부터 오늘까지 18일",
    today: new Date(2026, 10, 18, 21, 30),
    year: 2026,
    month: 11,
    total: 29_439,
    days: 18,
    expected: 1_636,
  },
  {
    name: "지난 달 — 1월 전체 31일",
    today: new Date(2026, 1, 18, 9, 0),
    year: 2026,
    month: 1,
    total: 46_516,
    days: 31,
    expected: 1_501,
  },
  {
    name: "오늘이 기간 첫날 — 1일",
    today: new Date(2026, 10, 1, 0, 5),
    year: 2026,
    month: 11,
    total: 29_439,
    days: 1,
    expected: 29_439,
  },
  {
    name: "음수 반올림 — −1,635.5 → −1,636(half-up)",
    today: new Date(2026, 10, 18, 21, 30),
    year: 2026,
    month: 11,
    total: -29_439,
    days: 18,
    expected: -1_636,
  },
];

/** 그 경우의 달 키 "YYYY-MM" */
export const monthKeyOf = (c: DailyAverageCase) =>
  `${c.year}-${String(c.month).padStart(2, "0")}`;
