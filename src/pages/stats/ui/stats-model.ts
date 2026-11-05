import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatChangeRate, isEn } from "@/shared/lib/groo/format";
import { assignChartColors, type ChartColored } from "@/shared/ds/chart";
import { chartColorOf, type ChartKey } from "@/shared/lib/groo/chart-palette";
import { amountFor, countableTx, splitFixed } from "@/entities/expense";
import type {
  CategoryBreakdown,
  ExpenseCategory,
  FixedView,
  HeatmapCell,
} from "@/entities/expense";
import {
  useExpenseCategories,
  useExpenseHeatmap,
  useExpenses,
  useMerchantSummary,
  useRangeSummary,
} from "@/features/expense";
import {
  fmt,
  labelsOf,
  relativeNames,
  monthRangeOf,
  periodLabel,
  previousRange,
  startOfDay,
  type RangeState,
  type TabKey,
} from "./stats-range";

/*
 * 통계 화면의 질의 · 계산(I-08 3) — 폰(StatsMobile)과 데스크톱(StatsDesktop)이 같은 값을 쓴다.
 * 구역은 stats-parts.tsx 가 이 모델을 받아 그린다. 질의가 실패하면 그 질의를 먹는 구역에만 실패를 보인다(I-08 41).
 */

/** 빈 배열 상수 — 로딩 중 매 렌더 새 배열이 되지 않게 참조를 고정한다 */
const EMPTY_HEATMAP: HeatmapCell[] = [];

// 행(시간대 구간) 정의 — 각 구간은 4시간 범위. 하루 흐름: 아침 → 점심 → 오후 → 저녁 → 심야 → 새벽
export const HEAT_ROWS: {
  labelKey: string;
  subKey: string;
  hours: number[];
}[] = [
  {
    labelKey: "heatRow.morning",
    subKey: "heatRow.morningSub",
    hours: [6, 7, 8, 9],
  },
  {
    labelKey: "heatRow.lunch",
    subKey: "heatRow.lunchSub",
    hours: [10, 11, 12, 13],
  },
  {
    labelKey: "heatRow.afternoon",
    subKey: "heatRow.afternoonSub",
    hours: [14, 15, 16, 17],
  },
  {
    labelKey: "heatRow.evening",
    subKey: "heatRow.eveningSub",
    hours: [18, 19, 20, 21],
  },
  {
    labelKey: "heatRow.night",
    subKey: "heatRow.nightSub",
    hours: [22, 23, 0, 1],
  },
  {
    labelKey: "heatRow.dawn",
    subKey: "heatRow.dawnSub",
    hours: [2, 3, 4, 5],
  },
];

// 열(요일) — Java DayOfWeek: 1=월 ~ 7=일
export const HEAT_COLS: { labelKey: string; dow: number }[] = [
  { labelKey: "dow.mon", dow: 1 },
  { labelKey: "dow.tue", dow: 2 },
  { labelKey: "dow.wed", dow: 3 },
  { labelKey: "dow.thu", dow: 4 },
  { labelKey: "dow.fri", dow: 5 },
  { labelKey: "dow.sat", dow: 6 },
  { labelKey: "dow.sun", dow: 7 },
];

export const WK_KEYS = [
  "dow.mon",
  "dow.tue",
  "dow.wed",
  "dow.thu",
  "dow.fri",
  "dow.sat",
  "dow.sun",
] as const;

export type DonutRow = {
  /** null = 미분류. 카테고리 메타가 없으므로 드릴다운도 없다. */
  rowId: number | null;
  name: string;
  amount: number;
  icon: string | null;
  color: string | null;
  hasChildren: boolean;
};

export type CompareRow = {
  groupRowId: number | null;
  name: string;
  icon: string | null;
  color: string | null;
  now: number;
  prev: number;
};

export type DonutSlice = DonutRow & { id: string; saved: ChartKey | null };

/** 도넛 조각에 차트 10색을 배정한다 — 저장된 색 먼저, 10개를 넘으면 상위 9 + 회색 "기타"(I-06 18 과 같은 규칙) */
export function colorDonut(
  rows: DonutRow[],
  othersLabel: string,
): ChartColored<DonutSlice>[] {
  const slices: DonutSlice[] = rows.map((r, i) => ({
    ...r,
    id: `${r.rowId ?? "none"}-${i}`,
    saved: chartColorOf(r.color),
  }));
  return assignChartColors(slices, {
    colorOf: (s) => s.saved,
    groupOthers: (rest) => ({
      id: "others",
      rowId: null,
      name: othersLabel,
      amount: rest.reduce((a, c) => a + c.amount, 0),
      icon: null,
      color: null,
      hasChildren: false,
      saved: null,
    }),
  });
}

const dayMs = 86400000;

export function useStatsModel() {
  const { t } = useTranslation("stats");
  const { t: te } = useTranslation("expense");
  const [tab, setTabState] = useState<TabKey>("cat");
  const [period, setPeriodState] = useState<RangeState>(() =>
    monthRangeOf(new Date()),
  );
  const [activeParentId, setActiveParentId] = useState<number | null>(null);
  // 카테고리 탭 도넛의 보기 — 전체 / 고정 제외 / 고정만. 고정·변동 탭은 이 값과 무관하게 셋을 다 보여 준다.
  const [fixedView, setFixedViewState] = useState<FixedView>("all");
  // 거래를 고정으로 정리하는 화면(고정·변동 탭과 카테고리 탭이 함께 연다).
  const [manageOpen, setManageOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 기간 · 탭 · 보기를 바꾸면 드릴다운을 푼다
  const setTab = (next: TabKey) => {
    setTabState(next);
    setActiveParentId(null);
  };
  const setPeriod = (next: RangeState) => {
    setPeriodState(next);
    setActiveParentId(null);
  };
  const setFixedView = (next: FixedView) => {
    setFixedViewState(next);
    setActiveParentId(null);
  };

  const startDate = fmt(period.from);
  const endDate = fmt(period.to);
  const prevR = previousRange(period);
  const prevStart = fmt(prevR.from);
  const prevEnd = fmt(prevR.to);

  const rangeQ = useRangeSummary(startDate, endDate);
  // 이전 동등 기간 — 비교 탭(전 기간 비교) 또는 월 모드(하루 평균 전월 대비)에서 필요. 그 외엔 빈 인자로 query disabled.
  const needPrev = tab === "compare" || period.segMode === "m";
  const prevRangeQ = useRangeSummary(
    needPrev ? prevStart : "",
    needPrev ? prevEnd : "",
  );
  const categoriesQ = useExpenseCategories({ reference: true });
  const merchantQ = useMerchantSummary(startDate, endDate);
  // 추이 탭 일별 시리즈 · 비교 탭 요일 집계 · 건수에 쓰는 raw 거래
  // 실패는 추이 탭 · 비교 탭이 자기 자리에서 말한다 — 서버 원문 토스트는 끈다
  const monthExpensesQ = useExpenses({ startDate, endDate }, { silent: true });
  const prevMonthExpensesQ = useExpenses(
    {
      startDate: prevStart,
      endDate: prevEnd,
    },
    { silent: true },
  );
  const heatmapQ = useExpenseHeatmap(startDate, endDate);

  const periodLbl = periodLabel(period);
  const labels = labelsOf(period);

  const categoryBreakdown: CategoryBreakdown[] =
    rangeQ.data?.categoryBreakdown ?? [];
  const totalExpense = rangeQ.data?.totalExpense ?? 0;
  const monthlyBuckets = rangeQ.data?.monthlyBuckets ?? [];

  const categoryById = new Map<number, ExpenseCategory>();
  for (const c of categoriesQ.data ?? []) categoryById.set(c.rowId, c);

  const periodBreakdown = categoryBreakdown.filter(
    (c) => c.expenseType === "EXPENSE",
  );

  // ── 카테고리 도넛 ──
  const donutMap = new Map<number | null, DonutRow>();
  for (const c of periodBreakdown) {
    const groupRowId = c.parentCategoryRowId ?? c.categoryRowId;
    const groupName =
      c.parentCategoryName ?? c.categoryName ?? t("uncategorized");
    let row = donutMap.get(groupRowId);
    if (!row) {
      const cat = groupRowId != null ? categoryById.get(groupRowId) : undefined;
      row = {
        rowId: groupRowId,
        name: groupName,
        amount: 0,
        icon: cat?.icon ?? null,
        color: cat?.color ?? null,
        hasChildren: false,
      };
      donutMap.set(groupRowId, row);
    }
    row.amount += amountFor(
      splitFixed(c.totalAmount, c.fixedAmount),
      fixedView,
    );
    if (c.parentCategoryRowId != null) row.hasChildren = true;
  }
  // 고정 제외 · 고정만 보기에서는 몫이 0 인 카테고리를 뺀다 — 0원 조각이 범례에 남으면 헷갈린다
  const donutBreakdown: DonutRow[] = Array.from(donutMap.values())
    .filter((r) => fixedView === "all" || r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const drillMap = new Map<number | null, DonutRow>();
  if (activeParentId != null) {
    for (const c of periodBreakdown) {
      if (c.parentCategoryRowId !== activeParentId) continue;
      let row = drillMap.get(c.categoryRowId);
      if (!row) {
        const cat =
          c.categoryRowId != null
            ? categoryById.get(c.categoryRowId)
            : undefined;
        row = {
          rowId: c.categoryRowId,
          name: c.categoryName ?? t("uncategorized"),
          amount: 0,
          icon: cat?.icon ?? null,
          color: cat?.color ?? null,
          hasChildren: false,
        };
        drillMap.set(c.categoryRowId, row);
      }
      row.amount += amountFor(
        splitFixed(c.totalAmount, c.fixedAmount),
        fixedView,
      );
    }
  }
  const drillBreakdown: DonutRow[] = Array.from(drillMap.values())
    .filter((r) => fixedView === "all" || r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const activeParent =
    activeParentId != null
      ? (donutBreakdown.find((r) => r.rowId === activeParentId) ?? null)
      : null;
  const isDrilled = activeParentId != null && drillBreakdown.length > 0;
  const donutView = isDrilled ? drillBreakdown : donutBreakdown;
  const donutTotal = donutView.reduce((s, x) => s + x.amount, 0);
  // 도넛 가운데(데스크톱) · 합계 줄(폰) 라벨 — custom 모드의 full date range 는 짧게
  const centerPeriodLbl =
    period.segMode === "custom" ? t("period.custom.now") : periodLbl;
  const donutTotalLabel = isDrilled
    ? t("category.drilledCenter", { name: activeParent?.name ?? "" })
    : t(
        fixedView === "variable"
          ? "category.centerVariable"
          : fixedView === "fixed"
            ? "category.centerFixed"
            : "compare.periodExpense",
        { period: centerPeriodLbl },
      );

  // ── 가맹점 TOP 5 ──
  const merchants = merchantQ.data?.merchants ?? [];
  const topMerchants = merchants.slice(0, 5);
  const maxMerchantAmt = Math.max(1, ...topMerchants.map((m) => m.totalAmount));

  // ── 요일 × 시간대 열지도 ──
  const heatmapCells: HeatmapCell[] = heatmapQ.data ?? EMPTY_HEATMAP;
  const heatmapMatrix: number[][] = HEAT_ROWS.map(() => HEAT_COLS.map(() => 0));
  for (const cell of heatmapCells) {
    const colIdx = HEAT_COLS.findIndex((c) => c.dow === cell.dayOfWeek);
    const rowIdx = HEAT_ROWS.findIndex((r) => r.hours.includes(cell.hour));
    if (colIdx < 0 || rowIdx < 0) continue;
    matrixAdd(heatmapMatrix, rowIdx, colIdx, cell.totalAmount);
  }
  const heatmapTotal = heatmapMatrix.reduce(
    (s, row) => s + row.reduce((a, b) => a + b, 0),
    0,
  );

  // ── 요약(하이라이트) ──
  const topMerchant = topMerchants[0];
  const categoryTop = donutBreakdown[0];
  // 가맹점 대표 카테고리 — 원시 거래에서 해당 가맹점의 지배적(최다 지출) 카테고리 역산
  let topMerchantCat: {
    amount: number;
    icon: string | null;
    color: string | null;
  } | null = null;
  if (topMerchant?.merchant) {
    const byCat = new Map<
      number,
      { amount: number; icon: string | null; color: string | null }
    >();
    for (const e of monthExpensesQ.data ?? []) {
      if (e.merchant !== topMerchant.merchant || e.expenseType !== "EXPENSE")
        continue;
      const prev = byCat.get(e.categoryRowId);
      if (prev) {
        prev.amount += e.amount;
      } else {
        const cat = categoryById.get(e.categoryRowId);
        byCat.set(e.categoryRowId, {
          amount: e.amount,
          icon: e.categoryIcon ?? cat?.icon ?? null,
          color: e.categoryColor ?? cat?.color ?? null,
        });
      }
    }
    for (const v of byCat.values())
      if (!topMerchantCat || v.amount > topMerchantCat.amount)
        topMerchantCat = v;
  }
  const rangeDays =
    Math.round(
      (startOfDay(period.to).getTime() - startOfDay(period.from).getTime()) /
        dayMs,
    ) + 1;
  // 평균 — 단일 월 모드는 일평균, 그 외는 월평균. custom 은 일평균.
  const useDailyAvg = period.segMode === "m" || period.segMode === "custom";
  const avgDivisor = useDailyAvg
    ? rangeDays
    : Math.max(1, monthlyBuckets.length);
  const avgValue = avgDivisor > 0 ? Math.round(totalExpense / avgDivisor) : 0;
  const avgLabel = t(labels.avg);
  const prevTotalExpense = prevRangeQ.data?.totalExpense ?? 0;
  // 전월 대비 등락 % — 소수 둘째 자리까지 공용 formatChangeRate(▲ ▼ 가 방향을 말하니 부호 없음)
  const dayPct =
    prevTotalExpense > 0
      ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100
      : 0;
  const dayRate = formatChangeRate(dayPct, { sign: "none" });

  // ── 추이 ──
  // 단일 월(segMode === 'm') 또는 사용자 지정 기간이 1개월 이내면 일별 시리즈, 그 외엔 월별 시리즈
  const useDailyTrend =
    period.segMode === "m" ||
    (period.segMode === "custom" && monthlyBuckets.length <= 1);
  // 추이 · 저축 막대는 요약(월별 묶음)에 더해, 일별로 그릴 때는 그 기간 거래 전체가 있어야 그려진다 —
  // 둘 중 값이 없는 실패가 있으면 빈 차트가 아니라 실패로 말한다
  const trendFailed =
    (rangeQ.isError && !rangeQ.data) ||
    (useDailyTrend && monthExpensesQ.isError && !monthExpensesQ.data);
  const retryTrend = () => {
    if (rangeQ.isError) void rangeQ.refetch();
    if (monthExpensesQ.isError) void monthExpensesQ.refetch();
  };
  const trendChartData = buildTrendData({
    useDailyTrend,
    period,
    expenses: monthExpensesQ.data ?? [],
    monthlyBuckets,
  });
  const sumIn = monthlyBuckets.reduce((s, b) => s + b.totalIncome, 0);
  const sumOut = monthlyBuckets.reduce((s, b) => s + b.totalExpense, 0);
  const n = Math.max(1, monthlyBuckets.length);
  const avgIn = sumIn / n;
  const avgOut = sumOut / n;
  const avgSave = avgIn - avgOut;
  const isSingle = period.segMode === "m";
  const saveRate =
    avgIn > 0 ? Math.max(0, Math.min(100, (avgSave / avgIn) * 100)) : 0;
  const spendRate =
    avgIn > 0 ? Math.max(0, Math.min(100, (avgOut / avgIn) * 100)) : 0;
  const statLabelIn = isSingle ? te("income") : t("trend.avgIncome");
  const statLabelOut = isSingle ? te("expense") : t("trend.avgExpense");
  const statLabelSave = isSingle ? t("trend.savings") : t("trend.avgSavings");

  // ── 주요 카테고리 월별 추이(지출 TOP3 쌓은 막대) ──
  const catTrendTop3 = [...periodBreakdown]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 3);
  const catTrendData = monthlyBuckets.map((b, i) => {
    const parts = catTrendTop3.map(
      (c) =>
        (b.categoryExpenses ?? []).find(
          (ce) => ce.categoryRowId === c.categoryRowId,
        )?.amount ?? 0,
    );
    const label = isEn()
      ? [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ][b.month - 1]
      : String(b.month).padStart(2, "0");
    return {
      label: label ?? String(b.month),
      parts,
      sum: parts.reduce((s, v) => s + v, 0),
      isCur: i === monthlyBuckets.length - 1,
    };
  });
  const catTrendMax = Math.max(1, ...catTrendData.map((d) => d.sum));
  // 여러 달 + TOP3 지출 데이터가 있을 때만 노출(단일 월은 카테고리 탭 도넛이 담당).
  const showCatTrend =
    monthlyBuckets.length >= 2 && catTrendTop3.length > 0 && catTrendMax > 1;

  // ── 비교 ──
  const compareMap = new Map<number | null, CompareRow>();
  const addBreakdown = (source: "now" | "prev", list: CategoryBreakdown[]) => {
    for (const c of list) {
      if (c.expenseType !== "EXPENSE") continue;
      // 미분류(카테고리 없음)도 한 줄로 세운다 — 빼면 합이 총액과 안 맞는다.
      const groupRowId = c.parentCategoryRowId ?? c.categoryRowId;
      const groupName =
        c.parentCategoryName ?? c.categoryName ?? t("uncategorized");
      let row = compareMap.get(groupRowId);
      if (!row) {
        const cat =
          groupRowId != null ? categoryById.get(groupRowId) : undefined;
        row = {
          groupRowId,
          name: groupName,
          icon: cat?.icon ?? null,
          color: cat?.color ?? null,
          now: 0,
          prev: 0,
        };
        compareMap.set(groupRowId, row);
      }
      row[source] += c.totalAmount;
    }
  };
  addBreakdown("now", rangeQ.data?.categoryBreakdown ?? []);
  addBreakdown("prev", prevRangeQ.data?.categoryBreakdown ?? []);
  const compareRows = Array.from(compareMap.values())
    .sort((a, b) => b.now - a.now || b.prev - a.prev)
    .slice(0, 10);
  const totalNow = totalExpense;
  const totalPrev = prevTotalExpense;
  const {
    now: periodNow,
    prev: periodPrev,
    nowInline: periodNowInline,
    prevInline: periodPrevInline,
  } = relativeNames(period, new Date(), (k) => t(k));
  const noPrevText = t("period.noPrev", { prev: periodPrevInline });
  const momText = t("period.vs", { prev: periodPrevInline });
  const cmpDiff = totalNow - totalPrev;
  const cmpPct =
    totalPrev > 0
      ? formatChangeRate((cmpDiff / totalPrev) * 100, { sign: "none" })
      : null;
  const prevDays =
    Math.round(
      (startOfDay(prevR.to).getTime() - startOfDay(prevR.from).getTime()) /
        dayMs,
    ) + 1;
  // 하루 평균 분모 — 이번 기간은 '오늘까지 경과 일수', 이전 기간은 전체 일수. 진행 중인 기간이 미래 종료일까지 계산돼 분모가 과대해지는 것 방지.
  const cmpToday = startOfDay(new Date());
  const cmpNowEnd =
    startOfDay(period.to).getTime() > cmpToday.getTime()
      ? cmpToday
      : startOfDay(period.to);
  const cmpNowDays = Math.max(
    1,
    Math.round(
      (cmpNowEnd.getTime() - startOfDay(period.from).getTime()) / dayMs,
    ) + 1,
  );
  // 건수도 합계와 같은 거래만 센다 — 환불된 것 · 카드 이월 · 아직 안 온 것은 뺀다
  const nowTxCount = countableTx(monthExpensesQ.data ?? []).filter(
    (e) => e.expenseType === "EXPENSE",
  ).length;
  const prevTxCount = countableTx(prevMonthExpensesQ.data ?? []).filter(
    (e) => e.expenseType === "EXPENSE",
  ).length;
  const cmpMetrics = [
    {
      key: "daily",
      label: t("compare.metricDailyAvg"),
      now: Math.round(totalNow / cmpNowDays),
      prev: Math.round(totalPrev / Math.max(1, prevDays)),
      count: false,
    },
    {
      key: "count",
      label: t("compare.metricTxCount"),
      now: nowTxCount,
      prev: prevTxCount,
      count: true,
    },
    {
      key: "perTx",
      label: t("compare.metricPerTx"),
      now: nowTxCount > 0 ? Math.round(totalNow / nowTxCount) : 0,
      prev: prevTxCount > 0 ? Math.round(totalPrev / prevTxCount) : 0,
      count: false,
    },
  ];
  // 카테고리별 증감 — compareRows(상위 10, now desc)를 증감액 절대값 큰 순으로 재정렬.
  const deltaRows = compareRows
    .map((r) => ({
      ...r,
      diff: r.now - r.prev,
      pct: r.prev > 0 ? ((r.now - r.prev) / r.prev) * 100 : 0,
    }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const maxDelta = Math.max(1, ...deltaRows.map((r) => Math.abs(r.diff)));

  // 요일별 지출 비교 — 이번 기간 vs 이전 기간, 월요일 시작. 합계와 같은 거래만.
  const wkNow = new Array<number>(7).fill(0);
  const wkPrev = new Array<number>(7).fill(0);
  const addWeekday = (
    arr: number[],
    list: ReadonlyArray<{
      expenseType: string;
      amount: number;
      expenseDate?: string | null;
    }>,
  ) => {
    for (const e of list) {
      if (e.expenseType !== "EXPENSE") continue;
      const ds = (e.expenseDate ?? "").slice(0, 10);
      if (!ds) continue;
      const idx = (new Date(`${ds}T00:00:00`).getDay() + 6) % 7;
      arr[idx] = (arr[idx] ?? 0) + e.amount;
    }
  };
  addWeekday(wkNow, countableTx(monthExpensesQ.data ?? []));
  addWeekday(wkPrev, countableTx(prevMonthExpensesQ.data ?? []));
  let wkIdx = -1;
  let wkDeltaValue = 0;
  for (let i = 0; i < 7; i++) {
    const d = (wkNow[i] ?? 0) - (wkPrev[i] ?? 0);
    if (Math.abs(d) > Math.abs(wkDeltaValue)) {
      wkDeltaValue = d;
      wkIdx = i;
    }
  }

  return {
    // 상태
    tab,
    setTab,
    period,
    setPeriod,
    activeParentId,
    setActiveParentId,
    fixedView,
    setFixedView,
    manageOpen,
    setManageOpen,
    pickerOpen,
    setPickerOpen,
    startDate,
    endDate,
    periodLbl,
    labels,
    // 질의
    rangeQ,
    prevRangeQ,
    categoriesQ,
    merchantQ,
    monthExpensesQ,
    prevMonthExpensesQ,
    heatmapQ,
    categoryById,
    // 도넛
    donutView,
    donutTotal,
    donutTotalLabel,
    isDrilled,
    activeParent,
    totalExpense,
    // 가맹점
    topMerchants,
    maxMerchantAmt,
    // 열지도
    heatmapMatrix,
    heatmapTotal,
    // 요약
    categoryTop,
    topMerchant,
    topMerchantCat,
    rangeDays,
    avgLabel,
    avgValue,
    prevTotalExpense,
    dayPct,
    dayRate,
    // 추이
    trendChartData,
    trendFailed,
    retryTrend,
    useDailyTrend,
    avgIn,
    avgOut,
    avgSave,
    saveRate,
    spendRate,
    statLabelIn,
    statLabelOut,
    statLabelSave,
    catTrendTop3,
    catTrendData,
    showCatTrend,
    // 비교
    totalNow,
    totalPrev,
    periodNow,
    periodPrev,
    periodNowInline,
    periodPrevInline,
    noPrevText,
    momText,
    cmpDiff,
    cmpPct,
    cmpMetrics,
    deltaRows,
    maxDelta,
    wkNow,
    wkPrev,
    wkDelta: { idx: wkIdx, delta: wkDeltaValue },
  };
}

export type StatsModel = ReturnType<typeof useStatsModel>;

function matrixAdd(m: number[][], r: number, c: number, v: number) {
  const row = m[r];
  if (row) row[c] = (row[c] ?? 0) + v;
}

export type TrendDatum = {
  month: string;
  income: number;
  expense: number;
  savings: number;
};

function buildTrendData({
  useDailyTrend,
  period,
  expenses,
  monthlyBuckets,
}: {
  useDailyTrend: boolean;
  period: RangeState;
  expenses: Parameters<typeof countableTx>[0];
  monthlyBuckets: {
    year: number;
    month: number;
    totalIncome: number;
    totalExpense: number;
  }[];
}): TrendDatum[] {
  if (useDailyTrend) {
    const fromDay = startOfDay(period.from);
    const toDay = startOfDay(period.to);
    const days = Math.round((toDay.getTime() - fromDay.getTime()) / dayMs) + 1;
    const byDay = new Map<
      string,
      { income: number; expense: number; label: string }
    >();
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDay);
      d.setDate(d.getDate() + i);
      byDay.set(fmt(d), {
        income: 0,
        expense: 0,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      });
    }
    // 서버 집계와 같은 규칙 — 환불된 것 · 아직 안 온 것 · 카드 이월은 세지 않는다(`countableTx` 한 곳)
    for (const e of countableTx(expenses)) {
      const bucket = byDay.get(e.expenseDate.slice(0, 10));
      if (!bucket) continue;
      if (e.expenseType === "INCOME") bucket.income += e.amount;
      else bucket.expense += e.amount;
    }
    return Array.from(byDay.values()).map((v) => ({
      month: v.label,
      income: v.income,
      expense: v.expense,
      savings: v.income - v.expense,
    }));
  }
  // 모든 버킷이 같은 해면 'MM' 만 (년 prefix 생략)
  const allSameYear =
    monthlyBuckets.length > 0 &&
    monthlyBuckets.every((b) => b.year === monthlyBuckets[0]!.year);
  return monthlyBuckets.map((b) => ({
    month: allSameYear
      ? String(b.month).padStart(2, "0")
      : `${b.year}.${String(b.month).padStart(2, "0")}`,
    income: b.totalIncome,
    expense: b.totalExpense,
    savings: b.totalIncome - b.totalExpense,
  }));
}
