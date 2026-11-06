/**
 * 증권사 무관 시세 훅. 자산 화면이 쓴다 — 증권사를 몰라도 된다.
 */
import { POLL_META } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { securitiesApi } from "../api/securitiesApi";

const COMMON = { retry: false, refetchOnWindowFocus: false } as const;

/**
 * 관심목록 시세 폴링 주기. 서버 나무 시세 캐시 TTL(20초)보다 길게 잡는다 —
 * 짧게 잡으면 캐시에 맞는 헛 요청만 늘고 상류 호출은 안 줄어든다.
 */
export const WATCH_POLL_MS = 30_000;

/**
 * 보유 종목 현재가. 기본 10초 폴링 — 자산 화면이 라이브로 갱신된다.
 *
 * **폴링 주기를 열어 둔 이유** — 나무는 다건 시세 API 가 없어 서버가 종목마다 1콜을 낸다.
 * 서버 캐시 TTL 이 20초(`NamuProperties.quoteCacheTtlSeconds`)라 10초로 조르면 절반은
 * 캐시에 맞고 절반은 그대로 상류로 나가면서 요청 수만 두 배가 된다. 종목이 많은 화면
 * (관심목록)은 TTL 보다 긴 주기를 줘서 한 주기에 한 번만 나가게 한다.
 */
export const useSecuritiesPrices = (
  symbols: string[],
  refetchInterval = 10_000,
) =>
  useQuery({
    queryKey: ["securities", "prices", [...symbols].sort()],
    queryFn: () => securitiesApi.getPrices(symbols),
    enabled: symbols.length > 0,
    ...COMMON,
    refetchInterval,
    // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
    meta: POLL_META,
  });

/**
 * 환율 쿼리 한 벌. **두 곳이 같은 queryKey 를 쓴다** — 아래 `useSecuritiesExchangeRate`(USD 고정)와
 * `useLivePrices` 의 통화별 조회다. 옵션을 각자 적어 두면 한쪽만 고쳐져 조용히 어긋나므로
 * 여기 한 곳에 둔다.
 *
 * **폴링하지 않는다**(`refetchInterval` 없음). 환율은 초 단위로 볼 값이 아니다.
 *
 * **`staleTime` 이 10분인 이유** — 서버가 주는 건 종목 가격이 아니라 **그날의 기준환율**이고
 * (나무 잔고의 당일매매기준환율 · 해외현재가의 원화 환산 환율), 서버도 같은 10분을 캐시한다
 * (`app.namu.fx-cache-ttl-seconds`). 그보다 짧게 조르면 캐시에 맞고 되돌아오는 요청만 늘 뿐
 * 새 값이 나오지 않는다. 예전 60초가 그 상태였다 — 화면 하나가 분당 한 번씩 물었다.
 *
 * **`gcTime` 을 늘린 이유** — 기본 5분이라 화면을 옮겼다 돌아오면 캐시가 이미 버려져
 * `staleTime` 이 아무 일도 못 했다. 값을 30분 들고 있으면 화면 사이를 오가도 다시 안 묻는다.
 */
const FX_STALE_TIME = 10 * 60_000;
const FX_GC_TIME = 30 * 60_000;

export const securitiesExchangeRateQuery = (currency: string) => ({
  queryKey: ["securities", "exchange-rate", currency, "KRW"],
  queryFn: () => securitiesApi.getExchangeRate(currency, "KRW"),
  ...COMMON,
  staleTime: FX_STALE_TIME,
  gcTime: FX_GC_TIME,
});

/** 원화 환산 환율. 못 구하면 rate 가 null 로 온다. */
export const useSecuritiesExchangeRate = (enabled = true) =>
  useQuery({
    ...securitiesExchangeRateQuery("USD"),
    enabled,
  });
