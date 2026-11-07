import { measureTickWidth } from "@/shared/lib/groo/axisWidth";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Pin } from "lucide-react";
import { Button } from "@/shared/ds/button";
import {
  Chart,
  ChartDataTable,
  ChartLegendTiles,
  ChartTooltip,
  ChartTooltipContent,
  chartAxisProps,
  chartGridProps,
  chartVar,
  formatAxisWon,
} from "@/shared/ds/chart";
import { List, ListItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { cn } from "@/shared/lib/cn";
import { formatMonthTicks } from "@/shared/lib/date";
import { niceCeil } from "@/shared/lib/groo/chartAxis";
import { formatPercent } from "@/shared/lib/groo/format";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import {
  BandEmpty,
  BandFailure,
  BandHead,
  Desc,
} from "@/shared/ui/groo/band-parts";
import {
  fixedShareTexts,
  splitFixed,
  type FixedSplit,
} from "@/entities/expense";
import type {
  CategoryBreakdown,
  ExpenseCategory,
  MonthlyTrend,
} from "@/entities/expense";
import { useMonthlyTrend } from "@/features/expense";
import { Body, PeriodButton, type Placement } from "./stats-parts";
import type { StatsModel } from "./stats-model";

/*
 * 통계 · 고정/변동 탭 구역(I-08 38) — 한 기간의 수입 · 지출을 고정과 변동(고정 제외)으로 나눠 보여 준다.
 * 서버가 내리는 건 전체와 그 가운데 고정인 몫뿐이다. 변동은 `전체 − 고정` 으로 이 화면이 구한다(`splitFixed`).
 * 두 계열의 색은 차트 배정 차례 첫 두 색 — 고정 파랑 · 변동 초록(Q1-A1, 지출 · 수입 탭 같은 색). 색만으로 가르지 않게 막대 옆에 늘 이름과 숫자가 붙는다.
 */

type Kind = "expense" | "income";

const FIXED_COLOR = chartVar("blue");
const VARIABLE_COLOR = chartVar("green");
const swatchColor = (fixed: boolean) => (fixed ? FIXED_COLOR : VARIABLE_COLOR);

/** 고정(파랑) / 변동(초록) 견본 */
function Swatch({ fixed }: { fixed: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-[2px]"
      style={{ background: swatchColor(fixed) }}
    />
  );
}

/** 한 줄 비율 막대 — 왼쪽이 고정, 오른쪽이 변동. 폭은 전체에 대한 비율이다. 전체가 0 이면 빈 트랙만 그린다 */
function RatioBar({
  split,
  ariaLabel,
}: {
  split: FixedSplit;
  ariaLabel: string;
}) {
  const fixedPct = split.total === 0 ? 0 : (split.fixed / split.total) * 100;
  const shares = fixedShareTexts(split);
  const cell =
    "flex h-full items-center justify-center overflow-hidden whitespace-nowrap text-t2 font-bold text-fg-neutral-inverted";
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex h-7 overflow-hidden rounded-r2 bg-bg-neutral-weak"
    >
      {split.fixed > 0 && (
        <div
          className={cell}
          style={{ width: `${fixedPct}%`, background: FIXED_COLOR }}
        >
          {fixedPct >= 14 ? shares.fixed : ""}
        </div>
      )}
      {split.variable > 0 && (
        <div
          className={cn(cell, "flex-1")}
          style={{ background: VARIABLE_COLOR }}
        >
          {100 - fixedPct >= 14 ? shares.variable : ""}
        </div>
      )}
    </div>
  );
}

function Failure({
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

// ── 지출 · 수입 개요 ─────────────────────────────────────────────
export function FixedOverviewSection({
  m,
  kind,
  place,
}: {
  m: StatsModel;
  kind: Kind;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.fixed");
  const head = (
    <BandHead
      title={t(`fixed.${kind}.title`)}
      band={place === "band"}
      aside={kind === "expense" ? <PeriodButton m={m} /> : undefined}
    />
  );
  if (m.rangeQ.isError && !m.rangeQ.data) {
    if (place === "band" && kind !== "expense") return null;
    return (
      <>
        {head}
        <Failure
          place={place}
          title={t("loadFailed.fixed")}
          onRetry={() => void m.rangeQ.refetch()}
        />
      </>
    );
  }
  const summary = m.rangeQ.data;
  if (m.rangeQ.isLoading || !summary) {
    return (
      <>
        {head}
        <Body place={place}>
          <div aria-hidden>
            <Skeleton className="h-7 w-full" radius="8" />
            <Skeleton text="t5" className="mt-x4 w-1/2" />
            <Skeleton text="t5" className="mt-x2 w-2/3" />
          </div>
        </Body>
      </>
    );
  }
  const split =
    kind === "expense"
      ? splitFixed(summary.totalExpense, summary.fixedExpense)
      : splitFixed(summary.totalIncome, summary.fixedIncome);
  if (split.total === 0) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandEmpty>{t(`fixed.${kind}.none`)}</BandEmpty>
        </Body>
      </>
    );
  }
  const shares = fixedShareTexts(split);
  const noFixed = split.fixed === 0;
  const figures = [
    {
      key: "total",
      label: t(`fixed.total.${kind}`),
      value: split.total,
      swatch: null,
      sub: null,
    },
    {
      key: "fixed",
      label: t(`fixed.fixed.${kind}`),
      value: split.fixed,
      swatch: true,
      sub: shares.fixed,
    },
    {
      key: "variable",
      label: t(`fixed.variable.${kind}`),
      value: split.variable,
      swatch: false,
      sub: shares.variable,
    },
  ];
  const label = (f: (typeof figures)[number]) => (
    <span className="inline-flex flex-wrap items-center gap-x1_5">
      {f.swatch != null && <Swatch fixed={f.swatch} />}
      <span>{f.label}</span>
      {f.sub && <span className="text-fg-neutral-subtle">{f.sub}</span>}
    </span>
  );
  return (
    <>
      {head}
      <Body place={place} className={place === "band" ? "px-0" : undefined}>
        <div className={place === "band" ? "px-x6" : undefined}>
          <RatioBar
            split={split}
            ariaLabel={t("fixed.bar.aria", {
              kind: t(`fixed.total.${kind}`),
              fixed: shares.fixed,
              variable: shares.variable,
            })}
          />
        </div>
        {place === "band" ? (
          // 폰은 한 줄에 하나 — 이름 · 값 키-값 줄
          <List className="mt-x3">
            {figures.map((f) => (
              <ListItem
                key={f.key}
                title={label(f)}
                suffix={
                  <span className="text-end font-bold tabular-nums text-fg-neutral">
                    {withCommaBreaks(mask(won(f.value)))}
                  </span>
                }
              />
            ))}
          </List>
        ) : (
          <dl className="m-0 mt-x4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-x4">
            {figures.map((f) => (
              <div key={f.key} className="min-w-0">
                <dt className="text-t3 font-medium text-fg-neutral-subtle">
                  {label(f)}
                </dt>
                <dd className="m-0 mt-x0_5 text-t5 font-bold tabular-nums text-fg-neutral">
                  {withCommaBreaks(mask(won(f.value)))}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className={cn("mt-x3", place === "band" && "px-x6")}>
          {noFixed ? (
            <>
              <Desc>{t("fixed.empty.desc")}</Desc>
              <Button
                type="button"
                variant="neutralOutline"
                size="small"
                className="mt-x3"
                onClick={() => m.setManageOpen(true)}
              >
                {t("fixed.manage")}
              </Button>
            </>
          ) : (
            <Desc>
              {t(`fixed.insight.${kind}`, {
                pct: shares.fixed,
                // "0.1% 미만이" / "33.2%가" — 값 끝 글자에 따라(0.05% 미만이면 글이 "미만" 으로 끝난다)
                josa:
                  split.fixedPercent > 0 && split.fixedPercent < 0.05
                    ? "이"
                    : "가",
              })}{" "}
              <strong className="font-bold text-fg-neutral">
                {mask(won(split.variable))}
              </strong>
              {t("fixed.insight.tail")}
            </Desc>
          )}
        </div>
      </Body>
    </>
  );
}

// ── 월별 고정 · 변동 추이 ────────────────────────────────────────
interface MonthRow {
  label: string;
  fixed: number;
  variable: number;
}

function toRows(
  src: { year: number; month: number; total: number; fixed?: number }[],
): MonthRow[] {
  const labels = formatMonthTicks(src);
  return src.map((r, i) => {
    const s = splitFixed(r.total, r.fixed);
    return { label: labels[i]!, fixed: s.fixed, variable: s.variable };
  });
}

export function FixedTrendSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.fixed");
  const [kind, setKind] = useState<Kind>("expense");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // 한 달만 고른 기간이면 막대가 하나뿐이라 의미가 없다 — 그때는 최근 6개월을 보여 준다
  const trendQ = useMonthlyTrend(6);
  const head = (
    <BandHead
      title={t("fixed.trend.title")}
      band={place === "band"}
      aside={
        // 자리 폭 = (가장 긴 칸 글 + 좌우 24) × 칸 수 + 8(칸 글은 글자 배율을 따르지 않는다). 제목이 머리 폭 50% 를 지키고, 넘치면 머리 아래 오른쪽 끝으로 내려간다
        <div className="w-max max-w-full">
          <SegmentedControl
            aria-label={t("fixed.trend.kindAria")}
            value={kind}
            onValueChange={(v) => setKind(v as Kind)}
          >
            <SegmentedControlItem value="expense">
              {t("fixed.kind.expense")}
            </SegmentedControlItem>
            <SegmentedControlItem value="income">
              {t("fixed.kind.income")}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      }
    />
  );
  const height = place === "band" ? 200 : 260;
  if (m.rangeQ.isError && !m.rangeQ.data) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <>
        {head}
        <Failure
          place={place}
          title={t("loadFailed.fixed")}
          onRetry={() => void m.rangeQ.refetch()}
        />
      </>
    );
  }
  const summary = m.rangeQ.data;
  const buckets = summary?.monthlyBuckets ?? [];
  const useRange = buckets.length >= 2;
  if (!useRange && trendQ.isError && !trendQ.data) {
    return (
      <>
        {head}
        <Failure
          place={place}
          title={t("loadFailed.fixed")}
          onRetry={() => void trendQ.refetch()}
        />
      </>
    );
  }
  if (m.rangeQ.isLoading || !summary || (!useRange && trendQ.isLoading)) {
    return (
      <>
        {head}
        <Body place={place}>
          <Skeleton
            aria-hidden
            className="w-full"
            radius="16"
            style={{ height }}
          />
        </Body>
      </>
    );
  }
  const trend: MonthlyTrend[] = trendQ.data ?? [];
  const rows = useRange
    ? toRows(
        buckets.map((b) => ({
          year: b.year,
          month: b.month,
          total: kind === "expense" ? b.totalExpense : b.totalIncome,
          fixed: kind === "expense" ? b.fixedExpense : b.fixedIncome,
        })),
      )
    : toRows(
        trend.map((x) => ({
          year: x.year,
          month: x.month,
          total: kind === "expense" ? x.totalExpense : x.totalIncome,
          fixed: kind === "expense" ? x.fixedExpense : x.fixedIncome,
        })),
      );
  if (!rows.some((r) => r.fixed + r.variable > 0)) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandEmpty>{t("empty.trend")}</BandEmpty>
        </Body>
      </>
    );
  }
  const axis = niceCeil(
    Math.max(
      0,
      ...rows.map(
        (r) =>
          (hidden.has("fixed") ? 0 : r.fixed) +
          (hidden.has("variable") ? 0 : r.variable),
      ),
    ),
  );
  const sumFixed = rows.reduce((s, r) => s + r.fixed, 0);
  const sumVariable = rows.reduce((s, r) => s + r.variable, 0);
  const name = t("chart.fixedName", { kind: t(`fixed.kind.${kind}`) });
  const legendId = `stats-fixed-legend-${place}`;
  const showFixed = !hidden.has("fixed");
  const showVariable = !hidden.has("variable");
  return (
    <>
      {head}
      <Body place={place}>
        {!useRange && <Desc className="mb-x2">{t("fixed.trend.recent")}</Desc>}
        <ChartLegendTiles
          id={legendId}
          items={[
            {
              key: "fixed",
              label: t("fixed.legend.fixed"),
              color: "blue",
              total: mask(won(sumFixed)),
            },
            {
              key: "variable",
              label: t("fixed.legend.variable"),
              color: "green",
              total: mask(won(sumVariable)),
            },
          ]}
          hidden={hidden}
          onHiddenChange={setHidden}
        />
        <Chart label={name} legendId={legendId} height={height}>
          <BarChart data={rows}>
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="label"
              interval="preserveStartEnd"
              {...chartAxisProps()}
            />
            <YAxis
              domain={[0, axis.max]}
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
                  valueFormatter={(v) => mask(won(Number(v)))}
                />
              }
            />
            {showFixed && (
              <Bar
                dataKey="fixed"
                name={t("fixed.legend.fixed")}
                stackId="a"
                fill={FIXED_COLOR}
                radius={showVariable ? 0 : [4, 4, 0, 0]}
              />
            )}
            {showVariable && (
              <Bar
                dataKey="variable"
                name={t("fixed.legend.variable")}
                stackId="a"
                fill={VARIABLE_COLOR}
              />
            )}
          </BarChart>
        </Chart>
        <ChartDataTable
          caption={name}
          columns={[
            t("chart.tableMonth"),
            t("fixed.legend.fixed"),
            t("fixed.legend.variable"),
          ]}
          rows={rows.map((r) => [
            r.label,
            mask(won(r.fixed)),
            mask(won(r.variable)),
          ])}
        />
      </Body>
    </>
  );
}

// ── 카테고리별 고정 · 변동 ───────────────────────────────────────
interface CategoryRow {
  key: string;
  name: string;
  total: number;
  fixed: number;
}

/** 지출 카테고리를 부모 단위로 묶어 고정 · 변동 몫을 합친다 — 도넛과 같은 묶음 규칙 */
function categoryRows(
  breakdown: CategoryBreakdown[],
  categoryById: Map<number, ExpenseCategory>,
  uncategorized: string,
): CategoryRow[] {
  const map = new Map<string, CategoryRow>();
  for (const c of breakdown) {
    if (c.expenseType !== "EXPENSE") continue;
    const groupId = c.parentCategoryRowId ?? c.categoryRowId;
    const key = groupId == null ? "none" : String(groupId);
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        name:
          c.parentCategoryName ??
          c.categoryName ??
          (groupId != null ? categoryById.get(groupId)?.categoryName : null) ??
          uncategorized,
        total: 0,
        fixed: 0,
      };
      map.set(key, row);
    }
    const s = splitFixed(c.totalAmount, c.fixedAmount);
    row.total += s.total;
    row.fixed += s.fixed;
  }
  return [...map.values()]
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

const CATEGORY_LIMIT = 8;

export function FixedCategorySection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.fixed");
  const head = (
    <BandHead title={t("fixed.category.title")} band={place === "band"} />
  );
  if (m.rangeQ.isError && !m.rangeQ.data) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <>
        {head}
        <Failure
          place={place}
          title={t("loadFailed.fixed")}
          onRetry={() => void m.rangeQ.refetch()}
        />
      </>
    );
  }
  const summary = m.rangeQ.data;
  if (m.rangeQ.isLoading || !summary) {
    return (
      <>
        {head}
        <Body place={place}>
          <div aria-hidden className="flex flex-col gap-x4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton text="t4" className="w-1/2" />
                <Skeleton className="mt-x1_5 h-2 w-full" radius="full" />
              </div>
            ))}
          </div>
        </Body>
      </>
    );
  }
  const cats = categoryRows(
    summary.categoryBreakdown,
    m.categoryById,
    t("uncategorized"),
  );
  if (cats.length === 0) return null;
  const shown = cats.slice(0, CATEGORY_LIMIT);
  const max = Math.max(1, ...shown.map((r) => r.total));
  return (
    <>
      {head}
      <Body place={place}>
        <ul className="m-0 flex list-none flex-col gap-x4 p-0">
          {shown.map((r) => {
            const s = splitFixed(r.total, r.fixed);
            return (
              <li key={r.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-x3">
                  <span className="min-w-[8rem] flex-1 text-t4 font-bold text-fg-neutral [overflow-wrap:anywhere]">
                    {r.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-t4 font-bold tabular-nums text-fg-neutral">
                    {mask(won(s.total))}
                  </span>
                </div>
                {/* 장식 막대 — 값은 옆 금액이 말한다 */}
                <div
                  aria-hidden
                  className="mt-x1_5 h-2 overflow-hidden rounded-full bg-bg-neutral-weak"
                >
                  <div
                    className="flex h-full overflow-hidden rounded-full"
                    style={{ width: `${(s.total / max) * 100}%` }}
                  >
                    {s.fixed > 0 && (
                      <div
                        style={{
                          width: `${(s.fixed / s.total) * 100}%`,
                          background: FIXED_COLOR,
                        }}
                      />
                    )}
                    {s.variable > 0 && (
                      <div
                        className="flex-1"
                        style={{ background: VARIABLE_COLOR }}
                      />
                    )}
                  </div>
                </div>
                {s.fixed > 0 && (
                  <p className="m-0 mt-x1 text-t3 text-fg-neutral-subtle">
                    {t("fixed.category.fixedPart", {
                      pct: formatPercent(s.fixedPercent, "share"),
                    })}
                    {place === "card" && ` · ${mask(won(s.fixed))}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {/* 바닥 버튼 영역 — 위 끝까지 선 1px */}
        <div className="-mx-x6 mt-x5 flex flex-wrap items-center justify-between gap-x3 border-t border-solid border-stroke-neutral-subtle px-x6 pt-x4">
          <span className="inline-flex items-center gap-x1_5 text-t3 text-fg-neutral-subtle">
            <Pin aria-hidden className="size-4 shrink-0" />
            {t("fixed.manageHint")}
          </span>
          <Button
            type="button"
            variant="neutralOutline"
            size="small"
            onClick={() => m.setManageOpen(true)}
          >
            {t("fixed.manage")}
          </Button>
        </div>
      </Body>
    </>
  );
}
