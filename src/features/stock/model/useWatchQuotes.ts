/**
 * 관심 그룹 시세 — 보이는 심볼만 한 번에(50 씩) 부르고, 받은 값은 안 보이게 돼도 남긴다(I-13 22).
 *
 * 심볼 목록은 부르는 쪽이 만든다(보이는 그룹의 합 — `visibleSymbols`). 여기서는 나누어 부르고 모은다.
 * 한 사람의 키로 그 사람 것만 부른다 — 공유 캐시 · 묶음 조회를 만들지 않는다.
 */
import { POLL_META } from "@/shared/api";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { stockKeys } from "@/shared/config";
import { stockApi } from "../api/stockApi";
import { marketTzOfCurrency } from "../lib/prev-close";
import { chunkSymbols } from "../lib/watch-prices";
import { changePctOf, usePrevCloses } from "./useTossStocks";
import { namuPricesQuery, NAMU_WATCH_POLL_MS } from "./useNamu";

/** 한 종목의 표시용 시세. 못 구한 값은 null — 행이 '—' 로 접는다. */
export interface RowQuote {
  price: number | null;
  changePct: number | null;
}

const NONE: RowQuote = { price: null, changePct: null };

/**
 * 받은 값을 모아 둔다 — 심볼 목록에서 빠져도(그룹이 화면 밖으로 나가도) 값은 남는다.
 * 새로 받은 값이 오면 렌더 중에 합친다(effect 로 상태를 되돌려 맞추지 않는다).
 */
function useKept<V>(fresh: Map<string, V>): Map<string, V> {
  const stamp = useMemo(
    () => [...fresh].map(([k, v]) => `${k}:${JSON.stringify(v)}`).join("|"),
    [fresh],
  );
  const [seen, setSeen] = useState("");
  const [kept, setKept] = useState<Map<string, V>>(() => new Map());
  if (stamp !== seen) {
    setSeen(stamp);
    if (fresh.size > 0) setKept((prev) => new Map([...prev, ...fresh]));
  }
  return kept;
}

/** 토스 — 시세 다건 1콜(50 씩) + 전일 종가(보이는 심볼마다 일봉, 캐시 10분) */
export function useTossWatchQuotes(symbols: string[]) {
  const chunks = useMemo(() => chunkSymbols(symbols), [symbols]);
  const results = useQueries({
    queries: chunks.map((c) => ({
      queryKey: stockKeys.prices(c),
      queryFn: () => stockApi.getPrices(c),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      refetchInterval: 10_000,
      // 되풀이해 받는 시세 — 다시 받기 실패는 공용 스낵바가 아니라 그 자리가 알린다
      meta: POLL_META,
    })),
  });
  // 전일 종가는 시장 날짜로 가른다 — 시세 응답의 통화로 시장을 정한다(미국은 뉴욕). 통화를 모르는 심볼(시세 전)은 아직 부르지 않아
  // 한국 날짜로 잘못 집지 않는다(검수 N1)
  const currencyBySymbol = new Map<string, string>();
  for (const r of results)
    for (const p of r.data ?? []) currencyBySymbol.set(p.symbol, p.currency);
  const prevCloses = usePrevCloses(
    symbols.filter((s) => currencyBySymbol.has(s)),
    (s) => marketTzOfCurrency(currencyBySymbol.get(s)),
  );
  const freshPrices = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of results)
      for (const p of r.data ?? []) {
        const v = Number.parseFloat(p.lastPrice);
        if (Number.isFinite(v)) map.set(p.symbol, v);
      }
    return map;
    // results 는 매 렌더 새 배열이다 — 받은 시각이 바뀔 때만 다시 센다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join()]);
  const prices = useKept(freshPrices);
  const prevs = useKept(prevCloses);
  return {
    isLoading: results.some((r) => r.isLoading),
    isError: results.length > 0 && results.every((r) => r.isError),
    /**
     * 못 받은 묶음이 있다 — 값 없이 처음 실패한 묶음이 있으면 "load"(그 자리 Result Section), 실패한 묶음이 모두 받아 둔
     * 값이 있으면 "stale"(Callout — 보이는 값은 마지막으로 받은 시세). 아니면 null(단계 4)
     */
    // 값 없이 처음 실패한 묶음이 있으면 그 자리 Result Section(값이 없을 때의 규칙 — 검수 2차 L4)
    failed: results.some((r) => r.isError && r.data === undefined)
      ? ("load" as const)
      : results.some((r) => r.isError)
        ? ("stale" as const)
        : null,
    retrying: results.some((r) => r.isFetching),
    retry: () => {
      for (const r of results) if (r.isError) void r.refetch();
    },
    priceOf: (symbol: string): RowQuote => {
      const price = prices.get(symbol) ?? null;
      return price == null
        ? NONE
        : { price, changePct: changePctOf(price, prevs.get(symbol)) };
    },
  };
}

/**
 * 나무 — `/v1/namu/prices`(상한 50 · 서버 캐시 20초 · 예산 4초), 30초 주기. 전일 종가는 시세에 실려 온다.
 * 기본 증권사가 아니라 나무로 부른다(I-13b 16) — 경로만 바뀌고 묶음 · 주기 · 규칙은 I-13 22 그대로다.
 */
export function useNamuWatchQuotes(symbols: string[]) {
  const chunks = useMemo(() => chunkSymbols(symbols), [symbols]);
  const results = useQueries({
    queries: chunks.map((c) => namuPricesQuery(c, NAMU_WATCH_POLL_MS)),
  });
  const fresh = useMemo(() => {
    const map = new Map<string, RowQuote>();
    for (const r of results)
      for (const q of r.data ?? []) {
        const changePct =
          q.previousClose != null && q.previousClose > 0
            ? ((q.price - q.previousClose) / q.previousClose) * 100
            : null;
        map.set(q.symbol, {
          price: Number.isFinite(q.price) ? q.price : null,
          changePct,
        });
      }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join()]);
  const kept = useKept(fresh);
  return {
    isLoading: results.some((r) => r.isLoading),
    isError: results.length > 0 && results.every((r) => r.isError),
    /**
     * 못 받은 묶음이 있다 — 값 없이 처음 실패한 묶음이 있으면 "load"(그 자리 Result Section), 실패한 묶음이 모두 받아 둔
     * 값이 있으면 "stale"(Callout — 보이는 값은 마지막으로 받은 시세). 아니면 null(단계 4)
     */
    // 값 없이 처음 실패한 묶음이 있으면 그 자리 Result Section(값이 없을 때의 규칙 — 검수 2차 L4)
    failed: results.some((r) => r.isError && r.data === undefined)
      ? ("load" as const)
      : results.some((r) => r.isError)
        ? ("stale" as const)
        : null,
    retrying: results.some((r) => r.isFetching),
    retry: () => {
      for (const r of results) if (r.isError) void r.refetch();
    },
    priceOf: (symbol: string): RowQuote => kept.get(symbol) ?? NONE,
  };
}
