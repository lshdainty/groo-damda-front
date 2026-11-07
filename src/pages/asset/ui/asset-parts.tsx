import { PriceStaleCallout } from "@/features/stock/ui/phone/price-fail-band";
import { loadFailed } from "@/shared/api";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Landmark, Target } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import {
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { CardContent, Delta } from "@/shared/ds/card";
import {
  Chart,
  ChartDataTable,
  ChartDonutCenter,
  ChartDonutLegend,
  ChartTooltip,
  ChartTooltipContent,
  assignChartColors,
  chartAxisProps,
  chartDonutRadii,
  chartGridProps,
  formatAxisWon,
  type ChartColor,
} from "@/shared/ds/chart";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { List, ListButtonItem, ListItem, ListTile } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton, LoadingRegion } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { isIconName } from "@/shared/lib";
import {
  formatMonthDay,
  formatMonthTicks,
  formatYearMonth,
  parseLocalDate,
} from "@/shared/lib/date";
import { niceAxis } from "@/shared/lib/groo/chartAxis";
import { useAxisWidth } from "@/shared/lib/groo/axisWidth";
import {
  chartColorOf,
  getPaletteByColor,
} from "@/shared/lib/groo/chart-palette";
import {
  MINUS,
  formatChangeRate,
  formatPercent,
} from "@/shared/lib/groo/format";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";
import { useHideAmounts } from "@/shared/lib/groo/hide-amounts-core";
import { useOpenHideAmountsSettings } from "@/shared/lib/groo/hide-amounts-nav";
import { MASK, won } from "@/shared/lib/groo/money-text";
import {
  BandEmpty,
  BandFailure,
  BandHead,
  BarredItem,
  HeadNote,
  KeyValueRows,
  KeyValueSkeleton,
  MeterBar,
  StatGrid,
  type KeyValue,
} from "@/shared/ui/groo/band-parts";
import { useNetWorthTrend, type InvestValuation } from "@/features/asset";
import { useRecurringTransactions } from "@/features/recurring-transaction";
import { useSavingGoals } from "@/features/savingGoal";
import type { Asset } from "@/entities/asset";
import type { SavingGoal } from "@/entities/savingGoal";
import {
  krwOf,
  useAssetMask,
  useFitLimit,
  type AssetGroups,
} from "./asset-model";
import { AssetRow, GroupRowsSkeleton } from "@/widgets/asset-full";

/*
 * 자산 화면의 구역 부품(I-05 54 ~ 63) — 폰 띠(band)와 데스크톱 카드(card)가 같은 내용을 같은 부품으로 그린다.
 * 띠 안은 구역이 제 좌우 24 를 갖고(band), 카드 안은 카드 본문(CardContent)이 24 를 갖는다.
 * 금액은 원까지 · 가리면 "••••". 카드마다 따로 불러오고 따로 실패한다(화면 전체 게이트 없음 — 62).
 */

type Placement = "band" | "card";

function Body({
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

const KV_ROW = "[&_[data-slot=list-content]]:py-x2";

// ── 순자산 추이 차트 ────────────────────────────────────────────
/**
 * 순자산 추이 = ds Chart 선 — 영역 채움 없이 선 2 + 데이터 점마다 점(지름 6, 계열 색, 테두리 없음).
 * 레시피 차트는 늘 찍는 점을 `[&_.recharts-line-dots]:hidden` 으로 감춘다 — 이 화면만 className 으로 덮어 보이게 한다(I-05 57, 사용자 고침).
 * 가리킨 점은 스펙 그대로(10 · 카드 면 색 테두리 2).
 */
export function NetWorthChart({ height = 180 }: { height?: number }) {
  const { t } = useTranslation("asset");
  const hidden = useHideAmounts("asset.netWorth");
  const trendQ = useNetWorthTrend(12);
  const points = trendQ.data ?? [];
  // 월 눈금 — 한 해 안이면 "5월", 해가 섞이면 "2025. 12." (통계와 같은 규칙 · 앱 monthTicks)
  const tickLabels = formatMonthTicks(points);
  const data = points.map((p, i) => ({
    monthLabel: tickLabels[i]!,
    netWorth: p.netWorth,
  }));
  // Y축: 0기준 nice 눈금 (앱 net_worth_chart niceAxis 정합).
  const vals = data.map((d) => d.netWorth);
  const yAxis = niceAxis(Math.min(0, ...vals), Math.max(0, ...vals));
  const tick = (v: number) => (hidden ? MASK : formatAxisWon(v));
  // 음수 축 글자가 잘리지 않게 가장 긴 눈금 글자를 재서 폭을 잡는다(D6).
  const axisWidth = useAxisWidth(yAxis.ticks.map(tick));

  if (trendQ.isLoading) {
    return (
      <LoadingRegion
        pending
        className="contents"
        fallback={
          <>
            <Skeleton className="w-full" radius="8" style={{ height }} />
          </>
        }
      />
    );
  }
  if (loadFailed(trendQ)) {
    return (
      <BandFailure
        title={t("loadFailed.trend")}
        onRetry={() => void trendQ.refetch()}
      />
    );
  }
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-t4 text-fg-neutral-subtle"
        style={{ height }}
      >
        {t("noTrendData")}
      </div>
    );
  }
  const latest = data[data.length - 1]!.netWorth;
  const latestText = hidden ? MASK : won(latest);
  return (
    <>
      <Chart
        label={t("chart.netWorthName", { amount: latestText })}
        height={height}
        className="[&_.recharts-line-dots]:block"
      >
        <LineChart
          data={data}
          // 해가 섞이면 마지막 눈금 "2026. 11." 이 점 끝(오른쪽 가장자리)을 넘지 않게 오른쪽을 비운다
          margin={{
            top: 8,
            right: tickLabels.some((l) => l.length > 4) ? 32 : 8,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="monthLabel" {...chartAxisProps()} />
          <YAxis
            domain={[yAxis.min, yAxis.max]}
            ticks={yAxis.ticks}
            tickFormatter={tick}
            width={axisWidth}
            {...chartAxisProps()}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                valueFormatter={(v) => (hidden ? MASK : won(Number(v)))}
              />
            }
          />
          <Line
            dataKey="netWorth"
            name={t("netWorth")}
            stroke="var(--color-chart-blue)"
            dot={{ r: 3, fill: "var(--color-chart-blue)", strokeWidth: 0 }}
          />
        </LineChart>
      </Chart>
      <ChartDataTable
        caption={t("chart.netWorthName", { amount: latestText })}
        columns={[t("chart.tableMonth"), t("netWorth")]}
        rows={data.map((d) => [d.monthLabel, hidden ? MASK : won(d.netWorth)])}
      />
    </>
  );
}

// ── 순자산 요약 ─────────────────────────────────────────────────
/**
 * 순자산 요약(55) — 눈(금액 가리기 설정, 보이는 40 · 누르는 44 · 아이콘 20) · 금액 t12 · 증감 Delta · 추이 차트 · 지표 셋(폰 한 줄에 하나, 데스크톱 세 칸).
 * 지금처럼 흰 띠(폰) · 흰 카드(데스크톱) — hero 로 바꾸지 않는다(Q2 2A).
 */
export function SummarySection({
  g,
  place,
}: {
  g: AssetGroups;
  place: Placement;
}) {
  const { t } = useTranslation("asset");
  const mask = useAssetMask("asset.netWorth");
  const hidden = useHideAmounts("asset.netWorth");
  const openHide = useOpenHideAmountsSettings("asset");
  const band = place === "band";

  if (g.summaryFailed) {
    return (
      <Body place={place} className={band ? "pt-x6" : undefined}>
        <BandFailure
          title={
            // 폰은 목록 질의 실패가 요약 띠의 상자 하나로 모인다 — 앱과 같은 글 "자산을 불러오지 못했어요"
            band && g.assetsFailed
              ? t("loadFailed.assets")
              : t("loadFailed.summary")
          }
          onRetry={g.retrySummary}
          band={false}
        />
      </Body>
    );
  }
  if (g.summaryLoading) return <SummarySkeleton place={place} />;

  const isUp = g.changeAmount >= 0;
  const delta =
    g.changeAmount === 0 ? (
      <Delta direction="flat" text={t("vsLastMonth")} />
    ) : (
      <Delta
        direction={isUp ? "up" : "down"}
        value={`${formatChangeRate(g.changePercent, { sign: "none" })}${
          hidden ? "" : ` (${won(Math.abs(g.changeAmount))})`
        }`}
        text={t("vsLastMonth")}
      />
    );
  const stats: KeyValue[] = [
    {
      key: "accounts",
      name: t("tab.accountDeposit"),
      value: mask(won(g.accountsTotal)),
    },
    {
      key: "invest",
      name: t("group.invest"),
      value: mask(won(g.investmentsTotal)),
    },
    {
      key: "cards",
      name: t("cardBalance"),
      value: mask(
        g.cardsTotal > 0 ? MINUS + won(g.cardsTotal) : won(g.cardsTotal),
      ),
    },
  ];
  return (
    <>
      <Body place={place} className={band ? "pb-0 pt-x6" : undefined}>
        <div className="flex items-center gap-x1">
          <span className="text-t3 font-medium text-fg-neutral-subtle">
            {t("totalNetWorth")}
          </span>
          <Button
            type="button"
            variant="ghost"
            ghostColor="neutralMuted"
            size="medium"
            layout="iconOnly"
            className="-my-x2 [&_svg]:size-5"
            aria-label={t("hideAmountsSettings")}
            onClick={openHide}
          >
            {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </div>
        <p className="m-0 mt-x1 text-t12 font-bold tabular-nums text-fg-neutral">
          {withCommaBreaks(mask(won(g.netWorth)))}
        </p>
        <div className="mt-x2 text-t3 text-fg-neutral-subtle">
          {g.hasLastMonth ? delta : <span>{t("noLastMonth")}</span>}
        </div>
        <div className="mt-x4">
          <NetWorthChart height={band ? 140 : 180} />
        </div>
      </Body>
      {band ? (
        <>
          <KeyValueRows className={cn("mt-x3", KV_ROW)} items={stats} />
          <div className="pb-x4" />
        </>
      ) : (
        <CardContent className="gap-0 pt-0">
          <StatGrid items={stats} className="mt-x5" />
        </CardContent>
      )}
    </>
  );
}

export function SummarySkeleton({ place }: { place: Placement }) {
  const band = place === "band";
  return (
    <>
      <Body place={place} className={band ? "pb-0 pt-x6" : undefined}>
        <LoadingRegion
          pending
          className="contents"
          fallback={
            <>
              <Skeleton text="t3" className="w-1/4" />
              <Skeleton text="t12" radius="8" className="mt-x2 w-1/2" />
              <Skeleton text="t3" className="mt-x2 w-1/3" />
              <Skeleton
                className="mt-x4 w-full"
                radius="8"
                style={{ height: band ? 140 : 180 }}
              />
            </>
          }
        />
      </Body>
      {band ? (
        <div className="mt-x3 pb-x4">
          <KeyValueSkeleton rows={3} />
        </div>
      ) : (
        <CardContent className="gap-0 pt-0">
          <LoadingRegion
            pending
            className="contents"
            fallback={
              <>
                <div className="mt-x5 grid grid-cols-3 gap-x3">
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <Skeleton text="t3" className="w-1/2" />
                      <Skeleton text="t5" className="mt-x0_5 w-3/4" />
                    </div>
                  ))}
                </div>
              </>
            }
          />
        </CardContent>
      )}
    </>
  );
}

// ── 자산 구성 도넛(데스크톱) ────────────────────────────────────
type GroupKey = "cash" | "invest";
type Slice = {
  id: string;
  name: string;
  amount: number;
  saved: ChartColor | null;
  groupKey?: GroupKey;
};

/**
 * 자산 구성(58) — 조각은 자산 묶음(현금 · 투자)만, 누르면 계좌별로 쪼개진다. 빚(카드 · 대출)은 범례 아래 "빚" 목록 줄 — 조각 · %에 들지 않는다(chart.md 8B).
 * 가운데 = 자산 합계(원까지). 합계 글 폭이 구멍 − 16 을 넘으면 목록 범례 위에 합계 줄(chart.md:94).
 * 전체 자산 합계에 포함을 끈 자산은 순자산에서 빠지므로 도넛에서도 뺀다.
 */
export function AssetCompositionCard({
  accounts,
  investments,
  cards,
  loans,
}: {
  accounts: Asset[];
  investments: Asset[];
  cards: Asset[];
  loans: Asset[];
}) {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.composition");
  const [active, setActive] = useState<GroupKey | null>(null);
  const SIZE = 180;
  const hole = chartDonutRadii(SIZE).innerRadius * 2;
  const [measureRef, decisionFits] = useFitLimit(hole - 16);
  const [dsFits, setDsFits] = useState(true);

  const included = (arr: Asset[]) =>
    arr.filter((a) => a.isIncludedInTotal === "Y");
  const groupAssets: Record<GroupKey, Asset[]> = {
    cash: included(accounts),
    invest: included(investments),
  };
  const groupLabel = (k: GroupKey) =>
    k === "cash" ? t("group.cashDeposit") : t("group.invest");
  const sumKrw = (arr: Asset[]) => arr.reduce((s, a) => s + krwOf(a), 0);

  const groupSlices: Slice[] = (["cash", "invest"] as GroupKey[])
    .map((k) => ({
      id: k,
      name: groupLabel(k),
      amount: sumKrw(groupAssets[k]),
      saved: null,
      groupKey: k,
    }))
    .filter((s) => s.amount > 0);
  const drillSlices: Slice[] = active
    ? groupAssets[active]
        .map((a) => ({
          id: String(a.rowId),
          name: a.institution
            ? `${a.institution} · ${a.assetName}`
            : a.assetName,
          amount: krwOf(a),
          saved: chartColorOf(a.color),
        }))
        .filter((s) => s.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : [];
  const base = active ? drillSlices : groupSlices;
  const slices = assignChartColors(base, {
    colorOf: (s) => s.saved,
    groupOthers: (rest) => ({
      id: "others",
      name: t("common:others"),
      amount: rest.reduce((a, c) => a + c.amount, 0),
      saved: null,
    }),
  });
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const totalLabel = active ? groupLabel(active) : t("assetTotal");
  const totalText = m(won(total));
  const pct = (v: number) =>
    formatPercent((v / Math.max(1, total)) * 100, "share");

  const debts = active
    ? []
    : [
        { key: "card", name: t("group.card"), list: cards },
        { key: "loan", name: t("assetType.loan"), list: loans },
      ]
        .map((d) => ({ ...d, amount: Math.abs(sumKrw(included(d.list))) }))
        .filter((d) => d.amount > 0);

  const showCenter = decisionFits && total > 0;
  const showRow = !showCenter || !dsFits;
  const legendId = "asset-composition-legend";
  const chartName = t("chart.compositionName", {
    label: totalLabel,
    amount: totalText,
  });

  return (
    <>
      <BandHead
        title={active ? groupLabel(active) : t("composition")}
        band={false}
        aside={
          <HeadNote>
            {t("date:asOf", { date: formatMonthDay(new Date()) })}
          </HeadNote>
        }
        action={
          active
            ? { label: t("backToComposition"), onClick: () => setActive(null) }
            : undefined
        }
      />
      {slices.length === 0 ? (
        <CardContent className="gap-0">
          <BandEmpty>{active ? t("noItems") : t("noAssetData")}</BandEmpty>
        </CardContent>
      ) : (
        <CardContent className="gap-0">
          <div className="relative flex items-start gap-x8">
            <span
              ref={measureRef}
              aria-hidden
              className="pointer-events-none invisible absolute whitespace-nowrap text-t5 font-bold tabular-nums"
            >
              {totalText}
            </span>
            <Chart
              label={chartName}
              legendId={legendId}
              height={SIZE}
              className="w-[180px] shrink-0"
            >
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  {...chartDonutRadii(SIZE)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      valueFormatter={(v) => m(won(Number(v)))}
                    />
                  }
                />
              </PieChart>
              {showCenter && (
                <ChartDonutCenter
                  label={totalLabel}
                  amount={totalText}
                  onFitChange={setDsFits}
                />
              )}
            </Chart>
            <div className="min-w-0 flex-1">
              {showRow && (
                <div
                  data-slot="asset-donut-total"
                  className="flex items-baseline justify-between gap-x3"
                >
                  <span className="text-t3 text-fg-neutral-subtle">
                    {totalLabel}
                  </span>
                  <span className="min-w-0 text-end text-t5 font-bold tabular-nums text-fg-neutral">
                    {withCommaBreaks(totalText)}
                  </span>
                </div>
              )}
              <ChartDonutLegend
                id={legendId}
                items={slices.map((s) => ({
                  key: s.id,
                  label: s.name,
                  color: s.color,
                  percent: pct(s.amount),
                  amount: m(won(s.amount)),
                  onClick: s.groupKey
                    ? () => setActive(s.groupKey as GroupKey)
                    : undefined,
                }))}
              />
              {debts.length > 0 && (
                <div data-slot="asset-donut-debts" className="mt-x4">
                  <h3 className="m-0 text-t4 font-bold text-fg-neutral">
                    {t("debt")}
                  </h3>
                  <ul className="m-0 list-none p-0">
                    {debts.map((d) => (
                      <li
                        key={d.key}
                        className="flex min-h-11 items-center justify-between gap-x2 text-t4"
                      >
                        <span className="min-w-0 text-fg-neutral">
                          {d.name}
                        </span>
                        <b className="shrink-0 text-end tabular-nums text-fg-neutral">
                          {withCommaBreaks(m(MINUS + won(d.amount)))}
                        </b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <ChartDataTable
            caption={chartName}
            columns={[
              t("chart.tableGroup"),
              t("chart.tablePercent"),
              t("chart.tableAmount"),
            ]}
            rows={[
              ...slices.map((s) => [s.name, pct(s.amount), m(won(s.amount))]),
              ...debts.map((d) => [
                `${t("debt")} · ${d.name}`,
                "",
                m(MINUS + won(d.amount)),
              ]),
            ]}
          />
        </CardContent>
      )}
    </>
  );
}

export function CompositionSection({ g }: { g: AssetGroups }) {
  const { t } = useTranslation("asset");
  if (g.assetsFailed) {
    return (
      <>
        <BandHead title={t("composition")} band={false} />
        <CardContent className="gap-0">
          <BandFailure
            title={t("loadFailed.composition")}
            onRetry={g.retryAssets}
            band={false}
          />
        </CardContent>
      </>
    );
  }
  if (g.assetsLoading) {
    return (
      <>
        <BandHead
          title={t("composition")}
          band={false}
          aside={
            <HeadNote>
              {t("date:asOf", { date: formatMonthDay(new Date()) })}
            </HeadNote>
          }
        />
        <CardContent className="gap-0">
          <LoadingRegion
            pending
            className="contents"
            fallback={
              <>
                <div className="flex items-start gap-x8">
                  <Skeleton radius="full" className="size-[180px] shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex min-h-11 items-center gap-x2"
                      >
                        <Skeleton radius="4" className="size-2.5 shrink-0" />
                        <Skeleton text="t4" className="min-w-0 flex-1" />
                        <Skeleton text="t4" className="w-x10 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            }
          />
        </CardContent>
      </>
    );
  }
  return (
    <AssetCompositionCard
      accounts={g.accounts}
      investments={g.investments}
      cards={g.cards}
      loans={g.loans}
    />
  );
}

// ── 다가오는 청구(데스크톱) ─────────────────────────────────────
/** 다가오는 청구(59) — 목록 카드. 줄 = 제목 · 날짜 설명 · 뒤 금액, 머리 오른쪽 "전체 보기" 글 버튼 */
export function UpcomingBillsSection() {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.upcoming");
  const navigate = useNavigate();
  // 백엔드에서 EXPENSE·활성·nextDate>=today 필터 + limit 6 — 프론트 필터 불필요.
  const recurringQ = useRecurringTransactions({ upcoming: true, limit: 6 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = (recurringQ.data ?? [])
    .filter((r) => !!r.nextExecutionDate)
    .map((r) => {
      const next = parseLocalDate(r.nextExecutionDate as string) ?? today;
      const daysLeft = Math.round(
        (next.getTime() - today.getTime()) / 86_400_000,
      );
      return {
        rowId: r.rowId,
        title: r.description || r.merchant || r.categoryName,
        amount: r.amount,
        daysLeft,
        dateLabel: formatMonthDay(next),
      };
    });

  const goToSettings = (rowId?: number) => {
    const params = new URLSearchParams({ tab: "settings", sub: "recurring" });
    if (rowId) params.set("recurringId", String(rowId));
    navigate(`/desk/expense?${params.toString()}`);
  };
  const head = (
    <BandHead
      title={t("upcomingBills")}
      band={false}
      list
      action={{ label: t("viewAll"), onClick: () => goToSettings() }}
    />
  );
  if (loadFailed(recurringQ)) {
    return (
      <>
        {head}
        <div className="px-x6 pb-x3">
          <BandFailure
            title={t("loadFailed.upcoming")}
            onRetry={() => void recurringQ.refetch()}
            band={false}
          />
        </div>
      </>
    );
  }
  if (recurringQ.isLoading) {
    return (
      <>
        {head}
        <LoadingRegion
          pending
          className="contents"
          fallback={
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
                  <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
                    <Skeleton text="t5" className="w-1/2" />
                    <Skeleton text="t3" className="w-1/3" />
                  </div>
                  <Skeleton text="t5" className="w-x10 shrink-0" />
                </div>
              ))}
            </>
          }
        />
      </>
    );
  }
  if (items.length === 0) {
    return (
      <>
        {head}
        <div className="px-x6 pb-x3">
          <BandEmpty>{t("noUpcomingBills")}</BandEmpty>
        </div>
      </>
    );
  }
  return (
    <>
      {head}
      <List aria-label={t("upcomingBills")}>
        {items.map((it) => (
          <ListButtonItem
            key={it.rowId}
            title={it.title}
            detail={
              <span
                className={it.daysLeft <= 3 ? "text-fg-critical" : undefined}
              >
                {it.daysLeft <= 0
                  ? t("date:today")
                  : t("date:daysLater", { count: it.daysLeft })}{" "}
                · {it.dateLabel}
              </span>
            }
            suffix={
              <span className="text-t5 font-bold tabular-nums text-fg-neutral">
                {m(MINUS + won(it.amount))}
              </span>
            }
            onClick={() => goToSettings(it.rowId)}
          />
        ))}
      </List>
    </>
  );
}

// ── 자산 묶음 ───────────────────────────────────────────────────
export function GroupSection({
  place,
  title,
  card,
  assets,
  total,
  negativeTotal = false,
  onOpenDetail,
  investValMap,
  g,
}: {
  place: Placement;
  title: string;
  card: HideCardKey;
  assets: Asset[];
  total: number;
  negativeTotal?: boolean;
  onOpenDetail: (asset: Asset) => void;
  investValMap?: Map<number, InvestValuation>;
  g: AssetGroups;
}) {
  const { t } = useTranslation("asset");
  const m = useAssetMask(card);
  const band = place === "band";
  const head = (
    <BandHead
      title={title}
      band={band}
      list
      aside={
        g.assetsLoading || g.assetsFailed ? undefined : (
          <span className="shrink-0 text-end text-t5 font-bold tabular-nums text-fg-neutral">
            {withCommaBreaks(
              m(negativeTotal && total !== 0 ? MINUS + won(total) : won(total)),
            )}
          </span>
        )
      }
    />
  );
  if (g.assetsFailed) {
    return (
      <>
        {head}
        <div className={band ? "pb-x6" : "px-x6 pb-x3"}>
          <BandFailure
            title={t("loadFailed.assets")}
            onRetry={g.retryAssets}
            band={band}
          />
        </div>
      </>
    );
  }
  if (g.assetsLoading) {
    return (
      <>
        {head}
        <GroupRowsSkeleton rows={3} band={band} />
      </>
    );
  }
  if (assets.length === 0) {
    return (
      <>
        {head}
        <div className={cn("px-x6", band ? "pb-x6" : "pb-x3")}>
          <BandEmpty>{t("noItems")}</BandEmpty>
        </div>
      </>
    );
  }
  // 이 카드에 연동 투자 자산이 있는데 시세를 못 받았다 — 금액은 DB 잔액 · 옛 시세 그대로 두고 띠 한 줄(단계 4)
  const priceFail =
    g.priceFailed && assets.some((a) => g.linkedIds.has(a.rowId));
  return (
    <>
      {head}
      {priceFail && (
        <PriceStaleCallout
          band={band}
          shows={g.priceFailShows ?? "lastPrice"}
          retrying={g.pricesRetrying}
          onRetry={g.retryPrices}
          className={band ? "pb-x2" : "px-x6 pb-x2"}
        />
      )}
      <List aria-label={title} className={band ? "pb-x3" : undefined}>
        {assets.map((a) => (
          <AssetRow
            key={a.rowId}
            asset={a}
            card={card}
            onOpenDetail={onOpenDetail}
            investVal={investValMap?.get(a.rowId) ?? null}
          />
        ))}
      </List>
    </>
  );
}

function formatDeadline(deadline: string | null): string | null {
  const d = parseLocalDate(deadline);
  if (!d) return null;
  return formatYearMonth(d);
}

/**
 * 저축 목표 줄(60) — 앞 타일 40(모서리 12 · 옅은 색 바탕 · 아이콘 20) · 제목(+ 달성 배지) · 설명 "{기한} · {현재 원} / {목표 원}"(원까지, 줄임 없음) ·
 * 뒤 % · 아래 Progress goal 막대. 조회 전용 — 추가 · 수정 · 삭제는 설정 > 저축 목표.
 */
export function SavingGoalItem({ goal }: { goal: SavingGoal }) {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.savingGoals");
  const pct =
    goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  // 다크에서 light variant 로 스왑되도록 팔레트 헬퍼를 통과시킨다(앱 resolveChartColor 정합).
  const palette = getPaletteByColor(goal.color);
  // 저장된 아이콘 이름이 lucide 카탈로그에 없을 수 있다 — API 로 이모지도 들어온다.
  // 검사 없이 DynamicIcon 에 넘기면 렌더마다 console.error 가 쌓였다(QA #95).
  const iconName =
    goal.icon && goal.icon.trim().length > 0 ? goal.icon : "piggy-bank";
  const amounts = `${won(goal.currentAmount)} / ${won(goal.targetAmount)}`;
  return (
    <BarredItem
      row={
        <ListItem
          as="div"
          align="top"
          prefix={
            <ListTile style={{ background: palette.bg, color: palette.color }}>
              {isIconName(iconName) ? (
                <DynamicIcon name={iconName} size={20} />
              ) : (
                <Target size={20} />
              )}
            </ListTile>
          }
          title={
            <>
              {goal.title}
              {goal.isAchieved === "Y" && (
                <Badge
                  variant="weak"
                  tone="positive"
                  size="medium"
                  className="ml-x1_5 align-middle"
                >
                  {t("achieved")}
                </Badge>
              )}
            </>
          }
          detail={`${formatDeadline(goal.deadlineDate) ?? t("savingGoal.noDeadline")} · ${m(amounts)}`}
          suffix={
            <span className="text-t5 font-bold tabular-nums text-fg-neutral">
              {formatPercent(pct, "progress")}
            </span>
          }
        />
      }
      bar={
        <MeterBar
          label={goal.title}
          value={goal.currentAmount}
          max={goal.targetAmount}
          meaning="goal"
          formatValue={(n) => m(won(n))}
        />
      }
    />
  );
}

/** 저축 목표 구역 — 머리 오른쪽 "전체 보기"(설정 > 저축 목표로, 목적지 그대로) */
export function SavingGoalsSection({ place }: { place: Placement }) {
  const { t } = useTranslation("asset");
  const navigate = useNavigate();
  const goalsQ = useSavingGoals();
  const band = place === "band";
  const goals = goalsQ.data?.goals ?? [];
  const head = (
    <BandHead
      title={t("savingGoals")}
      band={band}
      list
      action={{
        label: t("viewAll"),
        onClick: () => navigate("/desk/settings?section=goals"),
      }}
    />
  );
  if (loadFailed(goalsQ)) {
    return (
      <>
        {head}
        <div className={band ? "pb-x6" : "px-x6 pb-x3"}>
          <BandFailure
            title={t("loadFailed.goals")}
            onRetry={() => void goalsQ.refetch()}
            band={band}
          />
        </div>
      </>
    );
  }
  if (goalsQ.isLoading) {
    return (
      <>
        {head}
        <LoadingRegion
          pending
          className="contents"
          fallback={
            <>
              <div className={band ? "pb-x3" : undefined}>
                {[0, 1].map((i) => (
                  <div key={i}>
                    <div className="flex items-center gap-x3 px-x6 py-x3">
                      <Skeleton radius="12" className="size-x10 shrink-0" />
                      <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
                        <Skeleton text="t5" className="w-1/2" />
                        <Skeleton text="t3" className="w-1/3" />
                      </div>
                      <Skeleton text="t5" className="w-x10 shrink-0" />
                    </div>
                    <div className="px-x6 pb-x3 pt-x1">
                      <Skeleton className="h-2 w-full" radius="full" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          }
        />
      </>
    );
  }
  if (goals.length === 0) {
    return (
      <>
        {head}
        <div className={cn("px-x6", band ? "pb-x6" : "pb-x3")}>
          <BandEmpty>{t("manageGoalsPrompt")}</BandEmpty>
        </div>
      </>
    );
  }
  return (
    <>
      {head}
      <List
        aria-label={t("savingGoals")}
        className={band ? "pb-x3" : undefined}
      >
        {goals.map((goal) => (
          <SavingGoalItem key={goal.rowId} goal={goal} />
        ))}
      </List>
    </>
  );
}

// ── 빈 화면 ─────────────────────────────────────────────────────
/** 빈 화면(61) — Result Section empty "처음" 갈래: 폰은 띠 안 large, 데스크톱은 카드 안 medium. 첫 버튼은 계좌 · 카드 관리로 */
export function AssetEmpty({ size }: { size: "large" | "medium" }) {
  const { t } = useTranslation("asset");
  const navigate = useNavigate();
  return (
    <ResultSection
      kind="empty"
      size={size}
      icon={<Landmark aria-hidden />}
      title={t("emptyTitle")}
      description={t("emptyDesc")}
      primaryAction={{
        label: t("emptyCta"),
        onClick: () => navigate("/desk/settings?section=accounts"),
      }}
    />
  );
}
