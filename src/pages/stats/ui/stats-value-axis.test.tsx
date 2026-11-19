// 통계 세로 눈금 QA(2026-11-18, dev f3d43f81 — 수입 0원 · 하루 지출 최대 5.8만 · 폰 320). 차트 눈금 글은 글자 크기 설정을 따르지
// 않는다(#260) — 아래는 모두 글자 300% 에서 100% 와 같은 눈금이다.
//   A 수입이 모두 0 이면 왼쪽 수입 축이 "0 · 0 · 1 · 1 · 1"(0 ~ 1 을 다섯 칸으로) — 앱 niceChartAxis 처럼 0 ~ 1만
//   B recharts 세로축 기본(interval "preserveEnd")이 준 눈금도 글 높이 + 8 로 재 빼서 "−6만 · −4만 · 0"(−2만 빠짐),
//     "0 · 4만 · 8만"(2만 · 6만 빠짐)처럼 고르지 않았다 — niceValueAxis 눈금(1 · 2 · 5 간격 · 0 포함)을 하나도 빼지 않고 그린다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeTickScale,
  edgeLabelBox,
  installValueAxisHarness,
  layoutCharts,
  tickScale,
  yTickLabels,
} from "@/shared/lib/groo/value-axis.test-utils";
import { MINUS } from "@/shared/ds/chart/chart-variants";
import type { StatsModel, TrendDatum } from "./stats-model";
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
const { TrendSection, SavingsBarsSection } =
  await import("./stats-trend-parts");
const { FixedTrendSection } = await import("./fixed-parts");
const { CompareWeekdaySection } = await import("./stats-compare-parts");

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
});

const render = (node: React.ReactNode) =>
  act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));
/** 폰 320 — 띠 좌우 24 를 뺀 차트 폭 */
const PHONE_CHART = 272;

/** 11. 1. ~ 11. 18. 날별 — 수입 0, 지출은 며칠만(가장 많은 날 58,000) */
const SPEND: Record<number, number> = { 3: 12_000, 8: 58_000, 12: 31_000 };
const days: TrendDatum[] = Array.from({ length: 18 }, (_, i) => {
  const expense = SPEND[i + 1] ?? 0;
  return {
    month: `11. ${i + 1}.`,
    tick: { label: `11. ${i + 1}.` },
    income: 0,
    expense,
    savings: -expense,
  };
});

const model = (over: Partial<Record<keyof StatsModel, unknown>> = {}) =>
  ({
    rangeQ: { isLoading: false, isError: false, data: {}, refetch: () => {} },
    trendFailed: false,
    retryTrend: () => {},
    useDailyTrend: true,
    periodLbl: "11월",
    period: monthRangeOf(new Date(2026, 10, 18)),
    pickerOpen: false,
    setPickerOpen: () => {},
    setPeriod: () => {},
    setPickerDraft: () => {},
    trendChartData: days,
    ...over,
  }) as unknown as StatsModel;

/** 글자 300% — 눈금 글은 그대로라 100% 와 같은 눈금이 나와야 한다 */
const at300 = () => {
  tickScale.value = 3;
};

describe("수입 · 지출 추이 — 이중 축", () => {
  // 200 · 300%: 그리는 높이 200 − 8 − 5 − (12 + 15) = 160 → 10 칸(눈금 글 줄 15 그대로 — 예전 200% 는 4 칸으로 줄였다). 다섯 칸으로
  // 맞춘 축(왼쪽 0 ~ 1만 · 오른쪽 0 ~ 10만)이 그대로 든다
  it("A · B 글자 300% · 폰 320 — 왼쪽 수입 0 ~ 1만 · 오른쪽 지출 0 ~ 10만, 두 축 같은 여섯 눈금을 하나도 빼지 않는다(100% 와 같다)", async () => {
    at300();
    await render(<TrendSection m={model()} place="band" />);
    await layoutCharts(PHONE_CHART);
    // 수입이 모두 0 — 앱 niceChartAxis 와 같은 0 ~ 1만(겹치는 "0 · 0 · 1 · 1 · 1" 이 아니다)
    expect(yTickLabels(container, { axis: 0 })).toEqual([
      "0",
      "0.2만",
      "0.4만",
      "0.6만",
      "0.8만",
      "1만",
    ]);
    // 지출 0 ~ 5.8만 은 2만 간격 — 왼쪽이 다섯 칸이라 0 ~ 10만, 격자와 같은 높이에 선다(앱 p_chart_cartesian)
    expect(yTickLabels(container, { axis: 1 })).toEqual([
      "0",
      "2만",
      "4만",
      "6만",
      "8만",
      "10만",
    ]);
  });

  it("한 계열을 끄면 남은 계열의 축 하나 — 지출만 0 ~ 6만", async () => {
    at300();
    const Wrapped = () => <TrendSection m={model()} place="band" />;
    await render(<Wrapped />);
    await layoutCharts(PHONE_CHART);
    // 수입 타일을 눌러 끈다
    const income = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
    ).find((b) => b.textContent?.includes("수입"))!;
    await act(async () => income.click());
    await layoutCharts(PHONE_CHART);
    expect(container.querySelectorAll(".recharts-yAxis")).toHaveLength(1);
    expect(yTickLabels(container)).toEqual(["0", "2만", "4만", "6만"]);
  });
});

describe("날별 순저축 — 음수 막대", () => {
  it("B 글자 300% · 폰 320 — −6만 · −4만 · −2만 · 0 을 모두 그린다", async () => {
    at300();
    await render(<SavingsBarsSection m={model()} place="band" />);
    await layoutCharts(PHONE_CHART);
    expect(yTickLabels(container)).toEqual([
      `${MINUS}6만`,
      `${MINUS}4만`,
      `${MINUS}2만`,
      "0",
    ]);
  });
});

describe("고정 · 변동 추이 — 쌓은 막대", () => {
  it("B 글자 300% · 폰 320 — 칸마다 합의 nice 눈금(0 ~ 60만 · 20만 간격)을 모두 그린다", async () => {
    at300();
    const bucket = (month: number, total: number, fixed: number) => ({
      year: 2026,
      month,
      totalExpense: total,
      fixedExpense: fixed,
      totalIncome: 0,
      fixedIncome: 0,
    });
    const m = model({
      rangeQ: {
        isLoading: false,
        isError: false,
        refetch: () => {},
        data: {
          monthlyBuckets: [
            bucket(6, 320_000, 120_000),
            bucket(7, 410_000, 120_000),
            bucket(8, 280_000, 120_000),
            bucket(9, 460_000, 130_000),
            bucket(10, 390_000, 130_000),
            bucket(11, 210_000, 130_000),
          ],
        },
      },
    });
    await render(<FixedTrendSection m={m} place="band" />);
    await layoutCharts(PHONE_CHART);
    // 가장 큰 칸 46만 — 네 칸으로 나눈 11.5만 위의 nice 간격 20만(1 · 2 · 5)
    expect(yTickLabels(container)).toEqual(["0", "20만", "40만", "60만"]);
  });
});

describe("요일별 지출 비교 — 막대 둘", () => {
  it("B 글자 300% · 폰 320 — 0 ~ 6만 을 모두 그린다", async () => {
    at300();
    const q = { isLoading: false, isError: false, data: [] };
    const m = model({
      monthExpensesQ: q,
      prevMonthExpensesQ: q,
      wkNow: [0, 12_000, 58_000, 0, 31_000, 0, 0],
      wkPrev: [5_000, 0, 22_000, 8_000, 0, 41_000, 0],
      wkDelta: { idx: -1 },
      periodNow: "11월",
      periodPrev: "10월",
    });
    await render(<CompareWeekdaySection m={m} place="band" />);
    await layoutCharts(PHONE_CHART);
    expect(yTickLabels(container)).toEqual(["0", "2만", "4만", "6만"]);
  });
});

/** 세로축 끝 글의 자리(#250) — 통계 추이(이중 축 · 200) · 순저축(180), 글자 300% */
describe("통계 추이 · 글자 300% — 세로축 끝 글이 상자 안 · 가로 글과 겹치지 않는다", () => {
  for (const after of [false, true]) {
    it(after ? "페이지가 뜬 뒤 300% 로 키울 때" : "처음부터 300%", async () => {
      tickScale.value = after ? 1 : 3;
      await render(
        <>
          <TrendSection m={model()} place="band" />
          <SavingsBarsSection m={model()} place="band" />
        </>,
      );
      await layoutCharts(PHONE_CHART);
      if (after) {
        await changeTickScale(3);
        await layoutCharts(PHONE_CHART);
      }
      for (const chart of [0, 1]) {
        const { yTop, yBottom, xTop } = edgeLabelBox(container, { chart });
        expect(yTop).toBeGreaterThanOrEqual(0);
        expect(yBottom).toBeLessThanOrEqual(xTop);
      }
    });
  }
});
