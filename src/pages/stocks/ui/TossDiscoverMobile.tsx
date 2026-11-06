import { isHardError, isStaleError } from "@/features/stock/lib/query-state";
import { PriceStaleCallout } from "@/features/stock/ui/phone/price-fail-band";
import { useMemo, useState } from "react";
import { amountText } from "@/features/stock/lib/amount-text";
import { useTranslation } from "react-i18next";
import { List } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { ChartNoAxesColumn } from "lucide-react";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { num } from "@/features/stock/lib/format";
import {
  LineSkeletons,
  StockLine,
} from "@/features/stock/ui/phone/phone-parts";
import {
  useTossRankings,
  useTossStockInfo,
} from "@/features/stock/model/useTossStocks";

type Kind = "gainers" | "losers" | "volume";
type Market = "KR" | "US";

/**
 * 발견 탭(I-13 10) — 유형 Segmented(급상승 · 급하락 · 거래량) 아래 8 에 시장 Segmented(국내 · 미국), 그 아래 순위 줄.
 * 그림에는 유형 하나만 있지만 시장 거르기도 지금 있는 기능이라 남긴다(S). 순위 응답엔 이름이 없어 종목 정보를 배치로 조회한다.
 */
export function TossDiscoverMobile({
  onOpen,
}: {
  onOpen: (symbol: string) => void;
}) {
  const { t } = useTranslation("stocks");
  const [market, setMarket] = useState<Market>("KR");
  const [kind, setKind] = useState<Kind>("gainers");
  const type =
    kind === "gainers"
      ? "TOP_GAINERS"
      : kind === "losers"
        ? "TOP_LOSERS"
        : "MARKET_TRADING_VOLUME";
  // 급상승 · 급하락은 실시간 미지원 → 1d, 거래량은 실시간
  const duration = kind === "volume" ? "realtime" : "1d";
  const q = useTossRankings(type, market, duration, { count: 10 });
  const rankings = useMemo(() => q.data?.rankings ?? [], [q.data]);
  const infoQ = useTossStockInfo(rankings.map((r) => r.symbol));
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of infoQ.data ?? []) map.set(i.symbol, i.name);
    return map;
  }, [infoQ.data]);

  return (
    <>
      <div className="flex flex-col gap-x2 px-x6 pb-x2 pt-x1">
        <SegmentedControl
          aria-label={t("discover.kindAria")}
          value={kind}
          onValueChange={(v) => setKind(v as Kind)}
        >
          <SegmentedControlItem value="gainers">
            {t("discover.gainers")}
          </SegmentedControlItem>
          <SegmentedControlItem value="losers">
            {t("discover.losers")}
          </SegmentedControlItem>
          <SegmentedControlItem value="volume">
            {t("discover.volume")}
          </SegmentedControlItem>
        </SegmentedControl>
        <SegmentedControl
          aria-label={t("discover.marketAria")}
          value={market}
          onValueChange={(v) => setMarket(v as Market)}
        >
          <SegmentedControlItem value="KR">
            {t("market.krShort")}
          </SegmentedControlItem>
          <SegmentedControlItem value="US">
            {t("market.usShort")}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
      {/* 받아 둔 순위가 있는 채 다시 받기(60초)가 실패했다 — 순위는 두고 띠 한 줄(단계 4) */}
      {isStaleError(q) && (
        <PriceStaleCallout
          onRetry={() => void q.refetch()}
          retrying={q.isFetching}
          className="pb-x2"
        />
      )}
      {q.isLoading ? (
        <LineSkeletons rows={10} label={t("discover.loading")} />
      ) : isHardError(q) ? (
        <BandFailure
          band
          title={t("discover.failTitle")}
          onRetry={() => void q.refetch()}
        />
      ) : rankings.length === 0 ? (
        <ResultSection
          kind="empty"
          size="medium"
          as="h3"
          icon={<ChartNoAxesColumn aria-hidden />}
          title={t("discover.empty")}
        />
      ) : (
        <List aria-label={t("segments.discover")}>
          {rankings.map((r) => {
            const last = num(r.price.lastPrice);
            const pct =
              r.price.changeRate != null ? num(r.price.changeRate) * 100 : null;
            return (
              <StockLine
                key={r.symbol}
                rank={r.rank}
                name={nameOf.get(r.symbol) ?? r.symbol}
                detail={r.symbol}
                amount={last > 0 ? amountText(last, r.currency) : null}
                pct={pct}
                onClick={() => onOpen(r.symbol)}
              />
            );
          })}
        </List>
      )}
    </>
  );
}
