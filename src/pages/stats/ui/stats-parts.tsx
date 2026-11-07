import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pie, PieChart } from "recharts";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Card, CardContent, Delta } from "@/shared/ds/card";
import {
  Chart,
  ChartDataTable,
  ChartDonutCenter,
  ChartDonutLegend,
  ChartHeatmap,
  ChartTooltip,
  ChartTooltipContent,
  CHART_ORDER,
  HEAT_STEP_SWATCH,
  chartDonutRadii,
  chartVar,
} from "@/shared/ds/chart";
import { List, ListItem, ListTile } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { cn } from "@/shared/lib/cn";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { formatChangeRate } from "@/shared/lib/groo/format";
import { RangePickerSheet } from "./RangePickerSheet";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import { Icon } from "@/shared/ui/groo/primitives";
import {
  BandEmpty,
  BandFailure,
  BandHead,
  Desc,
} from "@/shared/ui/groo/band-parts";
import type { FixedView } from "@/entities/expense";
import { formatDateRange, formatDateRangeParts } from "@/shared/lib/date";

/** 소수 둘째 자리로 반올림해 0 이 되는 등락률 — 방향 없이 "변화 없음" */
const ZERO_RATE = formatChangeRate(0, { sign: "none" });
import {
  HEAT_COLS,
  HEAT_ROWS,
  colorDonut,
  type StatsModel,
} from "./stats-model";

/*
 * 통계 구역 부품(I-08 29 ~ 42) — 폰 띠(band)와 데스크톱 카드(card)가 같은 내용을 같은 부품으로 그린다.
 * 띠 안은 구역이 제 좌우 24 를 갖고(band), 카드 안은 카드 본문(CardContent)이 24 를 갖는다.
 * 금액은 원까지 · 가리면 "••••". 눈금 글자만 줄여 쓴다(formatAxisWon).
 */

export type Placement = "band" | "card";

/** 글 · 숫자 · 차트 구역의 본문 상자 — 띠는 좌우 24, 카드는 카드 본문 */
export function Body({
  place,
  className,
  children,
}: {
  place: Placement;
  className?: string;
  children: ReactNode;
}) {
  return place === "band" ? (
    <div className={cn("px-x6 pb-x6", className)}>{children}</div>
  ) : (
    <CardContent className={cn("gap-0", className)}>{children}</CardContent>
  );
}

/** 머리 없는 띠의 본문 — 띠는 위 24 에서 첫 글이 시작하고(머리가 없어 위 여백을 본문이 갖는다), 카드는 카드 본문이 24 를 갖는다 */
export function HeadlessBody({
  place,
  className,
  children,
}: {
  place: Placement;
  className?: string;
  children: ReactNode;
}) {
  return place === "band" ? (
    <div className={cn("px-x6 pb-x6 pt-x6", className)}>{children}</div>
  ) : (
    <CardContent className={cn("gap-0", className)}>{children}</CardContent>
  );
}

/** 칸 폭이 아니라 글 폭 — 잰 글 요소의 크기가 바뀔 때만 상태로 옮긴다(ResizeObserver 콜백) */
function useFitLimit(limit: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setFits(el.getBoundingClientRect().width <= limit),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit]);
  return [ref, fits] as const;
}

/** 기간 버튼(31) — ds Button neutralOutline small 36 · 뒤 꺾쇠 16 하나(앞 · 뒤 아이콘을 함께 쓰지 않는다 — button.md:67) · t4 · 700. 다른 해 직접 기간의 두 줄 글은 "~" 뒤에서만 줄을 바꾼다.
 * 누르면 ds Date Picker 기간 고르기가 열린다 — 1280 미만 시트, 이상 이 버튼 아래 팝오버(date-picker.md 어디에 놓나 :112) */
export function PeriodButton({ m }: { m: StatsModel }) {
  const { t } = useTranslation("stats");
  const { period } = m;
  const twoLine =
    period.segMode === "custom" &&
    period.from.getFullYear() !== period.to.getFullYear();
  // 다른 해 직접 기간 — 양끝에 연도, 두 줄은 구간 기호 뒤에서만 바꾼다(날짜 규칙 · 구간 기호는 로케일 문구)
  const parts = twoLine ? formatDateRangeParts(period.from, period.to) : null;
  const text = parts
    ? `${parts.start}${parts.separator}\n${parts.end}`
    : m.periodLbl;
  return (
    <RangePickerSheet
      open={m.pickerOpen}
      onOpenChange={m.setPickerOpen}
      initial={period}
      onConfirm={m.setPeriod}
      draft={m.pickerDraft}
      onDraftChange={m.setPickerDraft}
      trigger={({ onClick }) => (
        <Button
          type="button"
          variant="neutralOutline"
          size="small"
          aria-label={t("period.buttonAria", {
            period: parts ? formatDateRange(period.from, period.to) : text,
          })}
          aria-haspopup="dialog"
          aria-expanded={m.pickerOpen}
          className="h-auto min-h-9 shrink-0 whitespace-pre-line py-x1_5 text-center [&_svg]:size-4"
          onClick={onClick}
        >
          <span>{text}</span>
          <ChevronDown aria-hidden />
        </Button>
      )}
    />
  );
}

/** 구역 로딩 · 빈 · 실패를 한 곳에서 — 질의가 실패하면 그 구역 안에 실패 상자와 "다시 시도"(그 질의만) */
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

// ── 카테고리별 지출 ───────────────────────────────────────────────
/** 도넛 구역(32) — 머리 "카테고리별 지출" + 기간 버튼, 아래 Segmented, 도넛(폰 180 · 두께 24 / 데스크톱 200 · 두께 26) + 목록 범례 */
export function DonutSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const title = m.isDrilled ? (
    <span className="inline-flex flex-wrap items-baseline gap-x1">
      <Button
        type="button"
        variant="ghost"
        ghostColor="neutralMuted"
        size="small"
        className="-mx-x3_5 text-t5"
        onClick={() => m.setActiveParentId(null)}
      >
        {t("category.title")}
      </Button>
      <span aria-hidden className="text-fg-neutral-subtle">
        ›
      </span>
      <span>{m.activeParent?.name}</span>
    </span>
  ) : (
    t("category.title")
  );
  return (
    <>
      <BandHead
        title={title}
        band={place === "band"}
        aside={<PeriodButton m={m} />}
      />
      <DonutBody m={m} place={place} />
    </>
  );
}

function DonutBody({ m, place }: { m: StatsModel; place: Placement }) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.category");
  const size = place === "band" ? 180 : 200;
  const failed = m.rangeQ.isError && !m.rangeQ.data;
  const segmented = (
    // 같은 내용을 거르는 자리라 그 내용 바로 위에 둔다(Segmented Control 스펙)
    <SegmentedControl
      aria-label={t("fixedView.aria")}
      value={m.fixedView}
      onValueChange={(v) => m.setFixedView(v as FixedView)}
    >
      <SegmentedControlItem value="all">
        {t("fixedView.all")}
      </SegmentedControlItem>
      <SegmentedControlItem value="variable">
        {t("fixedView.variable")}
      </SegmentedControlItem>
      <SegmentedControlItem value="fixed">
        {t("fixedView.fixed")}
      </SegmentedControlItem>
    </SegmentedControl>
  );
  if (failed) {
    return (
      <Failure
        place={place}
        title={t("loadFailed.category")}
        onRetry={() => void m.rangeQ.refetch()}
      />
    );
  }
  if (m.rangeQ.isLoading) {
    return (
      <Body place={place}>
        {segmented}
        <div aria-hidden className="mt-x5 flex flex-col gap-x4">
          <div
            className={cn(
              "flex items-center gap-x8",
              place === "band" ? "flex-col gap-x4" : "flex-row",
            )}
          >
            <Skeleton
              radius="full"
              className="shrink-0"
              style={{ width: size, height: size }}
            />
            <div className="flex w-full flex-col gap-x3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-x2">
                  <Skeleton radius="4" className="size-2.5 shrink-0" />
                  <Skeleton text="t4" className="flex-1" />
                  <Skeleton text="t4" className="w-x10 shrink-0" />
                  <Skeleton text="t4" className="w-x16 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Body>
    );
  }
  if (m.donutView.length === 0) {
    return (
      <Body place={place}>
        {segmented}
        <BandEmpty>{t("empty.category")}</BandEmpty>
      </Body>
    );
  }
  return (
    <Body place={place}>
      {segmented}
      <DonutChartBody m={m} place={place} size={size} mask={mask} />
    </Body>
  );
}

function DonutChartBody({
  m,
  place,
  size,
  mask,
}: {
  m: StatsModel;
  place: Placement;
  size: number;
  mask: (text: string) => string;
}) {
  const { t } = useTranslation("stats");
  const { t: tc } = useTranslation("common");
  const [dsFits, setDsFits] = useState(true);
  const slices = colorDonut(m.donutView, tc("others"));
  const total = m.donutTotal;
  const totalText = mask(won(total));
  // 가운데 합계 판정 = 결정 2A "금액 글 폭 ≤ 구멍 − 16"(ds 판정 그대로) — 폰은 가운데 글 없이 늘 목록 위 합계 줄
  const hole = chartDonutRadii(size).innerRadius * 2;
  const [measureRef, decisionFits] = useFitLimit(hole - 16);
  const center = place === "card";
  const showCenter = center && decisionFits;
  const showRow = !showCenter || !dsFits;
  const legendId = `stats-donut-legend-${place}`;
  const pct = (v: number) =>
    total > 0 ? `${((v / total) * 100).toFixed(1)}%` : "0.0%";
  const name = t("chart.donutName", {
    period: m.periodLbl,
    total: totalText,
  });
  const chart = (
    <div className={cn("relative", place === "band" ? "mb-x4 mt-x5" : "")}>
      {center && (
        <span
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute whitespace-nowrap text-t5 font-bold tabular-nums"
        >
          {totalText}
        </span>
      )}
      <Chart label={name} legendId={legendId} height={size}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="amount"
            nameKey="name"
            {...chartDonutRadii(size)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                valueFormatter={(v) => mask(won(Number(v)))}
              />
            }
          />
        </PieChart>
        {showCenter && (
          <ChartDonutCenter
            label={m.donutTotalLabel}
            amount={totalText}
            onFitChange={setDsFits}
          />
        )}
      </Chart>
    </div>
  );
  const totalRow = showRow && (
    <div
      data-slot="stats-donut-total"
      className="mb-x4 flex items-baseline justify-between gap-x3"
    >
      <span className="text-t3 text-fg-neutral-subtle">
        {m.donutTotalLabel}
      </span>
      <span className="min-w-0 text-end text-t5 font-bold tabular-nums text-fg-neutral">
        {withCommaBreaks(totalText)}
      </span>
    </div>
  );
  const legend = (
    <ChartDonutLegend
      id={legendId}
      items={slices.map((s) => ({
        key: s.id,
        label: s.name,
        color: s.color,
        percent: pct(s.amount),
        amount: mask(won(s.amount)),
        // 하위가 있는 줄만 누르는 줄 — 들어가면 그 안에서는 더 들어갈 곳이 없다
        onClick:
          !m.isDrilled && s.hasChildren
            ? () => m.setActiveParentId(s.rowId)
            : undefined,
      }))}
    />
  );
  return (
    <>
      {place === "band" ? (
        <div className="flex flex-col">
          {chart}
          {totalRow}
          {legend}
        </div>
      ) : (
        <div className="mt-x5 flex items-center gap-x8">
          <div className="shrink-0" style={{ width: size }}>
            {chart}
          </div>
          <div className="min-w-0 flex-1">
            {totalRow}
            {legend}
          </div>
        </div>
      )}
      <ChartDataTable
        caption={name}
        columns={[
          t("chart.tableCategory"),
          t("chart.tablePercent"),
          t("chart.tableAmount"),
        ]}
        rows={slices.map((s) => [s.name, pct(s.amount), mask(won(s.amount))])}
      />
    </>
  );
}

// ── 많이 쓴 가맹점 TOP 5 ──────────────────────────────────────────
/** TOP 5(33) — 순위 + 본문(이름 줄바꿈 · n회 · 금액 한 줄) + 아래 막대(카테고리 색 그대로, 장식) */
export function MerchantsSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.category");
  const head = (
    <BandHead title={t("merchant.title")} band={place === "band"} list />
  );
  if (m.merchantQ.isError && !m.merchantQ.data) {
    return (
      <>
        {head}
        <Failure
          place={place}
          title={t("loadFailed.merchant")}
          onRetry={() => void m.merchantQ.refetch()}
        />
      </>
    );
  }
  if (m.merchantQ.isLoading) {
    return (
      <>
        {head}
        <div aria-hidden className={place === "band" ? "pb-x3" : undefined}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-x2_5 px-x6 py-x2">
              <Skeleton text="t4" className="w-x4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-x3">
                  <Skeleton text="t5" className="w-1/3" />
                  <Skeleton text="t5" className="w-x16 shrink-0" />
                </div>
                <Skeleton className="mt-x1_5 h-2 w-full" radius="full" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (m.topMerchants.length === 0) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandEmpty>{t("empty.merchant")}</BandEmpty>
        </Body>
      </>
    );
  }
  return (
    <>
      {head}
      <ol
        aria-label={t("merchant.title")}
        className={cn("m-0 list-none p-0", place === "band" && "pb-x3")}
      >
        {m.topMerchants.map((mc, i) => (
          <li key={`${mc.merchant}-${i}`} className="flex gap-x2_5 px-x6 py-x2">
            <span className="w-x4 shrink-0 text-t4 font-bold tabular-nums text-fg-brand">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-x3">
                <span className="min-w-[8rem] flex-1 text-t5 text-fg-neutral [overflow-wrap:anywhere]">
                  {mc.merchant}
                  <span className="ms-x1_5 text-t3 text-fg-neutral-subtle">
                    {t("unit.times", { count: mc.count })}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-t5 font-bold tabular-nums text-fg-neutral">
                  {mask(won(mc.totalAmount))}
                </span>
              </div>
              {/* 막대는 ProgressBar 가 아니다 — 카테고리 색 그대로, 장식(값은 옆 금액 글이 말한다) */}
              <div
                aria-hidden
                data-slot="stats-merchant-bar"
                className="mt-x1_5 h-2 overflow-hidden rounded-full bg-bg-neutral-weak"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(mc.totalAmount / m.maxMerchantAmt) * 100}%`,
                    background: chartVar(
                      CHART_ORDER[i % CHART_ORDER.length] ?? "blue",
                    ),
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

// ── 요일 · 시간대 열지도 ───────────────────────────────────────────
/** 열지도(34) — ds ChartHeatmap. 칸 글은 칸 폭 112 이상에서만 원까지(폰은 세기 색만), 값은 툴팁 · 표로 보기 */
export function HeatmapSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.category");
  const head = <BandHead title={t("heatmap.title")} band={place === "band"} />;
  if (m.heatmapQ.isError && !m.heatmapQ.data) {
    return (
      <>
        {head}
        <Failure
          place={place}
          title={t("loadFailed.heatmap")}
          onRetry={() => void m.heatmapQ.refetch()}
        />
      </>
    );
  }
  if (m.heatmapQ.isLoading) {
    return (
      <>
        {head}
        <Body place={place}>
          <Desc className="mb-x3">{t("heatmap.subtitle")}</Desc>
          <div
            aria-hidden
            className="grid gap-x1_5"
            style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}
          >
            <span />
            {HEAT_COLS.map((c) => (
              <Skeleton key={c.dow} text="t2" className="mx-auto w-x3" />
            ))}
            {HEAT_ROWS.map((r) => (
              <HeatSkeletonRow key={r.labelKey} />
            ))}
          </div>
        </Body>
      </>
    );
  }
  if (m.heatmapTotal === 0) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandEmpty>
            {t("heatmap.empty", { period: m.periodNowInline })}
          </BandEmpty>
        </Body>
      </>
    );
  }
  const name = t("chart.heatName", {
    period: m.periodLbl,
    total: mask(won(m.heatmapTotal)),
  });
  return (
    <>
      {head}
      <Body place={place}>
        <Desc className="mb-x3">{t("heatmap.subtitle")}</Desc>
        <ChartHeatmap
          label={name}
          rows={HEAT_ROWS.map((r) => ({
            key: r.labelKey,
            label: t(r.labelKey),
            sub: t(r.subKey),
          }))}
          columns={HEAT_COLS.map((c) => ({
            key: String(c.dow),
            label: t(c.labelKey),
          }))}
          values={m.heatmapMatrix}
          formatValue={(v) => mask(won(v))}
          valueLabel={t("chart.heatValue")}
          tooltipLabel={(row, col) => (
            <>
              {col.label} {row.label} {row.sub}
            </>
          )}
        />
        <div className="mt-x3 flex flex-wrap items-center gap-x2 text-t2 text-fg-neutral-subtle">
          <span>{t("heatmap.less")}</span>
          <span aria-hidden className="flex gap-x0_5">
            {HEAT_STEP_SWATCH.map((c) => (
              <span
                key={c}
                className="h-2.5 w-x4 rounded-r1"
                style={{ background: c }}
              />
            ))}
          </span>
          <span>{t("heatmap.more")}</span>
          <span className="ms-auto tabular-nums">
            {t("heatmap.total")} {mask(won(m.heatmapTotal))}
          </span>
        </div>
        <ChartDataTable
          caption={name}
          columns={[
            t("chart.tableTime"),
            ...HEAT_COLS.map((c) => t(c.labelKey)),
          ]}
          rows={HEAT_ROWS.map((r, ri) => [
            `${t(r.labelKey)} ${t(r.subKey)}`,
            ...HEAT_COLS.map((_, ci) =>
              mask(won(m.heatmapMatrix[ri]?.[ci] ?? 0)),
            ),
          ])}
        />
      </Body>
    </>
  );
}

function HeatSkeletonRow() {
  return (
    <>
      <span>
        <Skeleton text="t3" className="w-x8" />
        <Skeleton text="t1" className="mt-x0_5 w-x12" />
      </span>
      {HEAT_COLS.map((c) => (
        <Skeleton key={c.dow} radius="4" className="aspect-square w-full" />
      ))}
    </>
  );
}

// ── 요약(하이라이트) ───────────────────────────────────────────────
/** 요약(35) — 머리 없는 띠. 블록 셋(가장 많이 쓴 카테고리 · 가맹점 · 평균), 블록 사이 16. 이름 줄바꿈 */
export function HighlightsSection({
  m,
  place,
}: {
  m: StatsModel;
  place: Placement;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.category");
  const loading = m.rangeQ.isLoading || m.merchantQ.isLoading;
  const failed =
    (m.rangeQ.isError && !m.rangeQ.data) ||
    (m.merchantQ.isError && !m.merchantQ.data);
  if (failed) {
    // 폰은 질의 하나 = 상자 하나 — 같은 질의를 먹는 뒤 띠는 상자를 또 그리지 않는다(앞 띠가 말한다). 데스크톱은 카드마다 그대로
    if (place === "band") return null;
    return (
      <HeadlessBody place={place}>
        <BandFailure
          title={t("loadFailed.highlights")}
          onRetry={() => {
            if (m.rangeQ.isError) void m.rangeQ.refetch();
            if (m.merchantQ.isError) void m.merchantQ.refetch();
          }}
        />
      </HeadlessBody>
    );
  }
  const avgDetail =
    m.period.segMode !== "m" ? (
      <>
        {t("avgSub.rangeTotal", { days: m.rangeDays })}{" "}
        {mask(won(m.totalExpense))}
      </>
    ) : m.prevTotalExpense > 0 ? (
      <Delta
        direction={
          m.dayRate === ZERO_RATE ? "flat" : m.dayPct > 0 ? "up" : "down"
        }
        value={m.dayRate}
        text={m.momText}
      />
    ) : m.prevRangeQ.isLoading ? (
      t("avgSub.momCalculating", { prev: m.periodPrevInline })
    ) : (
      t("avgSub.momUnavailable", { prev: m.periodPrevInline })
    );
  const blocks: {
    key: string;
    label: string;
    title: string;
    detail: ReactNode;
    icon: string | null;
    color: string | null;
    fallback: string;
  }[] = [
    {
      key: "category",
      label: t("highlight.topCategory"),
      title: m.categoryTop?.name ?? "—",
      detail: m.categoryTop
        ? mask(won(m.categoryTop.amount))
        : t("highlight.noData"),
      icon: m.categoryTop?.icon ?? null,
      color: m.categoryTop?.color ?? null,
      fallback: m.categoryTop?.name?.charAt(0) || "•",
    },
    {
      key: "merchant",
      label: t("highlight.topMerchant"),
      title: m.topMerchant?.merchant ?? "—",
      detail: m.topMerchant
        ? `${t("unit.times", { count: m.topMerchant.count })} · ${mask(won(m.topMerchant.totalAmount))}`
        : t("highlight.noData"),
      // 가맹점이 속한 대표 카테고리 아이콘(역산), 없으면 상점 아이콘
      icon: m.topMerchantCat?.icon ?? "store",
      color: m.topMerchantCat?.color ?? null,
      fallback: m.topMerchant?.merchant?.charAt(0) || "•",
    },
    {
      key: "average",
      label: m.avgLabel,
      title: mask(won(m.avgValue)),
      detail: avgDetail,
      icon: "calendar-days",
      color: null,
      fallback: "∅",
    },
  ];
  const renderBlock = (b: (typeof blocks)[number]) => {
    const pal = getPaletteByColor(b.color);
    return (
      <section key={b.key} aria-label={b.label} className="min-w-0">
        <p className="m-0 mb-x2 px-x6 text-t3 font-medium text-fg-neutral-subtle">
          {b.label}
        </p>
        {loading ? (
          <div aria-hidden className="flex items-center gap-x3 px-x6">
            <Skeleton radius="12" className="size-x10 shrink-0" />
            <div className="flex-1">
              <Skeleton text="t5" className="w-1/2" />
              <Skeleton text="t3" className="mt-x0_5 w-1/3" />
            </div>
          </div>
        ) : (
          <List>
            <ListItem
              as="div"
              prefix={
                <ListTile style={{ background: pal.bg, color: pal.color }}>
                  {b.icon ? (
                    <Icon name={b.icon} size={20} />
                  ) : (
                    <span>{b.fallback}</span>
                  )}
                </ListTile>
              }
              title={<span className="font-bold">{b.title}</span>}
              detail={b.detail}
            />
          </List>
        )}
      </section>
    );
  };
  // 폰은 머리 없는 띠 하나에 블록 셋(사이 16), 데스크톱은 카드 셋 한 줄 그대로(구조 그대로 — 40)
  if (place === "card") {
    return (
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-x2">
        {blocks.map((b) => (
          <Card key={b.key} className="px-0">
            {renderBlock(b)}
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-x4 pb-x6 pt-x6">
      {blocks.map(renderBlock)}
    </div>
  );
}
