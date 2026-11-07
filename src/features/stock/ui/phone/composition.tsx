import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Pie, PieChart } from "recharts";
import {
  Chart,
  ChartDonutCenter,
  ChartDonutLegend,
  assignChartColors,
  chartDonutRadii,
  formatWon,
} from "@/shared/ds/chart";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { ChartPie } from "lucide-react";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { cn } from "@/shared/lib/cn";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { formatPercent } from "@/shared/lib/groo/format";

/*
 * 포트폴리오 구성 본문(I-13 19) — 도넛 112 가운데(가운데 글 "{n}종목") + 아래 12 에 범례 줄.
 * 범례는 자산 구성 도넛과 같은 ds ChartDonutLegend — 색 칸 10 · 종목 이름 · 비중 "98.95%" · 원화 환산 평가액(원까지, 자르지 않음).
 * 도넛은 ds Chart(자산 구성 도넛과 같은 길 — Pie + chartDonutRadii · 가운데 ChartDonutCenter, chart.md). 두께는 지름을 따른다(112 → 17 · 120 → 18).
 * 색은 차트 색 배정 순서(assignChartColors). 환율이 없어 비중을 못 내면 도넛 대신 Result Section empty small.
 */

export interface CompositionView {
  items: { key: string; name: string; pct: number; krwValue: number }[];
  /** 비중을 낼 수 없는 이유(환율 없음) — 있으면 도넛 대신 이 글 */
  notice?: string;
}

const pctText = (n: number) => formatPercent(n, "share");

export function CompositionBody({
  data,
  loading,
  failed,
  onRetry,
  side,
  titled,
}: {
  data: CompositionView;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** 768 ~ 1279 카드(13-2 29) — 도넛 120 을 왼쪽, 범례를 오른쪽에 둔다(사이 24). 1280 오른쪽 열 · 폰은 세로 */
  side?: boolean;
  /** 위에 카드 머리(제목)가 있다 — 도넛 위를 12 로 줄인다(머리 아래 4 + 12) */
  titled?: boolean;
}) {
  const { t } = useTranslation("stocks");
  const { t: tc } = useTranslation("common");
  const legendId = useId();
  if (failed)
    return (
      <div className="py-x6">
        <BandFailure
          band
          title={t("portfolio.failTitle")}
          onRetry={onRetry ?? (() => {})}
        />
      </div>
    );
  if (loading)
    return (
      <div aria-busy className="flex flex-col items-center gap-x3 px-x6 py-x6">
        <Skeleton radius="full" className="size-28" />
        <Skeleton text="t5" className="w-full" />
        <Skeleton text="t5" className="w-full" />
      </div>
    );
  if (data.notice)
    return (
      <div className="px-x6 py-x6">
        <ResultSection
          kind="empty"
          size="medium"
          as="h3"
          icon={<ChartPie aria-hidden />}
          title={data.notice}
        />
      </div>
    );
  if (data.items.length === 0)
    return (
      <div className="px-x6 py-x6">
        <ResultSection
          kind="empty"
          size="medium"
          as="h3"
          icon={<ChartPie aria-hidden />}
          title={t("holdings.empty")}
        />
      </div>
    );
  // 10개를 넘으면 상위 9 + "그 밖" 하나(회색) — 자산 구성 도넛과 같다(assignChartColors · chart.md). 항목은 큰 순서로 온다(composition())
  const colored = assignChartColors(data.items, {
    groupOthers: (rest) => ({
      key: "others",
      name: tc("others"),
      pct: rest.reduce((a, c) => a + c.pct, 0),
      krwValue: rest.reduce((a, c) => a + c.krwValue, 0),
    }),
  });
  const size = side ? 120 : 112;
  const count = t("unit.stocksCount", { count: data.items.length });
  const donut = (
    <Chart
      // 이름은 제목만 — 비중 · 금액은 금액 가리기를 따르는 범례가 aria-describedby 로 읽는다(통계 도넛과 같다).
      // 이름에 원값을 넣으면 가리기를 켜도 화면 읽기가 비중을 읽는다(I-wrap-b1 ε 검수 M2)
      label={t("portfolio.title")}
      legendId={legendId}
      height={size}
      style={{ width: size }}
    >
      <PieChart>
        <Pie
          data={colored}
          dataKey="pct"
          nameKey="name"
          {...chartDonutRadii(size)}
        />
      </PieChart>
      <ChartDonutCenter amount={count} />
    </Chart>
  );
  // 자산 구성 도넛과 같은 범례 한 벌(chart.md 도넛 범례) — 비중 · 금액은 금액 가리기를 따른다
  const legend = (
    <ChartDonutLegend
      id={legendId}
      aria-label={t("portfolio.title")}
      className={side ? "min-w-0 flex-1 pr-x6" : "mt-x3 px-x6"}
      items={colored.map((c) => ({
        key: c.key,
        label: c.name,
        color: c.color,
        percent: (
          <MaskAmount card="stocks.summary">{pctText(c.pct)}</MaskAmount>
        ),
        amount: (
          <MaskAmount card="stocks.summary">{formatWon(c.krwValue)}</MaskAmount>
        ),
      }))}
    />
  );
  if (side)
    return (
      <div
        className={cn(
          "flex items-center gap-x6 pb-x6 pl-x6",
          titled ? "pt-x3" : "pt-x6",
        )}
      >
        <div className="shrink-0">{donut}</div>
        {legend}
      </div>
    );
  return (
    <div className={cn("pb-x6", titled ? "pt-x3" : "pt-x6")}>
      <div className="flex justify-center px-x6">{donut}</div>
      {legend}
    </div>
  );
}
