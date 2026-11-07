import { measureTickWidth, niceTickLabels } from "@/shared/lib/groo/axisWidth";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CompareBar } from "./compare-bar";
import { Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardStat } from "@/shared/ds/card";
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
import { List, ListItem, ListTile } from "@/shared/ds/list";
import { Skeleton, SkeletonGroup } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { KRW, MINUS, formatChangeRate } from "@/shared/lib/groo/format";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import { Icon } from "@/shared/ui/groo/primitives";
import {
  BandEmpty,
  BandFailure,
  BandHead,
  HeadNote,
} from "@/shared/ui/groo/band-parts";
import { Body, HeadlessBody, type Placement } from "./stats-parts";
import { WK_KEYS, type StatsModel } from "./stats-model";

/*
 * 통계 · 비교 탭 구역(I-08 37) — 요약(큰 숫자 + 증감 + 견줌 막대) · 지표 셋 · 카테고리별 증감 · 요일별 지출 비교(ds 막대 두 계열).
 * 증감은 ds Delta(▲ fg-critical · ▼ fg-informative), "좋은지 나쁜지" 는 글이 말한다(색 강조를 걷는다).
 */

/** 마지막 글자에 받침이 있는가 — 과 · 와 고르기(한글이 아니면 받침 없음으로 본다) */
const withBatchim = (text: string) => {
  const code = text.charCodeAt(text.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};

const deltaDirection = (d: number) => (d > 0 ? "up" : d < 0 ? "down" : "flat");

/** 비교 탭 질의 둘(이번 기간 · 이전 기간) 중 실패한 것만 다시 받는다 */
function compareFailed(m: StatsModel) {
  return (
    (m.rangeQ.isError && !m.rangeQ.data) ||
    (m.prevRangeQ.isError && !m.prevRangeQ.data)
  );
}
function retryCompare(m: StatsModel) {
  if (m.rangeQ.isError) void m.rangeQ.refetch();
  if (m.prevRangeQ.isError) void m.prevRangeQ.refetch();
}
const compareLoading = (m: StatsModel) =>
  m.rangeQ.isLoading || m.prevRangeQ.isLoading;

// ── 요약 ────────────────────────────────────────────────────────
export function CompareSummarySection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.compare");
  if (compareFailed(m)) {
    return (
      <HeadlessBody place={place}>
        <BandFailure
          title={t("loadFailed.compare")}
          onRetry={() => retryCompare(m)}
        />
      </HeadlessBody>
    );
  }
  if (compareLoading(m)) {
    return (
      <HeadlessBody place={place}>
        <SkeletonGroup>
          <Skeleton text="t3" className="w-1/3" />
          <Skeleton text="t9" className="mt-x1 w-2/3" />
          <Skeleton text="t4" className="mt-x3 w-3/4" />
          <Skeleton className="mt-x4 h-2 w-full" radius="full" />
          <Skeleton className="mt-x2_5 h-2 w-full" radius="full" />
        </SkeletonGroup>
      </HeadlessBody>
    );
  }
  const less = m.cmpDiff <= 0;
  const barMax = Math.max(1, m.totalNow, m.totalPrev);
  return (
    <HeadlessBody place={place}>
      <CardStat
        label={t("compare.periodExpense", { period: m.periodNow })}
        value={mask(won(m.totalNow))}
        delta={
          m.cmpPct != null
            ? {
                direction:
                  m.cmpPct === formatChangeRate(0, { sign: "none" })
                    ? "flat"
                    : deltaDirection(m.cmpDiff),
                value: m.cmpPct,
              }
            : undefined
        }
      />
      {m.cmpPct != null && m.cmpDiff === 0 ? (
        <p className="m-0 mt-x3 text-t4 text-fg-neutral">{t("compare.same")}</p>
      ) : m.cmpPct != null ? (
        // 강조는 금액만 700 — 좋은지 나쁜지는 글이 말한다
        <p className="m-0 mt-x3 text-t4 text-fg-neutral">
          {t("compare.vsLastPrefix", { prev: m.periodPrev })}{" "}
          <span className="font-bold">
            {mask(won(Math.abs(m.cmpDiff)))}{" "}
            {less ? t("compare.dirLess") : t("compare.dirMore")}
          </span>{" "}
          {t("compare.spentSuffix", { prev: m.periodPrevInline })}
        </p>
      ) : (
        <p className="m-0 mt-x3 text-t3 text-fg-neutral-subtle">
          {m.noPrevText}
        </p>
      )}
      <div className="mt-x4 flex flex-col gap-x2_5">
        <CompareBar
          current
          label={m.periodNow}
          amount={mask(won(m.totalNow))}
          max={m.totalNow / barMax}
        />
        <CompareBar
          current={false}
          label={m.periodPrev}
          amount={mask(won(m.totalPrev))}
          max={m.totalPrev / barMax}
        />
      </div>
    </HeadlessBody>
  );
}

// ── 지표 셋 ─────────────────────────────────────────────────────
export function CompareMetricsSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.compare");
  const failed =
    compareFailed(m) ||
    (m.monthExpensesQ.isError && !m.monthExpensesQ.data) ||
    (m.prevMonthExpensesQ.isError && !m.prevMonthExpensesQ.data);
  if (failed) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <HeadlessBody place={place}>
        <BandFailure
          title={t("loadFailed.compare")}
          onRetry={() => {
            retryCompare(m);
            if (m.monthExpensesQ.isError) void m.monthExpensesQ.refetch();
            if (m.prevMonthExpensesQ.isError)
              void m.prevMonthExpensesQ.refetch();
          }}
        />
      </HeadlessBody>
    );
  }
  const loading =
    compareLoading(m) ||
    m.monthExpensesQ.isLoading ||
    m.prevMonthExpensesQ.isLoading;
  const value = (v: number, count: boolean) =>
    count ? `${KRW(v)}${t("compare.unitCount")}` : mask(won(v));
  const stats = m.cmpMetrics.map((x) => {
    const d = x.now - x.prev;
    return (
      <CardStat
        key={x.key}
        label={x.label}
        value={value(x.now, x.count)}
        delta={{
          direction: deltaDirection(d),
          value: value(Math.abs(d), x.count),
          text: `${m.periodPrev} ${value(x.prev, x.count)}`,
        }}
      />
    );
  });
  const skeleton = (
    <SkeletonGroup>
      <Skeleton text="t3" className="w-1/3" />
      <Skeleton text="t9" className="mt-x1 w-1/2" />
      <Skeleton text="t3" className="mt-x1 w-2/3" />
    </SkeletonGroup>
  );
  // 폰은 지표 한 줄에 하나(머리 없는 띠 하나), 데스크톱은 카드 셋 한 줄 그대로(구조 그대로)
  if (place === "card") {
    return (
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-x2">
        {m.cmpMetrics.map((x, i) => (
          <Card key={x.key}>{loading ? skeleton : stats[i]}</Card>
        ))}
      </div>
    );
  }
  return (
    <HeadlessBody place={place} className="flex flex-col gap-x5">
      {loading
        ? m.cmpMetrics.map((x) => <div key={x.key}>{skeleton}</div>)
        : stats}
    </HeadlessBody>
  );
}

// ── 카테고리별 증감 ──────────────────────────────────────────────
export function CompareCategorySection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.compare");
  const head = (
    <BandHead
      title={t("compare.categoryDeltaTitle")}
      band={place === "band"}
      list
      aside={<HeadNote>{t("compare.categoryDeltaSort")}</HeadNote>}
    />
  );
  if (compareFailed(m)) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <>
        {head}
        <Body place={place}>
          <BandFailure
            title={t("loadFailed.compare")}
            onRetry={() => retryCompare(m)}
          />
        </Body>
      </>
    );
  }
  if (compareLoading(m)) {
    return (
      <>
        {head}
        <SkeletonGroup className={place === "band" ? "pb-x3" : undefined}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
              <Skeleton radius="12" className="size-x10 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
                <Skeleton text="t5" className="w-1/2" />
                <Skeleton text="t3" className="w-2/3" />
              </div>
              <Skeleton text="t5" className="w-x16 shrink-0" />
            </div>
          ))}
        </SkeletonGroup>
      </>
    );
  }
  if (m.deltaRows.length === 0) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandEmpty>{t("empty.compare")}</BandEmpty>
        </Body>
      </>
    );
  }
  return (
    <>
      {head}
      <List
        aria-label={t("compare.categoryDeltaTitle")}
        className={place === "band" ? "pb-x3" : undefined}
      >
        {m.deltaRows.map((r) => {
          const up = r.diff > 0;
          const pal = getPaletteByColor(r.color);
          const tone = up ? "text-fg-critical" : "text-fg-informative";
          const amounts = (
            <span className="shrink-0 text-end">
              <span
                className={cn(
                  "block whitespace-nowrap text-t5 font-bold tabular-nums",
                  r.diff === 0 ? "text-fg-neutral" : tone,
                )}
              >
                {r.diff === 0 ? "" : up ? "+" : MINUS}
                {mask(won(Math.abs(r.diff)))}
              </span>
              <span className="block text-t3 tabular-nums text-fg-neutral-subtle">
                {r.prev > 0 ? (
                  <>
                    {up ? "▲" : r.diff < 0 ? "▼" : ""}{" "}
                    {formatChangeRate(r.pct, { sign: "none" })}
                  </>
                ) : (
                  "—"
                )}
              </span>
            </span>
          );
          return (
            <ListItem
              key={r.groupRowId ?? "none"}
              align="top"
              prefix={
                <ListTile style={{ background: pal.bg, color: pal.color }}>
                  <Icon name={r.icon ?? "tag"} size={20} />
                </ListTile>
              }
              title={r.name}
              detail={
                <>
                  {mask(won(r.prev))} → {mask(won(r.now))}
                </>
              }
              suffix={
                place === "card" ? (
                  <span className="flex items-center gap-x4">
                    <DivergingBar diff={r.diff} max={m.maxDelta} up={up} />
                    {amounts}
                  </span>
                ) : (
                  amounts
                )
              }
            />
          );
        })}
      </List>
    </>
  );
}

/** 가운데 축 막대 — 데스크톱 · 태블릿만. 감소는 왼쪽 · 증가는 오른쪽 */
function DivergingBar({
  diff,
  max,
  up,
}: {
  diff: number;
  max: number;
  up: boolean;
}) {
  const w = `${(Math.abs(diff) / max) * 100}%`;
  const color = up ? "bg-fg-critical" : "bg-fg-informative";
  return (
    <span aria-hidden className="flex w-[180px] shrink-0">
      <span className="flex flex-1 justify-end">
        {!up && diff !== 0 && (
          <span
            className={cn("h-2 self-center rounded-l-full", color)}
            style={{ width: w }}
          />
        )}
      </span>
      <span className="w-px shrink-0 bg-stroke-neutral-weak" />
      <span className="flex flex-1">
        {up && (
          <span
            className={cn("h-2 self-center rounded-r-full", color)}
            style={{ width: w }}
          />
        )}
      </span>
    </span>
  );
}

// ── 요일별 지출 비교 ─────────────────────────────────────────────
export function CompareWeekdaySection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.compare");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const head = (
    <BandHead title={t("compare.weekdayTitle")} band={place === "band"} />
  );
  const failed =
    (m.monthExpensesQ.isError && !m.monthExpensesQ.data) ||
    (m.prevMonthExpensesQ.isError && !m.prevMonthExpensesQ.data);
  if (failed) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandFailure
            title={t("loadFailed.weekday")}
            onRetry={() => {
              if (m.monthExpensesQ.isError) void m.monthExpensesQ.refetch();
              if (m.prevMonthExpensesQ.isError)
                void m.prevMonthExpensesQ.refetch();
            }}
          />
        </Body>
      </>
    );
  }
  const height = place === "band" ? 180 : 220;
  if (m.monthExpensesQ.isLoading || m.prevMonthExpensesQ.isLoading) {
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
  const data = WK_KEYS.map((k, i) => ({
    day: t(k),
    now: m.wkNow[i] ?? 0,
    prev: m.wkPrev[i] ?? 0,
  }));
  const sumNow = m.wkNow.reduce((a, b) => a + b, 0);
  const sumPrev = m.wkPrev.reduce((a, b) => a + b, 0);
  const name = t("chart.weekdayName", { period: m.periodNow });
  const legendId = `stats-weekday-legend-${place}`;
  const dk = m.wkDelta.idx >= 0 ? WK_KEYS[m.wkDelta.idx] : undefined;
  // 변화가 가장 큰 요일(절댓값) 한 줄 — 요일마다 변화가 없으면 "{기간}과 비슷해요." 로 줄을 그대로 보인다
  const changed = dk != null && m.wkDelta.delta !== 0;
  const text = changed
    ? t(
        m.wkDelta.delta < 0
          ? "compare.weekdayInsightDown"
          : "compare.weekdayInsightUp",
        {
          dow: t(dk),
          amt: mask(KRW(Math.abs(m.wkDelta.delta))),
          prev: m.periodPrevInline,
        },
      )
    : t("compare.weekdayInsightSame", {
        prev: m.periodPrevInline,
        josa: withBatchim(m.periodPrev) ? "과" : "와",
      });
  const insight: ReactNode = (
    <p className="m-0 mt-x3 flex items-start gap-x1_5 text-t3 text-fg-neutral-muted">
      <Sparkles aria-hidden className="mt-x0_5 size-4 shrink-0 text-fg-brand" />
      <span>{text}</span>
    </p>
  );
  return (
    <>
      {head}
      <Body place={place}>
        <ChartLegendTiles
          id={legendId}
          items={[
            {
              key: "now",
              label: m.periodNow,
              color: "blue",
              total: mask(won(sumNow)),
            },
            {
              key: "prev",
              label: m.periodPrev,
              color: "blue-weak",
              total: mask(won(sumPrev)),
            },
          ]}
          hidden={hidden}
          onHiddenChange={setHidden}
        />
        <Chart label={name} legendId={legendId} height={height}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="day" {...chartAxisProps()} />
            <YAxis
              tickFormatter={(v) => mask(formatAxisWon(Number(v)))}
              width={measureTickWidth(
                niceTickLabels(
                  data.flatMap((d) => [
                    Number(d.now ?? 0),
                    Number(d.prev ?? 0),
                  ]),
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
            {!hidden.has("now") && (
              <Bar dataKey="now" name={m.periodNow} fill={chartVar("blue")} />
            )}
            {!hidden.has("prev") && (
              <Bar
                dataKey="prev"
                name={m.periodPrev}
                fill={chartVar("blue-weak")}
              />
            )}
          </BarChart>
        </Chart>
        <ChartDataTable
          caption={name}
          columns={[t("chart.tableWeekday"), m.periodNow, m.periodPrev]}
          rows={data.map((d) => [d.day, mask(won(d.now)), mask(won(d.prev))])}
        />
        {insight}
      </Body>
    </>
  );
}
