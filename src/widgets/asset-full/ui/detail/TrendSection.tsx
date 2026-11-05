import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Chart,
  ChartDataTable,
  ChartTooltip,
  ChartTooltipContent,
  chartAxisProps,
  chartGridProps,
  formatAxisWon,
} from "@/shared/ds/chart";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { Skeleton } from "@/shared/ds/skeleton";
import { useAxisWidth } from "@/shared/lib/groo/axisWidth";
import { niceAxis } from "@/shared/lib/groo/chartAxis";
import { MASK, won } from "@/shared/lib/groo/money-text";
import { BandFailure, ListTitle } from "@/shared/ui/groo/band-parts";
import { useAssetBalanceTrend } from "@/features/asset";
import type { Asset } from "@/entities/asset";
import { useAssetHidden } from "../../lib/asset-groups";
import type { AssetDetailModel } from "./use-asset-detail";

type Period = "3m" | "6m" | "1y";
const WEEKS: Record<Period, number> = { "3m": 12, "6m": 24, "1y": 52 };

/**
 * 잔액 추이(I-17 48) — 목록 제목 "최근 {12주} {잔액 추이}" + ds Segmented Control(3개월 · 6개월 · 1년) + ds Chart 선.
 * 05-3 순자산 추이 차트와 한 변형이다: 선 2 + 데이터 점마다 점(지름 6) · 채움 없음 · 가로 격자 점선 · 가리킴 선 · 툴팁 원까지 · U+2212.
 * 높이는 폰 140 · 데스크톱 180. 눈금 글은 가장 긴 글자를 재서 폭을 잡아 잘리지 않는다(음수 "−3억"). 금액을 가리면 눈금 · 툴팁이 "••••".
 */
export function TrendSection({
  asset,
  model,
  desk,
  first,
}: {
  asset: Asset;
  model: AssetDetailModel;
  desk: boolean;
  first?: boolean;
}) {
  const { t } = useTranslation("asset");
  const [period, setPeriod] = useState<Period>("3m");
  const weeks = WEEKS[period];
  const trendQ = useAssetBalanceTrend(asset.rowId, weeks, { silent: true });
  const hidden = useAssetHidden("asset.detail", asset.isAmountHidden === "Y");
  const data = (trendQ.data ?? []).map((p, i) => ({
    label: t("assetDetail.weekLabel", { n: i + 1 }),
    weekStart: p.weekStart,
    // 원화 합계(서버 balanceInKrw — 줄 · 상세 큰 금액과 같은 한 식, I-13 길 A). 옛 서버면 balance
    balance: p.balanceInKrw ?? p.balance,
  }));
  // Y축: 0 기준 nice 눈금 — 음수 잔액(대출)도 0 아래로 확장
  const vals = data.map((d) => d.balance);
  const yAxis = niceAxis(Math.min(0, ...vals), Math.max(0, ...vals));
  const tick = (v: number) => (hidden ? MASK : formatAxisWon(v));
  const axisWidth = useAxisWidth(yAxis.ticks.map(tick));
  const height = desk ? 180 : 140;
  const seriesLabel = model.isCard
    ? t("assetDetail.seriesUsage")
    : model.isInv
      ? t("assetDetail.seriesValuation")
      : t("assetDetail.seriesBalance");
  const kindLabel = model.isCard
    ? t("assetDetail.trendUsage")
    : model.isInv
      ? t("assetDetail.trendValuation")
      : t("assetDetail.trendBalance");
  const titleId = `asset-trend-${asset.rowId}`;
  const title = t("assetDetail.recentTrend", {
    period: t("assetDetail.weekLabel", { n: weeks }),
    label: kindLabel,
  });

  let body;
  if (trendQ.isLoading) {
    body = <Skeleton className="w-full" radius="8" style={{ height }} />;
  } else if (trendQ.isError && !trendQ.data) {
    body = (
      <BandFailure
        title={t("assetDetail.trendLoadFailed")}
        onRetry={() => void trendQ.refetch()}
      />
    );
  } else if (data.length === 0) {
    body = (
      <div
        className="flex items-center justify-center text-t4 text-fg-neutral-subtle"
        style={{ height }}
      >
        {t("assetDetail.noData")}
      </div>
    );
  } else {
    const latest = data[data.length - 1]!.balance;
    const summary = `${title}, ${hidden ? MASK : won(latest)}`;
    body = (
      <>
        <Chart
          label={summary}
          height={height}
          className="[&_.recharts-line-dots]:block"
        >
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={18}
              {...chartAxisProps()}
            />
            <YAxis
              tickSize={0}
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
              dataKey="balance"
              name={seriesLabel}
              stroke="var(--color-chart-blue)"
              dot={{ r: 3, fill: "var(--color-chart-blue)", strokeWidth: 0 }}
            />
          </LineChart>
        </Chart>
        <ChartDataTable
          caption={summary}
          columns={[t("assetDetail.tableWeek"), seriesLabel]}
          rows={data.map((d) => [d.label, hidden ? MASK : won(d.balance)])}
        />
      </>
    );
  }
  return (
    <section data-slot="asset-detail-trend" aria-labelledby={titleId}>
      <ListTitle id={titleId} first={first}>
        {title}
      </ListTitle>
      <div className="px-global-gutter py-x1">
        <div className="w-max max-w-full">
          <SegmentedControl
            aria-label={t("assetDetail.periodAria")}
            value={period}
            onValueChange={(v) => setPeriod(v as Period)}
          >
            <SegmentedControlItem value="3m">
              {t("assetDetail.period3m")}
            </SegmentedControlItem>
            <SegmentedControlItem value="6m">
              {t("assetDetail.period6m")}
            </SegmentedControlItem>
            <SegmentedControlItem value="1y">
              {t("assetDetail.period1y")}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>
      <div className="px-global-gutter pt-x2">{body}</div>
    </section>
  );
}
