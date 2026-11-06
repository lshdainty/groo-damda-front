import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Pie, PieChart } from "recharts";
import {
  Chart,
  ChartDonutCenter,
  assignChartColors,
  chartDonutRadii,
} from "@/shared/ds/chart";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { List, ListItem } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { ChartPie } from "lucide-react";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { cn } from "@/shared/lib/cn";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";

/*
 * 포트폴리오 구성 본문(I-13 19) — 도넛 112 가운데(가운데 글 "{n}종목") + 아래 12 에 범례 줄.
 * 범례는 List 키-값 줄: 앞 색 칸 10(모서리 2) + 종목 이름(줄바꿈) · 값 비중 "98.95%".
 * 도넛은 ds Chart(자산 구성 도넛과 같은 길 — Pie + chartDonutRadii · 가운데 ChartDonutCenter, chart.md). 두께는 지름을 따른다(112 → 17 · 120 → 18).
 * 색은 차트 색 배정 순서(assignChartColors). 환율이 없어 비중을 못 내면 도넛 대신 Result Section empty small.
 */

export interface CompositionView {
  items: { key: string; name: string; pct: number }[];
  /** 비중을 낼 수 없는 이유(환율 없음) — 있으면 도넛 대신 이 글 */
  notice?: string;
}

const pctText = (n: number) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

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
  const colored = assignChartColors(data.items);
  const size = side ? 120 : 112;
  const count = t("unit.stocksCount", { count: colored.length });
  const donut = (
    <Chart
      label={`${t("portfolio.title")} — ${colored
        .map((c) => `${c.name} ${pctText(c.pct)}`)
        .join(" · ")}`}
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
  const legend = (
    <List
      id={legendId}
      className={side ? "min-w-0 flex-1" : "mt-x3"}
      aria-label={t("portfolio.title")}
    >
      {colored.map((c) => (
        <ListItem
          key={c.key}
          className="[&_[data-slot=list-content]]:py-x2"
          prefix={
            <span
              aria-hidden
              className="block size-2.5 rounded-[2px]"
              style={{ background: c.fill }}
            />
          }
          title={c.name}
          suffix={
            <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
              <MaskAmount card="stocks.summary">
                {withCommaBreaks(pctText(c.pct))}
              </MaskAmount>
            </span>
          }
        />
      ))}
    </List>
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
