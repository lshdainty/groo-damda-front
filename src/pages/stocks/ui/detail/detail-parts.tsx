import { isHardError } from "@/features/stock/lib/query-state";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, Star } from "lucide-react";
import { useWideSurface } from "@/shared/ds/overlay/use-wide-surface";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/ds/popover";
import { Toggle } from "@/shared/ds/toggle";
import { Card, CardHeader, CardTitle } from "@/shared/ds/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  TableSkeletonRows,
  TableStatusRow,
} from "@/shared/ds/table";
import { Badge } from "@/shared/ds/badge";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { List, ListButtonItem, ListItem } from "@/shared/ds/list";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { Skeleton } from "@/shared/ds/skeleton";
import { TopNavigationIconButton } from "@/shared/ds/top-navigation";
import { cn } from "@/shared/lib/cn";
import { formatMonthDay } from "@/shared/lib/date";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { fmtByCurrency } from "@/features/stock/lib/format";
import { formatChangeRate } from "@/shared/lib/groo/format";
import { tradeClock } from "@/features/stock/lib/market-state";
import type {
  InvestorTradingDay,
  TossOrderbook,
} from "@/features/stock/api/stockApi";
import type { CandleBroker } from "@/features/stock/api/securitiesApi";
import { useNamuExecutions } from "@/features/stock/model/useNamu";
import { useWatchlist } from "@/features/stock/model/useWatchlist";
import {
  useTossOrderbook,
  useTossTrades,
} from "@/features/stock/model/useTossStocks";
import { useDailyCandles } from "@/features/stock/model/useDailyCandles";
import { LightweightStockChart } from "@/features/stock/ui/LightweightStockChart";
import {
  RANGES,
  RANGE_LABEL_KEY,
  useCandleAvailability,
  type Range,
} from "@/features/stock/model/chart-range";
import {
  BandTitle,
  DeltaText,
  KvListItem,
  PctDelta,
} from "@/features/stock/ui/phone/phone-parts";
import { directionOf } from "../../model/invest";

/*
 * 폰 종목 상세 페이지의 조각(I-13 18 ~ 20) — 머리 · 관심 Toggle · 차트 · 키-값 · 호가 · 일별 시세 · 매매.
 * 증권사 무관한 것만 둔다. 금액은 글로 만들어 받는다(가리기 · 통화 반영은 부르는 쪽).
 */

/**
 * 관심 Toggle — 이름 고정 "관심 등록", 눌림은 aria-pressed(켬 선 2.5 · 끔 선 2). 그룹이 둘 이상이면 담을 그룹을 고른다(Q3).
 * 폰은 상단 바 오른쪽 아이콘 단추 + Bottom Sheet. 768 이상(`body`)은 머리 카드 이름 줄 오른쪽 본문 Toggle(보이는 40 · 누르는 44)이고,
 * 고르기는 1280 미만 Bottom Sheet · 이상 Popover(Select 기본 자리)다.
 */
export function WatchToggle({
  symbol,
  marketCode,
  body,
}: {
  symbol: string;
  marketCode?: string;
  /** 본문 Toggle(768 이상 머리 카드) — 없으면 상단 바 아이콘 단추 */
  body?: boolean;
}) {
  const { t } = useTranslation("stocks");
  const wl = useWatchlist();
  const wide = useWideSurface();
  const [picking, setPicking] = useState(false);
  const watched = wl.isWatched(symbol);
  const onPress = () => {
    if (!watched && wl.groups.length > 1) setPicking(true);
    else wl.toggleWatch(symbol, marketCode);
  };
  const pick = (rowId: number) => {
    setPicking(false);
    wl.toggleWatch(symbol, marketCode, rowId);
  };
  const choices = (
    <List aria-label={t("watch.pickGroup")}>
      {wl.groups.map((g) => (
        <ListButtonItem
          key={g.rowId}
          title={g.groupName}
          detail={t("unit.count", { count: g.items.length })}
          onClick={() => pick(g.rowId)}
        />
      ))}
    </List>
  );
  const sheet = (
    <BottomSheet open={picking} onOpenChange={setPicking}>
      <BottomSheetContent title={t("watch.pickGroup")}>
        <BottomSheetBody scrollFog className="px-0">
          {choices}
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
  if (!body)
    return (
      <>
        <TopNavigationIconButton
          aria-label={t("watch.add")}
          aria-pressed={watched}
          aria-disabled={!wl.ready && !wl.failed ? true : undefined}
          onClick={onPress}
        >
          <Star aria-hidden strokeWidth={watched ? 2.5 : 2} />
        </TopNavigationIconButton>
        {sheet}
      </>
    );
  const toggle = (
    <Toggle
      aria-label={t("watch.add")}
      pressed={watched}
      aria-disabled={!wl.ready && !wl.failed ? true : undefined}
      icon={<Star aria-hidden />}
      onClick={(e) => {
        // 그룹이 둘 이상이고 아직 안 담았으면 고르러 간다 — 켬 · 끔은 Toggle 이 먼저 바꾸지 않게 막는다
        if (!watched && wl.groups.length > 1) {
          e.preventDefault();
          setPicking(true);
        }
      }}
      onPressedChange={() => wl.toggleWatch(symbol, marketCode)}
    />
  );
  return wide ? (
    <Popover open={picking} onOpenChange={setPicking}>
      <PopoverAnchor asChild>
        <span className="inline-flex">{toggle}</span>
      </PopoverAnchor>
      <PopoverContent aria-label={t("watch.pickGroup")} align="end">
        {choices}
      </PopoverContent>
    </Popover>
  ) : (
    <>
      {toggle}
      {sheet}
    </>
  );
}

/** 띠 ① 머리 · 차트 — 위 24 · 좌우 24 · 아래 24 */
export function HeadBand({
  name,
  detail,
  priceText,
  pct,
  changeAmount,
  currency,
  approx,
  unavailable,
  failed,
  onRetry,
  warnings,
  loading,
  symbol,
  isUs,
  broker,
  watch,
  chartHeight = 168,
}: {
  name: string;
  detail: string;
  priceText: string;
  pct: number | null;
  /** 전일 종가 대비 변화 금액(부호 있음) — 머리 증감 "▲ 45,200원 · 0.30%". 없으면 퍼센트만 */
  changeAmount?: number | null;
  currency?: string;
  approx?: string;
  unavailable?: string;
  /** 시세 조회가 실패했다(받아 둔 값 없음) — "미지원" 이 아니라 실패 한 벌 + 다시 시도(검수 H4) */
  failed?: boolean;
  onRetry?: () => void;
  warnings?: string[];
  loading?: boolean;
  symbol: string;
  isUs: boolean;
  /** 차트가 부를 증권사 — 그 탭의 증권사 */
  broker: CandleBroker;
  /** 이름 줄 오른쪽 관심 Toggle(768 이상 머리 카드) */
  watch?: ReactNode;
  /** 차트 높이 — 폰 168 · 768 이상 200(지금 데스크톱 그대로) */
  chartHeight?: number;
}) {
  const { t } = useTranslation("stocks");
  const title = (
    <>
      <h2
        id="stock-name"
        className="m-0 text-t7 font-bold text-fg-neutral [overflow-wrap:break-word]"
      >
        {name}
      </h2>
      <p className="m-0 mt-x0_5 text-t3 text-fg-neutral-subtle">{detail}</p>
    </>
  );
  return (
    <section aria-labelledby="stock-name">
      {watch ? (
        <div className="flex items-start justify-between gap-x2">
          <div className="min-w-0">{title}</div>
          <div className="-mt-x1 shrink-0">{watch}</div>
        </div>
      ) : (
        title
      )}
      <div className="mt-x4">
        {loading ? (
          <Skeleton text="t12" className="w-3/5" />
        ) : (
          <p className="m-0 text-t12 font-bold tabular-nums text-fg-neutral">
            {withCommaBreaks(priceText)}
          </p>
        )}
        {pct != null && (
          <div className="mt-x1">
            {changeAmount != null && currency ? (
              <DeltaText
                dir={Math.abs(pct) < 0.005 ? "flat" : pct > 0 ? "up" : "down"}
                text={`${fmtByCurrency(Math.abs(changeAmount), currency)} · ${formatChangeRate(Math.abs(pct), { sign: "none" })}`}
              />
            ) : (
              <PctDelta pct={pct} />
            )}
          </div>
        )}
        {approx && (
          <p className="m-0 mt-x1 text-t3 tabular-nums text-fg-neutral-subtle">
            {approx}
          </p>
        )}
        {failed ? (
          <BandFailure
            title={t("detail.priceFail")}
            onRetry={onRetry ?? (() => {})}
          />
        ) : (
          unavailable && (
            <p className="m-0 mt-x1 text-t3 text-fg-neutral-subtle">
              {unavailable}
            </p>
          )
        )}
      </div>
      {warnings && warnings.length > 0 && (
        <div className="mt-x2 flex flex-wrap gap-x1">
          {warnings.map((w, i) => (
            <Badge key={i} variant="weak" tone="warning" size="medium">
              {w}
            </Badge>
          ))}
        </div>
      )}
      <ChartBlock
        symbol={symbol}
        isUs={isUs}
        broker={broker}
        height={chartHeight}
      />
    </section>
  );
}

/** 차트(05-1 그대로 · 높이 168) + 기간 Segmented 5칸(식별자는 `1D` 그대로, 글만 "1일") */
function ChartBlock({
  symbol,
  isUs,
  broker,
  height,
}: {
  symbol: string;
  isUs: boolean;
  broker: CandleBroker;
  height: number;
}) {
  const { t } = useTranslation("stocks");
  const [range, setRange] = useState<Range>("1D");
  const availability = useCandleAvailability();
  return (
    <div className="mt-x4">
      <div style={availability === "yes" ? undefined : { height }}>
        {availability === "yes" ? (
          <LightweightStockChart
            symbol={symbol}
            isUs={isUs}
            range={range}
            height={height}
            broker={broker}
          />
        ) : availability === "no" ? (
          <div className="flex h-full flex-col items-center justify-center gap-x2 text-center text-t4 text-fg-neutral-subtle">
            <LineChart aria-hidden className="size-7" />
            {t("chart.brokerRequired")}
          </div>
        ) : null}
      </div>
      {availability !== "no" && (
        <SegmentedControl
          className="mt-x3"
          aria-label={t("chart.rangeAria")}
          value={range}
          onValueChange={(v) => setRange(v as Range)}
        >
          {RANGES.map((r) => (
            <SegmentedControlItem key={r} value={r} className="px-x1">
              {t(RANGE_LABEL_KEY[r])}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      )}
    </div>
  );
}

export interface KvLine {
  key: string;
  name: string;
  value: ReactNode;
  tone?: "critical" | "positive" | "informative";
}

/** 키-값 띠 — 구역 제목 + 한 줄에 하나(키 R9 t4 · 값 오른쪽 R13 t5 · 700 · 고정폭) */
export function KvBand({
  title,
  id,
  rows,
  loading,
  failed,
}: {
  title: string;
  id: string;
  rows: KvLine[];
  loading?: boolean;
  /** 실패 한 벌 — 제목 · 설명 · [다시 시도]. 오류 원문은 그리지 않는다 */
  failed?: { title: string; onRetry: () => void };
}) {
  if (failed)
    return (
      <section aria-labelledby={id} className="pb-x6">
        <BandTitle id={id}>{title}</BandTitle>
        <BandFailure band title={failed.title} onRetry={failed.onRetry} />
      </section>
    );
  return (
    <section aria-labelledby={id}>
      <BandTitle id={id}>{title}</BandTitle>
      <List aria-labelledby={id} className="pb-x6">
        {rows.map((r) => (
          <KvListItem
            key={r.key}
            name={r.name}
            value={r.value}
            tone={r.tone}
            loading={loading}
          />
        ))}
      </List>
    </section>
  );
}

// ---- 호가 · 체결 ---------------------------------------------------------------

const ROW = "h-8";
/** 나무 응답은 모든 칸이 null 일 수 있다 — 읽지 못하면 null (NaN 이 막대 폭 · 글로 번지지 않게) */
const fin = (s: string | null | undefined): number | null => {
  if (s == null) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
/** 일별 봉의 문자열 값 — 항상 숫자로 온다(없는 칸은 이미 걸러진 봉) */
const num = (s: string) => Number.parseFloat(s);
const qtyText = (q: number | null) => (q == null ? "—" : q.toLocaleString());

/** 호가 질의 모양 — 토스는 자기 훅, 나무는 상세 시세 응답의 `orderbook`(부르는 쪽이 이 모양으로 넘긴다) */
export interface BookQuery {
  data: TossOrderbook | null | undefined;
  /** 아직 값도 오류도 없다(꺼져 있어 시작 전인 질의 포함) — 이때 "없어요" 를 보이지 않는다 */
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

/**
 * 호가 · 체결 띠 — Segmented [호가, 체결] + 위 12 에 표(`<table>`, 줄 32). 매도 informative · 매수 critical.
 * 두 증권사 공통(I-13b 21) — 호가는 같은 부품 · 같은 이름(`Orderbook` · `Trade`). **고른 탭의 질의만** 켠다(체결 5초 폴링은 체결 탭일 때만).
 * 나무 호가는 상세 시세에 실려 와 서버 캐시(20초)만큼만 바뀐다.
 */
export function QuotesBand({
  broker,
  market,
  symbol,
  currency,
  lastPrice,
  changePct,
  namuBook,
}: {
  broker: "TOSS" | "NAMU";
  /** 나무 체결의 국내 · 미국 갈래 */
  market: "KR" | "US" | null;
  symbol: string;
  currency: string;
  lastPrice: number | null;
  /** 전일 종가를 못 받았으면 null — 가운데 띠에 등락률을 지어내지 않는다(0.00% 금지) */
  changePct: number | null;
  /** 나무 호가 — 상세 시세 질의에서 꺼내 넘긴다 */
  namuBook?: BookQuery;
}) {
  const { t } = useTranslation("stocks");
  const [tab, setTab] = useState<"book" | "tape">("book");
  const toss = broker === "TOSS";
  const tossBookQ = useTossOrderbook(toss ? symbol : null, tab === "book");
  const tossTradesQ = useTossTrades(toss ? symbol : null, 20, tab === "tape");
  const namuTradesQ = useNamuExecutions(
    toss ? null : market,
    symbol,
    tab === "tape",
  );
  const bookQ: BookQuery = toss
    ? tossBookQ
    : (namuBook ?? {
        data: null,
        isPending: false,
        isError: false,
        refetch: () => {},
      });
  const tradesQ = toss ? tossTradesQ : namuTradesQ;
  const fmt = (p: number) => fmtByCurrency(p, currency);
  // 값(가격)이 없는 줄은 그리지 않는다 · 수량이 없으면 칸 "—" 와 막대 0
  const levels = (list: { price: string; volume: string }[] | undefined) =>
    (list ?? [])
      .map((e) => {
        const q = fin(e.volume);
        return { p: fin(e.price), q: q == null ? null : Math.round(q) };
      })
      .filter((e): e is { p: number; q: number | null } => e.p != null)
      .slice(0, 5);
  const asks = levels(bookQ.data?.asks).reverse();
  const bids = levels(bookQ.data?.bids);
  const maxQ = Math.max(
    1,
    ...asks.map((a) => a.q ?? 0),
    ...bids.map((b) => b.q ?? 0),
  );
  const barWidth = (q: number | null) => `${((q ?? 0) / maxQ) * 100}%`;
  const fills = (tradesQ.data ?? [])
    .map((x) => ({ x, p: fin(x.price) }))
    .flatMap(({ x, p }) => (p == null ? [] : [{ x, p }]))
    .slice(0, 12)
    .map(({ x, p }, i, arr) => {
      const prev = i + 1 < arr.length ? arr[i + 1]!.p : p;
      const q = fin(x.volume);
      return {
        time: tradeClock(x.timestamp),
        p,
        q: q == null ? null : Math.round(q),
        dir: p >= prev ? 1 : -1,
      };
    });

  const head = (cols: string[], book = false) => (
    <thead>
      <tr className="text-t3 font-medium text-fg-neutral-subtle">
        {cols.map((c, i) => (
          <th
            key={c}
            scope="col"
            className={cn(
              // 호가 표는 가격 칸이 먼저(줄지 않는다), 잔량 칸은 쉼표 뒤(<wbr>)에서만 줄을 바꿔 남는 폭에 들어온다 — 글자는 줄이지 않고 말줄임 · 축약도 쓰지 않는다(DESIGN.md 돈)
              "px-x1 pb-x1 font-medium first:pl-0 last:pr-0",
              book && i === 1 ? "w-px whitespace-nowrap" : "break-keep",
              i === 0
                ? "text-start"
                : cols.length === 3 && i === 1
                  ? "text-center"
                  : "text-end",
            )}
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
  const bookRow = (e: { p: number; q: number | null }, side: "ask" | "bid") => (
    <tr key={`${side}${e.p}`} className={ROW}>
      <td className="relative p-0">
        {side === "bid" && (
          <>
            <span
              aria-hidden
              className="absolute inset-y-x1 right-0 rounded-[4px] bg-bg-critical-weak"
              style={{ width: barWidth(e.q) }}
            />
            <span className="relative block pr-x1 text-end text-t3 tabular-nums text-fg-neutral-subtle">
              {withCommaBreaks(qtyText(e.q))}
            </span>
          </>
        )}
      </td>
      <td
        className={cn(
          "w-px whitespace-nowrap px-x1 text-center text-t4 font-bold tabular-nums",
          side === "ask" ? "text-fg-informative" : "text-fg-critical",
        )}
      >
        {fmt(e.p)}
      </td>
      <td className="relative p-0">
        {side === "ask" && (
          <>
            <span
              aria-hidden
              className="absolute inset-y-x1 left-0 rounded-[4px] bg-bg-informative-weak"
              style={{ width: barWidth(e.q) }}
            />
            <span className="relative block pl-x1 text-t3 tabular-nums text-fg-neutral-subtle">
              {withCommaBreaks(qtyText(e.q))}
            </span>
          </>
        )}
      </td>
    </tr>
  );

  return (
    <section aria-labelledby="stock-quotes">
      <BandTitle id="stock-quotes">{t("quotes.title")}</BandTitle>
      <div className="px-x6 pb-x6 pt-x1">
        <SegmentedControl
          aria-label={t("quotes.title")}
          value={tab}
          onValueChange={(v) => setTab(v as "book" | "tape")}
        >
          <SegmentedControlItem value="book">
            {t("quotes.orderbook")}
          </SegmentedControlItem>
          <SegmentedControlItem value="tape">
            {t("quotes.trades")}
          </SegmentedControlItem>
        </SegmentedControl>
        <div className="mt-x3">
          {tab === "book" ? (
            bookQ.isPending ? (
              <TableSkeleton label={t("quotes.orderbookLoading")} />
            ) : isHardError(bookQ) ? (
              <BandFailure
                title={t("quotes.orderbookFail")}
                onRetry={() => void bookQ.refetch()}
              />
            ) : asks.length === 0 && bids.length === 0 ? (
              <p className="m-0 py-x3 text-center text-t3 text-fg-neutral-subtle">
                {t("quotes.orderbookEmpty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t("quotes.orderbook")}</caption>
                  {head(
                    [
                      t("orderbook.bidVolume"),
                      t("quotes.tradePrice"),
                      t("orderbook.askVolume"),
                    ],
                    true,
                  )}
                  <tbody>
                    {asks.map((a) => bookRow(a, "ask"))}
                    <tr className={ROW}>
                      <td
                        colSpan={3}
                        className="border-y border-dashed border-stroke-neutral-subtle p-0 text-center"
                      >
                        <span
                          className={cn(
                            "text-t4 font-bold tabular-nums",
                            changePct == null || changePct === 0
                              ? "text-fg-neutral"
                              : changePct > 0
                                ? "text-fg-critical"
                                : "text-fg-informative",
                          )}
                        >
                          {lastPrice != null ? fmt(lastPrice) : "—"}
                        </span>
                        {changePct != null && (
                          <>
                            {" "}
                            <PctDelta pct={changePct} />
                          </>
                        )}
                      </td>
                    </tr>
                    {bids.map((b) => bookRow(b, "bid"))}
                  </tbody>
                </table>
              </div>
            )
          ) : tradesQ.isPending ? (
            <TableSkeleton label={t("quotes.tradesLoading")} />
          ) : isHardError(tradesQ) ? (
            <BandFailure
              title={t("quotes.tradesFail")}
              onRetry={() => void tradesQ.refetch()}
            />
          ) : fills.length === 0 ? (
            <p className="m-0 py-x3 text-center text-t3 text-fg-neutral-subtle">
              {t("quotes.tradesEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <caption className="sr-only">{t("quotes.trades")}</caption>
                {head([
                  t("quotes.tradeTime"),
                  t("quotes.tradePrice"),
                  t("quotes.tradeVolume"),
                ])}
                <tbody>
                  {fills.map((f, i) => (
                    <tr key={i} className={ROW}>
                      <td className="p-0 text-t3 tabular-nums text-fg-neutral-subtle">
                        {f.time}
                      </td>
                      <td
                        className={cn(
                          "p-0 text-end text-t4 font-bold tabular-nums",
                          f.dir > 0
                            ? "text-fg-critical"
                            : "text-fg-informative",
                        )}
                      >
                        {fmt(f.p)}
                      </td>
                      <td className="p-0 text-end text-t3 tabular-nums text-fg-neutral-muted">
                        {qtyText(f.q)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TableSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy aria-label={label} className="flex flex-col gap-x2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

// ---- 일별 시세 + 매매 ------------------------------------------------------------

/** 일별 시세 — 최근 날짜부터 여덟 줄(종가 · 전 거래일 대비 등락률 · 거래량) */
function useDailyRows(symbol: string, broker: CandleBroker, enabled: boolean) {
  const q = useDailyCandles(symbol, broker, enabled);
  const rows = useMemo(() => {
    const asc = [...(q.data?.candles ?? [])].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
    const recent = asc.slice(-9);
    const out: {
      date: string;
      close: number;
      chg: number;
      vol: number;
    }[] = [];
    for (let i = recent.length - 1; i >= 1; i--) {
      const c = recent[i]!;
      const prev = num(recent[i - 1]!.closePrice);
      const close = num(c.closePrice);
      out.push({
        date: c.timestamp.slice(0, 10),
        close,
        chg: prev > 0 ? ((close - prev) / prev) * 100 : 0,
        vol: Math.round(num(c.volume)),
      });
    }
    return out.slice(0, 8);
  }, [q.data]);
  return { q, rows };
}

/** 일별 시세 띠 — List 줄: 제목 날짜 "10월 23일" · 설명 "거래량 …" · 오른쪽 종가 + 등락률. `tail` 은 끝에 오는 매매(토스) */
export function DailyBand({
  symbol,
  broker,
  enabled = true,
  currency,
  tail,
}: {
  symbol: string;
  broker: CandleBroker;
  /** 나무 상세는 상세 시세 질의가 끝난 뒤에 연다(처음 한꺼번에 몰리지 않게) */
  enabled?: boolean;
  currency: string;
  tail?: ReactNode;
}) {
  const { t } = useTranslation("stocks");
  const { q, rows } = useDailyRows(symbol, broker, enabled);
  return (
    <section aria-labelledby="stock-daily" className="pb-x6">
      <BandTitle id="stock-daily">{t("daily.title")}</BandTitle>
      {q.isPending ? (
        <List aria-busy aria-label={t("daily.loading")}>
          {Array.from({ length: 5 }, (_, i) => (
            <ListItem
              key={i}
              title={<Skeleton text="t5" className="w-1/4" />}
              detail={<Skeleton text="t3" className="mt-x0_5 w-1/3" />}
              suffix={<Skeleton text="t5" className="w-20" />}
            />
          ))}
        </List>
      ) : isHardError(q) ? (
        <BandFailure
          band
          title={t("daily.failTitle")}
          onRetry={() => void q.refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="m-0 px-x6 py-x3 text-center text-t3 text-fg-neutral-subtle">
          {t("daily.empty")}
        </p>
      ) : (
        <List aria-labelledby="stock-daily">
          {rows.map((r) => (
            <ListItem
              key={r.date}
              title={formatMonthDay(new Date(`${r.date}T00:00:00`))}
              detail={t("daily.volumeDesc", { count: r.vol.toLocaleString() })}
              suffix={
                <span className="flex flex-col items-end">
                  <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
                    {withCommaBreaks(fmtByCurrency(r.close, currency))}
                  </span>
                  <span className="mt-x0_5">
                    <PctDelta pct={r.chg} />
                  </span>
                </span>
              }
            />
          ))}
        </List>
      )}
      {tail}
    </section>
  );
}

/**
 * 일별 시세 카드(768 이상, I-13 34) — 머리 "일별 시세" + ds Table(머리 41 · 줄 45 · 일자 · 종가 · 등락률 · 거래량, 카드 가장자리까지).
 * `tail` 은 끝에 오는 매매(토스 — 위 20 · 좌우 24 · 아래 24).
 */
export function DailyCard({
  symbol,
  broker,
  enabled = true,
  currency,
  tail,
}: {
  symbol: string;
  broker: CandleBroker;
  enabled?: boolean;
  currency: string;
  tail?: ReactNode;
}) {
  const { t } = useTranslation("stocks");
  const { q, rows } = useDailyRows(symbol, broker, enabled);
  return (
    <Card body="list" aria-labelledby="stock-daily">
      <CardHeader>
        <CardTitle id="stock-daily">{t("daily.title")}</CardTitle>
      </CardHeader>
      <Table caption={t("daily.title")} className="mt-x2">
        <TableHeader>
          <TableRow>
            <TableHead>{t("daily.date")}</TableHead>
            <TableHead align="end">{t("daily.close")}</TableHead>
            <TableHead align="end">{t("daily.changeRate")}</TableHead>
            <TableHead align="end">{t("daily.volume")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isPending ? (
            <TableSkeletonRows
              rows={5}
              columns={[
                { align: "start", width: "64px" },
                { align: "end", width: "80px" },
                { align: "end", width: "56px" },
                { align: "end", width: "64px" },
              ]}
            />
          ) : isHardError(q) ? (
            <TableStatusRow>
              <BandFailure
                band
                title={t("daily.failTitle")}
                onRetry={() => void q.refetch()}
              />
            </TableStatusRow>
          ) : rows.length === 0 ? (
            <TableStatusRow>
              <p className="m-0 py-x3 text-center text-t3 text-fg-neutral-subtle">
                {t("daily.empty")}
              </p>
            </TableStatusRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.date}>
                <TableRowHeader>
                  {formatMonthDay(new Date(`${r.date}T00:00:00`))}
                </TableRowHeader>
                <TableCell align="end">
                  {fmtByCurrency(r.close, currency)}
                </TableCell>
                <TableCell align="end">
                  <PctDelta pct={r.chg} />
                </TableCell>
                <TableCell align="end">{r.vol.toLocaleString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {tail && <div className="pb-x3">{tail}</div>}
    </Card>
  );
}

// ---- 투자자별 매매동향(국내 종목만 — I-13b 22) ------------------------------------

/** 순매수 주 수 → 방향 + 부호 없는 쉼표 글. null → "—"(토스 당일 잠정 개인), 0 → "0" 화살표 없음 */
function investorValue(v: string | null): {
  dir: "up" | "down" | "flat";
  text: string;
} {
  if (v == null || v.trim() === "" || !Number.isFinite(Number(v)))
    return { dir: "flat", text: "—" };
  const n = Number(v);
  return { dir: directionOf(n), text: Math.abs(n).toLocaleString() };
}

/**
 * 값 한 칸 — 순매수 ▲ critical · 순매도 ▼ informative(부호 없음). **null "—" · 0 "0" 은 화살표 없는 보조 글**이다 —
 * ds Delta flat 은 "변화 없음" 이라 이 자리(값 없음 · 순매수 0)에 맞지 않는다(I-13b 22).
 */
function InvestorCell({
  v,
}: {
  v: { dir: "up" | "down" | "flat"; text: string };
}) {
  if (v.dir === "flat")
    return (
      <span className="text-t3 font-medium tabular-nums text-fg-neutral-subtle">
        {v.text}
      </span>
    );
  return <DeltaText dir={v.dir} text={withCommaBreaks(v.text)} />;
}

const investorDate = (d: string) => {
  const date = new Date(`${d.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? d : formatMonthDay(date);
};

/** 투자자별 질의 모양 — 토스 · 나무가 같은 응답이라 부르는 쪽이 이 모양으로 넘긴다 */
export interface InvestorQuery {
  data: InvestorTradingDay[] | undefined;
  /** 아직 값도 오류도 없다(꺼져 있어 시작 전인 질의 포함) — 이때 "없어요" 를 보이지 않는다 */
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

function InvestorUnit() {
  const { t } = useTranslation("stocks");
  return (
    <span className="min-w-0 text-t4 text-fg-neutral-subtle">
      {t("investor.unit")}
    </span>
  );
}

/**
 * 폰 "투자자별 매매동향" 띠 — 구역 제목 + 오른쪽 보조 글, List 줄 다섯(최신이 위):
 * 제목 날짜 · 오른쪽 세 줄(라벨 폭 40 오른쪽 맞춤 + 사이 8 + 값). 빈 목록은 안내 줄.
 */
export function InvestorBand({ q }: { q: InvestorQuery }) {
  const { t } = useTranslation("stocks");
  const rows = (q.data ?? []).slice(0, 5);
  const sides = [
    ["individual", "investor.individual"],
    ["foreigner", "investor.foreigner"],
    ["institution", "investor.institution"],
  ] as const;
  return (
    <section aria-labelledby="stock-investor" className="pb-x6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-x2 gap-y-x0_5 px-x6 pb-x1 pt-x6">
        <h2
          id="stock-investor"
          className="m-0 text-t5 font-bold text-fg-neutral"
        >
          {t("investor.title")}
        </h2>
        <InvestorUnit />
      </div>
      {q.isPending ? (
        <List aria-busy aria-label={t("investor.loading")}>
          {Array.from({ length: 5 }, (_, i) => (
            <ListItem
              key={i}
              title={<Skeleton text="t5" className="w-1/4" />}
              suffix={<Skeleton text="t3" className="h-14 w-24" />}
            />
          ))}
        </List>
      ) : isHardError(q) ? (
        <BandFailure
          band
          title={t("investor.failTitle")}
          onRetry={() => void q.refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="m-0 px-x6 pb-x3 pt-x1 text-t4 text-fg-neutral-subtle">
          {t("investor.empty")}
        </p>
      ) : (
        <List aria-labelledby="stock-investor">
          {rows.map((r) => (
            <ListItem
              key={r.date}
              title={investorDate(r.date)}
              suffix={
                // 라벨 칸은 고정 폭이 아니라 "가장 긴 낱말 폭까지" 넓어진다 — 영어 Individual · Foreign · Institution 이 낱말 중간에서
                // 꺾이지 않는다(한국어는 40 그대로: 최소 2.5rem). 값 칸이 먼저 줄어든다. 줄 안이 좁으면 ds List 가 값을 본문 아래로 내린다(list.md).
                <span className="grid max-w-[60cqw] @max-[calc(16rem+48px)]/list-item:max-w-none grid-cols-[minmax(2.5rem,max-content)_minmax(0,1fr)] items-baseline gap-x-x2 gap-y-x0_5">
                  {sides.map(([k, label]) => {
                    const v = investorValue(r[k]);
                    return (
                      <Fragment key={k}>
                        <span className="text-end text-t3 text-fg-neutral-subtle [overflow-wrap:normal]">
                          {t(label)}
                        </span>
                        <span className="justify-self-end">
                          <InvestorCell v={v} />
                        </span>
                      </Fragment>
                    );
                  })}
                </span>
              }
            />
          ))}
        </List>
      )}
    </section>
  );
}

/** 768 이상 "투자자별 매매동향" 카드 — ds Table(머리 41 · 줄 45): 일자 · 개인 · 외국인 · 기관. 숫자 열은 줄바꿈을 허용한다 */
export function InvestorCard({ q }: { q: InvestorQuery }) {
  const { t } = useTranslation("stocks");
  const rows = (q.data ?? []).slice(0, 5);
  const cell = (v: string | null) => <InvestorCell v={investorValue(v)} />;
  return (
    <Card body="list" aria-labelledby="stock-investor">
      <CardHeader>
        <CardTitle id="stock-investor">{t("investor.title")}</CardTitle>
        <InvestorUnit />
      </CardHeader>
      <Table caption={t("investor.title")} className="mt-x2">
        <TableHeader>
          <TableRow>
            <TableHead>{t("daily.date")}</TableHead>
            <TableHead align="end">{t("investor.individual")}</TableHead>
            <TableHead align="end">{t("investor.foreigner")}</TableHead>
            <TableHead align="end">{t("investor.institution")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isPending ? (
            <TableSkeletonRows
              rows={5}
              columns={[
                { align: "start", width: "64px" },
                { align: "end", width: "72px" },
                { align: "end", width: "72px" },
                { align: "end", width: "72px" },
              ]}
            />
          ) : isHardError(q) ? (
            <TableStatusRow>
              <BandFailure
                band
                title={t("investor.failTitle")}
                onRetry={() => void q.refetch()}
              />
            </TableStatusRow>
          ) : rows.length === 0 ? (
            <TableStatusRow>
              <p className="m-0 py-x3 text-center text-t4 text-fg-neutral-subtle">
                {t("investor.empty")}
              </p>
            </TableStatusRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.date}>
                <TableRowHeader>{investorDate(r.date)}</TableRowHeader>
                <TableCell align="end">{cell(r.individual)}</TableCell>
                <TableCell align="end">{cell(r.foreigner)}</TableCell>
                <TableCell align="end">{cell(r.institution)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

/**
 * 매도 · 매수(국내 통념 — 매도 brandSolid · 매수 criticalSolid, large 48 한 줄 반씩 · 사이 8) + 이유 줄 + 수수료 Callout + 안내 두 줄.
 * 주문은 아직 없다 — 사용자 결정 D3 B(10-30): 가짜 완료 · "준비중" 띠를 걷고, 단추는 남기되 막고(disabled — 색은 스펙의 비활성 전용 색)
 * 그 밑에 이유 줄 "주문은 곧 열려요." 를 둔다. 막힌 단추는 이유 줄을 aria-describedby 로 이어 읽힌다.
 */
export function TradeTail({ isUs }: { isUs: boolean }) {
  const { t } = useTranslation("stocks");
  const reasonId = useId();
  return (
    <div className="px-x6 pt-x5">
      <div className="flex gap-x2">
        <Button
          variant="brandSolid"
          size="large"
          className="flex-1"
          disabled
          aria-describedby={reasonId}
        >
          {t("trade.sell")}
        </Button>
        <Button
          variant="criticalSolid"
          size="large"
          className="flex-1"
          disabled
          aria-describedby={reasonId}
        >
          {t("trade.buy")}
        </Button>
      </div>
      <Callout id={reasonId} tone="neutral" className="mt-x3">
        {t("trade.pending")}
      </Callout>
      <Callout tone="informative" className="mt-x3">
        {isUs ? t("fee.us") : t("fee.kr")}
      </Callout>
      <p className="m-0 mt-x3 text-center text-t3 text-fg-neutral-subtle">
        {t("disclaimer.line1")}
        <br />
        {t("disclaimer.line2")}
      </p>
    </div>
  );
}

/** 나무 상세 아래 안내 — 둘째 줄(시세는 참고용)만. 첫 증권사 문구를 띄우지 않는다(I-13 21) */
export function NamuNotice() {
  const { t } = useTranslation("stocks");
  return (
    <p className="m-0 px-x6 pt-x5 text-center text-t3 text-fg-neutral-subtle">
      {t("disclaimer.line2")}
    </p>
  );
}
