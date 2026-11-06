/**
 * 라이브 시세 한 벌 — 자산 화면 세 곳(목록·상세·편집)이 **같은 규칙**을 쓰게 모아 둔 훅.
 *
 * 흩어져 있던 탓에 실제로 두 번 어긋났다.
 * - 증권사 무관 경로로 옮길 때 목록만 옮기고 상세·편집이 토스 경로에 남아, 나무 사용자는
 *   한 화면에서 총액은 맞고 종목별 평가액만 '—' 였다.
 * - 원화 환산이 "KRW 아니면 USD" 였다. 토스 시절엔 통화가 둘뿐이라 맞았지만 나무를 붙이며
 *   JPY·HKD·CNY 가 들어와, 엔화 종목에 달러 환율을 곱하면 평가액이 백 배 넘게 부푼다.
 *
 * 그래서 **통화별 환율**과 **전일 종가 조달**을 여기 한 곳에 둔다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  securitiesExchangeRateQuery,
  useSecuritiesPrices,
} from "./useSecuritiesPrices";
import { marketTzOfCurrency } from "../lib/prev-close";
import { usePrevCloses } from "./useTossStocks";
import { useMyFeatures } from "@/features/subscription/model/useSubscription";

export interface LiveQuote {
  price: number;
  currency: string;
}

export interface LivePrices {
  /** 원표기 견적 — 통화 기호를 붙여 보여줄 때 쓴다. 환산은 unitKrw 를 써라. */
  quoteOf: (symbol: string) => LiveQuote | undefined;
  /** 1주 원화 환산가. 시세 미확보·환율 미확보면 null — 호출부가 그 자산 평가를 접는다. */
  unitKrw: (symbol: string) => number | null;
  /** 전일 종가의 원화 환산가. 등락 표시 전용 — 없으면 등락을 감춘다. */
  prevUnitKrw: (symbol: string) => number | null;
  /** 견적의 거래 통화. 화면이 통화 기호를 붙일 때 쓴다. */
  currencyOf: (symbol: string) => string | undefined;
  /**
   * 시세 · 환율을 못 받았다(처음 · 받아 둔 값이 있어도) — 평가가 DB 잔액으로 조용히 바뀌거나 옛 시세로 남는다.
   * 화면이 그 카드에 "시세를 불러오지 못했어요" 띠를 둔다(단계 4)
   */
  failed: boolean;
  /** 못 받은 시세 · 환율만 다시 받는다 */
  retry: () => void;
}

/** 원화가 아닌 통화만 환율이 필요하다. */
const foreignCurrenciesOf = (currencies: string[]): string[] =>
  [...new Set(currencies.filter((c) => c && c !== "KRW"))].sort();

/**
 * @param symbols 시세를 볼 종목. 빈 배열이면 아무것도 조회하지 않는다
 * @param enabled 게이트(프로 + 증권사 연결). false 면 조회하지 않는다
 */
export function useLivePrices(symbols: string[], enabled: boolean): LivePrices {
  const { data: features } = useMyFeatures({ reference: true });
  const active = enabled && symbols.length > 0;
  const activeSymbols = useMemo(
    () => (active ? symbols : []),
    [active, symbols],
  );

  const pricesQ = useSecuritiesPrices(activeSymbols);
  const quotes = pricesQ.data;

  // 응답에 실제로 등장한 통화만 환율을 받는다 — 안 쓰는 통화를 미리 묻지 않는다.
  const currencies = useMemo(
    () => foreignCurrenciesOf((quotes ?? []).map((q) => q.currency)),
    [quotes],
  );
  // 설정은 useSecuritiesPrices 에 한 벌로 둔다 — 저기 USD 전용 훅과 queryKey 가 같아서,
  // 옵션을 여기 따로 적으면 한쪽만 고쳐져도 아무 경고 없이 어긋난다.
  const rateQueries = useQueries({
    queries: currencies.map(securitiesExchangeRateQuery),
  });
  const rateByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    rateQueries.forEach((r, i) => {
      const c = currencies[i];
      const rate = r.data?.rate;
      if (c && rate != null && Number.isFinite(rate) && rate > 0)
        m.set(c, rate);
    });
    return m;
    // rateQueries 는 매 렌더 새 배열이라 의존성에 넣으면 무한 갱신이 된다 — 값만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencies, rateQueries.map((r) => r.data?.rate).join(",")]);

  // 전일 종가는 증권사마다 사정이 다르다. 나무는 시세 응답에 딸려 오고, 토스는 캔들을
  // 종목마다 따로 받아야 한다 — 그래서 기본 소스가 토스일 때만 캔들을 부른다.
  // 나무 사용자가 부르면 토스 크리덴셜이 없어 종목 수만큼 403 이 나간다.
  const needsCandles = active && features?.primaryBroker === "TOSS";
  // 전일은 시장 날짜로 가른다 — 시세 응답의 통화로 시장을 정한다(미국은 뉴욕). 시세가 오기 전 심볼은 아직 부르지 않는다(검수 N1)
  const currencyBySymbol = useMemo(
    () => new Map((quotes ?? []).map((q) => [q.symbol, q.currency])),
    [quotes],
  );
  const candleSymbols = useMemo(
    () =>
      needsCandles ? activeSymbols.filter((s) => currencyBySymbol.has(s)) : [],
    [needsCandles, activeSymbols, currencyBySymbol],
  );
  const candlePrevCloses = usePrevCloses(candleSymbols, (s) =>
    marketTzOfCurrency(currencyBySymbol.get(s)),
  );

  const failed =
    active && (pricesQ.isError || rateQueries.some((r) => r.isError));
  // 다시 받기는 부르는 순간의 질의를 본다 — 함수 자체는 늘 같아 아래 묶음이 렌더마다 새로 만들어지지 않는다
  const retryRef = useRef(() => {});
  useEffect(() => {
    retryRef.current = () => {
      if (pricesQ.isError) void pricesQ.refetch();
      for (const r of rateQueries) if (r.isError) void r.refetch();
    };
  });
  const [retryFailed] = useState(() => () => retryRef.current());

  return useMemo(() => {
    const bySymbol = new Map(
      (quotes ?? [])
        .filter((q) => Number.isFinite(q.price))
        .map((q) => [q.symbol, q]),
    );
    const toKrw = (price: number, currency: string): number | null => {
      if (currency === "KRW") return price;
      const rate = rateByCurrency.get(currency);
      // 환율을 못 구한 통화는 환산하지 않는다 — 다른 통화 환율을 대신 곱하면 금액이 통째로 틀린다.
      return rate != null ? price * rate : null;
    };
    return {
      unitKrw: (symbol) => {
        const q = bySymbol.get(symbol);
        return q ? toKrw(q.price, q.currency) : null;
      },
      prevUnitKrw: (symbol) => {
        const q = bySymbol.get(symbol);
        if (!q) return null;
        const prev = q.previousClose ?? candlePrevCloses.get(symbol) ?? null;
        return prev != null && prev > 0 ? toKrw(prev, q.currency) : null;
      },
      quoteOf: (symbol) => {
        const q = bySymbol.get(symbol);
        return q ? { price: q.price, currency: q.currency } : undefined;
      },
      currencyOf: (symbol) => bySymbol.get(symbol)?.currency,
      failed,
      retry: retryFailed,
    };
  }, [quotes, rateByCurrency, candlePrevCloses, failed, retryFailed]);
}
