// 통계 추이 가로 눈금 — groo-design #247(chart.md "큰 글자" 아래 네 줄) · QA(2026-11-18, 11. 1. ~ 11. 18. · 폰 320).
//   D-1 끝 글 자리는 비워 둔다 — 그리는 자리 오른쪽에 끝 눈금 글 폭의 절반(오른쪽 축이 있으면 모자란 만큼만). 끝 글을 안으로 당기다
//       앞 글을 빼지 않아 건너뛴 간격이 끝까지 고르다. 예전에는 끝 글을 당기며 앞 글을 빼 "11. 3. · 11. 8. · 11. 18."(5일 · 10일)이었다
//   D-2 같은 화면 · 같은 기간 차트(수입 · 지출과 순저축)는 그리는 자리가 가장 좁은 차트로 건너뛰기를 한 번 세고 같은 날짜 글을 쓴다.
//       예전에는 위 "11. 3. · 11. 8. · 11. 18." · 아래 "11. 2. · 11. 6. · 11. 10. · 11. 18." 로 달랐다
//   C  글자 200% · 축 둘이면 끝 글 하나만 — 지금대로 둔다(chart.md "끝 글 하나만 들어가면")
//   #248 같은 기간 · 같은 눈금 단위(달)면 여러 달일 때 보이는 주요 카테고리 월별 추이도 같은 묶음 — 세 차트가 같은 달 글
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChartXGroup } from "@/shared/ds/chart";
import {
  installValueAxisHarness,
  layoutCharts,
  tickScale,
  xTickLabels,
} from "@/shared/lib/groo/value-axis.test-utils";
import type { StatsModel, TrendDatum } from "./stats-model";
import { monthRangeOf } from "./stats-range";
import { monthAxisTicks } from "@/shared/lib/date";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const { i18n } = await import("@/shared/i18n/config");
const { TrendSection, SavingsBarsSection, CatTrendSection } =
  await import("./stats-trend-parts");

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

const model = () =>
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
    trendXGroup: createChartXGroup(),
  }) as unknown as StatsModel;

/** 추이 탭 그대로 — 수입 · 지출(이중 축) 위, 순저축 막대 아래. 같은 모델(같은 묶음) */
const renderTrendTab = async (scale: number) => {
  tickScale.value = scale;
  const m = model();
  await act(() =>
    root.render(
      <MemoryRouter>
        <TrendSection m={m} place="band" />
        <SavingsBarsSection m={m} place="band" />
      </MemoryRouter>,
    ),
  );
  await layoutCharts(PHONE_CHART);
  // 묶음의 가장 좁은 폭이 바뀌면 그린 뒤에 차트들을 다시 그린다
  await act(async () => {});
};

const day = (label: string) => Number(/\d+\. (\d+)\./.exec(label)?.[1]);
const gaps = (labels: string[]) =>
  labels.slice(1).map((l, i) => day(l) - day(labels[i]!));

describe("통계 추이 — 위 · 아래 차트의 가로 날짜", () => {
  for (const scale of [1, 2]) {
    it(`폰 320 · 글자 ${scale * 100}% — 두 차트가 같은 날짜 글이고, 끝(11. 18.)까지 간격이 고르다`, async () => {
      await renderTrendTab(scale);
      const top = xTickLabels(container, { chart: 0 }).map((l) => l.text);
      const bottom = xTickLabels(container, { chart: 1 }).map((l) => l.text);
      expect(top[top.length - 1]).toBe("11. 18.");
      expect(bottom).toEqual(top);
      expect(new Set(gaps(top)).size).toBeLessThanOrEqual(1);
      if (scale === 2) {
        // C — 글이 둘도 들어가지 않는 폭이면 끝 글 하나만(지금대로)
        expect(top).toEqual(["11. 18."]);
      } else {
        expect(top.length).toBeGreaterThan(1);
      }
    });

    it(`폰 320 · 글자 ${scale * 100}% — 끝 글이 차트 오른쪽 끝을 넘지 않는다(이중 축 · 축 하나 모두)`, async () => {
      await renderTrendTab(scale);
      for (const chart of [0, 1]) {
        const xs = xTickLabels(container, { chart });
        expect(xs[xs.length - 1]!.right).toBeLessThanOrEqual(
          PHONE_CHART + 0.01,
        );
        // 글 사이 8 이상
        for (let i = 1; i < xs.length; i++)
          expect(xs[i]!.left - xs[i - 1]!.right).toBeGreaterThanOrEqual(8);
      }
    });
  }
});

/** 2025. 12. ~ 2026. 11. 열두 달 — 월별 추이 · 순저축 · 주요 카테고리 월별 추이(여러 달이라 보인다) */
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  year: i === 0 ? 2025 : 2026,
  month: i === 0 ? 12 : i,
}));
const monthTicks = monthAxisTicks(MONTHS);
const monthly = () =>
  ({
    ...(model() as unknown as Record<string, unknown>),
    useDailyTrend: false,
    periodLbl: "2025. 12. ~ 2026. 11.",
    trendChartData: MONTHS.map((_, i) => ({
      month: monthTicks[i]!.label,
      tick: monthTicks[i]!,
      income: 0,
      expense:
        [120, 340, 80, 560, 210, 90, 450, 300, 130, 610, 270, 580][i]! * 1_000,
      savings:
        -[120, 340, 80, 560, 210, 90, 450, 300, 130, 610, 270, 580][i]! * 1_000,
    })),
    catTrendTop3: [
      { categoryRowId: 1, categoryName: "식비", totalAmount: 900_000 },
      { categoryRowId: 2, categoryName: "교통", totalAmount: 400_000 },
    ],
    categoryById: new Map(),
    catTrendData: MONTHS.map((_, i) => ({
      label: monthTicks[i]!.label,
      tick: monthTicks[i]!,
      parts: [60_000 + i * 1_000, 20_000],
      sum: 80_000 + i * 1_000,
      isCur: i === 11,
    })),
  }) as unknown as StatsModel;

describe("통계 추이 · 여러 달 — 주요 카테고리 월별 추이까지 한 묶음(#248)", () => {
  for (const scale of [1, 2]) {
    it(`폰 320 · 글자 ${scale * 100}% — 세 차트가 같은 달 글이고 간격이 고르다`, async () => {
      tickScale.value = scale;
      const m = monthly();
      await act(() =>
        root.render(
          <MemoryRouter>
            <TrendSection m={m} place="band" />
            <SavingsBarsSection m={m} place="band" />
            <CatTrendSection m={m} place="band" />
          </MemoryRouter>,
        ),
      );
      await layoutCharts(PHONE_CHART);
      await act(async () => {});
      const at = (chart: number) =>
        xTickLabels(container, { chart }).map((l) => l.text);
      // 끝 달(11월)이 남는다 — 끝 글 하나뿐이면 맨 앞 칸(2025. 12.)과 해가 달라 연도가 붙는다("2026. 11.")
      expect(["11월", "2026. 11."]).toContain(at(0)[at(0).length - 1]);
      expect(at(1)).toEqual(at(0));
      expect(at(2)).toEqual(at(0));
      for (const chart of [0, 1, 2]) {
        const xs = xTickLabels(container, { chart });
        expect(xs[xs.length - 1]!.right).toBeLessThanOrEqual(
          PHONE_CHART + 0.01,
        );
      }
    });
  }
});
