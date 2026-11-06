import { useTranslation } from "react-i18next";
import {
  TopNavigation,
  TopNavigationActions,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { ScreenBands } from "@/shared/ui/groo/screen-bands";
import { formatChangeRate, money } from "@/shared/lib/groo/format";
import { useMasked, won } from "@/shared/lib/groo/money-text";
import { brokerPath } from "@/features/stock/lib/broker";
import { marketName } from "@/features/stock/lib/market-name";
import { formatDateLong } from "@/shared/lib/date";
import {
  fmtByCurrency,
  fmtCapKRW,
  fmtCapUsd,
  fmtShares,
  num,
} from "@/features/stock/lib/format";
import { mergeNamuHoldings } from "@/features/stock/lib/holdings";
import {
  useNamuExchangeRate,
  useNamuHoldings,
  useNamuInvestors,
  useNamuQuote,
} from "@/features/stock/model/useNamu";
import { useStockBySymbol } from "@/features/stock/model/useStockMaster";
import {
  changePctOf,
  usePrevClose,
  useTossAccounts,
  useTossExchangeRate,
  useTossCandles,
  useTossHoldings,
  useTossInvestors,
  useTossPriceLimits,
  useTossPrices,
  useTossStockInfo,
  useTossStockWarnings,
} from "@/features/stock/model/useTossStocks";
import { BandTitle, DeltaText } from "@/features/stock/ui/phone/phone-parts";
import {
  KR_TZ,
  US_TZ,
  dateKeyIn,
  marketTzOfCurrency,
} from "@/features/stock/lib/prev-close";
import { isHardError, isStaleError } from "@/features/stock/lib/query-state";
import { useDayKey } from "@/features/stock/model/useDayKey";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { Card } from "@/shared/ds/card";
import { DeskColumns, DeskFrame, DeskSlot } from "../desk/desk-frame";
import { directionOf, directionOfPct } from "../../model/invest";
import {
  DailyBand,
  DailyCard,
  HeadBand,
  InvestorBand,
  InvestorCard,
  KvBand,
  NamuNotice,
  QuotesBand,
  TradeTail,
  WatchToggle,
  type KvLine,
} from "./detail-parts";

/**
 * 종목 상세 페이지(I-13 18 ~ 21 · 33 ~ 35). 폰은 상단 바(← "종목 상세" + 관심 Toggle) 아래 띠:
 * ① 머리 · 차트 ② 내 보유(보유일 때만) ③ 오늘 시세 ④ 호가 · 체결 ⑤ 투자자별 매매동향(국내 종목) ⑥ 기본 정보 ⑦ 일별 시세(+ 토스는 끝에 매매)
 * — 두 증권사 공통(I-13b U3). 768 이상은 같은 구역을 카드로 — 제목 줄 위 "‹ 증권", 1280 이상 2 : 1
 * (왼쪽 머리 · 차트 → 투자자별 → 일별 시세, 오른쪽 내 보유 → 오늘 시세 → 호가 · 체결 → 기본 정보), 미만은 폰 띠 차례의 한 칸 720.
 * 주소만으로 열린다 — 보유 종목인지는 같은 보유 질의에서 찾는다.
 */
export function StockDetailView({
  broker,
  symbol,
  layout = "phone",
}: {
  broker: "TOSS" | "NAMU";
  symbol: string;
  layout?: "phone" | "desk";
}) {
  const { t } = useTranslation("stocks");
  const master = useStockBySymbol(symbol, { reference: true }).data ?? null;
  const desk = layout === "desk";
  const toss =
    broker === "TOSS" ? <TossBody symbol={symbol} desk={desk} /> : null;
  const namu =
    broker === "NAMU" ? <NamuBody symbol={symbol} desk={desk} /> : null;
  if (desk)
    return (
      <DeskFrame
        slot="stock-detail-desktop"
        title={t("detail.sheetTitle")}
        parent={{ to: brokerPath(broker), label: t("nav.title") }}
        source={
          broker === "NAMU" ? t("namu.dataNotice") : t("market.dataNotice")
        }
      >
        {toss}
        {namu}
      </DeskFrame>
    );
  return (
    <>
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref={brokerPath(broker)} />
        <TopNavigationTitle>{t("detail.sheetTitle")}</TopNavigationTitle>
        <TopNavigationActions>
          <WatchToggle symbol={symbol} marketCode={master?.marketCode} />
        </TopNavigationActions>
      </TopNavigation>
      <ScreenBands>
        {toss}
        {namu}
      </ScreenBands>
    </>
  );
}

const flush = (name: string, node: React.ReactNode) =>
  node ? (
    <div data-band="flush" data-section={name}>
      {node}
    </div>
  ) : null;

function TossBody({ symbol, desk }: { symbol: string; desk: boolean }) {
  const { t } = useTranslation("stocks");
  const mask = useMasked("stocks.detail");
  const master = useStockBySymbol(symbol, { reference: true }).data ?? null;
  const infoQ = useTossStockInfo([symbol]);
  const info = infoQ.data?.[0];
  const pricesQ = useTossPrices([symbol]);
  // 미국 종목은 전일을 뉴욕 날짜로 가른다 — 시세 · 정보 · 마스터 어디서든 통화를 알면 쓴다(아래 currency 와 같은 근거)
  const knownCurrency =
    pricesQ.data?.[0]?.currency ?? info?.currency ?? master?.currency ?? null;
  const prevCloseQ = usePrevClose(symbol, marketTzOfCurrency(knownCurrency));
  const fxQ = useTossExchangeRate();
  const warningsQ = useTossStockWarnings(symbol);
  const accountsQ = useTossAccounts();
  const holdingsQ = useTossHoldings(accountsQ.data?.[0]?.accountSeq ?? null);
  const holding =
    holdingsQ.data?.items.find((h) => h.symbol === symbol) ?? null;
  const limitsQ = useTossPriceLimits(symbol);

  const name = master?.nameKr ?? info?.name ?? holding?.name ?? symbol;
  // 통화는 시세 응답의 것을 먼저 쓴다. 어디서도 모르면 빈 값 — 숫자만 보이고 KRW 로 추정하지 않는다(검수 M6)
  const currency = knownCurrency ?? holding?.currency ?? "";
  const isUs = currency === "USD";
  const isKr = currency === "KRW";
  const lastRaw = pricesQ.data?.[0]?.lastPrice;
  const last =
    lastRaw != null && Number.isFinite(Number.parseFloat(lastRaw))
      ? Number.parseFloat(lastRaw)
      : null;
  const fxRate = fxQ.data ? num(fxQ.data.rate) : null;
  const changePct = changePctOf(last, prevCloseQ.data);
  // 머리 증감의 금액 — 전일 종가를 못 받았으면 둘 다 없다(0.00% 를 지어내지 않는다)
  const changeAmount =
    last != null && prevCloseQ.data != null && prevCloseQ.data > 0
      ? last - prevCloseQ.data
      : null;
  const marketLabel = marketName(t, master?.marketCode ?? info?.market);
  const kind =
    info?.securityType === "ETF" || master?.securityType === "ETF"
      ? "ETF"
      : t(`securityType.${master?.securityType ?? "STOCK"}`, {
          defaultValue: t("info.stock"),
        });

  // 내 보유 — 한 줄에 하나(토스 아홉)
  const holdRows: KvLine[] = [];
  if (holding) {
    const ev = num(holding.marketValue.amount);
    const pnl = num(holding.profitLoss.amount);
    const pnlPct = num(holding.profitLoss.rate);
    const avg = num(holding.averagePurchasePrice);
    const day = num(holding.dailyProfitLoss.amount);
    const purchase = num(holding.marketValue.purchaseAmount);
    const fees = num(holding.cost.commission) + num(holding.cost.tax ?? "0");
    const cur = holding.currency.toUpperCase();
    const d = (n: number, text: string, strong = true) => (
      <DeltaText dir={directionOf(n)} text={mask(text)} strong={strong} />
    );
    holdRows.push(
      {
        key: "ev",
        name: t("holding.marketValue"),
        value: mask(fmtByCurrency(ev, cur)),
      },
      {
        key: "pnl",
        name: t("holding.profitLoss"),
        value: d(pnl, fmtByCurrency(Math.abs(pnl), cur)),
      },
      {
        key: "rate",
        name: t("holding.returnRate"),
        value: (
          <DeltaText
            strong
            dir={directionOfPct(pnlPct)}
            text={formatChangeRate(Math.abs(pnlPct), { sign: "none" })}
          />
        ),
      },
      {
        key: "qty",
        name: t("holding.quantity"),
        value: t("holding.sharesUnit", {
          count: num(holding.quantity).toLocaleString(),
        }),
      },
      {
        key: "avg",
        name: t("holding.avgPrice"),
        value: fmtByCurrency(avg, cur),
      },
      {
        key: "cost",
        name: t("holding.purchaseAmount"),
        value: mask(fmtByCurrency(purchase, cur)),
      },
      {
        key: "day",
        name: t("holding.dailyPnl"),
        value: d(day, fmtByCurrency(Math.abs(day), cur)),
      },
      {
        key: "fees",
        name: t("holding.feesTax"),
        value: fmtByCurrency(fees, cur),
      },
      {
        key: "sell",
        name: t("holding.sellable"),
        value: t("holding.sharesUnit", {
          count: num(holding.quantity).toLocaleString(),
        }),
      },
    );
  }

  // 오늘 시세(I-13b 20) — 시가 · 고가 · 저가 · 거래량 = 일봉 오늘 봉(마지막 봉 날짜가 오늘일 때만), 상하한가 = 한도(국내만)
  const todayQ = useTossCandles(symbol, "1d", 3);
  const limits = limitsQ.data;
  // 오늘 봉 — "오늘" 은 그 시장의 거래일이다(미국은 뉴욕 날짜). 한국 날짜로 가르면 한국 자정 뒤 미국 장중에 띠가 사라진다(검수 M7).
  // 순서를 가정하지 않는다 — 날짜로 찾는다. 날이 바뀌면 `useDayKey` 가 다시 판정하게 한다
  const dayKey = useDayKey(isUs ? US_TZ : KR_TZ);
  // 통화를 아직 모르면 시장(= 날짜 기준)을 모른다 — 한국 날짜로 가르지 않고 기다린다(아래 todayLoading)
  const marketPending = !currency && (pricesQ.isLoading || infoQ.isLoading);
  const todayBar =
    (currency ? (todayQ.data?.candles ?? []) : []).find(
      (c) => dateKeyIn(c.timestamp, isUs ? US_TZ : KR_TZ) === dayKey,
    ) ?? null;
  const shares = num(info?.sharesOutstanding);
  const priceInKrw =
    last == null
      ? null
      : isUs
        ? fxRate == null
          ? null
          : last * fxRate
        : isKr
          ? last
          : null;
  const mcKRW = priceInKrw != null && shares > 0 ? priceInKrw * shares : null;
  const upper = limits?.upperLimitPrice ? num(limits.upperLimitPrice) : null;
  const lower = limits?.lowerLimitPrice ? num(limits.lowerLimitPrice) : null;
  const suspended = !!info?.koreanMarketDetail?.krxTradingSuspended;
  const infoRows: KvLine[] = [
    {
      key: "market",
      name: t("info.market"),
      value: info
        ? marketName(t, info.market)
        : isUs
          ? t("market.usShort")
          : t("market.krShort"),
    },
    {
      key: "type",
      name: t("info.securityType"),
      value: info?.securityType === "ETF" ? "ETF" : t("info.stock"),
    },
    { key: "cur", name: t("info.currency"), value: info?.currency ?? currency },
    ...(mcKRW != null
      ? [{ key: "cap", name: t("info.marketCap"), value: fmtCapKRW(mcKRW) }]
      : []),
    ...(info?.listDate
      ? [
          {
            key: "list",
            name: t("info.listDate"),
            value: formatDateLong(info.listDate),
          },
        ]
      : []),
    ...(shares > 0
      ? [
          {
            key: "shares",
            name: t("info.sharesOutstanding"),
            value: fmtShares(shares),
          },
        ]
      : []),
    // 거래상태는 국내 종목의 정보(koreanMarketDetail)가 있을 때만 — 모르는 값을 "정상" 으로 말하지 않는다(미국 · 빈 응답은 줄 없음, 검수 M5)
    ...(info?.koreanMarketDetail
      ? [
          {
            key: "status",
            name: t("info.tradingStatus"),
            value: suspended ? t("info.suspended") : t("info.normal"),
            tone: suspended ? ("critical" as const) : ("positive" as const),
          },
        ]
      : []),
  ];

  const todayRows: KvLine[] = [
    ...(todayBar
      ? (
          [
            ["open", "today.open", todayBar.openPrice],
            ["high", "today.high", todayBar.highPrice],
            ["low", "today.low", todayBar.lowPrice],
          ] as const
        )
          .filter(([, , v]) => Number.isFinite(Number.parseFloat(v)))
          .map(([key, label, v]) => ({
            key,
            name: t(label),
            value: fmtByCurrency(Number.parseFloat(v), currency),
          }))
      : []),
    ...(todayBar && Number.isFinite(Number.parseFloat(todayBar.volume))
      ? [
          {
            key: "volume",
            name: t("today.volume"),
            value: t("holding.sharesUnit", {
              count: Math.round(
                Number.parseFloat(todayBar.volume),
              ).toLocaleString(),
            }),
          },
        ]
      : []),
    ...(isKr && upper != null
      ? [
          {
            key: "up",
            name: t("info.upperLimit"),
            value: money(upper),
            tone: "critical" as const,
          },
        ]
      : []),
    ...(isKr && lower != null
      ? [
          {
            key: "low-limit",
            name: t("info.lowerLimit"),
            value: money(lower),
            tone: "informative" as const,
          },
        ]
      : []),
  ];
  const todayLoading = marketPending || todayQ.isLoading || limitsQ.isLoading;
  const todayFailed = isHardError(todayQ) && isHardError(limitsQ);
  const todayBand =
    todayLoading || todayFailed || todayRows.length > 0 ? (
      <KvBand
        id="stock-today"
        title={t("today.title")}
        rows={
          todayLoading
            ? (["open", "high", "low", "volume"] as const).map((k) => ({
                key: k,
                name: t(`today.${k}`),
                value: "",
              }))
            : todayRows
        }
        loading={todayLoading}
        stale={
          !todayFailed && isStaleError(todayQ)
            ? {
                onRetry: () => void todayQ.refetch(),
                retrying: todayQ.isFetching,
              }
            : undefined
        }
        failed={
          todayFailed
            ? {
                title: t("today.failTitle"),
                onRetry: () => {
                  void todayQ.refetch();
                  void limitsQ.refetch();
                },
              }
            : undefined
        }
      />
    ) : null;
  // 투자자별 매매동향 — 국내 종목만(시장을 알기 전엔 부르지 않는다). 미국이면 띠 · 카드가 없다
  const marketKnown = !!(info || master || holding);
  const investorsQ = useTossInvestors(symbol, marketKnown && isKr);
  const showInvestors = marketKnown && isKr;

  const head = (
    <HeadBand
      broker="TOSS"
      name={name}
      detail={`${symbol} · ${marketLabel} · ${kind}`}
      priceText={last != null ? fmtByCurrency(last, currency) : "—"}
      pct={changePct}
      changeAmount={changeAmount}
      currency={currency}
      approx={
        isUs && last != null && fxRate != null
          ? `≈ ${won(Math.round(last * fxRate))}`
          : undefined
      }
      unavailable={
        last == null && !pricesQ.isLoading && !isHardError(pricesQ)
          ? t("detail.priceUnavailable")
          : undefined
      }
      // 처음 실패는 그 자리 Result Section, 받아 둔 값이 있는 채 다시 받기 실패는 값을 두고 Callout(단계 4)
      failed={isHardError(pricesQ)}
      stale={isStaleError(pricesQ)}
      retrying={pricesQ.isFetching}
      onRetry={() => void pricesQ.refetch()}
      loading={pricesQ.isLoading}
      warnings={(warningsQ.data ?? []).map((w) =>
        t(`warning.${w.warningType}`, { defaultValue: w.warningType }),
      )}
      symbol={symbol}
      isUs={isUs}
      watch={
        desk ? (
          <WatchToggle symbol={symbol} marketCode={master?.marketCode} body />
        ) : undefined
      }
      chartHeight={desk ? 200 : 168}
    />
  );
  const holdBand = holding && (
    <KvBand
      id="stock-holding"
      title={t("holding.title")}
      rows={holdRows}
      stale={
        isStaleError(accountsQ) || isStaleError(holdingsQ)
          ? {
              onRetry: () => {
                void accountsQ.refetch();
                void holdingsQ.refetch();
              },
              retrying: accountsQ.isFetching || holdingsQ.isFetching,
            }
          : undefined
      }
    />
  );
  const quotesBand = (
    <QuotesBand
      broker="TOSS"
      market={isKr ? "KR" : "US"}
      symbol={symbol}
      currency={currency}
      lastPrice={last}
      changePct={changePct}
    />
  );
  // 정보 조회가 실패했는데 "정상" 으로 그리면 거래정지 종목이 멀쩡해 보인다 — 실패 한 벌(검수 H2)
  const infoBand = isHardError(infoQ) ? (
    <section aria-labelledby="stock-info">
      <BandTitle id="stock-info">{t("info.title")}</BandTitle>
      <div className="pb-x6 pt-x3">
        <BandFailure
          band
          title={t("info.failTitle")}
          onRetry={() => void infoQ.refetch()}
        />
      </div>
    </section>
  ) : (
    <KvBand
      id="stock-info"
      title={t("info.title")}
      rows={infoRows}
      loading={infoQ.isLoading}
    />
  );

  if (desk)
    return (
      <DeskColumns
        left={
          <>
            <DeskSlot order={1} slot="head">
              <Card>{head}</Card>
            </DeskSlot>
            {showInvestors && (
              <DeskSlot order={5} slot="investor">
                <InvestorCard q={investorsQ} />
              </DeskSlot>
            )}
            <DeskSlot order={7} slot="daily">
              <DailyCard
                symbol={symbol}
                broker="TOSS"
                currency={currency}
                tail={<TradeTail isUs={isUs} />}
              />
            </DeskSlot>
          </>
        }
        right={
          <>
            {holdBand && (
              <DeskSlot order={2} slot="holding">
                <Card className="p-0">{holdBand}</Card>
              </DeskSlot>
            )}
            {todayBand && (
              <DeskSlot order={3} slot="today">
                <Card className="p-0">{todayBand}</Card>
              </DeskSlot>
            )}
            <DeskSlot order={4} slot="quotes">
              <Card className="p-0">{quotesBand}</Card>
            </DeskSlot>
            <DeskSlot order={6} slot="info">
              <Card className="p-0">{infoBand}</Card>
            </DeskSlot>
          </>
        }
      />
    );

  return (
    <>
      <div>{head}</div>
      {holdBand && flush("holding", holdBand)}
      {flush("today", todayBand)}
      {flush("quotes", quotesBand)}
      {showInvestors && flush("investor", <InvestorBand q={investorsQ} />)}
      {flush("info", infoBand)}
      {flush(
        "daily",
        <DailyBand
          symbol={symbol}
          broker="TOSS"
          currency={currency}
          tail={<TradeTail isUs={isUs} />}
        />,
      )}
    </>
  );
}

/** 빈 문자열 · 없는 칸 → null (나무는 문자열로 주고 모든 칸이 null 일 수 있다) */
const numOrNull = (v: string | null | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const textOrNull = (v: string | null | undefined): string | null =>
  v != null && v.trim() !== "" ? v.trim() : null;
/** 20231227 → 2023-12-27 (이미 날짜 꼴이면 그대로) */
const dateText = (v: string): string =>
  /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v;

function NamuBody({ symbol, desk }: { symbol: string; desk: boolean }) {
  const { t } = useTranslation("stocks");
  const mask = useMasked("stocks.detail");
  const masterQ = useStockBySymbol(symbol, { reference: true });
  const master = masterQ.data ?? null;
  const krwQ = useNamuHoldings("KRW");
  const usdQ = useNamuHoldings("USD");
  const fxQ = useNamuExchangeRate();
  const view = mergeNamuHoldings(krwQ.data, usdQ.data, fxQ.data?.rate ?? null);
  const holding = view.rows.find((r) => r.symbol === symbol) ?? null;

  // 국내 · 미국 — 마스터가 먼저(보유 질의를 기다리지 않는다), 마스터에 없으면 보유 통화, 그것도 모르면 국내
  const market: "KR" | "US" | null = master
    ? master.countryCode === "KR"
      ? "KR"
      : "US"
    : holding
      ? holding.currency === "USD"
        ? "US"
        : "KR"
      : masterQ.isLoading
        ? null
        : "KR";
  // 상세 시세 하나(13b-0 3) — 머리 · 오늘 시세 · 호가 · 기본 정보가 이 응답이다. 보유 종목도 부른다. 10초 · 상세가 보일 때만
  const quoteQ = useNamuQuote(market, symbol);
  const q = quoteQ.data ?? null;
  const quoteFailed = isHardError(quoteQ);
  // 나무 초당 5회 한도 — 상세 시세가 끝난 뒤(성공 · 실패 모두) 투자자별 · 일별 시세를 연다
  const afterQuote = quoteQ.isFetched;
  const investorsQ = useNamuInvestors(symbol, market === "KR" && afterQuote);

  const name = master?.nameKr ?? q?.name ?? holding?.name ?? symbol;
  const currency: string =
    q?.currency ??
    holding?.currency ??
    master?.currency ??
    // 어디서도 통화를 모르면 시장으로(국내 원 · 미국 달러), 시장도 모르면 빈 값 — 숫자만 보인다(13-1 M6)
    (market === "KR" ? "KRW" : market === "US" ? "USD" : "");
  const isUs = market === "US" || currency === "USD";
  const last = numOrNull(q?.price);
  const prevClose = numOrNull(q?.previousClose);
  const changeAmount =
    prevClose != null && prevClose > 0 && last != null
      ? last - prevClose
      : null;
  const changePct =
    prevClose != null && prevClose > 0 && last != null
      ? ((last - prevClose) / prevClose) * 100
      : null;
  const fxRate = fxQ.data?.rate ?? null;

  const holdRows: KvLine[] = [];
  if (holding) {
    const ev = num(holding.evalAmount);
    const pnl = num(holding.profitLoss);
    const cost = ev - pnl;
    const pct = cost > 0 ? (pnl / cost) * 100 : 0;
    const sellable = numOrNull(holding.sellableQuantity);
    holdRows.push(
      {
        key: "ev",
        name: t("holding.marketValue"),
        value: mask(fmtByCurrency(ev, currency)),
      },
      {
        key: "pnl",
        name: t("holding.profitLoss"),
        value: (
          <DeltaText
            strong
            dir={directionOf(pnl)}
            text={mask(fmtByCurrency(Math.abs(pnl), currency))}
          />
        ),
      },
      {
        key: "qty",
        name: t("holding.quantity"),
        value: t("holding.sharesUnit", {
          count: num(holding.quantity).toLocaleString(),
        }),
      },
      {
        key: "rate",
        name: t("holding.returnRate"),
        value: (
          <DeltaText
            strong
            dir={directionOfPct(pct)}
            text={formatChangeRate(Math.abs(pct), { sign: "none" })}
          />
        ),
      },
      {
        key: "avg",
        name: t("holding.avgPrice"),
        value: fmtByCurrency(num(holding.avgPrice), currency),
      },
      {
        key: "cost",
        name: t("holding.purchaseAmount"),
        value: mask(fmtByCurrency(cost, currency)),
      },
      // 매도가능은 미국 잔고만 준다 — 국내는 줄이 없다
      ...(sellable != null
        ? [
            {
              key: "sell",
              name: t("holding.sellable"),
              value: t("holding.sharesUnit", {
                count: sellable.toLocaleString(),
              }),
            },
          ]
        : []),
    );
  }

  // 오늘 시세 — 값이 없는 줄은 그리지 않고, 다 없으면 띠가 없다. 상한가 critical · 하한가 informative
  const todayRows: KvLine[] = [];
  if (q) {
    const px = (label: string, key: string, v: string | null) => {
      const n = numOrNull(v);
      if (n != null)
        todayRows.push({
          key,
          name: t(label),
          value: fmtByCurrency(n, currency),
        });
    };
    px("today.open", "open", q.open);
    px("today.high", "high", q.high);
    px("today.low", "low", q.low);
    const vol = numOrNull(q.volume);
    if (vol != null)
      todayRows.push({
        key: "volume",
        name: t("today.volume"),
        value: t("holding.sharesUnit", {
          count: Math.round(vol).toLocaleString(),
        }),
      });
    const up = numOrNull(q.upperLimit);
    if (up != null)
      todayRows.push({
        key: "up",
        name: t("info.upperLimit"),
        value: fmtByCurrency(up, currency),
        tone: "critical",
      });
    const low = numOrNull(q.lowerLimit);
    if (low != null)
      todayRows.push({
        key: "low-limit",
        name: t("info.lowerLimit"),
        value: fmtByCurrency(low, currency),
        tone: "informative",
      });
  }

  // 기본 정보 — 시장 · 종목 유형 · 통화는 마스터, 업종 · 시가총액 · 상장일 · 상장(발행)주식수는 상세 시세. "거래상태" 줄은 나무에 없다
  const infoRows: KvLine[] = [
    {
      key: "market",
      name: t("info.market"),
      value: master
        ? marketName(t, master.marketCode)
        : isUs
          ? t("market.usShort")
          : t("market.krShort"),
    },
    {
      key: "type",
      name: t("info.securityType"),
      value: master?.securityType === "ETF" ? "ETF" : t("info.stock"),
    },
    { key: "cur", name: t("info.currency"), value: currency },
  ];
  if (q) {
    const sector = textOrNull(q.sector);
    if (sector)
      infoRows.push({ key: "sector", name: t("info.sector"), value: sector });
    // 시가총액 — 국내는 원 단위로 온다. 미국은 달러 총액이라 환율이 있으면 원으로 바꿔 같은 꼴(fmtCapKRW),
    // 없으면 줄을 지우지 않고 달러로 보인다(환율 없이 원으로 지어내지 않는다)
    const cap = numOrNull(q.marketCap);
    if (cap != null && cap > 0)
      infoRows.push({
        key: "cap",
        name: t("info.marketCap"),
        value: !isUs
          ? fmtCapKRW(cap)
          : fxRate != null && fxRate > 0
            ? fmtCapKRW(cap * fxRate)
            : fmtCapUsd(cap),
      });
    const listed = textOrNull(q.listingDate);
    if (listed)
      infoRows.push({
        key: "list",
        name: t("info.listDate"),
        value: formatDateLong(dateText(listed)),
      });
    const shares = numOrNull(q.listedShares);
    if (shares != null && shares > 0)
      infoRows.push({
        key: "shares",
        name: isUs ? t("info.sharesOutstanding") : t("info.listedShares"),
        value: fmtShares(shares),
      });
  }

  const head = (
    <HeadBand
      broker="NAMU"
      name={name}
      detail={
        master ? `${symbol} · ${marketName(t, master.marketCode)}` : symbol
      }
      priceText={last != null && last > 0 ? fmtByCurrency(last, currency) : "—"}
      pct={changePct}
      changeAmount={changeAmount}
      currency={currency}
      unavailable={
        !quoteFailed && !quoteQ.isPending && (last == null || last === 0)
          ? t("namu.priceEmpty")
          : undefined
      }
      loading={quoteQ.isPending}
      // 처음 실패는 그 자리 Result Section, 받아 둔 값이 있는 채 다시 받기 실패는 값을 두고 Callout(단계 4)
      failed={quoteFailed}
      stale={isStaleError(quoteQ)}
      retrying={quoteQ.isFetching}
      onRetry={() => void quoteQ.refetch()}
      warnings={(q?.warnings ?? []).map((w) =>
        t(`warning.${w.warningType}`, { defaultValue: w.warningType }),
      )}
      symbol={symbol}
      isUs={isUs}
      watch={
        desk ? (
          <WatchToggle symbol={symbol} marketCode={master?.marketCode} body />
        ) : undefined
      }
      chartHeight={desk ? 200 : 168}
    />
  );
  // 나무 보유 — 한 통화만 못 받았거나 받아 둔 값이 있는 채 실패했다(이 종목이 빠졌을 수도 있다) — 띠 한 줄(단계 4)
  const namuHoldStale =
    !(isHardError(krwQ) && isHardError(usdQ)) && (krwQ.isError || usdQ.isError);
  const holdBand = holding && (
    <KvBand
      id="stock-holding"
      title={t("holding.title")}
      rows={holdRows}
      stale={
        namuHoldStale
          ? {
              onRetry: () => {
                if (krwQ.isError) void krwQ.refetch();
                if (usdQ.isError) void usdQ.refetch();
              },
              retrying: krwQ.isFetching || usdQ.isFetching,
            }
          : undefined
      }
    />
  );
  const todayBand =
    !quoteFailed && (quoteQ.isPending || todayRows.length > 0) ? (
      <KvBand
        id="stock-today"
        title={t("today.title")}
        rows={
          quoteQ.isPending
            ? (["open", "high", "low", "volume"] as const).map((k) => ({
                key: k,
                name: t(`today.${k}`),
                value: "",
              }))
            : todayRows
        }
        loading={quoteQ.isPending}
        stale={
          isStaleError(quoteQ)
            ? {
                onRetry: () => void quoteQ.refetch(),
                retrying: quoteQ.isFetching,
              }
            : undefined
        }
      />
    ) : null;
  const quotesBand = quoteFailed ? null : (
    <QuotesBand
      broker="NAMU"
      market={market}
      symbol={symbol}
      currency={currency}
      lastPrice={last}
      changePct={changePct}
      namuBook={{
        data: q?.orderbook ?? null,
        isPending: quoteQ.isPending,
        isError: false,
        refetch: () => void quoteQ.refetch(),
      }}
    />
  );
  const infoBand = (
    <KvBand id="stock-info" title={t("info.title")} rows={infoRows} />
  );
  const showInvestors = market === "KR";

  if (desk)
    return (
      <DeskColumns
        left={
          <>
            <DeskSlot order={1} slot="head">
              <Card>{head}</Card>
            </DeskSlot>
            {showInvestors && (
              <DeskSlot order={5} slot="investor">
                <InvestorCard q={investorsQ} />
              </DeskSlot>
            )}
            <DeskSlot order={7} slot="daily">
              <DailyCard
                symbol={symbol}
                broker="NAMU"
                enabled={afterQuote}
                currency={currency}
                tail={<NamuNotice />}
              />
            </DeskSlot>
          </>
        }
        right={
          <>
            {holdBand && (
              <DeskSlot order={2} slot="holding">
                <Card className="p-0">{holdBand}</Card>
              </DeskSlot>
            )}
            {todayBand && (
              <DeskSlot order={3} slot="today">
                <Card className="p-0">{todayBand}</Card>
              </DeskSlot>
            )}
            {quotesBand && (
              <DeskSlot order={4} slot="quotes">
                <Card className="p-0">{quotesBand}</Card>
              </DeskSlot>
            )}
            <DeskSlot order={6} slot="info">
              <Card className="p-0">{infoBand}</Card>
            </DeskSlot>
          </>
        }
      />
    );

  return (
    <>
      <div>{head}</div>
      {holdBand && flush("holding", holdBand)}
      {flush("today", todayBand)}
      {flush("quotes", quotesBand)}
      {showInvestors && flush("investor", <InvestorBand q={investorsQ} />)}
      {flush("info", infoBand)}
      {flush(
        "daily",
        <DailyBand
          symbol={symbol}
          broker="NAMU"
          enabled={afterQuote}
          currency={currency}
          tail={<NamuNotice />}
        />,
      )}
    </>
  );
}
