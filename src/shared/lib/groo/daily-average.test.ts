// 하루 평균 셈 — groo-design #259(DESIGN.md 숫자 "하루 평균"). 화면 쪽 시험은 같은 경우(DAILY_AVERAGE_CASES)로 홈 · 예산 · 통계를 돈다.
import { describe, expect, it } from "vitest";

import {
  dailyAverage,
  dailyAverageDays,
  divideWonHalfUp,
  monthDailyAverage,
} from "./daily-average";
import { DAILY_AVERAGE_CASES } from "./daily-average.test-utils";

describe("dailyAverageDays — 오늘을 품으면 첫날부터 오늘까지, 지난 기간은 전체", () => {
  it.each(DAILY_AVERAGE_CASES)("$name", (c) => {
    expect(
      dailyAverageDays(
        new Date(c.year, c.month - 1, 1),
        new Date(c.year, c.month, 0),
        c.today,
      ),
    ).toBe(c.days);
  });

  it("시각은 버린다 — 첫날 23:59 · 마지막 날 00:00 이어도 날짜로 센다", () => {
    expect(
      dailyAverageDays(
        new Date(2026, 10, 1, 23, 59),
        new Date(2026, 10, 30, 0, 0),
        new Date(2026, 10, 18, 0, 0),
      ),
    ).toBe(18);
  });

  it("오늘이 마지막 날이면 전체, 아직 오지 않은 기간도 전체, 하루짜리 기간은 1", () => {
    const from = new Date(2026, 10, 1);
    const to = new Date(2026, 10, 30);
    expect(dailyAverageDays(from, to, new Date(2026, 10, 30, 12))).toBe(30);
    expect(dailyAverageDays(from, to, new Date(2026, 9, 31, 12))).toBe(30);
    expect(dailyAverageDays(from, from, new Date(2026, 10, 1))).toBe(1);
  });

  it("일광 절약 시각으로 하루가 23 · 25 시간이어도 날수가 같다(연 · 월 · 일로 센다)", () => {
    // 3월 · 11월에 시각이 바뀌는 곳에서도 3월 1일 ~ 31일은 31일
    expect(
      dailyAverageDays(
        new Date(2026, 2, 1),
        new Date(2026, 2, 31),
        new Date(2026, 3, 2),
      ),
    ).toBe(31);
  });
});

describe("divideWonHalfUp — 원 단위 half-up(0.5 는 0 에서 먼 쪽)", () => {
  it("1.5 → 2 · 2.4 → 2 · −1.5 → −2 · −2.4 → −2 · 0 은 +0", () => {
    expect(divideWonHalfUp(3, 2)).toBe(2);
    expect(divideWonHalfUp(12, 5)).toBe(2);
    expect(divideWonHalfUp(-3, 2)).toBe(-2);
    expect(divideWonHalfUp(-12, 5)).toBe(-2);
    expect(Object.is(divideWonHalfUp(0, 7), 0)).toBe(true);
    expect(Object.is(divideWonHalfUp(-1, 7), 0)).toBe(true);
  });

  it("Math.round 와 다른 자리 — 음수의 .5", () => {
    expect(Math.round(-1635.5)).toBe(-1635);
    expect(divideWonHalfUp(-29_439, 18)).toBe(-1636);
  });
});

describe("dailyAverage · monthDailyAverage — 같은 경우는 같은 값", () => {
  it.each(DAILY_AVERAGE_CASES)("$name → $expected", (c) => {
    expect(monthDailyAverage(c.total, c.year, c.month, c.today)).toBe(
      c.expected,
    );
    expect(
      dailyAverage(
        c.total,
        new Date(c.year, c.month - 1, 1),
        new Date(c.year, c.month, 0),
        c.today,
      ),
    ).toBe(c.expected);
  });
});
