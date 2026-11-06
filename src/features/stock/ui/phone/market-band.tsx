import { useTranslation } from "react-i18next";
import { List, ListItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { PriceFailBand } from "./price-fail-band";
import { BandTitle, PctDelta } from "./phone-parts";

/*
 * 띠 ② 시장(I-13 9) — 구역 제목 · 장 상태 줄 · 지수 줄 · 환율 줄.
 * 장 상태 줄: ● 국내 장마감   ● 미국 개장 22:30 — t4 · 점 6 · 열림 fg-positive / 닫힘 stroke-neutral-solid, 줄바꿈 허용.
 * 나무는 지수 줄이 없다(`indices` 비움) — 장 상태 줄(대표 종목의 장 상태) + 환율 줄만 있고, 다른 증권사를 권하는 글 · 빈 자리를 두지 않는다.
 * 지수 줄은 추이선이 있는 짧은 줄이라 위아래 10(List 12 와 다르다 — 그림 값). 모르는 심볼은 그리지 않는다.
 */

export interface MarketState {
  key: string;
  name: string;
  open: boolean;
  /** 이미 번역한 상태 글 — "장마감" · "개장 오후 10:30"(한국 시각). 달력이 아직이면(pending) 비어 있다 */
  label: string;
  /** 달력을 아직 못 받았다 — 글 자리에 Skeleton. 못 받고 실패했으면 이 칸을 부르는 쪽이 아예 빼서 넘긴다 */
  pending?: boolean;
}

export interface IndexLine {
  symbol: string;
  name: string;
  value: string;
  series?: number[];
  /** 그 구간 시작 대비 % — 추이선 색 · 증감 */
  trendPct: number | null;
}

export interface FxLine {
  /** 이미 만든 값 글 — "1,385.20원". 못 구했으면 null("환율 없음") */
  value: string | null;
  /** 값 자리만 Skeleton */
  loading?: boolean;
  /** 설명 — "매매기준율" */
  base: string;
}

/** 지수 추이선 — 56 × 20 · 선 1.5(점 없음). 색은 부르는 쪽이 정한다 */
function IndexSpark({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = 56 / (values.length - 1);
  const pts = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(18 - ((v - min) / range) * 16).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox="0 0 56 20"
      width={56}
      height={20}
      className="block shrink-0"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const lineColor = (pct: number | null) =>
  pct != null && pct < 0
    ? "var(--color-fg-informative)"
    : "var(--color-fg-critical)";

export function MarketBand({
  markets,
  statesLoading,
  indices,
  fx,
  loading,
  failed,
  onRetry,
  priceFailed,
  onRetryPrice,
}: {
  markets: MarketState[];
  /** 장 상태 줄을 기다리는 중(나무 — 대표 종목 시세가 오기 전) — 줄 자리에 값 Skeleton */
  statesLoading?: boolean;
  indices: IndexLine[];
  fx: FxLine | null;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** 받아 둔 지수 · 시세가 있는 채 다시 받기(폴링)가 실패했다 — 값은 두고 제목 아래 띠 한 줄(단계 4) */
  priceFailed?: boolean;
  onRetryPrice?: () => void;
}) {
  const { t } = useTranslation("stocks");
  return (
    <section aria-labelledby="stocks-market-title" data-section="market">
      <BandTitle id="stocks-market-title">{t("market.title")}</BandTitle>
      {!failed && priceFailed && (
        <PriceFailBand
          onRetry={onRetryPrice ?? onRetry ?? (() => {})}
          className="pb-x2"
        />
      )}
      {failed ? (
        <div className="pb-x6 pt-x3">
          <BandFailure
            band
            title={t("market.failTitle")}
            onRetry={onRetry ?? (() => {})}
          />
        </div>
      ) : (
        <div className="pb-x6">
          {statesLoading && markets.length === 0 && (
            <div
              aria-busy
              data-slot="market-states-loading"
              className="px-x6 pb-x1 pt-x1"
            >
              <Skeleton text="t4" className="w-48 max-w-full" />
            </div>
          )}
          {markets.length > 0 && (
            <ul
              className="m-0 flex list-none flex-wrap gap-x-x4 gap-y-x1 px-x6 pb-x1 pt-x1 text-t4 text-fg-neutral-subtle"
              data-slot="market-states"
            >
              {markets.map((m) => (
                <li key={m.key} className="flex items-center gap-x1_5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      m.open ? "bg-fg-positive" : "bg-stroke-neutral-solid",
                    )}
                  />
                  <span>
                    <b className="font-bold text-fg-neutral">{m.name}</b>{" "}
                    {m.pending ? (
                      <Skeleton
                        text="t4"
                        className="inline-block w-16 align-middle"
                        data-slot="market-state-pending"
                      />
                    ) : (
                      m.label
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <List aria-label={t("market.title")}>
            {loading
              ? [0, 1].map((i) => (
                  <ListItem
                    key={i}
                    title={<Skeleton text="t5" className="w-1/4" />}
                    className="[&_[data-slot=list-content]]:py-x2_5"
                    suffix={<Skeleton text="t5" className="w-20" />}
                  />
                ))
              : indices.map((i) => (
                  <ListItem
                    key={i.symbol}
                    // 지수 이름은 낱말 안에서 접히지 않는다(List 규칙: 본문 최소 폭 = 제목의 가장 긴 낱말) — 모자라면 추이선이 먼저 빠진다
                    title={
                      <span className="break-keep [overflow-wrap:normal]">
                        {i.name}
                      </span>
                    }
                    className="[&_[data-slot=list-content]]:py-x2_5"
                    suffix={
                      <span className="flex items-center gap-x3">
                        {i.series && i.series.length > 1 && (
                          <span className="flex @max-[16rem]/list-item:hidden">
                            <IndexSpark
                              values={i.series}
                              color={lineColor(i.trendPct)}
                            />
                          </span>
                        )}
                        <span className="flex flex-col items-end">
                          <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
                            {i.value}
                          </span>
                          <span className="mt-x0_5">
                            <PctDelta pct={i.trendPct} />
                          </span>
                        </span>
                      </span>
                    }
                  />
                ))}
            {fx && (
              <ListItem
                title={t("summary.fxRate")}
                detail={fx.base}
                className="[&_[data-slot=list-content]]:py-x2_5"
                suffix={
                  fx.loading ? (
                    <Skeleton text="t5" className="w-20" />
                  ) : fx.value == null ? (
                    <span className="text-end text-t4 text-fg-neutral-subtle">
                      {t("namu.fxUnavailableShort")}
                    </span>
                  ) : (
                    <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
                      {fx.value}
                    </span>
                  )
                }
              />
            )}
          </List>
        </div>
      )}
    </section>
  );
}
