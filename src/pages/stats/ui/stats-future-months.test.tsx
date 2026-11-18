// 오늘 뒤는 그리지 않는다(chart.md "오늘 뒤는 그리지 않습니다") — 2026-11-18 판정: 주요 카테고리 월별 추이 · 고정/변동 추이가 서버가 기간
// 끝까지 채워 보낸 앞날 달(12월)을 0 으로 그렸다. 그래서 같은 기간 묶음(D-2)의 끝 글도 추이(11월)와 달랐다(12월).
// 이제 월별 차트는 모두 같은 셈(bucketsToToday)으로 이번 달에서 끝난다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChartXGroup } from "@/shared/ds/chart";
import {
  installValueAxisHarness,
  layoutCharts,
  xTickLabels,
} from "@/shared/lib/groo/value-axis.test-utils";
import {
  buildCatTrendData,
  buildTrendData,
  bucketsToToday,
  type StatsModel,
} from "./stats-model";
import { monthRangeOf } from "./stats-range";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** 고정 · 변동 추이가 기간 버킷이 둘 이상이면 쓰지 않는 최근 6개월 질의 */
vi.mock("@/features/expense", async (orig) => ({
  ...(await orig<typeof import("@/features/expense")>()),
  useMonthlyTrend: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
}));

const { i18n } = await import("@/shared/i18n/config");
const { TrendSection, SavingsBarsSection, CatTrendSection } =
  await import("./stats-trend-parts");
const { FixedTrendSection } = await import("./fixed-parts");

const TODAY = new Date(2026, 10, 18); // 2026-11-18

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  installValueAxisHarness();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  await i18n.changeLanguage("ko");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** 2026 년 1 ~ 12월 버킷 — 서버는 기간(올해) 끝까지 0 버킷을 채워 보낸다. 12월은 앞날이다 */
const YEAR = Array.from({ length: 12 }, (_, i) => ({
  year: 2026,
  month: i + 1,
  totalIncome: 0,
  totalExpense: i < 11 ? 100_000 + i * 10_000 : 0,
  fixedIncome: 0,
  fixedExpense: i < 11 ? 50_000 : 0,
  categoryExpenses:
    i < 11
      ? [
          { categoryRowId: 1, amount: 60_000 + i * 1_000 },
          { categoryRowId: 2, amount: 20_000 },
        ]
      : [],
}));
const TOP3 = [
  { categoryRowId: 1, categoryName: "식비", totalAmount: 900_000 },
  { categoryRowId: 2, categoryName: "교통", totalAmount: 400_000 },
];

describe("월별 버킷은 이번 달에서 끝난다", () => {
  it("오늘을 품은 기간 — 이번 달 뒤를 뺀다 · 기간 전체가 앞날이면 그대로 · 지난 기간은 그대로", () => {
    expect(bucketsToToday(YEAR, TODAY).map((b) => b.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    const future = [1, 2, 3].map((month) => ({ year: 2027, month }));
    expect(bucketsToToday(future, TODAY)).toEqual(future);
    const past = [10, 11, 12].map((month) => ({ year: 2025, month }));
    expect(bucketsToToday(past, TODAY)).toEqual(past);
  });

  it("추이 · 주요 카테고리 월별 추이가 같은 칸 — 끝이 11월, 이번 달 표시(isCur)도 11월", () => {
    const trend = buildTrendData({
      useDailyTrend: false,
      period: monthRangeOf(TODAY),
      expenses: [],
      monthlyBuckets: YEAR,
      today: TODAY,
    });
    const cat = buildCatTrendData({
      monthlyBuckets: YEAR,
      top3: TOP3,
      today: TODAY,
    });
    expect(cat).toHaveLength(11);
    expect(cat.map((d) => d.label)).toEqual(trend.map((d) => d.month));
    expect(cat[cat.length - 1]!.label).toBe("11월");
    expect(cat.filter((d) => d.isCur).map((d) => d.label)).toEqual(["11월"]);
  });
});

/** 올해(1 ~ 12월)를 고른 통계 추이 탭 — 수입 · 지출 · 순저축 · 주요 카테고리 월별 추이(여러 달이라 보인다) */
const yearModel = () =>
  ({
    rangeQ: {
      isLoading: false,
      isError: false,
      data: { monthlyBuckets: YEAR },
      refetch: () => {},
    },
    trendFailed: false,
    retryTrend: () => {},
    useDailyTrend: false,
    periodLbl: "2026년",
    period: monthRangeOf(TODAY),
    pickerOpen: false,
    setPickerOpen: () => {},
    setPeriod: () => {},
    setPickerDraft: () => {},
    trendChartData: buildTrendData({
      useDailyTrend: false,
      period: monthRangeOf(TODAY),
      expenses: [],
      monthlyBuckets: YEAR,
      today: TODAY,
    }),
    catTrendTop3: TOP3,
    categoryById: new Map(),
    catTrendData: buildCatTrendData({
      monthlyBuckets: YEAR,
      top3: TOP3,
      today: TODAY,
    }),
    trendXGroup: createChartXGroup(),
  }) as unknown as StatsModel;

const ends = (chart: number) => {
  const xs = xTickLabels(container, { chart });
  return xs[xs.length - 1]?.text;
};

describe("통계 — 앞날 달이 든 기간(올해)", () => {
  it("폰 320 — 추이 · 순저축 · 주요 카테고리 월별 추이의 끝 글이 모두 이번 달(11월)", async () => {
    const m = yearModel();
    await act(() =>
      root.render(
        <MemoryRouter>
          <TrendSection m={m} place="band" />
          <SavingsBarsSection m={m} place="band" />
          <CatTrendSection m={m} place="band" />
        </MemoryRouter>,
      ),
    );
    await layoutCharts(272);
    await act(async () => {});
    expect([ends(0), ends(1), ends(2)]).toEqual(["11월", "11월", "11월"]);
    // 같은 기간 묶음 — 세 차트가 같은 달 글
    const at = (chart: number) =>
      xTickLabels(container, { chart }).map((l) => l.text);
    expect(at(1)).toEqual(at(0));
    expect(at(2)).toEqual(at(0));
    // 표로 보기도 같은 달까지 — 카테고리 추이 표에 12월 줄이 없다
    const tables = Array.from(container.querySelectorAll("table"));
    expect(tables.length).toBeGreaterThanOrEqual(3);
    for (const table of tables) expect(table.textContent).not.toContain("12월");
  });

  it("고정 · 변동 추이도 이번 달에서 끝난다 — 12월을 0 으로 그리지 않는다", async () => {
    await act(() =>
      root.render(
        <MemoryRouter>
          <FixedTrendSection m={yearModel()} place="card" />
        </MemoryRouter>,
      ),
    );
    // 데스크톱 카드 — 열한 칸이 다 들어가는 폭
    await layoutCharts(900);
    const xs = xTickLabels(container).map((l) => l.text);
    expect(xs[xs.length - 1]).toBe("11월");
    expect(xs).not.toContain("12월");
    expect(
      container.querySelectorAll(".recharts-bar-rectangle").length,
    ).toBeLessThanOrEqual(11 * 2);
  });
});
