/**
 * 나무증권 조회 훅. 토스와 나눠 둔다 — 경로·인증·응답 칸이 증권사마다 다르다.
 *
 * **나무 탭은 늘 나무 값을 부른다**(I-13b 16) — 시세 · 환율 · 차트를 `/v1/securities/**`(사용자의 기본 증권사)가
 * 아니라 `/v1/namu/**` 로. 되풀이 호출(10초 시세 · 5초 체결)은 화면이 보일 때만 돈다 —
 * react-query 의 `refetchIntervalInBackground` 기본값(false)이 그 일을 한다. 한 사람의 키로 그 사람 것만 부른다.
 */
import { POLL_META } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import {
  namuApi,
  type NamuListQuote,
  type NamuMarketState,
} from "../api/namuApi";

const COMMON = { retry: false, refetchOnWindowFocus: false } as const;

/** 나무 보유 종목. 통화가 KRW 면 국내, 그 밖이면 해외 — 서버가 엔드포인트를 가른다. */
export function useNamuHoldings(currency: string) {
  return useQuery({
    queryKey: ["namu", "holdings", currency],
    queryFn: () => namuApi.getHoldings(currency),
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * 관심 그룹 시세 폴링 주기. 서버 시세 캐시(20초)보다 길게 잡는다 —
 * 짧게 잡으면 캐시에 맞는 헛 요청만 늘고 상류 호출은 안 줄어든다.
 */
export const NAMU_WATCH_POLL_MS = 30_000;

/** 시장 띠의 대표 종목 시세 주기 — 장 상태는 분 단위로 보면 된다 */
export const NAMU_MARKET_POLL_MS = 60_000;

/** 나무 목록 시세(다건) — 키는 심볼 집합. 장 상태가 종목마다 딸려 온다 */
export const namuPricesQuery = (
  symbols: string[],
  refetchInterval: number,
) => ({
  queryKey: ["namu", "prices", [...symbols].sort()],
  queryFn: () => namuApi.getPrices(symbols),
  ...COMMON,
  refetchInterval,
  // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
  meta: POLL_META,
});

export const useNamuPrices = (
  symbols: string[],
  refetchInterval = NAMU_MARKET_POLL_MS,
) =>
  useQuery({
    ...namuPricesQuery(symbols, refetchInterval),
    enabled: symbols.length > 0,
  });

/**
 * 원화 환산 환율(USD). **폴링하지 않는다** — 환율은 초 단위로 볼 값이 아니고 서버도 10분 캐시한다.
 * `gcTime` 을 늘려 화면 사이를 오가도 다시 안 묻는다.
 */
export const useNamuExchangeRate = (enabled = true) =>
  useQuery({
    queryKey: ["namu", "exchange-rate", "USD"],
    queryFn: () => namuApi.getExchangeRate("USD"),
    enabled,
    ...COMMON,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

/** 종목 상세 시세 — 10초마다(서버 캐시 20초라 상류는 20초에 한 번). 상세가 보일 때만 */
export const useNamuQuote = (
  market: "KR" | "US" | null,
  symbol: string | null,
) =>
  useQuery({
    queryKey: ["namu", "quote", market, symbol],
    queryFn: () => namuApi.getQuote(market!, symbol!),
    enabled: !!market && !!symbol,
    ...COMMON,
    staleTime: 5_000,
    refetchInterval: 10_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

/** 체결 — 5초마다. **체결 탭이 골라져 있을 때만**(`enabled`) 부른다 */
export const useNamuExecutions = (
  market: "KR" | "US" | null,
  symbol: string | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: ["namu", "executions", market, symbol],
    queryFn: () => namuApi.getExecutions(market!, symbol!, 20),
    enabled: !!market && !!symbol && enabled,
    ...COMMON,
    staleTime: 3_000,
    refetchInterval: 5_000,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

/** 투자자별 매매동향(국내 종목) — 상세를 열 때 한 번, 5분 안에는 다시 안 묻는다 */
export const useNamuInvestors = (symbol: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ["namu", "investors", symbol],
    queryFn: () => namuApi.getInvestors(symbol!, 5),
    enabled: !!symbol && enabled,
    ...COMMON,
    staleTime: 5 * 60_000,
  });

/**
 * 해외 증거금("예수금 · 달러"). 폴링 없음 — 들어올 때, 그리고 창에 돌아왔을 때 60초가 지났으면 다시 묻는다.
 * (보유와 같은 박자 — 보유도 폴링하지 않는다.)
 */
export const useNamuMargin = () =>
  useQuery({
    queryKey: ["namu", "margin"],
    queryFn: () => namuApi.getMargin(),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

/** 시장(국내 · 미국) → 대표 종목의 장 상태. 대표가 없거나 응답에 없으면 null */
export function marketStateOf(
  quotes: NamuListQuote[] | undefined,
  symbol: string | null,
): NamuMarketState | null {
  if (!symbol) return null;
  return quotes?.find((q) => q.symbol === symbol)?.marketState ?? null;
}
