import { useMemo, useState, type ReactNode } from "react";
import { amountText } from "@/features/stock/lib/amount-text";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { List } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { ChipTabsList, ChipTabsTrigger, Tabs } from "@/shared/ds/tabs";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { ScreenBands } from "@/shared/ui/groo/screen-bands";
import { formatChangeRate } from "@/shared/lib/groo/format";
import { useMasked, won } from "@/shared/lib/groo/money-text";
import { brokerPath } from "@/features/stock/lib/broker";
import { fmtByCurrency, fmtFxRate, num } from "@/features/stock/lib/format";
import { Skeleton } from "@/shared/ds/skeleton";
import { marketLookup } from "@/features/stock/lib/market-state";
import { isHardError, isStaleError } from "@/features/stock/lib/query-state";
import { visibleSymbols } from "@/features/stock/lib/watch-prices";
import { useWatchGroups } from "@/features/stock/api/watchlistApi";
import {
  useTossAccounts,
  useTossBuyingPower,
  useTossExchangeRate,
  useTossHoldings,
  useTossIndicatorCandles,
  useTossIndicatorPrices,
  useTossMarketCalendarKr,
  useTossMarketCalendarUs,
} from "@/features/stock/model/useTossStocks";
import { useTossWatchQuotes } from "@/features/stock/model/useWatchQuotes";
import { useVisibleIds } from "@/features/stock/model/useVisibleIds";
import type { WatchGroup } from "@/features/stock/api/stockApi";
import { Card } from "@/shared/ds/card";
import { InvestBand } from "@/features/stock/ui/phone/invest-band";
import {
  MarketBand,
  type IndexLine,
  type MarketState,
} from "@/features/stock/ui/phone/market-band";
import {
  BandTitle,
  DeltaText,
  LineSkeletons,
  SourceLine,
  StockLine,
} from "@/features/stock/ui/phone/phone-parts";
import { StockSearchEntry } from "@/features/stock/ui/phone/stock-search";
import {
  WatchGroupDeleteConfirm,
  WatchGroupForm,
  WatchGroups,
} from "@/features/stock/ui/phone/watch-groups";
import { DeskColumns, DeskFrame, DeskSlot } from "./desk/desk-frame";
import { CompositionCard, StocksCard } from "./desk/desk-cards";
import {
  composition,
  directionOf,
  directionOfPct,
  tossHoldingLines,
  tossInvestSummary,
} from "../model/invest";
import { TossDiscoverMobile } from "./TossDiscoverMobile";

/** 지수로 세울 것 — 토스 카탈로그 8종 중 코스피 · 코스닥. 이름 키를 모르는 심볼은 그리지 않는다 */
const INDEX_SYMBOLS: string[] = ["KOSPI", "KOSDAQ"];

type Seg = "holdings" | "watch" | "discover";
const SEGS: Seg[] = ["holdings", "watch", "discover"];

const stockPath = (symbol: string) =>
  `${brokerPath("TOSS")}/${encodeURIComponent(symbol)}`;

/**
 * 토스증권 증권 화면. 폰(I-13 B)은 상단 바(← 증권) → (증권사 Line) → 띠 ① 내 투자 → 8 → 띠 ② 시장 → 8 → 띠 ③ 종목.
 * 데스크톱 · 태블릿(I 26 ~ 31)은 같은 값을 카드로 — 1280 이상 왼쪽 열 내 투자 + 종목 · 오른쪽 열 시장 + 포트폴리오 구성, 미만은 한 칸.
 * 종목 줄을 누르면 상세 페이지(`/desk/stocks/toss/:symbol`)로 간다. 탭은 `?tab=` 에 둬 돌아오면 그대로다.
 */
export function TossStocksView({
  header,
  layout = "phone",
}: {
  header?: ReactNode;
  /** phone = 띠 셋(768 미만) · desk = 카드 2 : 1(1280 이상) / 한 칸 720(768 ~ 1279) */
  layout?: "phone" | "desk";
}) {
  const { t } = useTranslation("stocks");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const seg: Seg = SEGS.includes(tabParam as Seg)
    ? (tabParam as Seg)
    : "holdings";
  const setSeg = (next: Seg) =>
    setParams(
      (p) => {
        if (next === "holdings") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );
  const open = (symbol: string) => navigate(stockPath(symbol));
  const mask = useMasked("stocks.holdings");

  // ---- 내 투자 -----------------------------------------------------------
  const accountsQ = useTossAccounts();
  const accountSeq = accountsQ.data?.[0]?.accountSeq ?? null;
  const holdingsQ = useTossHoldings(accountSeq);
  const holdings = holdingsQ.data;
  // 서버는 토스 응답을 그대로 넘긴다(TossQueryServiceImpl:212) — 정상 응답의 빈 목록([])은 빈 상태, 오류 응답은 실패 한 벌이다
  // (실제 응답은 확인하지 못했다 — 어느 쪽이 와도 맞게 보인다)
  const investLoading =
    accountsQ.isLoading || (accountSeq != null && holdingsQ.isLoading);
  const investFailed = isHardError(accountsQ) || isHardError(holdingsQ);
  const retryInvest = () => {
    void accountsQ.refetch();
    if (accountSeq != null) void holdingsQ.refetch();
  };
  // 받아 둔 보유 · 계좌가 있는 채 다시 받기가 실패했다 — 숫자는 두고 띠 한 줄(단계 4)
  const holdingsStale = isStaleError(accountsQ) || isStaleError(holdingsQ);
  const fxQ = useTossExchangeRate();
  const fxRate = fxQ.data ? num(fxQ.data.rate) : null;
  const summary = holdings ? tossInvestSummary(holdings) : null;
  const lines = useMemo(
    () => (holdings ? tossHoldingLines(holdings.items, fxRate) : []),
    [holdings, fxRate],
  );

  const pctOf = (p: number) => formatChangeRate(Math.abs(p), { sign: "none" });
  const investDelta = summary && {
    direction: directionOf(summary.pnl),
    value: mask(`${won(Math.abs(summary.pnl))} · ${pctOf(summary.pnlPct)}`),
    text: t("invest.vsPurchase"),
  };
  // 주문 가능 금액 둘(I-13b 18) — 60초마다. 값이 없으면(null) 줄을 그리지 않고, 질의가 실패하면 값 "—"(구역 실패가 아니다)
  const bpKrwQ = useTossBuyingPower(accountSeq, "KRW");
  const bpUsdQ = useTossBuyingPower(accountSeq, "USD");
  const buyingRow = (
    key: string,
    name: string,
    q: typeof bpKrwQ,
    format: (n: number) => string,
  ) => {
    const v = q.data?.cashBuyingPower;
    const has = v != null && v.trim() !== "";
    if (!isHardError(q) && !q.isLoading && !has) return [];
    return [
      {
        key,
        name,
        value: q.isLoading ? (
          <Skeleton text="t5" className="w-16" />
        ) : has ? (
          mask(format(num(v)))
        ) : (
          "—"
        ),
      },
    ];
  };
  // 주문 가능 금액도 60초마다 받는 숫자 — 받아 둔 값이 있는 채 실패하면 내 투자 띠가 함께 말한다
  const investStale =
    holdingsStale || isStaleError(bpKrwQ) || isStaleError(bpUsdQ);
  const retryInvestStale = () => {
    retryInvest();
    void bpKrwQ.refetch();
    void bpUsdQ.refetch();
  };
  const dailyDir = summary ? directionOfPct(summary.dailyPnlPct) : "flat";
  const investRows = [
    {
      key: "purchase",
      name: t("holding.purchaseAmount"),
      value: mask(won(summary?.purchaseAmount ?? 0)),
    },
    {
      key: "daily",
      name: t("holding.dailyPnl"),
      value: (
        <DeltaText
          strong
          dir={dailyDir}
          text={mask(
            `${won(Math.abs(summary?.dailyPnl ?? 0))} · ${pctOf(summary?.dailyPnlPct ?? 0)}`,
          )}
        />
      ),
    },
    ...buyingRow("orderable-krw", t("invest.orderableKrw"), bpKrwQ, won),
    ...buyingRow("orderable-usd", t("invest.orderableUsd"), bpUsdQ, (n) =>
      fmtByCurrency(n, "USD"),
    ),
    {
      key: "count",
      name: t("summary.holdingsCount"),
      value: t("unit.count", { count: summary?.count ?? 0 }),
    },
  ];

  // ---- 시장 ----------------------------------------------------------------
  const idxQ = useTossIndicatorPrices(INDEX_SYMBOLS);
  const idxCandles = useTossIndicatorCandles(INDEX_SYMBOLS);
  const krQ = useTossMarketCalendarKr();
  const usQ = useTossMarketCalendarUs();
  const desk = layout === "desk";
  // 장 상태는 달력이 준 것만 그린다 — 못 받았으면(실패) 그 시장을 줄에서 빼고, 아직이면 Skeleton.
  // "휴장" 은 달력이 세션 없음을 줬을 때만이다(검수 H4).
  const states: MarketState[] = [];
  for (const m of [
    {
      key: "kr",
      name: desk ? t("market.krFull") : t("market.krShort"),
      s: marketLookup(krQ, (d) => ({
        session: d.today.integrated?.regularMarket,
        date: d.today.date,
      })),
    },
    {
      key: "us",
      name: desk ? t("market.usFull") : t("market.usShort"),
      s: marketLookup(usQ, (d) => ({
        session: d.today.regularMarket,
        date: d.today.date,
      })),
    },
  ]) {
    if (!m.s) continue;
    if (m.s.pending)
      states.push({
        key: m.key,
        name: m.name,
        open: false,
        label: "",
        pending: true,
      });
    else
      states.push({
        key: m.key,
        name: m.name,
        open: m.s.open,
        label: t(m.s.labelKey, m.s.time ? { time: m.s.time } : undefined),
      });
  }
  const indices: IndexLine[] = [];
  for (const i of idxQ.data ?? []) {
    // 이름 키가 없는 심볼은 "코스닥" 으로 접지 않고 그리지 않는다(I-13 9)
    if (!t(`market.${i.symbol}`, { defaultValue: "" })) continue;
    if (num(i.lastPrice) <= 0) continue;
    const series = idxCandles.get(i.symbol);
    const trendPct =
      series && series.length >= 2 && series[0]! > 0
        ? ((series[series.length - 1]! - series[0]!) / series[0]!) * 100
        : null;
    indices.push({
      symbol: i.symbol,
      name: t(`market.${i.symbol}`),
      value: num(i.lastPrice).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      series,
      trendPct,
    });
  }
  // 구역(상태 줄 · 지수 줄 · 환율 줄)마다 따로 실패한다 — 받은 구역은 그대로 그리고 못 받은 구역만 비운다.
  // 전부 못 받았을 때만 한 벌 실패(앱과 같은 규칙: 구역별 부분 실패 · 전부일 때만 한 벌).
  const marketFailed =
    isHardError(idxQ) &&
    isHardError(krQ) &&
    isHardError(usQ) &&
    isHardError(fxQ);

  // ---- 종목 ----------------------------------------------------------------
  const watchQ = useWatchGroups();
  const groups = useMemo(() => watchQ.data ?? [], [watchQ.data]);
  const { visibleIds, track, allVisible } = useVisibleIds();
  const quoteSymbols = useMemo(
    () =>
      seg === "watch"
        ? visibleSymbols(
            groups,
            allVisible ? new Set(groups.map((g) => g.rowId)) : visibleIds,
          )
        : [],
    [seg, groups, visibleIds, allVisible],
  );
  const quotes = useTossWatchQuotes(quoteSymbols);

  const [form, setForm] = useState<{ group: WatchGroup | null } | null>(null);
  const [deleting, setDeleting] = useState<WatchGroup | null>(null);

  // 보유 목록(빈 상태 · 줄) — 다시 받기가 실패해도 그대로 그린다
  const holdingsBody = () =>
    lines.length === 0 ? (
      <ResultSection
        kind="empty"
        size="medium"
        as="h3"
        icon={<Search aria-hidden />}
        title={t("holdings.empty")}
      />
    ) : (
      <List aria-label={t("segments.holdings")}>
        {lines.map((l) => (
          <StockLine
            key={l.key}
            name={l.name}
            detail={t("holding.lineDesc", {
              code: l.symbol,
              count: l.qty.toLocaleString(),
            })}
            amount={mask(amountText(l.value, l.currency))}
            pct={l.returnPct}
            onClick={() => open(l.symbol)}
          />
        ))}
      </List>
    );
  const holdingsList = investLoading ? (
    <LineSkeletons label={t("holdings.loading")} />
  ) : investFailed ? (
    <BandFailure band title={t("holdings.failTitle")} onRetry={retryInvest} />
  ) : (
    // 받아 둔 보유가 있는 채 실패는 맨 위 내 투자 띠의 Callout 하나가 말한다(같은 실패에 하나 — 검수 2차 L5)
    holdingsBody()
  );

  const investBand = (columns: boolean) => (
    <InvestBand
      label={t("summary.title")}
      amount={mask(won(summary?.evalAmount ?? 0))}
      delta={investDelta ?? undefined}
      rows={investRows}
      loading={investLoading}
      failed={investFailed}
      onRetry={retryInvest}
      priceFailed={investStale}
      priceRetrying={
        accountsQ.isFetching ||
        holdingsQ.isFetching ||
        bpKrwQ.isFetching ||
        bpUsdQ.isFetching
      }
      onRetryPrice={retryInvestStale}
      columns={columns}
      onOpenPortfolio={
        columns ? null : () => navigate(`${brokerPath("TOSS")}/portfolio`)
      }
    />
  );
  const marketBand = (
    <MarketBand
      markets={states}
      indices={indices}
      fx={
        fxRate != null && fxRate > 0
          ? { value: fmtFxRate(fxRate), base: t("market.fxBase") }
          : null
      }
      loading={idxQ.isLoading}
      failed={marketFailed}
      priceFailed={isStaleError(idxQ)}
      priceRetrying={idxQ.isFetching}
      onRetryPrice={() => void idxQ.refetch()}
      onRetry={() => {
        void idxQ.refetch();
        void krQ.refetch();
        void usQ.refetch();
        void fxQ.refetch();
      }}
    />
  );
  const comp = composition(lines);
  const stocksTabs = (
    <>
      <Tabs value={seg} onValueChange={(v) => setSeg(v as Seg)}>
        <ChipTabsList
          variant="solid"
          size="medium"
          aria-label={t("list.tabsAria")}
        >
          <ChipTabsTrigger value="holdings">
            {t("segments.holdings")}
          </ChipTabsTrigger>
          <ChipTabsTrigger value="watch">{t("segments.watch")}</ChipTabsTrigger>
          <ChipTabsTrigger value="discover">
            {t("segments.discover")}
          </ChipTabsTrigger>
        </ChipTabsList>
      </Tabs>
      <div role="tabpanel" aria-labelledby="stocks-list-title">
        {seg === "holdings" ? (
          holdingsList
        ) : seg === "watch" ? (
          <WatchGroups
            groups={groups}
            loading={watchQ.isLoading}
            failed={isHardError(watchQ)}
            onRetry={() => void watchQ.refetch()}
            priceOf={quotes.priceOf}
            quotesFailed={quotes.failed}
            quotesRetrying={quotes.retrying}
            onRetryQuotes={quotes.retry}
            track={track}
            onOpen={open}
            onAddGroup={() => setForm({ group: null })}
            onRenameGroup={(g) => setForm({ group: g })}
            onDeleteGroup={setDeleting}
          />
        ) : (
          <TossDiscoverMobile onOpen={open} />
        )}
      </div>
    </>
  );
  const dialogs = (
    <>
      {form && (
        <WatchGroupForm group={form.group} onClose={() => setForm(null)} />
      )}
      {deleting && (
        <WatchGroupDeleteConfirm
          group={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );

  if (desk)
    return (
      <>
        <DeskFrame
          slot="stocks-desktop"
          title={t("nav.title")}
          source={t("market.dataNotice")}
        >
          <DeskColumns
            left={
              <>
                <DeskSlot order={1} slot="invest">
                  <Card className="p-0">{investBand(true)}</Card>
                </DeskSlot>
                <DeskSlot order={4} slot="stocks">
                  <StocksCard onPick={open}>{stocksTabs}</StocksCard>
                </DeskSlot>
              </>
            }
            right={
              <>
                <DeskSlot order={2} slot="market">
                  <Card className="p-0">{marketBand}</Card>
                </DeskSlot>
                <DeskSlot order={3} slot="composition">
                  <CompositionCard
                    data={{
                      items: comp.items,
                      notice: comp.fxMissing
                        ? t("namu.donutNeedsFx")
                        : undefined,
                    }}
                    loading={investLoading}
                    failed={investFailed}
                    onRetry={retryInvest}
                  />
                </DeskSlot>
              </>
            }
          />
        </DeskFrame>
        {dialogs}
      </>
    );

  return (
    <>
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref="/desk/more" />
        <TopNavigationTitle>{t("nav.title")}</TopNavigationTitle>
      </TopNavigation>
      {header}
      <ScreenBands>
        <div data-band="flush" data-section="invest">
          {investBand(false)}
        </div>
        <div data-band="flush" data-section="market">
          {marketBand}
        </div>
        <div data-band="flush" data-section="stocks">
          <BandTitle id="stocks-list-title">{t("list.title")}</BandTitle>
          <StockSearchEntry
            className="px-x6 pt-x2"
            onPick={(item) => open(item.symbol)}
          />
          {stocksTabs}
          <SourceLine>{t("market.dataNotice")}</SourceLine>
        </div>
      </ScreenBands>
      {dialogs}
    </>
  );
}
