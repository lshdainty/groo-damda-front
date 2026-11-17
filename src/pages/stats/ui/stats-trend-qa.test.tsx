// 통계 › 추이 QA(2026-11-17) — 앱(groo-damda-app fix/stats-trend-qa)에서 고친 결함의 웹 미러.
//   ⓐ 0 이 대부분인 날별 선에 늘 찍는 점(chart.md "늘 찍는 점 — dots", 값 7 개 이하)
//   ⓑ 수입 0 이면 비율은 "—"(DESIGN.md "퍼센트") · 문장 "수입이 없어 저축률을 낼 수 없어요"
//   ⓓ 가로축은 오늘에서 끝(chart.md "축") — 일별은 오늘까지, 월별은 이번 달까지. 일별 순저축 막대도 같은 점
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Expense } from "@/entities/expense";
import { CHART_HIDE_DOTS } from "@/shared/ds/chart/chart-variants";
import { formatDailyTick } from "@/shared/lib/date";
import {
  TREND_DOTS_MAX_VALUES,
  buildTrendData,
  savingsRates,
  trendNeedsDots,
  type StatsModel,
  type TrendDatum,
} from "./stats-model";
import { monthRangeOf, yearRangeOf, type RangeState } from "./stats-range";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const { i18n } = await import("@/shared/i18n/config");
const { TrendSection, SavingsRateSection, SavingsBarsSection } =
  await import("./stats-trend-parts");

let container: HTMLDivElement;
let root: Root;
let observers: { cb: (entries: unknown[]) => void; el: Element }[] = [];
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  observers = [];
  globalThis.ResizeObserver = class {
    private cb: (entries: unknown[]) => void;
    constructor(cb: (entries: unknown[]) => void) {
      this.cb = cb;
    }
    observe(el: Element) {
      observers.push({ cb: this.cb, el });
    }
    unobserve() {}
    disconnect() {
      observers = observers.filter((o) => o.cb !== this.cb);
    }
  } as unknown as typeof ResizeObserver;
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
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await i18n.changeLanguage("ko");
});

const render = (node: React.ReactNode) =>
  act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));
/** recharts 의 ResponsiveContainer 에 크기를 알린다 — jsdom 은 레이아웃이 없다 */
const layoutCharts = (width = 400, height = 200) =>
  act(() => {
    for (const o of observers)
      if (o.el.classList.contains("recharts-responsive-container"))
        o.cb([{ target: o.el, contentRect: { width, height } }]);
  });

const TODAY = new Date(2026, 10, 17); // 2026-11-17
const day = (d: number, income = 0, expense = 0): TrendDatum => ({
  month: `11. ${d}.`,
  tick: { label: `11. ${d}.` },
  income,
  expense,
  savings: income - expense,
});
/** 30 일 중 valued 개 날만 지출이 있는 날별 합 */
const daysWith = (valued: number) =>
  Array.from({ length: 30 }, (_, i) => day(i + 1, 0, i < valued ? 10_000 : 0));

const tx = (date: string, type: "INCOME" | "EXPENSE", amount: number) =>
  ({
    rowId: Math.random(),
    expenseDate: `${date}T12:00:00`,
    expenseType: type,
    amount,
  }) as unknown as Expense;

const bucket = (year: number, month: number, inc = 0, out = 0) => ({
  year,
  month,
  totalIncome: inc,
  totalExpense: out,
});

const model = (over: Partial<Record<keyof StatsModel, unknown>>) =>
  ({
    rangeQ: { isLoading: false, isError: false, data: {}, refetch: () => {} },
    trendFailed: false,
    retryTrend: () => {},
    useDailyTrend: true,
    periodLbl: "11월",
    period: monthRangeOf(TODAY),
    pickerOpen: false,
    setPickerOpen: () => {},
    setPeriod: () => {},
    pickerDraft: undefined,
    setPickerDraft: () => {},
    statLabelIn: "수입",
    statLabelOut: "지출",
    statLabelSave: "순저축",
    ...over,
  }) as unknown as StatsModel;

describe("ⓐ 늘 찍는 점 — 0 이 대부분인 날별 선", () => {
  it("값(0 이 아닌 날) 7 개 이하면 켜고 8 개면 끈다, 값이 없으면 끈다", () => {
    expect(TREND_DOTS_MAX_VALUES).toBe(7);
    expect(trendNeedsDots(daysWith(1), new Set())).toBe(true);
    expect(trendNeedsDots(daysWith(7), new Set())).toBe(true);
    expect(trendNeedsDots(daysWith(8), new Set())).toBe(false);
    expect(trendNeedsDots(daysWith(0), new Set())).toBe(false);
  });

  it("끈 계열은 세지 않는다 — 수입이 매일 있어도 수입을 끄면 지출 하루만 센다", () => {
    const data = Array.from({ length: 30 }, (_, i) =>
      day(i + 1, 1_000, i === 4 ? 10_000 : 0),
    );
    expect(trendNeedsDots(data, new Set())).toBe(false);
    expect(trendNeedsDots(data, new Set(["income"]))).toBe(true);
    // 지출을 끄면 수입 30 일 — 끈다
    expect(trendNeedsDots(data, new Set(["expense"]))).toBe(false);
  });

  it("QA 그림 그대로(지출 하루) — 추이 차트가 점을 켜고, 채움(면 그라디언트)은 그대로", async () => {
    const data = daysWith(1);
    await render(
      <TrendSection m={model({ trendChartData: data })} place="card" />,
    );
    await layoutCharts();
    const box = container.querySelector("[data-slot=chart]")!;
    expect(box.className).not.toContain(CHART_HIDE_DOTS);
    expect(
      container.querySelectorAll(".recharts-area-dots circle").length,
    ).toBeGreaterThan(0);
    expect(container.querySelectorAll("linearGradient").length).toBe(2);
  });

  it("값이 8 개 이상인 날별 선은 점을 두지 않는다(기본)", async () => {
    await render(
      <TrendSection m={model({ trendChartData: daysWith(8) })} place="card" />,
    );
    await layoutCharts();
    const box = container.querySelector("[data-slot=chart]")!;
    expect(box.className).toContain(CHART_HIDE_DOTS);
    expect(
      container.querySelectorAll(".recharts-area-dots circle"),
    ).toHaveLength(0);
  });
});

describe("ⓑ 수입 0 이면 비율은 —", () => {
  it("savingsRates — 수입 0 이하면 null(0 으로 나누지 않는다), 있으면 0 ~ 100", () => {
    expect(savingsRates(0, 50_000)).toBeNull();
    expect(savingsRates(-10, 0)).toBeNull();
    expect(savingsRates(Number.NaN, 0)).toBeNull();
    expect(savingsRates(100_000, 40_000)).toEqual({ save: 60, spend: 40 });
    // 수입보다 많이 쓰면 저축 0 · 지출 100 에서 멈춘다
    expect(savingsRates(100_000, 250_000)).toEqual({ save: 0, spend: 100 });
  });

  const noIncome = (lang: "ko" | "en") =>
    it(`수입 0 화면(${lang}) — 고리 "—" · 문장 · "지출 —" · "순저축 —", NaN · Infinity · "0%" 없음`, async () => {
      await i18n.changeLanguage(lang);
      const rates = savingsRates(0, 29_430);
      const m = model({
        avgIn: 0,
        avgOut: 29_430,
        avgSave: -29_430,
        saveRate: rates?.save ?? null,
        spendRate: rates?.spend ?? null,
        statLabelIn: lang === "ko" ? "수입" : "Income",
        statLabelOut: lang === "ko" ? "지출" : "Expense",
        statLabelSave: lang === "ko" ? "순저축" : "Net savings",
      });
      for (const place of ["band", "card"] as const) {
        await render(<SavingsRateSection m={m} place={place} />);
        const text = container.textContent ?? "";
        expect(
          container.querySelector("[data-slot=stats-savings-ring-value]")!
            .textContent,
        ).toBe("—");
        expect(text).toContain(
          lang === "ko"
            ? "수입이 없어 저축률을 낼 수 없어요"
            : "No income, so there's no savings rate to show",
        );
        const rows = Array.from(container.querySelectorAll("li")).map(
          (li) => li.textContent ?? "",
        );
        expect(rows[1]).toContain(lang === "ko" ? "지출 —" : "Expense —");
        expect(rows[2]).toContain(lang === "ko" ? "순저축 —" : "Net savings —");
        expect(text).not.toMatch(/NaN|Infinity|0%/);
        // 장식 막대 · 고리 호도 비운다
        const bars = container.querySelectorAll<HTMLElement>(
          "[aria-hidden].flex.h-2 > div",
        );
        for (const b of bars) expect(b.style.width).toBe("0%");
        const arc = container.querySelectorAll("circle")[1]!;
        expect(arc.getAttribute("stroke-dasharray")!.startsWith("0 ")).toBe(
          true,
        );
      }
    });
  noIncome("ko");
  noIncome("en");

  it('수입이 있으면 그대로 "60%" 문장 · 범례', async () => {
    const rates = savingsRates(100_000, 40_000);
    await render(
      <SavingsRateSection
        m={model({
          avgIn: 100_000,
          avgOut: 40_000,
          avgSave: 60_000,
          saveRate: rates?.save ?? null,
          spendRate: rates?.spend ?? null,
        })}
        place="card"
      />,
    );
    expect(
      container.querySelector("[data-slot=stats-savings-ring-value]")!
        .textContent,
    ).toBe("60%");
    expect(container.textContent).toContain(
      "월 평균 수입의 60%를 저축하고 있어요",
    );
    expect(container.textContent).toContain("지출 40%");
  });
});

describe("ⓓ 가로축은 오늘에서 끝", () => {
  const daily = (period: RangeState, today: Date, expenses: Expense[] = []) =>
    buildTrendData({
      useDailyTrend: true,
      period,
      expenses,
      monthlyBuckets: [],
      today,
    });

  it("이번 달 — 11. 17. 에서 끝나고 11. 18. ~ 11. 30. 을 0 으로 그리지 않는다", () => {
    const data = daily(monthRangeOf(TODAY), TODAY, [
      tx("2026-11-03", "EXPENSE", 12_000),
      tx("2026-11-03", "INCOME", 50_000),
    ]);
    expect(data).toHaveLength(17);
    expect(data[data.length - 1]!.month).toBe(formatDailyTick(TODAY, false));
    expect(data[2]).toMatchObject({
      income: 50_000,
      expense: 12_000,
      savings: 38_000,
    });
  });

  it("말일이 오늘이면 30 점, 지난 달은 말일까지(31 점), 첫날이 오늘이면 1 점", () => {
    expect(daily(monthRangeOf(TODAY), new Date(2026, 10, 30))).toHaveLength(30);
    expect(daily(monthRangeOf(new Date(2026, 9, 5)), TODAY)).toHaveLength(31);
    expect(daily(monthRangeOf(TODAY), new Date(2026, 10, 1))).toHaveLength(1);
    // 기간 전체가 앞날이면 그대로(자를 오늘이 기간 안에 없다)
    expect(daily(monthRangeOf(new Date(2026, 11, 1)), TODAY)).toHaveLength(31);
  });

  it("오늘의 시각이 늦어도 날 단위로 자른다(23:59 도 17 점)", () => {
    expect(
      daily(monthRangeOf(TODAY), new Date(2026, 10, 17, 23, 59)),
    ).toHaveLength(17);
  });

  const monthly = (buckets: ReturnType<typeof bucket>[], today: Date) =>
    buildTrendData({
      useDailyTrend: false,
      period: yearRangeOf(today),
      expenses: [],
      monthlyBuckets: buckets,
      today,
    });

  it("월별 — 올해는 이번 달(11월)까지 11 점, 지난 해는 12 점, 앞날 기간은 그대로", () => {
    const year = (y: number) =>
      Array.from({ length: 12 }, (_, i) => bucket(y, i + 1, 100, 50));
    const thisYear = monthly(year(2026), TODAY);
    expect(thisYear).toHaveLength(11);
    expect(thisYear[thisYear.length - 1]!.month).toBe("11월");
    expect(monthly(year(2025), TODAY)).toHaveLength(12);
    expect(monthly(year(2027), TODAY)).toHaveLength(12);
    // 해를 넘는 기간 — 지난 해 12월 · 올해 1 ~ 11월은 남고, 12월은 빠진다
    const span = [bucket(2025, 12), ...year(2026)];
    expect(monthly(span, TODAY)).toHaveLength(12);
  });

  it("일별 순저축 막대도 같은 점 — 이번 달이면 17 칸", async () => {
    const data = daily(monthRangeOf(TODAY), TODAY, [
      tx("2026-11-03", "EXPENSE", 12_000),
    ]);
    await render(
      <SavingsBarsSection m={model({ trendChartData: data })} place="card" />,
    );
    expect(container.querySelectorAll("table tbody tr")).toHaveLength(17);
  });
});
