/**
 * 종목 마스터 검색 react-query 훅 (서버 stock_master — KIS 마스터파일 daily 동기화).
 *
 * 기존 클라이언트 KRX JSON(국내 전용) 검색을 대체한다. 국내(KOSPI/KOSDAQ/KONEX)에 더해
 * 미국·중국·일본·홍콩·베트남 종목까지 한글명·영문명·심볼로 검색된다.
 * 검색은 구독 게이트 없음(로그인만) — 시세·연결은 기존 토스 게이트가 지킨다.
 */
import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { stockKeys } from "@/shared/config";
import { stockApi, type StockMasterItem } from "../api/stockApi";

/** 이름(한/영)·심볼 부분일치 검색 상위 [limit]개. 정확 일치 > prefix > 부분 일치 순 정렬은 서버가 보장. */
export function useStockSearch(keyword: string, limit = 8) {
  const term = keyword.trim();
  return useQuery({
    queryKey: stockKeys.search(term),
    queryFn: () => stockApi.searchStocks(term, { size: limit }),
    enabled: term.length > 0,
    retry: false,
    // 마스터는 하루 1회 갱신 데이터라 세션 내 재검색은 캐시로 충분하다.
    staleTime: 5 * 60_000,
    select: (page): StockMasterItem[] => page.content,
  });
}

/**
 * 심볼 → 종목 마스터 1건 (상세 헤더·관심 추가용). 심볼 정확 일치만 취하고 없으면 null.
 * 국내 005930 과 상해 600519 처럼 시장 간 심볼이 겹칠 수 있어 토스 시세 대상(KR/US) 시장을 우선한다.
 */
export function useStockBySymbol(
  symbol: string | null | undefined,
  opts?: ReferenceOpts,
) {
  const sym = (symbol ?? "").trim();
  return useQuery({
    queryKey: stockKeys.symbolName(sym),
    queryFn: async (): Promise<StockMasterItem | null> => {
      const page = await stockApi.searchStocks(
        sym,
        { size: 20 },
        referenceSilent(opts),
      );
      const exact = page.content.filter(
        (s) => s.symbol.toUpperCase() === sym.toUpperCase(),
      );
      if (exact.length === 0) return null;
      const tossPriority = exact.find(
        (s) => s.countryCode === "KR" || s.countryCode === "US",
      );
      return tossPriority ?? exact[0]!;
    },
    enabled: sym.length > 0,
    ...referenceMeta(opts),
    retry: false,
    staleTime: 60 * 60_000,
  });
}

/** 심볼 → 한글 종목명 (연결된 종목 표시용). */
export function useStockSymbolName(symbol: string | null | undefined) {
  const query = useStockBySymbol(symbol, { reference: true });
  return {
    ...query,
    data: query.data?.nameKr ?? (query.data === null ? null : undefined),
  };
}
