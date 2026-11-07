import { measureTickWidth, niceTickLabels } from "@/shared/lib/groo/axisWidth";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Rectangle,
  XAxis,
  YAxis,
  type RectangleProps,
} from "recharts";
import {
  Chart,
  ChartDataTable,
  ChartLegendTiles,
  ChartTooltip,
  ChartTooltipContent,
  assignChartColors,
  chartAxisProps,
  chartGridProps,
  chartVar,
  formatAxisWon,
} from "@/shared/ds/chart";
import { Skeleton, SkeletonGroup } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { chartColorOf } from "@/shared/lib/groo/chart-palette";
import { niceAxis, niceCeil } from "@/shared/lib/groo/chartAxis";
import { MINUS, formatPercent } from "@/shared/lib/groo/format";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import {
  BandEmpty,
  BandFailure,
  BandHead,
  HeadNote,
} from "@/shared/ui/groo/band-parts";
import {
  Body,
  HeadlessBody,
  PeriodButton,
  type Placement,
} from "./stats-parts";
import type { StatsModel } from "./stats-model";

/*
 * 통계 · 추이 탭 구역(I-08 36) — 수입 · 지출 추이(ds 선 이중 축 + 지표 타일) · 저축률(고리 게이지는 화면 그림) · 월별 순저축(ds 막대, 음수 포함) ·
 * 주요 카테고리 월별 추이(ds 쌓은 막대). 차트마다 이름(role="img") + 표로 보기(42).
 */

const chartHeight = (place: Placement, band: number, card: number) =>
  place === "band" ? band : card;

function ChartSkeleton({ height }: { height: number }) {
  return (
    <SkeletonGroup>
      <Skeleton className="w-full" radius="16" style={{ height }} />
    </SkeletonGroup>
  );
}

function Fail({
  place,
  title,
  onRetry,
}: {
  place: Placement;
  title: string;
  onRetry: () => void;
}) {
  return (
    <Body place={place}>
      <BandFailure title={title} onRetry={onRetry} />
    </Body>
  );
}

// ── 수입 · 지출 추이 ────────────────────────────────────────────
export function TrendSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const { t: te } = useTranslation("expense");
  const mask = useMasked("stats.trend");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const head = (
    <BandHead
      title={t("trend.title")}
      band={place === "band"}
      aside={<PeriodButton m={m} />}
    />
  );
  const height = chartHeight(place, 200, 260);
  if (m.trendFailed) {
    return (
      <>
        {head}
        <Fail
          place={place}
          title={t("loadFailed.trend")}
          onRetry={() => m.retryTrend()}
        />
      </>
    );
  }
  if (m.rangeQ.isLoading) {
    return (
      <>
        {head}
        <Body place={place}>
          <ChartSkeleton height={height} />
        </Body>
      </>
    );
  }
  const data = m.trendChartData;
  if (data.length === 0) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandEmpty>{t("empty.trend")}</BandEmpty>
        </Body>
      </>
    );
  }
  const sumIn = data.reduce((s, d) => s + d.income, 0);
  const sumOut = data.reduce((s, d) => s + d.expense, 0);
  const dual = !hidden.has("income") && !hidden.has("expense");
  const incomeAxis = niceCeil(Math.max(0, ...data.map((d) => d.income)));
  const expenseAxis = niceCeil(Math.max(0, ...data.map((d) => d.expense)));
  const singleAxis = niceCeil(
    Math.max(
      0,
      ...data.map((d) =>
        Math.max(
          hidden.has("income") ? 0 : d.income,
          hidden.has("expense") ? 0 : d.expense,
        ),
      ),
    ),
  );
  const legendId = `stats-trend-legend-${place}`;
  const name = t("chart.trendName", {
    period: m.periodLbl,
    income: mask(won(sumIn)),
    expense: mask(won(sumOut)),
  });
  const incomeScale = dual ? incomeAxis : singleAxis;
  return (
    <>
      {head}
      <Body place={place}>
        <ChartLegendTiles
          id={legendId}
          items={[
            {
              key: "income",
              label: te("income"),
              color: "blue",
              total: mask(won(sumIn)),
            },
            {
              key: "expense",
              label: te("expense"),
              color: "red",
              total: mask(won(sumOut)),
            },
          ]}
          hidden={hidden}
          onHiddenChange={setHidden}
        />
        <Chart label={name} legendId={legendId} height={height}>
          <AreaChart data={data}>
            <CartesianGrid {...chartGridProps} yAxisId="income" />
            <XAxis
              dataKey="month"
              interval="preserveStartEnd"
              minTickGap={16}
              {...chartAxisProps()}
            />
            <YAxis
              yAxisId="income"
              domain={[0, incomeScale.max]}
              ticks={incomeScale.ticks}
              tickFormatter={(v) => mask(formatAxisWon(Number(v)))}
              width={measureTickWidth(
                incomeScale.ticks.map((v) => mask(formatAxisWon(v))),
              )}
              {...chartAxisProps(dual ? { color: "blue" } : {})}
            />
            {dual && (
              <YAxis
                yAxisId="expense"
                orientation="right"
                domain={[0, expenseAxis.max]}
                ticks={expenseAxis.ticks}
                tickFormatter={(v) => mask(formatAxisWon(Number(v)))}
                width={measureTickWidth(
                  expenseAxis.ticks.map((v) => mask(formatAxisWon(v))),
                )}
                {...chartAxisProps({ color: "red" })}
              />
            )}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(v) => mask(won(Number(v)))}
                />
              }
            />
            {!hidden.has("income") && (
              <Area
                yAxisId="income"
                dataKey="income"
                name={te("income")}
                stroke={chartVar("blue")}
              />
            )}
            {!hidden.has("expense") && (
              <Area
                yAxisId={dual ? "expense" : "income"}
                dataKey="expense"
                name={te("expense")}
                stroke={chartVar("red")}
              />
            )}
          </AreaChart>
        </Chart>
        <ChartDataTable
          caption={name}
          columns={[
            m.useDailyTrend ? t("chart.tableDate") : t("chart.tableMonth"),
            te("income"),
            te("expense"),
          ]}
          rows={data.map((d) => [
            d.month,
            mask(won(d.income)),
            mask(won(d.expense)),
          ])}
        />
      </Body>
    </>
  );
}

// ── 저축률 ──────────────────────────────────────────────────────
const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R;

/**
 * 저축률 — 머리 없는 구역. 고리 게이지 108(rem 6.75 — 글자 크기를 따라 커진다, 200% 에서 216)은 화면 그림(스펙 부품 없음)이라 모양 그대로, 글은 역할 이름(눈금 t2 · 값 t9 · 문장 t5).
 * 지출 · 저축 비율 막대는 장식 막대(8 · 끝 둥글게 · 값은 글이 말한다).
 */
export function SavingsRateSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.trend");
  if (m.rangeQ.isError && !m.rangeQ.data) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <HeadlessBody place={place}>
        <BandFailure
          title={t("loadFailed.trend")}
          onRetry={() => void m.rangeQ.refetch()}
        />
      </HeadlessBody>
    );
  }
  if (m.rangeQ.isLoading) {
    return (
      <HeadlessBody place={place}>
        <SkeletonGroup className="flex items-center gap-x4">
          <Skeleton radius="full" className="size-[6.75rem] shrink-0" />
          <div className="flex-1">
            <Skeleton text="t5" className="w-2/3" />
            <Skeleton className="mt-x3 h-2 w-full" radius="full" />
          </div>
        </SkeletonGroup>
      </HeadlessBody>
    );
  }
  const insight = t("trend.savingsInsight", {
    pct: formatPercent(m.saveRate, "progress"),
  });
  const rows = [
    {
      key: "in",
      name: m.statLabelIn,
      value: mask(won(Math.round(m.avgIn))),
      dot: "bg-fg-neutral-subtle",
    },
    {
      key: "out",
      name: `${m.statLabelOut} ${formatPercent(m.spendRate, "progress")}`,
      value: mask(won(Math.round(m.avgOut))),
      dot: "bg-fg-critical",
    },
    {
      key: "save",
      name: `${m.statLabelSave} ${formatPercent(m.saveRate, "progress")}`,
      value: mask(won(Math.round(m.avgSave))),
      dot: "bg-fg-brand",
    },
  ];
  return (
    <HeadlessBody place={place}>
      <div
        className={cn(
          "flex gap-x5",
          place === "band" ? "flex-col" : "flex-row items-center gap-x8",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-x4",
            // 폰: 문장 칸이 8em 보다 좁아지면(글자 크기 200%) 문장이 고리 아래로 내려간다 — 낱말 가운데서 꺾이지 않게(v114 단어 단위)
            place === "band" ? "flex-wrap gap-y-x3" : "shrink-0",
          )}
        >
          <div
            data-slot="stats-savings-ring"
            className="relative size-[6.75rem] shrink-0"
          >
            <svg viewBox="0 0 108 108" className="size-full" aria-hidden>
              <circle
                cx="54"
                cy="54"
                r={RING_R}
                fill="none"
                stroke="var(--color-bg-neutral-weak)"
                strokeWidth="10"
              />
              <circle
                cx="54"
                cy="54"
                r={RING_R}
                fill="none"
                stroke="var(--color-fg-brand)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(RING_C * m.saveRate) / 100} ${RING_C}`}
                transform="rotate(-90 54 54)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-t2 font-medium text-fg-neutral-subtle">
                {t("trend.savingsRate")}
              </span>
              <span className="text-t9 font-bold tabular-nums text-fg-neutral">
                {formatPercent(m.saveRate, "progress")}
              </span>
            </div>
          </div>
          {place === "band" && (
            <p
              data-slot="stats-savings-insight"
              className="m-0 min-w-[8em] flex-1 basis-[8em] text-t5 font-bold text-fg-neutral"
            >
              {insight}
            </p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {place === "card" && (
            <p className="m-0 mb-x3 text-t5 font-bold text-fg-neutral">
              {insight}
            </p>
          )}
          {/* 장식 막대 — 값은 아래 글이 말한다 */}
          <div
            aria-hidden
            className="flex h-2 gap-x0_5 overflow-hidden rounded-full"
          >
            <div
              className="rounded-full bg-fg-critical"
              style={{ width: `${m.spendRate}%` }}
            />
            <div
              className="rounded-full bg-fg-brand"
              style={{ width: `${m.saveRate}%` }}
            />
          </div>
          <ul className="m-0 mt-x3 flex list-none flex-col gap-x2 p-0">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex flex-wrap items-baseline justify-between gap-x-x3 text-t5"
              >
                <span className="inline-flex min-w-0 items-center gap-x2 text-fg-neutral">
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", r.dot)}
                  />
                  {r.name}
                </span>
                <span className="shrink-0 text-end font-bold tabular-nums text-fg-neutral">
                  {r.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </HeadlessBody>
  );
}

// ── 월별(일별) 순저축 ────────────────────────────────────────────
type SavingsBarProps = RectangleProps & { value?: number | [number, number] };
function SavingsShape(props: SavingsBarProps) {
  const v = Array.isArray(props.value) ? props.value[1] : props.value;
  // 음수 막대는 아래 두 모서리로 — 0 선에 붙은 쪽이 각진다
  return (
    <Rectangle {...props} radius={(v ?? 0) < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0]} />
  );
}

export function SavingsBarsSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.trend");
  const title = m.useDailyTrend
    ? t("trend.dailySavings")
    : t("trend.monthlySavings");
  const head = (
    <BandHead
      title={title}
      band={place === "band"}
      aside={<HeadNote>{t("trend.savingsFormula")}</HeadNote>}
    />
  );
  const height = chartHeight(place, 180, 220);
  if (m.trendFailed) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <>
        {head}
        <Fail
          place={place}
          title={t("loadFailed.trend")}
          onRetry={() => m.retryTrend()}
        />
      </>
    );
  }
  if (m.rangeQ.isLoading) {
    return (
      <>
        {head}
        <Body place={place}>
          <ChartSkeleton height={height} />
        </Body>
      </>
    );
  }
  const data = m.trendChartData;
  if (data.length === 0) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandEmpty>{t("empty.monthlyData")}</BandEmpty>
        </Body>
      </>
    );
  }
  const axis = niceAxis(
    Math.min(0, ...data.map((d) => d.savings)),
    Math.max(0, ...data.map((d) => d.savings)),
  );
  const signed = (v: number) =>
    (v > 0 ? "+" : v < 0 ? MINUS : "") + won(Math.abs(v)).replace(MINUS, "");
  const name = t("chart.savingsName", { period: m.periodLbl, unit: title });
  return (
    <>
      {head}
      <Body place={place}>
        <Chart label={name} height={height}>
          <BarChart data={data}>
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="month"
              interval="preserveStartEnd"
              minTickGap={16}
              {...chartAxisProps()}
            />
            <YAxis
              domain={[axis.min, axis.max]}
              ticks={axis.ticks}
              tickFormatter={(v) => mask(formatAxisWon(Number(v)))}
              width={measureTickWidth(
                axis.ticks.map((v) => mask(formatAxisWon(v))),
              )}
              {...chartAxisProps()}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(v) => mask(signed(Number(v)))}
                />
              }
            />
            <Bar
              dataKey="savings"
              name={t("trend.savings")}
              shape={(p: unknown) => (
                <SavingsShape {...(p as SavingsBarProps)} />
              )}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={chartVar(d.savings < 0 ? "red" : "blue")} />
              ))}
            </Bar>
          </BarChart>
        </Chart>
        <ChartDataTable
          caption={name}
          columns={[
            m.useDailyTrend ? t("chart.tableDate") : t("chart.tableMonth"),
            t("trend.savings"),
          ]}
          rows={data.map((d) => [d.month, mask(signed(d.savings))])}
        />
      </Body>
    </>
  );
}

// ── 주요 카테고리 월별 추이 ──────────────────────────────────────
export function CatTrendSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.trend");
  const head = (
    <BandHead
      title={t("trend.catTrendTitle")}
      band={place === "band"}
      aside={<HeadNote>{t("trend.catTrendTop3")}</HeadNote>}
    />
  );
  if (m.rangeQ.isError && !m.rangeQ.data) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <>
        {head}
        <Fail
          place={place}
          title={t("loadFailed.trend")}
          onRetry={() => void m.rangeQ.refetch()}
        />
      </>
    );
  }
  if (m.rangeQ.isLoading) {
    return (
      <>
        {head}
        <Body place={place}>
          <ChartSkeleton height={chartHeight(place, 150, 180)} />
        </Body>
      </>
    );
  }
  const tops = m.catTrendTop3.map((c) => ({
    id: String(c.categoryRowId ?? "none"),
    name: c.categoryName ?? t("uncategorized"),
    saved:
      c.categoryRowId != null
        ? chartColorOf(m.categoryById.get(c.categoryRowId)?.color)
        : null,
  }));
  const colored = assignChartColors(tops, { colorOf: (s) => s.saved });
  const rows = m.catTrendData.map((d) => {
    const row: Record<string, number | string> = { label: d.label };
    colored.forEach((_, i) => {
      row[`c${i}`] = d.parts[i] ?? 0;
    });
    return row;
  });
  const name = t("chart.catTrendName", { period: m.periodLbl });
  return (
    <>
      {head}
      <Body place={place}>
        <ul
          aria-label={t("trend.catTrendTop3")}
          className="m-0 mb-x2 flex list-none flex-wrap gap-x3 p-0 text-t3 text-fg-neutral-subtle"
        >
          {colored.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-x1_5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: c.fill }}
              />
              {c.name}
            </li>
          ))}
        </ul>
        <Chart label={name} height={chartHeight(place, 180, 220)}>
          <BarChart data={rows}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="label" {...chartAxisProps()} />
            <YAxis
              tickFormatter={(v) => mask(formatAxisWon(Number(v)))}
              width={measureTickWidth(
                niceTickLabels(
                  rows.map((r) =>
                    colored.reduce(
                      (sum, _, i) => sum + Number(r[`c${i}`] ?? 0),
                      0,
                    ),
                  ),
                  (v) => mask(formatAxisWon(v)),
                ),
              )}
              {...chartAxisProps()}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(v) => mask(won(Number(v)))}
                />
              }
            />
            {colored.map((c, i) => (
              <Bar
                key={c.id}
                dataKey={`c${i}`}
                name={c.name}
                stackId="cat"
                fill={c.fill}
                radius={i === colored.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </Chart>
        <ChartDataTable
          caption={name}
          columns={[t("chart.tableMonth"), ...colored.map((c) => c.name)]}
          rows={m.catTrendData.map((d) => [
            d.label,
            ...colored.map((_, i) => mask(won(d.parts[i] ?? 0))),
          ])}
        />
      </Body>
    </>
  );
}
