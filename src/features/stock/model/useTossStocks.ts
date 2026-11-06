/**
 * 토스증권 Open API 연동 react-query 훅.
 * 모든 쿼리는 `retry: false` — 키 미설정(503)·백엔드 미기동 시 즉시 실패시켜 호출부가 mock 으로 폴백한다.
 */
import { POLL_META } from "@/shared/api";
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { stockKeys } from "@/shared/config";
import {
  stockApi,
  type TossRankingDuration,
  type TossRankingType,
} from "../api/stockApi";
import { prevCloseOf } from "../lib/prev-close";
import { useDayKey, useDayKeyOf } from "./useDayKey";

const COMMON = {
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: 15_000,
} as const;

// ---- 개별 엔드포인트 훅 ----------------------------------------------------

/**
 * USD→KRW 환율. `/api/v1/toss/**` 는 서버 게이트(SECURITIES 구독) 대상이라
 * 미구독자가 호출하면 403 → 전역 토스트. 호출부가 구독·필요 여부를 판단해 enabled 를 넘긴다.
 */
export const useTossExchangeRate = (enabled = true) =>
  useQuery({
    queryKey: stockKeys.exchangeRate(),
    queryFn: () => stockApi.getExchangeRate("USD", "KRW"),
    enabled,
    ...COMMON,
    staleTime: 60_000,
  });

export const useTossPrices = (symbols: string[]) =>
  useQuery({
    queryKey: stockKeys.prices(symbols),
    queryFn: () => stockApi.getPrices(symbols),
    enabled: symbols.length > 0,
    ...COMMON,
    // 현재가는 라이브로 — 상세 헤더 가격/등락%·리스트 시세가 주기적으로 갱신된다.
    // (탭이 백그라운드면 react-query 가 기본적으로 폴링 일시정지)
    refetchInterval: 10_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

/**
 * 호가 · 체결은 **고른 탭의 질의만** 켠다(`enabled`, I-13b 21) — 둘 다 늘 5초로 부르면 본인 키 호출이 두 배다.
 * 탭이 백그라운드이면 react-query 가 폴링을 멈춘다(`refetchIntervalInBackground` 기본 false).
 */
export const useTossOrderbook = (symbol: string | null, enabled = true) =>
  useQuery({
    queryKey: stockKeys.orderbook(symbol ?? ""),
    queryFn: () => stockApi.getOrderbook(symbol!),
    enabled: !!symbol && enabled,
    ...COMMON,
    staleTime: 3_000,
    // 호가는 변동이 잦음 → 5초 폴링. 백그라운드 탭 자동 일시정지.
    refetchInterval: 5_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

export const useTossTrades = (
  symbol: string | null,
  count = 20,
  enabled = true,
) =>
  useQuery({
    queryKey: stockKeys.trades(symbol ?? ""),
    queryFn: () => stockApi.getTrades(symbol!, count),
    enabled: !!symbol && enabled,
    ...COMMON,
    staleTime: 3_000,
    // 체결 테이프도 5초 폴링.
    refetchInterval: 5_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

export const useTossPriceLimits = (symbol: string | null) =>
  useQuery({
    queryKey: stockKeys.priceLimits(symbol ?? ""),
    queryFn: () => stockApi.getPriceLimits(symbol!),
    enabled: !!symbol,
    ...COMMON,
  });

export const useTossStockInfo = (symbols: string[]) =>
  useQuery({
    queryKey: stockKeys.stockInfo(symbols),
    queryFn: () => stockApi.getStocks(symbols),
    enabled: symbols.length > 0,
    ...COMMON,
    staleTime: 5 * 60_000,
  });

export const useTossCandles = (
  symbol: string | null,
  interval: "1m" | "1d",
  count?: number,
) =>
  useQuery({
    queryKey: stockKeys.candles(symbol ?? "", `${interval}:${count ?? ""}`),
    queryFn: () =>
      stockApi.getCandles(symbol!, interval, count ? { count } : undefined),
    enabled: !!symbol,
    ...COMMON,
    // 일별표·등락률 계산용 캔들도 주기 갱신 — 1m 은 15초, 1d 는 60초.
    refetchInterval: interval === "1m" ? 15_000 : 60_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

/** 투자자별 매매동향 — 상세를 열 때 한 번, 5분 안에는 다시 안 묻는다(일별 값 · 폴링 없음) */
export const useTossInvestors = (symbol: string | null, enabled = true) =>
  useQuery({
    queryKey: stockKeys.investors(symbol ?? ""),
    queryFn: () => stockApi.getInvestorTrading(symbol!, 5),
    enabled: !!symbol && enabled,
    ...COMMON,
    staleTime: 5 * 60_000,
  });

/**
 * 주문 가능 금액 — 60초마다(초 단위로 볼 값이 아니다 · 보유는 10초 그대로). 화면이 보일 때만.
 * 한도는 `ORDER_INFO` 초당 6회라 한 화면에서 둘(원화 · 달러)을 불러도 넉넉하다.
 */
export const useTossBuyingPower = (
  accountSeq: number | null,
  currency: "KRW" | "USD",
) =>
  useQuery({
    queryKey: stockKeys.buyingPower(accountSeq ?? 0, currency),
    queryFn: () => stockApi.getBuyingPower(accountSeq!, currency),
    enabled: !!accountSeq,
    ...COMMON,
    staleTime: 30_000,
    refetchInterval: 60_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

export const useTossStockWarnings = (symbol: string | null) =>
  useQuery({
    queryKey: stockKeys.warnings(symbol ?? ""),
    queryFn: () => stockApi.getStockWarnings(symbol!),
    enabled: !!symbol,
    ...COMMON,
    staleTime: 5 * 60_000,
  });

// 키에 "오늘" 을 넣는다 — 날이 바뀌면 새로 받는다(어제 달력으로 오늘 장 상태를 판정하지 않는다)
export const useTossMarketCalendarKr = () => {
  const day = useDayKey("Asia/Seoul");
  return useQuery({
    queryKey: stockKeys.marketCalendar("KR", day),
    queryFn: () => stockApi.getMarketCalendarKr(),
    ...COMMON,
    staleTime: 5 * 60_000,
  });
};

export const useTossMarketCalendarUs = () => {
  // 미국 달력의 오늘은 미국 현지 날짜다(토스 문서 date 설명)
  const day = useDayKey("America/New_York");
  return useQuery({
    queryKey: stockKeys.marketCalendar("US", day),
    queryFn: () => stockApi.getMarketCalendarUs(),
    ...COMMON,
    staleTime: 5 * 60_000,
  });
};

export const useTossAccounts = () =>
  useQuery({
    queryKey: stockKeys.accounts(),
    queryFn: () => stockApi.getAccounts(),
    ...COMMON,
    // 폴링은 아니지만 실패를 그 자리 띠가 말한다(단계 4) — 공용 새로 고침 스낵바와 겹치지 않게 같은 표식
    meta: POLL_META,
    staleTime: 5 * 60_000,
  });

export const useTossHoldings = (accountSeq: number | null) =>
  useQuery({
    queryKey: stockKeys.holdings(accountSeq ?? 0),
    queryFn: () => stockApi.getHoldings(accountSeq!),
    enabled: !!accountSeq,
    ...COMMON,
    staleTime: 5_000,
    // 보유종목 평가액은 현재가 반영 → 라이브로 갱신(상세 보유정보·포트폴리오 도넛).
    // 백그라운드 탭은 react-query 가 자동 일시정지.
    refetchInterval: 10_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

// ---- 랭킹 / 시장 지표 / 전일종가 --------------------------------------------

/** 주식 랭킹 (발견 탭). 등락률·거래대금 포함이라 별도 시세 조회가 필요 없다. */
export const useTossRankings = (
  type: TossRankingType,
  marketCountry: "KR" | "US",
  duration: TossRankingDuration,
  opts?: { count?: number; enabled?: boolean },
) =>
  useQuery({
    queryKey: stockKeys.rankings(type, marketCountry, duration),
    queryFn: () =>
      stockApi.getRankings(type, marketCountry, duration, {
        count: opts?.count ?? 20,
      }),
    enabled: opts?.enabled ?? true,
    ...COMMON,
    staleTime: 30_000,
    refetchInterval: 60_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

/** 시장 지표 현재가 (코스피·코스닥 지수 등 토스 카탈로그 8종) */
export const useTossIndicatorPrices = (symbols: string[], enabled = true) =>
  useQuery({
    queryKey: stockKeys.indicators(symbols),
    queryFn: () => stockApi.getIndicatorPrices(symbols),
    enabled: enabled && symbols.length > 0,
    ...COMMON,
    staleTime: 30_000,
    refetchInterval: 60_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

/**
 * 시장 지표 캔들 — 상단 지수 타일의 추이선(스파크라인).
 *
 * **지수 수만큼만 호출이 나간다**(코스피·코스닥 = 2콜). 종목 수에 비례하지 않으므로
 * 유량과 무관하다. 지수는 하루 안에서만 움직이므로 1분봉을 받고, 캐시는 폴링 주기보다
 * 길게 잡아 탭을 오가도 재요청이 안 나가게 한다.
 *
 * 실패해도 화면은 멀쩡하다 — 타일은 숫자만 남고 추이선만 사라진다(`retry: false`).
 */
export const useTossIndicatorCandles = (symbols: string[], enabled = true) => {
  const results = useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ["toss", "indicator-candles", symbol],
      queryFn: () =>
        stockApi.getIndicatorCandles(symbol, "1m" as const, SPARKLINE_POINTS),
      enabled: enabled && !!symbol,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    })),
  });
  return useMemo(() => {
    const map = new Map<string, number[]>();
    results.forEach((r, i) => {
      const sym = symbols[i];
      if (!sym || !r.data) return;
      // 오름차순(과거→현재)으로 세워야 선이 왼쪽에서 오른쪽으로 흐른다.
      const closes = [...r.data]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((c) => Number.parseFloat(c.closePrice))
        .filter(Number.isFinite);
      // 점이 하나뿐이면 선이 아니라 점이다 — 그릴 게 없으므로 넣지 않는다.
      if (closes.length >= 2) map.set(sym, closes);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(","), symbols.join(",")]);
};

/** 스파크라인 한 줄에 쓸 봉 수. 촘촘할수록 선이 자글거리고 적으면 추세가 안 보인다. */
const SPARKLINE_POINTS = 60;

/**
 * 전일 종가. 토스 /prices 에는 기준가·등락률이 없어 일봉에서 도출한다 — 순서 · 시간대 규칙은 `lib/prev-close.ts`.
 * 하루에 한 번 바뀌는 값이라 길게 캐시한다. `tz` 는 시장 시간대(국내 기본 · 미국 America/New_York — 1d 봉은 현지 자정 고정).
 */
export const usePrevClose = (
  symbol: string | null,
  tz: string = "Asia/Seoul",
) => {
  // 키에 시장의 오늘을 넣는다 — 화면을 띄워 둔 채 날이 바뀌면 새로 받는다(검수 N10)
  const day = useDayKey(tz);
  return useQuery({
    queryKey: stockKeys.prevClose(symbol ?? "", tz, day),
    queryFn: async () => {
      const page = await stockApi.getCandles(symbol!, "1d", { count: 3 });
      return prevCloseOf(page.candles, tz);
    },
    enabled: !!symbol,
    ...COMMON,
    staleTime: 10 * 60_000,
  });
};

/**
 * 여러 심볼의 전일 종가 배치 조회 — 투자 자산 보유 종목 등락 계산용.
 * usePrevClose 와 동일 쿼리키를 공유해 상세 화면과 캐시가 겹친다.
 */
export const usePrevCloses = (
  symbols: string[],
  // 필수 — 기본값을 두면 미국 종목이 한국 날짜로 가려져 오늘 봉을 전일로 집는다(검수 N1). `marketTzOfCurrency` 로 정한다
  tzOf: (symbol: string) => string,
): Map<string, number> => {
  const dayOf = useDayKeyOf();
  const results = useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: stockKeys.prevClose(symbol, tzOf(symbol), dayOf(tzOf(symbol))),
      queryFn: async () => {
        const page = await stockApi.getCandles(symbol, "1d", { count: 3 });
        return prevCloseOf(page.candles, tzOf(symbol));
      },
      ...COMMON,
      staleTime: 10 * 60_000,
    })),
  });
  const map = new Map<string, number>();
  results.forEach((r, i) => {
    const sym = symbols[i];
    if (sym && r.data != null) map.set(sym, r.data);
  });
  return map;
};

/** lastPrice 와 전일종가로 등락률(%)을 계산한다. 어느 한쪽이 없으면 null. */
export function changePctOf(
  lastPrice: string | number | null | undefined,
  prevClose: number | null | undefined,
): number | null {
  if (lastPrice == null || prevClose == null || prevClose <= 0) return null;
  const last =
    typeof lastPrice === "number" ? lastPrice : Number.parseFloat(lastPrice);
  if (!Number.isFinite(last)) return null;
  return ((last - prevClose) / prevClose) * 100;
}
