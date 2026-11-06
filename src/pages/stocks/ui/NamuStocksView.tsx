import { isHardError, isStaleError } from "@/features/stock/lib/query-state";
import { useMemo, useState, type ReactNode } from "react";
import { amountText } from "@/features/stock/lib/amount-text";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { List } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
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
import { namuMarketStatus } from "@/features/stock/lib/market-state";
import { Skeleton } from "@/shared/ds/skeleton";
import { mergeNamuHoldings } from "@/features/stock/lib/holdings";
import { visibleSymbols } from "@/features/stock/lib/watch-prices";
import { useWatchGroups } from "@/features/stock/api/watchlistApi";
import type { WatchGroup } from "@/features/stock/api/stockApi";
import {
  marketStateOf,
  useNamuExchangeRate,
  useNamuHoldings,
  useNamuMargin,
  useNamuPrices,
} from "@/features/stock/model/useNamu";
import { useVisibleIds } from "@/features/stock/model/useVisibleIds";
import { useNamuWatchQuotes } from "@/features/stock/model/useWatchQuotes";
import { Card } from "@/shared/ds/card";
import { InvestBand } from "@/features/stock/ui/phone/invest-band";
import { MarketBand } from "@/features/stock/ui/phone/market-band";
import {
  BandTitle,
  DeltaText,
  LineSkeletons,
  LineValue,
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
  namuHoldingLines,
  namuMarketReps,
  namuInvestSummary,
} from "../model/invest";

type Seg = "holdings" | "watch";
type MarketFilter = "ALL" | "KRW" | "USD";

const stockPath = (symbol: string) =>
  `${brokerPath("NAMU")}/${encodeURIComponent(symbol)}`;

/**
 * 나무증권 증권 화면(I-13 8 · 10 · 26 ~ 31, I-13b 17 · 18) — 토스와 같은 틀(폰은 띠 · 768 이상은 카드).
 * 나무에 없는 것(지수 · 발견 · 일간 손익)은 그리지 않고, 다른 증권사를 권하는 글도 없다.
 * 시장 띠 = 장 상태 줄(대표 종목의 시세에 딸려 오는 장 상태) + 환율 줄(`/v1/namu/exchange-rate`).
 * 국내 · 해외 두 응답은 한 목록으로 합쳐 보이고, 통화를 나눠 보려면 목록 위 Segmented 로 거른다.
 */
export function NamuStocksView({
  header,
  layout = "phone",
}: {
  header?: ReactNode;
  /** phone = 띠(768 미만) · desk = 카드 2 : 1(1280 이상) / 한 칸 720(768 ~ 1279) */
  layout?: "phone" | "desk";
}) {
  const { t } = useTranslation("stocks");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seg: Seg = params.get("tab") === "watch" ? "watch" : "holdings";
  const setSeg = (next: Seg) =>
    setParams(
      (p) => {
        if (next === "holdings") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );
  const [filter, setFilter] = useState<MarketFilter>("ALL");
  const desk = layout === "desk";
  const open = (symbol: string) => navigate(stockPath(symbol));
  const mask = useMasked("stocks.holdings");

  // ---- 내 투자 ---------------------------------------------------------------
  const krwQ = useNamuHoldings("KRW");
  const usdQ = useNamuHoldings("USD");
  const fxQ = useNamuExchangeRate();
  const fxRate = fxQ.data?.rate ?? null;
  const marginQ = useNamuMargin();
  const view = useMemo(
    () => mergeNamuHoldings(krwQ.data, usdQ.data, fxRate),
    [krwQ.data, usdQ.data, fxRate],
  );
  const summary = namuInvestSummary(view);
  const lines = useMemo(() => namuHoldingLines(view), [view]);
  const loading = krwQ.isLoading || usdQ.isLoading;
  // 둘 다 실패해야 오류다 — 한쪽만 실패하면 남은 통화만 보인다
  const bothFailed = isHardError(krwQ) && isHardError(usdQ);
  const retryInvest = () => {
    void krwQ.refetch();
    void usdQ.refetch();
  };
  // 한 통화만 못 받았거나(그 통화가 합계 · 목록에서 빠진다) 받아 둔 값이 있는 채 다시 받기가 실패했다 —
  // 남은 숫자는 두고 띠 한 줄(단계 4). 합계가 그 통화를 빼고 계산됐다는 걸 모르게 두지 않는다
  const holdingsStale = !bothFailed && (krwQ.isError || usdQ.isError);
  const retryStale = () => {
    if (krwQ.isError) void krwQ.refetch();
    if (usdQ.isError) void usdQ.refetch();
  };

  const pctOf = (p: number) => formatChangeRate(Math.abs(p), { sign: "none" });
  const cur = (c: { currency: "KRW" | "USD"; evalAmount: number }) =>
    mask(amountText(c.evalAmount, c.currency));
  const pnlNode = (c: {
    currency: "KRW" | "USD";
    profitLoss: number;
    profitRatePct: number;
  }) => (
    <DeltaText
      dir={directionOf(c.profitLoss)}
      text={mask(
        `${amountText(Math.abs(c.profitLoss), c.currency)} · ${pctOf(c.profitRatePct)}`,
      )}
    />
  );

  // 지표 — 섞였고 환율이 있으면 원화 환산 합계, 아니면 있는 통화 하나(국내 먼저)
  const main =
    summary.mixed && summary.totalKrw != null
      ? ({ kind: "total" } as const)
      : summary.krw
        ? ({ kind: "krw" } as const)
        : summary.usd
          ? ({ kind: "usd" } as const)
          : null;
  const metric = (() => {
    if (main?.kind === "total")
      return {
        label: t("namu.krwTotal"),
        amount: mask(`≈ ${won(Math.round(summary.totalKrw!))}`),
        note: t("namu.fxApplied", {
          rate: Math.round(summary.appliedFxRate ?? 0).toLocaleString(),
        }),
      };
    const c = main?.kind === "usd" ? summary.usd! : summary.krw;
    if (!c)
      return {
        label: t("namu.domesticValue"),
        amount: mask(won(0)),
      };
    return {
      label:
        c.currency === "KRW"
          ? t("namu.domesticValue")
          : t("namu.overseasValue"),
      amount: cur(c),
      delta: {
        direction: directionOf(c.profitLoss),
        value: mask(
          `${amountText(Math.abs(c.profitLoss), c.currency)} · ${pctOf(c.profitRatePct)}`,
        ),
        text: t("invest.vsPurchase"),
      },
    };
  })();
  const dash = "—";
  const hasValue = (v: string | null | undefined): v is string =>
    v != null && v.trim() !== "";
  function orderableRows() {
    const out: { key: string; name: string; value: ReactNode }[] = [];
    const orderable = krwQ.data?.orderableAmount;
    if (isHardError(krwQ) || hasValue(orderable))
      out.push({
        key: "orderable-krw",
        name: t("invest.orderableKrw"),
        value: hasValue(orderable) ? mask(won(num(orderable))) : dash,
      });
    const deposit = marginQ.data?.foreignDeposit;
    if (isHardError(marginQ) || marginQ.isLoading || hasValue(deposit))
      out.push({
        key: "deposit-usd",
        name: t("invest.depositUsd"),
        value: marginQ.isLoading ? (
          <Skeleton text="t5" className="w-16" />
        ) : hasValue(deposit) ? (
          mask(fmtByCurrency(num(deposit), "USD"))
        ) : (
          dash
        ),
      });
    return out;
  }
  const investRows = [
    // 합계가 지표일 때는 두 통화를 줄로 풀어 보이고, 하나가 지표일 때는 다른 통화가 있으면 그것만 줄로
    ...(summary.krw && (main?.kind === "total" || main?.kind === "usd")
      ? [
          {
            key: "krw",
            name: t("namu.domesticValue"),
            value: (
              <LineValue
                amount={cur(summary.krw)}
                delta={pnlNode(summary.krw)}
              />
            ),
          },
        ]
      : []),
    ...(summary.usd && main?.kind !== "usd"
      ? [
          {
            key: "usd",
            name: t("namu.overseasValue"),
            value: (
              <LineValue
                amount={cur(summary.usd)}
                delta={pnlNode(summary.usd)}
              />
            ),
          },
        ]
      : []),
    // 주문 가능 · 예수금(I-13b 18) — 값이 없으면(null) 줄을 그리지 않고, 질의가 실패하면 값 "—"
    ...orderableRows(),
    {
      key: "count",
      name: t("summary.holdingsCount"),
      value: summary.mixed
        ? t("namu.countSplit", { kr: summary.krwCount, us: summary.usdCount })
        : t("unit.count", { count: summary.count }),
    },
  ];

  // ---- 종목 ------------------------------------------------------------------
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
  const quotes = useNamuWatchQuotes(quoteSymbols);
  const [form, setForm] = useState<{ group: WatchGroup | null } | null>(null);
  const [deleting, setDeleting] = useState<WatchGroup | null>(null);

  const shown =
    filter === "ALL" ? lines : lines.filter((l) => l.currency === filter);
  const holdingsList = loading ? (
    <LineSkeletons label={t("holdings.loading")} />
  ) : bothFailed ? (
    <BandFailure band title={t("holdings.failTitle")} onRetry={retryInvest} />
  ) : (
    <>
      {/* 한 통화 실패 · 받아 둔 값이 있는 채 실패는 맨 위 내 투자 띠의 Callout 하나가 말한다(검수 2차 L5) */}
      {summary.mixed && (
        <div className="px-x6 pb-x2 pt-x1">
          <SegmentedControl
            aria-label={t("namu.filterAria")}
            value={filter}
            onValueChange={(v) => setFilter(v as MarketFilter)}
          >
            <SegmentedControlItem value="ALL">
              {t("namu.filterAll")}
            </SegmentedControlItem>
            <SegmentedControlItem value="KRW">
              {t("namu.tabDomestic")}
            </SegmentedControlItem>
            <SegmentedControlItem value="USD">
              {t("namu.tabOverseas")}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      )}
      {shown.length === 0 ? (
        <ResultSection
          kind="empty"
          size="medium"
          as="h3"
          icon={<Search aria-hidden />}
          title={
            lines.length === 0 ? t("namu.holdingsEmpty") : t("namu.filterEmpty")
          }
        />
      ) : (
        <List aria-label={t("segments.holdings")}>
          {shown.map((l) => (
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
      )}
    </>
  );

  const investBand = (columns: boolean) => (
    <InvestBand
      label={metric.label}
      amount={metric.amount}
      delta={"delta" in metric ? metric.delta : undefined}
      note={"note" in metric ? metric.note : undefined}
      rows={investRows}
      loading={loading}
      failed={bothFailed}
      failDescription={t("namu.failDesc")}
      onRetry={retryInvest}
      priceFailed={holdingsStale}
      priceRetrying={krwQ.isFetching || usdQ.isFetching}
      onRetryPrice={retryStale}
      columns={columns}
      emptyNote={
        !loading && !bothFailed && summary.count === 0
          ? t("namu.holdingsEmpty")
          : undefined
      }
      onOpenPortfolio={
        columns ? null : () => navigate(`${brokerPath("NAMU")}/portfolio`)
      }
    />
  );
  // 시장 띠 — 시장마다 대표 종목 하나(보유 첫 종목, 없으면 관심 첫 종목)의 시세로 장 상태를 읽는다. 최대 2종목 · 60초
  const reps = namuMarketReps(
    lines,
    groups.flatMap((g) => g.items),
  );
  const repSymbols = [reps.kr, reps.us].filter((s): s is string => !!s);
  const repQ = useNamuPrices(repSymbols);
  const stateOf = (key: string, name: string, rep: string | null) => {
    const st = marketStateOf(repQ.data, rep);
    const m = st ? namuMarketStatus(st) : null;
    return m
      ? [
          {
            key,
            name,
            open: m.open,
            label: t(m.labelKey, m.time ? { time: m.time } : undefined),
          },
        ]
      : [];
  };
  const marketStates = [
    ...stateOf("kr", desk ? t("market.krFull") : t("market.krShort"), reps.kr),
    ...stateOf("us", desk ? t("market.usFull") : t("market.usShort"), reps.us),
  ];
  // 대표 종목을 기다리는 동안(보유 · 관심 · 대표 시세 중 하나라도 오는 중) 장 상태 줄 자리는 값 Skeleton 이다.
  // 보유 질의가 실패했거나 보유가 0 이어도 관심 첫 종목이 대표라 줄은 나온다.
  // 실패 한 벌은 기다림이 끝난 뒤 환율과 대표 시세가 둘 다 실패했을 때만(대표를 기다리느라 실패로 보이면 안 된다).
  const statesWaiting = loading || watchQ.isLoading || repQ.isLoading;
  const marketFailed =
    !statesWaiting &&
    isHardError(fxQ) &&
    (repSymbols.length === 0 || isHardError(repQ));
  const marketBand = (
    <MarketBand
      markets={marketStates}
      statesLoading={statesWaiting}
      indices={[]}
      fx={{
        value: fxRate != null && fxRate > 0 ? fmtFxRate(fxRate) : null,
        loading: fxQ.isLoading,
        base: t("namu.fxBase"),
      }}
      failed={marketFailed}
      onRetry={() => {
        void fxQ.refetch();
        void repQ.refetch();
      }}
      priceFailed={isStaleError(repQ)}
      priceRetrying={repQ.isFetching}
      onRetryPrice={() => void repQ.refetch()}
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
        </ChipTabsList>
      </Tabs>
      <div role="tabpanel" aria-labelledby="stocks-list-title">
        {seg === "holdings" ? (
          holdingsList
        ) : (
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

  // 폭으로 갈리는 건 몸통(폰 띠 · 넓은 화면 카드)뿐이다 — 관심 그룹 폼 · 삭제 확인은 갈림 밖 한 자리에 둔다.
  // 두 갈래에 따로 두면 폭이 768 을 넘나들 때 폼이 다시 붙으며 쓰던 이름이 빈다(I-wrap-b1 ε 9)
  const body = desk ? (
    <DeskFrame
      slot="stocks-desktop"
      title={t("nav.title")}
      source={t("namu.dataNotice")}
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
                  notice:
                    view.fxMissing || comp.fxMissing
                      ? t("namu.donutNeedsFx")
                      : undefined,
                }}
                loading={loading}
                failed={bothFailed}
                onRetry={retryInvest}
              />
            </DeskSlot>
          </>
        }
      />
    </DeskFrame>
  ) : (
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
          <SourceLine>{t("namu.dataNotice")}</SourceLine>
        </div>
      </ScreenBands>
    </>
  );

  return (
    <>
      {body}
      {dialogs}
    </>
  );
}
