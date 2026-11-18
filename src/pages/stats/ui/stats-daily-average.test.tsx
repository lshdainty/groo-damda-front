// 통계 하루 평균 — groo-design #259. 요약 · 하이라이트(avgValue)와 비교 탭(지표 "하루 평균")이 홈 · 예산과 같은 경우
// (daily-average.test-utils)에서 같은 값. 예전 요약 · 하이라이트는 기간 전체 날수(rangeDays)로 나눠 이번 달 평균이 작았다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dailyAverageDays,
  divideWonHalfUp,
} from "@/shared/lib/groo/daily-average";
import { DAILY_AVERAGE_CASES } from "@/shared/lib/groo/daily-average.test-utils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/desk/stats", state: null }),
}));

const q = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});
/** 기간 첫날("YYYY-MM-DD") → 그 기간 지출 합 */
const totals = new Map<string, number>();
vi.mock("@/features/expense", () => ({
  useRangeSummary: (start: string) =>
    q({
      totalIncome: 0,
      totalExpense: totals.get(start) ?? 0,
      fixedIncome: 0,
      fixedExpense: 0,
      categoryBreakdown: [],
      monthlyBuckets: [],
    }),
  useMerchantSummary: () => q({ merchants: [] }),
  useExpenseHeatmap: () => q([]),
  useExpenseCategories: () => q([]),
  useExpenses: () => q([]),
  useMonthlyTrend: () => q([]),
}));

const { useStatsModel, useStatsState } = await import("./stats-model");
const { fmt, monthRangeOf, previousRange } = await import("./stats-range");
type RangeState = import("./stats-range").RangeState;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  totals.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

/** 그 기간으로 통계 모델을 그려 하루 평균 셋(요약 · 비교 이번 · 비교 이전)을 읽는다 */
const averagesFor = (period: RangeState) => {
  const seen: { avg: number; cmpNow: number; cmpPrev: number }[] = [];
  const Probe = () => {
    const own = useStatsState();
    const m = useStatsModel({ ...own, period });
    const daily = m.cmpMetrics.find((x) => x.key === "daily")!;
    seen.push({ avg: m.avgValue, cmpNow: daily.now, cmpPrev: daily.prev });
    return null;
  };
  act(() => root.render(<Probe />));
  return seen[seen.length - 1]!;
};

describe("통계 하루 평균 — 요약 · 하이라이트 · 비교가 홈 · 예산과 같은 셈", () => {
  it.each(DAILY_AVERAGE_CASES)("$name → $expected", (c) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(c.today);
    const period = monthRangeOf(new Date(c.year, c.month - 1, 1));
    const prev = previousRange(period);
    totals.set(fmt(period.from), c.total);
    totals.set(fmt(prev.from), c.total);
    const a = averagesFor(period);
    // 요약 · 하이라이트 · 비교(이번) — 같은 값
    expect(a.avg).toBe(c.expected);
    expect(a.cmpNow).toBe(c.expected);
    // 비교(이전) — 지난 기간은 기간 전체 날수
    expect(a.cmpPrev).toBe(
      divideWonHalfUp(c.total, dailyAverageDays(prev.from, prev.to, c.today)),
    );
  });

  it("직접 고른 기간(custom)이 오늘을 품으면 첫날부터 오늘까지 — 11월 10일 ~ 12월 5일, 오늘 11월 18일 → 9일", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 18, 12));
    const period: RangeState = {
      from: new Date(2026, 10, 10),
      to: new Date(2026, 11, 5),
      segMode: "custom",
    };
    totals.set(fmt(period.from), 9_000);
    const a = averagesFor(period);
    expect(a.avg).toBe(1_000);
    expect(a.cmpNow).toBe(1_000);
  });
});
