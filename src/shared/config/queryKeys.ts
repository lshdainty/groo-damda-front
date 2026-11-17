export const authKeys = {
  all: ["auth"] as const,
  check: () => [...authKeys.all, "check"] as const,
};

export const oauthKeys = {
  all: ["oauth"] as const,
  providers: () => [...oauthKeys.all, "providers"] as const,
};

export const deviceSessionKeys = {
  all: ["deviceSessions"] as const,
};

export const todoKeys = {
  all: ["todos"] as const,
  list: <T = Record<string, unknown>>(filters?: T) =>
    [...todoKeys.all, "list", filters] as const,
  detail: (id: number) => [...todoKeys.all, "detail", id] as const,
  subtasks: (parentId: number) =>
    [...todoKeys.all, "subtasks", parentId] as const,
  stats: () => [...todoKeys.all, "stats"] as const,
};

export const todoTagKeys = {
  all: ["todo-tags"] as const,
  list: () => [...todoTagKeys.all, "list"] as const,
};

export const calendarKeys = {
  all: ["calendar"] as const,
  events: <T = Record<string, unknown>>(params?: T) =>
    [...calendarKeys.all, "events", params] as const,
};

export const holidayKeys = {
  all: ["holidays"] as const,
  list: <T = Record<string, unknown>>(params?: T) =>
    [...holidayKeys.all, "list", params] as const,
};

export const userCalendarKeys = {
  all: ["user-calendars"] as const,
  list: () => [...userCalendarKeys.all, "list"] as const,
};

export const eventLabelKeys = {
  all: ["event-labels"] as const,
  list: () => [...eventLabelKeys.all, "list"] as const,
};

export const memoKeys = {
  all: ["memos"] as const,
  list: <T = Record<string, unknown>>(filters?: T) =>
    [...memoKeys.all, "list", filters] as const,
  detail: (id: number) => [...memoKeys.all, "detail", id] as const,
};

export const memoTagKeys = {
  all: ["memo-tags"] as const,
  list: () => [...memoTagKeys.all, "list"] as const,
};

export const expenseKeys = {
  all: ["expenses"] as const,
  list: <T = Record<string, unknown>>(filters?: T) =>
    [...expenseKeys.all, "list", filters] as const,
  categories: () => [...expenseKeys.all, "categories"] as const,
  budgets: <T = Record<string, unknown>>(params?: T) =>
    [...expenseKeys.all, "budgets", params] as const,
  budgetCompliance: (months: number) =>
    [...expenseKeys.all, "budget-compliance", months] as const,
  templates: () => [...expenseKeys.all, "templates"] as const,
  // assetId 를 키에 넣는다 — 안 넣으면 자산 필터를 걸었다 풀어도 캐시가 그대로다.
  rangeSummary: (startDate: string, endDate: string, assetId?: number | null) =>
    [
      ...expenseKeys.all,
      "range-summary",
      startDate,
      endDate,
      assetId ?? null,
    ] as const,
  monthlyTrend: (months: number) =>
    [...expenseKeys.all, "monthly-trend", months] as const,
  merchantSummary: <T = Record<string, unknown>>(params?: T) =>
    [...expenseKeys.all, "merchant-summary", params] as const,
  heatmap: (startDate: string, endDate: string) =>
    [...expenseKeys.all, "heatmap", startDate, endDate] as const,
  search: <T = Record<string, unknown>>(params?: T) =>
    [...expenseKeys.all, "search", params] as const,
};

export const assetKeys = {
  all: ["assets"] as const,
  list: () => [...assetKeys.all, "list"] as const,
  detail: (id: number) => [...assetKeys.all, "detail", id] as const,
  summary: (year?: number, month?: number) =>
    [...assetKeys.all, "summary", year ?? null, month ?? null] as const,
  netWorthTrend: (months: number) =>
    [...assetKeys.all, "net-worth-trend", months] as const,
  balanceTrend: (assetId: number, weeks: number) =>
    [...assetKeys.all, "balance-trend", assetId, weeks] as const,
  transfers: <T = Record<string, unknown>>(params?: T) =>
    [...assetKeys.all, "transfers", params] as const,
  billing: (id: number) => [...assetKeys.all, "billing", id] as const,
};

export const savingGoalKeys = {
  all: ["saving-goals"] as const,
  list: () => [...savingGoalKeys.all, "list"] as const,
  detail: (id: number) => [...savingGoalKeys.all, "detail", id] as const,
};

export const cardKeys = {
  all: ["cards"] as const,
  catalogs: <T = Record<string, unknown>>(params?: T) =>
    [...cardKeys.all, "catalogs", params] as const,
  catalogsInfinite: <T = Record<string, unknown>>(params?: T) =>
    [...cardKeys.all, "catalogs-infinite", params] as const,
  catalogDetail: (id: number) => [...cardKeys.all, "catalog", id] as const,
  performance: (assetRowId: number, yearMonth: string) =>
    [...cardKeys.all, "performance", assetRowId, yearMonth] as const,
};

export const recurringTransactionKeys = {
  all: ["recurring-transactions"] as const,
  list: (params?: { upcoming?: boolean; limit?: number }) =>
    [...recurringTransactionKeys.all, "list", params ?? {}] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

export const dutchPayKeys = {
  all: ["dutch-pay"] as const,
  list: () => [...dutchPayKeys.all, "list"] as const,
  detail: (id: number) => [...dutchPayKeys.all, "detail", id] as const,
};

export const expenseSplitKeys = {
  all: ["expense-splits"] as const,
  list: (expenseId: number) =>
    [...expenseSplitKeys.all, "list", expenseId] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};

export const subscriptionKeys = {
  all: ["subscription"] as const,
  myFeatures: () => [...subscriptionKeys.all, "features"] as const,
  mySubscription: () => [...subscriptionKeys.all, "me"] as const,
  brokerConnections: () =>
    [...subscriptionKeys.all, "securities-credentials"] as const,
  apiTokens: () => [...subscriptionKeys.all, "api-tokens"] as const,
};

export const stockKeys = {
  all: ["stocks"] as const,
  search: (keyword: string) => [...stockKeys.all, "search", keyword] as const,
  symbolName: (symbol: string) =>
    [...stockKeys.all, "symbol-name", symbol] as const,
  prices: (symbols: string[]) => [...stockKeys.all, "prices", symbols] as const,
  orderbook: (symbol: string) =>
    [...stockKeys.all, "orderbook", symbol] as const,
  trades: (symbol: string) => [...stockKeys.all, "trades", symbol] as const,
  exchangeRate: () => [...stockKeys.all, "exchange-rate"] as const,
  // `day` = 그 시장 달력의 오늘 — 날이 바뀌면 키가 바뀌어 어제 달력을 쓰지 않는다
  marketCalendar: (market: "KR" | "US", day?: string) =>
    [...stockKeys.all, "market-calendar", market, day ?? ""] as const,
  accounts: () => [...stockKeys.all, "accounts"] as const,
  holdings: (accountSeq: number) =>
    [...stockKeys.all, "holdings", accountSeq] as const,
  stockInfo: (symbols: string[]) =>
    [...stockKeys.all, "info", symbols] as const,
  priceLimits: (symbol: string) =>
    [...stockKeys.all, "price-limits", symbol] as const,
  candles: (symbol: string, interval: string) =>
    [...stockKeys.all, "candles", symbol, interval] as const,
  warnings: (symbol: string) => [...stockKeys.all, "warnings", symbol] as const,
  investors: (symbol: string) =>
    [...stockKeys.all, "investors", symbol] as const,
  buyingPower: (accountSeq: number, currency: string) =>
    [...stockKeys.all, "buying-power", accountSeq, currency] as const,
  // `tz` = 전일을 가르는 시장 시간대(국내 Asia/Seoul · 미국 America/New_York)
  // `day` = 그 시장의 오늘 — 날이 바뀌면 키가 바뀌어 어제 기준의 전일 종가를 쓰지 않는다
  prevClose: (symbol: string, tz?: string, day?: string) =>
    [
      ...stockKeys.all,
      "prev-close",
      symbol,
      tz ?? "Asia/Seoul",
      day ?? "",
    ] as const,
  rankings: (type: string, market: string, duration: string) =>
    [...stockKeys.all, "rankings", type, market, duration] as const,
  indicators: (symbols: string[]) =>
    [...stockKeys.all, "indicators", symbols] as const,
  watchGroups: () => [...stockKeys.all, "watch-groups"] as const,
};

export const constellationKeys = {
  all: ["constellation"] as const,
  today: () => [...constellationKeys.all, "today"] as const,
  sky: (days: number) => [...constellationKeys.all, "sky", days] as const,
  collection: () => [...constellationKeys.all, "collection"] as const,
};
