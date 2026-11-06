// 반복 회차 셈 한 벌(I-20 D 22 · 29) — 이번 달 합 · 다음 예정일 · 끝남. 예시는 결정 그림 셈표(i20-q gen.py:121-137)와 같다.
import { describe, expect, it } from "vitest";
import type { RecurringTransaction } from "@/entities/recurring-transaction";
import {
  isFinished,
  isPaused,
  monthTotal,
  occurrencesBetween,
  previewNextDates,
  upcomingDates,
} from "./recurring-schedule";

const rec = (o: Partial<RecurringTransaction>): RecurringTransaction => ({
  rowId: 1,
  userRowId: 1,
  categoryRowId: null,
  categoryName: null,
  assetRowId: null,
  assetName: null,
  toAssetRowId: null,
  toAssetName: null,
  fee: null,
  interestAmount: null,
  sourceExpenseRowId: null,
  expenseType: "EXPENSE",
  amount: 1000,
  description: null,
  merchant: null,
  paymentMethod: null,
  frequency: "MONTHLY",
  intervalValue: 1,
  dayOfWeek: null,
  dayOfMonth: 1,
  executionTime: null,
  startDate: "2026-01-01",
  endDate: null,
  maxOccurrences: null,
  executedCount: 0,
  nextExecutionDate: "2026-11-01",
  lastExecutedAt: null,
  isActive: "Y",
  autoLog: false,
  notifyDayBefore: false,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
  ...o,
});

// 지출 다섯 · 수입 하나 · 쉬는 이체 하나
const sample = [
  rec({ amount: 234_560, dayOfMonth: 25, startDate: "2026-01-25" }),
  rec({
    amount: 12_000,
    frequency: "WEEKLY",
    dayOfWeek: 1,
    dayOfMonth: null,
    startDate: "2026-01-05",
  }),
  rec({ amount: 123_456_789, dayOfMonth: 1, startDate: "2026-01-01" }),
  rec({ amount: 17_000, dayOfMonth: 2, startDate: "2026-01-02" }),
  rec({
    amount: 1_234_560,
    frequency: "YEARLY",
    dayOfMonth: 14,
    startDate: "2025-10-14",
  }),
  rec({
    amount: 123_456_789,
    expenseType: "INCOME",
    dayOfMonth: 21,
    startDate: "2026-01-21",
  }),
  rec({
    amount: 1_000_000,
    expenseType: "TRANSFER",
    isActive: "N",
    dayOfMonth: 10,
    startDate: "2026-01-10",
  }),
];

describe("이번 달 합 — 규칙으로 센다", () => {
  it("10월 지출은 이미 기록된 보험료(14일)와 월요일 넷을 포함한다", () => {
    expect(monthTotal(sample, "EXPENSE", 2026, 10)).toBe(124_990_909);
  });
  it("11월 1일에 열면 월요일 다섯 · 보험료 없음", () => {
    expect(monthTotal(sample, "EXPENSE", 2026, 11)).toBe(123_768_349);
  });
  it("수입 합 · 쉬는 반복은 더하지 않는다", () => {
    expect(monthTotal(sample, "INCOME", 2026, 10)).toBe(123_456_789);
    expect(
      monthTotal([rec({ isActive: "N", amount: 5_000 })], "EXPENSE", 2026, 10),
    ).toBe(0);
  });
  it("지난 매월 −123,708,349 · 한 달 평균 −123,863,229 가 나오면 틀린 것이다", () => {
    const v = monthTotal(sample, "EXPENSE", 2026, 10);
    expect(v).not.toBe(123_708_349);
    expect(v).not.toBe(123_863_229);
  });
});

describe("회차", () => {
  it("매월 31일은 2월에 말일", () => {
    expect(
      occurrencesBetween(
        rec({ dayOfMonth: 31, startDate: "2026-01-31" }),
        "2026-01-01",
        "2026-04-30",
      ),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("격월", () => {
    expect(
      occurrencesBetween(
        rec({ intervalValue: 2, dayOfMonth: 5, startDate: "2026-01-05" }),
        "2026-01-01",
        "2026-08-30",
      ),
    ).toEqual(["2026-01-05", "2026-03-05", "2026-05-05", "2026-07-05"]);
  });
  it("최대 횟수를 넘는 차례 · 끝 날짜 뒤는 뺀다", () => {
    const base = { dayOfMonth: 5, startDate: "2026-01-05" };
    expect(
      occurrencesBetween(
        rec({ ...base, maxOccurrences: 3 }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toHaveLength(3);
    expect(
      occurrencesBetween(
        rec({ ...base, endDate: "2026-03-10" }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-01-05", "2026-02-05", "2026-03-05"]);
  });
});

describe("다음 예정일 · 끝남", () => {
  it("남은 횟수(최대 − 실행)를 넘지 않는다", () => {
    expect(
      upcomingDates(
        rec({ dayOfMonth: 5, startDate: "2026-01-05", maxOccurrences: 5 }),
        "2026-11-05",
        3,
        3,
      ),
    ).toEqual(["2026-11-05", "2026-12-05"]);
  });
  it("쉬는 중이면 없다", () => {
    expect(upcomingDates(rec({}), "2026-11-01", 0, 3, false)).toEqual([]);
  });
  it("폼 안내 — 매월 31일은 말일, 최대 횟수 안", () => {
    expect(previewNextDates("2026-10-31", "MONTHLY", 0, 31, 3)).toEqual([
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
    expect(
      previewNextDates("2026-10-31", "MONTHLY", 0, 31, 3, {
        maxOccurrences: 2,
      }),
    ).toHaveLength(2);
  });
  it("끝남 — 서버가 횟수를 채우며 isActive 를 N 으로 바꾼 상태도 끝남이다(쉬는 중이 아니다)", () => {
    // 서버 markExecuted(RecurringTransaction.java:259): 횟수를 채우면 isActive=N
    const doneByCount = rec({
      maxOccurrences: 3,
      executedCount: 3,
      isActive: "N",
    });
    expect(isFinished(doneByCount)).toBe(true);
    expect(isPaused(doneByCount)).toBe(false);
    expect(isFinished(rec({ maxOccurrences: 3, executedCount: 3 }))).toBe(true);
    expect(
      isFinished(
        rec({ endDate: "2026-09-15", nextExecutionDate: "2026-10-15" }),
      ),
    ).toBe(true);
  });
  it("쉬는 중 — 꺼져 있고 끝나지 않았다 · 이달 합에서는 빠지고 끝난 반복의 마지막 회차는 센다", () => {
    const paused = rec({ isActive: "N", amount: 5_000 });
    expect(isPaused(paused)).toBe(true);
    expect(monthTotal([paused], "EXPENSE", 2026, 10)).toBe(0);
    const doneThisMonth = rec({
      amount: 7_000,
      dayOfMonth: 5,
      startDate: "2026-08-05",
      maxOccurrences: 3,
      executedCount: 3,
      isActive: "N",
      nextExecutionDate: "2026-11-05",
    });
    // 8 · 9 · 10월 5일이 1 · 2 · 3번째 — 서버가 꺼 두어도 마지막 회차가 든 달은 센다
    expect(monthTotal([doneThisMonth], "EXPENSE", 2026, 10)).toBe(7_000);
    expect(monthTotal([doneThisMonth], "EXPENSE", 2026, 11)).toBe(0);
  });
  it("폼 안내는 오늘 이후 첫 회차부터 · 저장된 간격대로 · 남은 횟수로 자른다", () => {
    expect(
      previewNextDates("2025-01-01", "MONTHLY", 0, 1, 3, {
        fromKey: "2026-11-03",
      }),
    ).toEqual(["2026-12-01", "2027-01-01", "2027-02-01"]);
    expect(
      previewNextDates("2026-01-05", "MONTHLY", 0, 5, 3, {
        intervalValue: 2,
        fromKey: "2026-11-03",
      }),
      // 1-05 · 3-05 · 5-05 · 7-05 · 9-05 · 11-05 — 11-03 다음 첫 회차는 2026-11-05
    ).toEqual(["2026-11-05", "2027-01-05", "2027-03-05"]);
    expect(
      previewNextDates("2026-01-05", "MONTHLY", 0, 5, 3, {
        maxOccurrences: 12,
        executedCount: 10,
        fromKey: "2026-11-03",
      }),
    ).toHaveLength(2);
  });
});
