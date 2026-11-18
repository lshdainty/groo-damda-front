// 예산 하루 평균 — groo-design #259. 홈 · 통계와 같은 경우(daily-average.test-utils)에서 같은 값.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DAILY_AVERAGE_CASES,
  monthKeyOf,
} from "@/shared/lib/groo/daily-average.test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const q = (data: unknown) => ({ data, isError: false, refetch: vi.fn() });
const state = { total: 0 };
vi.mock("@/features/expense", () => ({
  useExpenseBudgets: () => q([]),
  useRangeSummary: () =>
    q({ totalIncome: 0, totalExpense: state.total, categoryBreakdown: [] }),
  useExpenseCategories: () => q([]),
  useBudgetCompliance: () => q([]),
}));
vi.mock("@/features/user", () => ({
  useUserPreferences: () => q({ budgetAlertThreshold: 85 }),
}));

const { useBudgetModel } = await import("./budget-model");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("예산 하루 평균(dailyActual) — 이번 달은 1일부터 오늘까지, 지난 달은 그 달 전체, 원 단위 half-up", () => {
  it.each(DAILY_AVERAGE_CASES)("$name → $expected", (c) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(c.today);
    state.total = c.total;
    const seen: number[] = [];
    const Probe = () => {
      seen.push(
        useBudgetModel({ monthKey: monthKeyOf(c), setMonthKey: () => {} })
          .dailyActual,
      );
      return null;
    };
    act(() => root.render(<Probe />));
    expect(seen[seen.length - 1]).toBe(c.expected);
  });
});
