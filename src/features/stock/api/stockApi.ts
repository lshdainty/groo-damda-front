/**
 * 토스증권 Open API 연동 클라이언트 (백엔드 조회 프록시 `/api/v1/toss/**` 호출).
 * 백엔드 응답 계약(com.porest.desk.toss.dto)에 정확히 맞춘 타입.
 * 가격·수량·금액은 백엔드가 정밀도 보존을 위해 String 으로 내려주므로 그대로 string 으로 받는다.
 *
 * 키 미설정 시 백엔드가 503(TOSS_NOT_CONFIGURED)을 반환 → 호출부에서 mock 폴백.
 */
import { apiClient, silentConfig, type SilentOpts } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";

// ---- 응답 타입 (백엔드 toss DTO 미러) -------------------------------------

export interface TossPrice {
  symbol: string;
  timestamp: string | null;
  lastPrice: string;
  currency: string;
}

export interface TossOrderbookEntry {
  price: string;
  volume: string;
}

export interface TossOrderbook {
  timestamp: string | null;
  currency: string;
  asks: TossOrderbookEntry[];
  bids: TossOrderbookEntry[];
}

export interface TossTrade {
  price: string;
  volume: string;
  timestamp: string;
  currency: string;
}

export interface TossCandle {
  timestamp: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  currency: string;
}

/**
 * 백엔드 candle 응답 원형 — groo-core CursorResponse<Candle>.
 * 클라 내부에서는 {@link TossCandlePage}(candles/nextBefore)로 정규화해 사용한다.
 */
export interface TossCandleCursorPage {
  content: TossCandle[];
  meta: { size: number; hasNext: boolean; nextCursor: string | null };
}

/** 클라 내부 정규화 캔들 페이지 (content→candles, meta.nextCursor→nextBefore). */
export interface TossCandlePage {
  candles: TossCandle[];
  nextBefore: string | null;
}

/** 국내 종목 전용 상세(KOSPI/KOSDAQ 등). 해외 종목은 null. */
export interface TossKrMarketDetail {
  liquidationTrading: boolean;
  nxtSupported: boolean;
  krxTradingSuspended: boolean;
  nxtTradingSuspended: boolean;
}

export interface TossStockInfo {
  symbol: string;
  name: string;
  englishName: string;
  isinCode: string;
  market: string;
  securityType: string;
  isCommonShare: boolean;
  status: string;
  currency: string;
  listDate: string | null;
  delistDate: string | null;
  sharesOutstanding: string;
  leverageFactor: string | null;
  /** 국내 종목 상세(거래정지 등). 거래정지 판정은 status 가 아니라 krxTradingSuspended 로. */
  koreanMarketDetail: TossKrMarketDetail | null;
}

export interface TossStockWarning {
  warningType: string;
  exchange: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface TossExchangeRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  midRate: string;
  basisPoint: string;
  rateChangeType: "UP" | "EQUAL" | "DOWN";
  validFrom: string;
  validUntil: string;
}

/** 시장 세션 (시작/종료 시각). 휴장이면 상위에서 null */
export interface TossMarketSession {
  startTime: string;
  endTime: string;
}

export interface TossKrIntegratedHour {
  preMarket: TossMarketSession | null;
  regularMarket: TossMarketSession | null;
  afterMarket: TossMarketSession | null;
}

export interface TossKrMarketDay {
  date: string;
  integrated: TossKrIntegratedHour | null;
}

export interface TossKrMarketCalendar {
  today: TossKrMarketDay;
  previousBusinessDay: TossKrMarketDay;
  nextBusinessDay: TossKrMarketDay;
}

export interface TossUsMarketDay {
  date: string;
  dayMarket: TossMarketSession | null;
  preMarket: TossMarketSession | null;
  regularMarket: TossMarketSession | null;
  afterMarket: TossMarketSession | null;
}

export interface TossUsMarketCalendar {
  today: TossUsMarketDay;
  previousBusinessDay: TossUsMarketDay;
  nextBusinessDay: TossUsMarketDay;
}

export interface TossAccount {
  accountNo: string;
  accountSeq: number;
  accountType: string;
}

/** 통화별 금액 (원화 필수, 외화 nullable) */
export interface TossPriceAmount {
  krw: string;
  usd: string | null;
}

export interface TossHoldingsItem {
  symbol: string;
  name: string;
  marketCountry: string;
  currency: string;
  quantity: string;
  lastPrice: string;
  averagePurchasePrice: string;
  marketValue: {
    purchaseAmount: string;
    amount: string;
    amountAfterCost: string;
  };
  profitLoss: {
    amount: string;
    amountAfterCost: string;
    rate: string;
    rateAfterCost: string;
  };
  dailyProfitLoss: { amount: string; rate: string };
  cost: { commission: string; tax: string | null };
}

export interface TossHoldings {
  totalPurchaseAmount: TossPriceAmount;
  marketValue: { amount: TossPriceAmount; amountAfterCost: TossPriceAmount };
  profitLoss: {
    amount: TossPriceAmount;
    amountAfterCost: TossPriceAmount;
    rate: string;
    rateAfterCost: string;
  };
  dailyProfitLoss: { amount: TossPriceAmount; rate: string };
  items: TossHoldingsItem[];
}

export interface TossPriceLimit {
  timestamp: string;
  upperLimitPrice: string | null;
  lowerLimitPrice: string | null;
  currency: string;
}

/**
 * 투자자별 순매수(주) 하루 — 토스 · 나무가 같은 모양(서버가 맞춘다). 최신이 먼저.
 * 토스는 당일 잠정 기록의 개인이 null 이다 — 그대로 둔다("—").
 */
export interface InvestorTradingDay {
  date: string;
  individual: string | null;
  foreigner: string | null;
  institution: string | null;
}

/** 주문 가능 금액 — KRW 는 정수(원), USD 는 소수 문자열 */
export interface TossBuyingPower {
  currency: string;
  cashBuyingPower: string | null;
}

// ---- 종목 마스터 (서버 stock_master, KIS daily 동기화) ----------------------

export type StockSecurityType = "STOCK" | "ETF" | "INDEX" | "WARRANT";

/** 종목 마스터 1건 — 백엔드 StockApiDto.StockResponse 미러 */
export interface StockMasterItem {
  rowId: number;
  /** KR, US, CN, JP, HK, VN */
  countryCode: string;
  /** KOSPI, KOSDAQ, KONEX, KRX_IDX, NAS, NYS, AMS, SHS, SHI, SZS, SZI, TSE, HKS, HNX, HSX */
  marketCode: string;
  symbol: string;
  standardCode: string | null;
  nameKr: string;
  nameEn: string | null;
  securityType: StockSecurityType;
  currency: string;
}

/** groo-core PageResponse 미러 */
export interface StockSearchPage {
  content: StockMasterItem[];
  meta: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ---- 랭킹 / 시장 지표 -------------------------------------------------------

export type TossRankingType =
  | "MARKET_TRADING_AMOUNT"
  | "MARKET_TRADING_VOLUME"
  | "TOP_GAINERS"
  | "TOP_LOSERS"
  | "TOSS_SECURITIES_TRADING_AMOUNT"
  | "TOSS_SECURITIES_TRADING_VOLUME";

export type TossRankingDuration =
  "realtime" | "1d" | "1w" | "1mo" | "3mo" | "6mo" | "1y";

export interface TossRankingItem {
  rank: number;
  symbol: string;
  currency: string;
  /** changeRate 는 소수 비율(0.0125 = 1.25%). TOP_GAINERS/LOSERS 는 기간, 나머지는 전일 대비 */
  price: { lastPrice: string; basePrice: string; changeRate: string | null };
  tradingVolume: string;
  tradingAmount: string;
}

export interface TossRankingResponse {
  rankedAt: string | null;
  rankings: TossRankingItem[];
}

/** 시장 지표 현재가 (지수: 포인트, 국채: 수익률 %). 토스 카탈로그 8종만 지원 */
export interface TossIndicatorPrice {
  symbol: string;
  timestamp: string | null;
  lastPrice: string;
}

/**
 * 시장 지표 캔들 한 봉. 금액이 문자열인 이유는 종목 캔들과 같다 — 지표마다 소수 자릿수가
 * 다르다(지수 2자리 · 국채 수익률 3자리). 숫자로 받으면 뒤 0 이 잘린다.
 */
export interface TossIndicatorCandle {
  timestamp: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
}

// ---- 관심목록 (서버 stock-watch) -------------------------------------------

export interface WatchItem {
  rowId: number;
  stockMasterRowId: number;
  countryCode: string;
  marketCode: string;
  symbol: string;
  nameKr: string;
  nameEn: string | null;
  securityType: StockSecurityType;
  currency: string;
}

export interface WatchGroup {
  rowId: number;
  groupName: string;
  sortOrder: number;
  items: WatchItem[];
}

// ---- 클라이언트 ------------------------------------------------------------

const BASE = "/v1/toss";

/** 토스 candles 의 count 상한(min:1 max:200). 초과 요청은 before 커서로 페이지네이션. */
const TOSS_CANDLE_MAX = 200;

export const stockApi = {
  // 종목 마스터 검색 (구독 게이트 없음 — 로그인만 필요)
  searchStocks: async (
    keyword: string,
    opts?: {
      countryCode?: string;
      securityType?: StockSecurityType;
      page?: number;
      size?: number;
    },
  ): Promise<StockSearchPage> => {
    const resp: ApiResponse<StockSearchPage> = await apiClient.get(
      "/v1/stocks",
      {
        params: { keyword: keyword || undefined, ...opts },
      },
    );
    return resp.data;
  },

  // 시세
  getPrices: async (symbols: string[]): Promise<TossPrice[]> => {
    const resp: ApiResponse<TossPrice[]> = await apiClient.get(
      `${BASE}/prices`,
      {
        params: { symbols: symbols.join(",") },
      },
    );
    return resp.data;
  },

  getOrderbook: async (symbol: string): Promise<TossOrderbook> => {
    const resp: ApiResponse<TossOrderbook> = await apiClient.get(
      `${BASE}/orderbook`,
      {
        params: { symbol },
      },
    );
    return resp.data;
  },

  getTrades: async (symbol: string, count?: number): Promise<TossTrade[]> => {
    const resp: ApiResponse<TossTrade[]> = await apiClient.get(
      `${BASE}/trades`,
      {
        params: { symbol, count },
      },
    );
    return resp.data;
  },

  getPriceLimits: async (symbol: string): Promise<TossPriceLimit> => {
    const resp: ApiResponse<TossPriceLimit> = await apiClient.get(
      `${BASE}/price-limits`,
      {
        params: { symbol },
      },
    );
    return resp.data;
  },

  getCandles: async (
    symbol: string,
    interval: "1m" | "1d",
    opts?: { count?: number; before?: string; adjusted?: boolean },
  ): Promise<TossCandlePage> => {
    // 백엔드는 커서 단일 페이지(size≤200) 프록시 → content/meta.nextCursor 를 정규화해 받는다.
    const fetchPage = async (
      size?: number,
      cursor?: string,
    ): Promise<TossCandlePage> => {
      const resp: ApiResponse<TossCandleCursorPage> = await apiClient.get(
        `${BASE}/candles`,
        {
          params: { symbol, interval, size, cursor, adjusted: opts?.adjusted },
        },
      );
      return {
        candles: resp.data?.content ?? [],
        nextBefore: resp.data?.meta?.nextCursor ?? null,
      };
    };

    const wanted = opts?.count;
    // count 미지정 또는 ≤200 → 단일 요청 (기존 동작)
    if (!wanted || wanted <= TOSS_CANDLE_MAX) {
      return fetchPage(wanted, opts?.before);
    }

    // 토스 count 상한(200) 초과 → nextCursor 커서로 누적 (요청당 ≤200)
    const merged: TossCandle[] = [];
    const seen = new Set<string>();
    let cursor = opts.before;
    let nextBefore: string | null = null;
    let remaining = wanted;
    while (remaining > 0) {
      const page = await fetchPage(
        Math.min(remaining, TOSS_CANDLE_MAX),
        cursor,
      );
      if (page.candles.length === 0) break;
      for (const c of page.candles) {
        if (!seen.has(c.timestamp)) {
          seen.add(c.timestamp);
          merged.push(c);
        }
      }
      nextBefore = page.nextBefore;
      remaining -= page.candles.length;
      if (!page.nextBefore) break;
      cursor = page.nextBefore;
    }
    return { candles: merged, nextBefore };
  },

  // 종목 정보
  getStocks: async (symbols: string[]): Promise<TossStockInfo[]> => {
    const resp: ApiResponse<TossStockInfo[]> = await apiClient.get(
      `${BASE}/stocks`,
      {
        params: { symbols: symbols.join(",") },
      },
    );
    return resp.data;
  },

  /** 투자자별 매매동향(국내 종목만 — 미국이면 서버가 빈 목록) */
  getInvestorTrading: async (
    symbol: string,
    count = 5,
  ): Promise<InvestorTradingDay[]> => {
    const resp: ApiResponse<InvestorTradingDay[]> = await apiClient.get(
      `${BASE}/stocks/${encodeURIComponent(symbol)}/investor-trading`,
      { params: { count } },
    );
    return resp.data ?? [];
  },

  getStockWarnings: async (symbol: string): Promise<TossStockWarning[]> => {
    const resp: ApiResponse<TossStockWarning[]> = await apiClient.get(
      `${BASE}/stocks/${encodeURIComponent(symbol)}/warnings`,
    );
    return resp.data;
  },

  // 시장 정보
  getExchangeRate: async (
    baseCurrency = "USD",
    quoteCurrency = "KRW",
    dateTime?: string,
  ): Promise<TossExchangeRate> => {
    const resp: ApiResponse<TossExchangeRate> = await apiClient.get(
      `${BASE}/exchange-rate`,
      {
        params: { baseCurrency, quoteCurrency, dateTime },
      },
    );
    return resp.data;
  },

  getMarketCalendarKr: async (date?: string): Promise<TossKrMarketCalendar> => {
    const resp: ApiResponse<TossKrMarketCalendar> = await apiClient.get(
      `${BASE}/market-calendar/KR`,
      {
        params: { date },
      },
    );
    return resp.data;
  },

  getMarketCalendarUs: async (date?: string): Promise<TossUsMarketCalendar> => {
    const resp: ApiResponse<TossUsMarketCalendar> = await apiClient.get(
      `${BASE}/market-calendar/US`,
      {
        params: { date },
      },
    );
    return resp.data;
  },

  // 랭킹 / 시장 지표
  getRankings: async (
    type: TossRankingType,
    marketCountry: "KR" | "US",
    duration: TossRankingDuration,
    opts?: { excludeInvestmentCaution?: boolean; count?: number },
  ): Promise<TossRankingResponse> => {
    const resp: ApiResponse<TossRankingResponse> = await apiClient.get(
      `${BASE}/rankings`,
      {
        params: { type, marketCountry, duration, ...opts },
      },
    );
    return resp.data;
  },

  getIndicatorPrices: async (
    symbols: string[],
  ): Promise<TossIndicatorPrice[]> => {
    const resp: ApiResponse<TossIndicatorPrice[]> = await apiClient.get(
      `${BASE}/market-indicators/prices`,
      { params: { symbols: symbols.join(",") } },
    );
    return resp.data;
  },

  /**
   * 시장 지표 캔들 — 상단 지수 타일의 추이선이 쓴다.
   *
   * **백엔드엔 예전부터 있었고 프론트만 안 부르고 있었다**(`TossApiController#getMarketIndicatorCandles`).
   * 응답 봉투는 종목 캔들과 같은 `CursorResponse` 라 여기서도 `content` 를 편다.
   */
  getIndicatorCandles: async (
    symbol: string,
    interval: "1m" | "1d",
    count?: number,
  ): Promise<TossIndicatorCandle[]> => {
    const resp: ApiResponse<{ content: TossIndicatorCandle[] }> =
      await apiClient.get(`${BASE}/market-indicators/${symbol}/candles`, {
        params: { interval, size: count },
      });
    return resp.data?.content ?? [];
  },

  // 관심목록 (게이트 없음 — 로그인만 필요)
  getWatchGroups: async (): Promise<WatchGroup[]> => {
    const resp: ApiResponse<WatchGroup[]> = await apiClient.get(
      "/v1/stock-watch/groups",
    );
    return resp.data;
  },

  createWatchGroup: async (
    groupName: string,
    opts?: SilentOpts,
  ): Promise<WatchGroup> => {
    const resp: ApiResponse<WatchGroup> = await apiClient.post(
      "/v1/stock-watch/groups",
      { groupName },
      silentConfig(opts),
    );
    return resp.data;
  },

  renameWatchGroup: async (
    groupId: number,
    groupName: string,
    opts?: SilentOpts,
  ): Promise<WatchGroup> => {
    const resp: ApiResponse<WatchGroup> = await apiClient.put(
      `/v1/stock-watch/groups/${groupId}`,
      { groupName },
      silentConfig(opts),
    );
    return resp.data;
  },

  deleteWatchGroup: async (
    groupId: number,
    opts?: SilentOpts,
  ): Promise<void> => {
    await apiClient.delete(
      `/v1/stock-watch/groups/${groupId}`,
      silentConfig(opts),
    );
  },

  addWatchItem: async (
    groupId: number,
    symbol: string,
    marketCode?: string,
    opts?: SilentOpts,
  ): Promise<WatchItem> => {
    const resp: ApiResponse<WatchItem> = await apiClient.post(
      `/v1/stock-watch/groups/${groupId}/items`,
      { symbol, marketCode },
      silentConfig(opts),
    );
    return resp.data;
  },

  removeWatchItem: async (itemId: number, opts?: SilentOpts): Promise<void> => {
    await apiClient.delete(
      `/v1/stock-watch/items/${itemId}`,
      silentConfig(opts),
    );
  },

  // 계좌 / 보유자산
  getAccounts: async (): Promise<TossAccount[]> => {
    const resp: ApiResponse<TossAccount[]> = await apiClient.get(
      `${BASE}/accounts`,
    );
    return resp.data;
  },

  /** 주문 가능 금액(원화 · 달러) — 보유 조회와 같은 계좌 */
  getBuyingPower: async (
    accountSeq: number,
    currency: "KRW" | "USD",
  ): Promise<TossBuyingPower> => {
    const resp: ApiResponse<TossBuyingPower> = await apiClient.get(
      `${BASE}/buying-power`,
      { params: { accountSeq, currency } },
    );
    return resp.data;
  },

  getHoldings: async (
    accountSeq: number,
    symbol?: string,
  ): Promise<TossHoldings> => {
    const resp: ApiResponse<TossHoldings> = await apiClient.get(
      `${BASE}/holdings`,
      {
        params: { accountSeq, symbol },
      },
    );
    return resp.data;
  },
};
