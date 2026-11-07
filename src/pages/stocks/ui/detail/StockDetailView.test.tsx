// 토스 종목 상세(폰) — 기본 정보 실패 · 전일 종가 없음 · 머리 증감 금액 · 호가 색 · 0 손익 (I-13 P 절 18 · 13-1 검수 H2 · M4 · M5 · M13 · M14)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  info: "ok" as "ok" | "error" | "stale-error",
  last: "15200" as string | null,
  prevClose: 15150 as number | null,
  holding: null as null | { pnl: string; rate: string },
  prices: "ok" as "ok" | "error" | "empty",
  /** 시세 응답의 통화 — 미국 종목 시험용 */
  priceCurrency: "KRW" as string | null,
  infoMarket: "KOSPI",
  koreanDetail: true,
  infoEmpty: false,
  asks: true,
  bids: true,
  /** 토스 1d 봉(오늘 봉 판정 · M7) */
  bars: [] as {
    timestamp: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    closePrice: string;
    volume: string;
  }[],
  /** 시세 · 정보 · 마스터가 아직 안 왔다 — 통화를 모르는 첫 렌더(D1) */
  currencyPending: false,
  /** 종목 마스터가 통화를 모른다 — "어디서도 통화를 모른다" 의 마지막 출처(T1) */
  masterNoCurrency: false,
  bookPending: false,
  tradesPending: false,
  investors: [] as unknown[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      // 시장 이름 표(market.*) 만 진짜 글 — 모르는 코드는 원문(defaultValue)
      const names: Record<string, string> = {
        "market.NAS": "나스닥",
        "market.KOSPI": "코스피",
      };
      if (k in names) return names[k]!;
      return o && "defaultValue" in o ? String(o.defaultValue) : k;
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/stock/model/useWatchlist", () => ({
  useWatchlist: () => ({
    groups: [],
    ready: true,
    failed: false,
    isWatched: () => false,
    toggleWatch: () => {},
  }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockBySymbol: () => ({
    data: st.currencyPending
      ? undefined
      : {
          nameKr: "숲길전자",
          marketCode: "KOSPI",
          securityType: "STOCK",
          // 마스터가 늘 KRW 를 돌려주면 "통화를 어디서도 모른다" 를 만들 수 없다 — 코드는 마스터 통화도 쓴다(T1)
          currency: st.masterNoCurrency ? undefined : "KRW",
        },
  }),
}));
vi.mock("@/features/stock/model/useDailyCandles", () => ({
  useDailyCandles: () => ({
    isLoading: false,
    isPending: false,
    isError: false,
    data: { candles: [] },
    refetch: () => {},
  }),
}));
vi.mock("@/features/stock/model/chart-range", async (orig) => ({
  ...(await orig<typeof import("@/features/stock/model/chart-range")>()),
  useCandleAvailability: () => "no",
}));
vi.mock("@/features/stock/model/useTossStocks", async (orig) => {
  const real =
    await orig<typeof import("@/features/stock/model/useTossStocks")>();
  const q = (data: unknown, extra = {}) => ({
    data,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: () => {},
    ...extra,
  });
  const info = () => ({
    symbol: "A1",
    name: "숲길전자",
    market: st.infoMarket,
    currency: st.priceCurrency ?? "KRW",
    securityType: "STOCK",
    listDate: "2010-01-04",
    sharesOutstanding: "1000000",
    koreanMarketDetail: st.koreanDetail ? { krxTradingSuspended: false } : null,
  });
  return {
    // 코드가 부르는 다른 훅(13b 에서 늘어난 것 포함)이 mock 목록에 없어 던지지 않게 진짜를 깔고 필요한 것만 덮는다
    ...real,
    changePctOf: real.changePctOf,
    usePrevClose: () => q(st.prevClose),
    useTossStockInfo: () =>
      st.currencyPending
        ? q(undefined, { isLoading: true, isPending: true, isSuccess: false })
        : st.info === "error"
          ? q(undefined, { isError: true, isSuccess: false })
          : q(
              st.infoEmpty ? [] : [info()],
              st.info === "stale-error" ? { isError: true } : {},
            ),
    useTossPrices: () =>
      st.currencyPending
        ? q(undefined, { isLoading: true, isPending: true, isSuccess: false })
        : st.prices === "error"
          ? q(undefined, { isError: true, isSuccess: false })
          : q(
              st.last == null || st.prices === "empty"
                ? []
                : [
                    {
                      symbol: "A1",
                      lastPrice: st.last,
                      ...(st.priceCurrency
                        ? { currency: st.priceCurrency }
                        : {}),
                    },
                  ],
            ),
    useTossExchangeRate: () => q({ rate: "1385.20" }),
    useTossStockWarnings: () => q([]),
    useTossAccounts: () => q([{ accountSeq: 1 }]),
    useTossHoldings: () =>
      q({
        items: st.holding
          ? [
              {
                symbol: "A1",
                name: "숲길전자",
                currency: "KRW",
                quantity: "10",
                averagePurchasePrice: "100",
                marketValue: { amount: "1000", purchaseAmount: "1000" },
                profitLoss: { amount: st.holding.pnl, rate: st.holding.rate },
                dailyProfitLoss: { amount: "0" },
                cost: { commission: "0", tax: null },
              },
            ]
          : [],
      }),
    useTossPriceLimits: () => q(undefined),
    // 13b-1 에서 늘어난 훅 — 진짜가 네트워크로 나가지 않게 덮는다(없는 훅이 던지지 않게 ...real 도 유지)
    useTossCandles: () => q({ candles: st.bars }),
    useTossInvestors: () => q(st.investors),
    useTossOrderbook: () =>
      st.bookPending
        ? q(undefined, { isPending: true, isSuccess: false })
        : q({
            asks: st.asks
              ? [
                  { price: "15210", volume: "100" },
                  { price: "15220", volume: "200" },
                ]
              : [],
            bids: st.bids
              ? [
                  { price: "15190", volume: "100" },
                  { price: "15180", volume: "200" },
                ]
              : [],
          }),
    useTossTrades: () =>
      st.tradesPending
        ? q(undefined, { isPending: true, isSuccess: false })
        : q([
            {
              timestamp: "2026-10-29T13:00:05+09:00",
              price: "15200",
              volume: "3",
            },
            {
              timestamp: "2026-10-29T13:00:01+09:00",
              price: "15190",
              volume: "4",
            },
            {
              timestamp: "2026-10-29T12:59:58+09:00",
              price: "15195",
              volume: "2",
            },
          ]),
  };
});

const { StockDetailView } = await import("./StockDetailView");
let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  st.info = "ok";
  st.last = "15200";
  st.prevClose = 15150;
  st.holding = null;
  st.prices = "ok";
  st.priceCurrency = "KRW";
  st.infoMarket = "KOSPI";
  st.koreanDetail = true;
  st.infoEmpty = false;
  st.asks = true;
  st.bids = true;
  st.bars = [];
  st.currencyPending = false;
  st.masterNoCurrency = false;
  st.bookPending = false;
  st.tradesPending = false;
  st.investors = [];
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () =>
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <StockDetailView broker="TOSS" symbol="A1" />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
const section = (name: string) =>
  container.querySelector(`[data-section=${name}]`)!;

describe("기본 정보 — 조회가 실패하면 '정상' 으로 보이지 않는다(H2)", () => {
  it("받았으면 거래상태 '정상'", () => {
    render();
    expect(section("info").textContent).toContain("info.normal");
  });
  it("실패했고 받아 둔 값이 없으면 실패 한 벌 — '정상' · 시장 · 통화 줄이 없다", () => {
    st.info = "error";
    render();
    const t = section("info").textContent!;
    expect(t).toContain("info.failTitle");
    expect(t).not.toContain("info.normal");
    expect(t).not.toContain("info.tradingStatus");
  });
  it("폴링 실패(받아 둔 값 있음)는 받아 둔 값을 그대로 둔다", () => {
    st.info = "stale-error";
    render();
    expect(section("info").textContent).toContain("info.normal");
    expect(section("info").textContent).not.toContain("info.failTitle");
  });
});

describe("머리 증감 · 호가 가운데 — 전일 종가가 있을 때만(M4 · M5)", () => {
  it("머리 증감이 '▲ 50원 · 0.33%' — 금액이 있고 + 부호가 없다", () => {
    render();
    const head = container
      .querySelector("#stock-name")!
      .closest("section")!.textContent!;
    expect(head).toContain("▲ 50원 · 0.33%");
    expect(head).not.toMatch(/\+50/);
  });
  it("전일 종가가 없으면 머리에 증감을 두지 않고 호가 가운데에 0.00% 를 지어내지 않는다", () => {
    st.prevClose = null;
    render();
    expect(container.textContent).not.toContain("0.00%");
    const center = section("quotes").querySelector("td[colspan='3']")!;
    expect(center.textContent).toBe("15,200원");
    // 상승 색(빨강)이 아니라 중립색
    expect(center.querySelector("span")!.className).toContain(
      "text-fg-neutral",
    );
    expect(center.querySelector("span")!.className).not.toContain(
      "text-fg-critical",
    );
  });
  it("호가 가운데 가격 색은 방향 역할 색 — 상승 critical", () => {
    render();
    const center = section("quotes").querySelector("td[colspan='3']")!;
    expect(center.querySelector("span")!.className).toContain(
      "text-fg-critical",
    );
  });
});

describe("호가 · 체결 색은 역할 이름(M14) · 체결 시각은 12시간 · 초 없음(M16)", () => {
  it("매도 가격 fg-informative · 매수 가격 fg-critical, 옛 변수가 없다", () => {
    render();
    const q = section("quotes");
    const cells = [...q.querySelectorAll("td")].filter((td) =>
      /^15,(2[12]|1[89])0원$/.test(td.textContent ?? ""),
    );
    expect(cells.length).toBe(4);
    for (const td of cells) {
      const sell = /15,2[12]0원/.test(td.textContent!);
      expect(td.className).toContain(
        sell ? "text-fg-informative" : "text-fg-critical",
      );
    }
    expect(q.innerHTML).not.toContain("--status-danger-fg");
    expect(q.innerHTML).not.toContain("--fg-brand");
  });
  it("체결 탭 — 시각은 '오후 1:00' (초 없음), 하락 체결은 fg-informative · 견줄 체결이 없는 가장 오래된 줄은 fg-neutral", async () => {
    render();
    const tab = [...container.querySelectorAll("[role=radio]")].find(
      (e) => e.textContent === "quotes.trades",
    ) as HTMLElement;
    await act(async () => tab.click());
    const q = section("quotes");
    expect(q.textContent).toContain("오후 1:00");
    expect(q.textContent).not.toMatch(/1:00:0\d/);
    const price = [...q.querySelectorAll("td")].find(
      (td) => td.textContent === "15,190원",
    )!;
    expect(price.className).toContain("text-fg-informative");
    const up = [...q.querySelectorAll("td")].find(
      (td) => td.textContent === "15,200원",
    )!;
    expect(up.className).toContain("text-fg-critical");
    // 가장 오래된 체결은 견줄 앞 체결이 없다 — 오름 · 내림 어느 색도 아니다
    const oldest = [...q.querySelectorAll("td")].find(
      (td) => td.textContent === "15,195원",
    )!;
    expect(oldest.className).toContain("text-fg-neutral");
    expect(oldest.className).not.toContain("text-fg-critical");
    expect(oldest.className).not.toContain("text-fg-informative");
  });
});

describe("내 보유 — 0 이면 '변화 없음' (M13) · 한 줄에 하나(M12)", () => {
  it("평가손익 0 은 화살표 없이 '변화 없음'", () => {
    st.holding = { pnl: "0", rate: "0" };
    render();
    const rows = [
      ...section("holding").querySelectorAll("[data-slot=kv-value]"),
    ];
    // 평가금액 · 평가손익 · 수익률 … — 보이는 글은 delta-value (sr-only 문장은 따로)
    const shown = (i: number) =>
      rows[i]!.querySelector("[data-slot=delta-value]")!.textContent;
    expect(shown(1)).toBe("변화 없음");
    expect(shown(2)).toBe("변화 없음");
    expect(section("holding").textContent).not.toContain("▲");
  });
  it("평가손익 > 0 은 금액만 '▲ 100원' (수익률을 같이 쓰지 않는다)", () => {
    st.holding = { pnl: "100", rate: "10" };
    render();
    const rows = [
      ...section("holding").querySelectorAll("[data-slot=kv-value]"),
    ];
    const shown = (i: number) =>
      rows[i]!.querySelector("[data-slot=delta-value]")!.textContent;
    expect(shown(1)).toBe("▲ 100원");
    expect(shown(2)).toBe("▲ 10.00%");
  });
  it("키-값 줄은 한 벌 — 키는 ds List 제목 그대로(자리마다 크기를 덮지 않는다) · 값 t5 700 고정폭", () => {
    st.holding = { pnl: "100", rate: "10" };
    render();
    for (const name of ["holding", "info"]) {
      const v = section(name).querySelector("[data-slot=kv-value]")!;
      expect(v.className).toContain("text-t5");
      expect(v.className).toContain("font-bold");
      expect(v.className).toContain("tabular-nums");
      const title = v
        .closest("[data-slot=list-content]")!
        .querySelector("[data-slot=list-title]");
      // 키에 text-t4 · fg-neutral-subtle 덮어쓰기가 없다 — 내 투자 띠와 같은 줄
      expect(title?.innerHTML).not.toContain("text-t4");
    }
  });
});

describe("시세 조회 실패는 '미지원' 이 아니다(H4)", () => {
  const head = () =>
    container.querySelector("#stock-name")!.closest("section")!.textContent!;
  it("실패(받아 둔 값 없음) → '시세를 불러오지 못했어요' + [다시 시도], 미지원 글 없음", () => {
    st.prices = "error";
    render();
    expect(head()).toContain("detail.priceFail");
    expect(head()).not.toContain("detail.priceUnavailable");
    // 다시 시도 단추가 머리 띠 안에 있다
    expect(
      container
        .querySelector("#stock-name")!
        .closest("section")!
        .querySelector("button"),
    ).not.toBeNull();
  });
  it("정상 응답인데 시세가 비면 그때만 '미지원'", () => {
    st.prices = "empty";
    render();
    expect(head()).toContain("detail.priceUnavailable");
    expect(head()).not.toContain("detail.priceFail");
  });
});

describe("기본 정보 — 모르는 값을 '정상' 으로 말하지 않는다(M5) · 시장 이름(나스닥)", () => {
  it("정보 응답이 빈 목록이면 거래상태 줄이 없다", () => {
    st.infoEmpty = true;
    render();
    expect(section("info").textContent).not.toContain("info.normal");
    expect(section("info").textContent).not.toContain("info.tradingStatus");
  });
  it("미국 종목(koreanMarketDetail 없음)은 거래상태 줄이 없다", () => {
    st.koreanDetail = false;
    st.priceCurrency = "USD";
    st.infoMarket = "NASDAQ";
    render();
    expect(section("info").textContent).not.toContain("info.tradingStatus");
  });
  it("정보의 시장 글(NASDAQ)은 사용자 말 '나스닥' — 코드 그대로(NAS · NASDAQ) 보이지 않는다", () => {
    st.koreanDetail = false;
    st.priceCurrency = "USD";
    st.infoMarket = "NASDAQ";
    render();
    const rows = [...section("info").querySelectorAll("[data-slot=kv-value]")];
    expect(rows[0]!.textContent).toBe("나스닥");
  });
  it("상장일은 표준 날짜 '2010년 1월 4일' — 2010-01-04 를 그대로 보이지 않는다", () => {
    render();
    const t = section("info").textContent!;
    expect(t).toContain("2010년 1월 4일");
    expect(t).not.toContain("2010-01-04");
  });
});

describe("통화를 모르면 숫자만 — KRW 로 추정하지 않는다(M6)", () => {
  it("시세 응답에 통화가 있으면 그걸 쓴다(USD → $185.42)", () => {
    st.last = "185.42";
    st.priceCurrency = "USD";
    st.koreanDetail = false;
    render();
    const head = container
      .querySelector("#stock-name")!
      .closest("section")!.textContent!;
    expect(head).toContain("$185.42");
    expect(head).not.toContain("185원");
  });
  it("어디서도 통화를 모르면 '185.42' 숫자만(원 · $ 없음)", () => {
    st.last = "185.42";
    st.priceCurrency = null;
    st.infoEmpty = true;
    st.masterNoCurrency = true;
    render();
    const head = container
      .querySelector("#stock-name")!
      .closest("section")!.textContent!;
    expect(head).toContain("185.42");
    expect(head).not.toContain("185원");
    expect(head).not.toContain("$");
  });
});

describe("호가 — 한쪽이 비어도 있는 쪽은 보인다(M9)", () => {
  it("매도가 없으면(상한가) 매수 호가만 그리고 '호가 정보가 없어요' 가 아니다", () => {
    st.asks = false;
    render();
    const q = section("quotes");
    expect(q.textContent).not.toContain("quotes.orderbookEmpty");
    expect(q.textContent).toContain("15,190원");
    expect(q.textContent).not.toContain("15,210원");
  });
  it("둘 다 비어야 '호가 정보가 없어요'", () => {
    st.asks = false;
    st.bids = false;
    render();
    expect(section("quotes").textContent).toContain("quotes.orderbookEmpty");
  });
});

describe("꺼진 · 아직 시작 안 한 질의는 '없어요' 가 아니라 기다림이다(M1)", () => {
  it("호가 질의가 시작 전(isPending, 데이터 없음)이면 '호가 정보가 없어요' 를 보이지 않는다", () => {
    st.bookPending = true;
    render();
    const q = section("quotes");
    expect(q.textContent).not.toContain("quotes.orderbookEmpty");
    expect(q.textContent).not.toContain("quotes.orderbookFail");
    expect(q.querySelector("[aria-busy]")).not.toBeNull();
  });
  it("체결 탭도 같다 — 막 켜진 질의가 '체결 내역이 없어요' 로 비치지 않는다", async () => {
    st.tradesPending = true;
    render();
    const tab = [...container.querySelectorAll("[role=radio]")].find(
      (e) => e.textContent === "quotes.trades",
    ) as HTMLElement;
    await act(async () => tab.click());
    expect(section("quotes").textContent).not.toContain("quotes.tradesEmpty");
    expect(section("quotes").querySelector("[aria-busy]")).not.toBeNull();
  });
});

describe("오늘 시세 — '오늘' 은 그 시장의 거래일이다(M7, I-13b 20)", () => {
  const bar = (timestamp: string) => ({
    timestamp,
    openPrice: "100",
    highPrice: "110",
    lowPrice: "95",
    closePrice: "105",
    volume: "12345",
  });
  afterEach(() => vi.useRealTimers());
  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };
  const todayRows = () =>
    container.querySelector("[data-section=today]")?.textContent ?? "";

  it("미국 종목: 한국 자정 뒤(뉴욕은 아직 같은 날)에도 오늘 봉이 있다 — 띠가 사라지지 않는다", () => {
    // 한국 10-30 02:00 = 뉴욕 10-29 13:00. 1d 봉은 현지 자정 고정(뉴욕 10-29)
    at("2026-10-30T02:00:00+09:00");
    st.priceCurrency = "USD";
    st.bars = [
      bar("2026-10-28T00:00:00-04:00"),
      bar("2026-10-29T00:00:00-04:00"),
    ];
    render();
    expect(todayRows()).toContain("today.open");
    expect(todayRows()).toContain("today.volume");
  });
  it("미국 종목: 어제(뉴욕) 봉만 있으면 오늘 봉 줄은 없다", () => {
    at("2026-10-30T02:00:00+09:00");
    st.priceCurrency = "USD";
    st.bars = [bar("2026-10-28T00:00:00-04:00")];
    render();
    expect(todayRows()).not.toContain("today.open");
  });
  it("국내 종목: 한국 날짜로 가른다 — 순서를 가정하지 않는다(최신이 앞이어도)", () => {
    at("2026-10-29T13:00:00+09:00");
    st.bars = [
      bar("2026-10-29T00:00:00+09:00"),
      bar("2026-10-28T00:00:00+09:00"),
    ];
    render();
    expect(todayRows()).toContain("today.open");
  });
  it("국내 종목: 어제 봉만 있으면(휴장 · 장 시작 전) 오늘 봉 네 줄이 없다", () => {
    at("2026-10-29T08:00:00+09:00");
    st.bars = [bar("2026-10-28T00:00:00+09:00")];
    render();
    expect(todayRows()).not.toContain("today.open");
  });

  // ---- D1: 통화가 늦게 오는 실제 순서(시세 · 정보 · 마스터가 비동기) ----------------------
  it("통화를 아직 모르면(시세 · 정보 · 마스터 모두 오는 중) 한국 날짜로 오늘 봉을 가르지 않고 기다린다 — 값이 없다", () => {
    // 한국 10-30 03:00 = 뉴욕 10-29 14:00 — 한국 날짜가 뉴욕보다 앞선다
    at("2026-10-30T03:00:00+09:00");
    st.currencyPending = true;
    st.bars = [bar("2026-10-29T00:00:00-04:00")];
    render();
    expect(todayRows()).not.toContain("$100.00");
    expect(todayRows()).not.toContain("100원");
  });
  it("통화가 늦게 오면(USD) 타이머를 기다리지 않고 그 렌더에서 바로 오늘 봉이 나온다 — 60초 안 보이던 결함", () => {
    at("2026-10-30T03:00:00+09:00");
    st.currencyPending = true;
    st.bars = [bar("2026-10-29T00:00:00-04:00")];
    render();
    // 시세 응답이 도착 — 시간대가 한국 → 뉴욕으로 바뀐다. 시계도 타이머도 움직이지 않았다
    st.currencyPending = false;
    st.priceCurrency = "USD";
    st.koreanDetail = false;
    render();
    expect(todayRows()).toContain("today.open");
    expect(todayRows()).toContain("$100.00");
  });
  it("한국 23:00(두 시장의 날짜가 같은 시각)에서도 같다 — 늦게 온 통화로 바뀌어도 띠가 유지된다", () => {
    at("2026-10-29T23:00:00+09:00");
    st.currencyPending = true;
    st.bars = [bar("2026-10-29T00:00:00-04:00")];
    render();
    st.currencyPending = false;
    st.priceCurrency = "USD";
    st.koreanDetail = false;
    render();
    expect(todayRows()).toContain("$100.00");
  });

  // ---- D2: 투자자별 줄 이름 칸 — 고정 폭 40 이 아니라 가장 긴 낱말 폭까지 ----------------------
  it("투자자별 라벨 칸은 고정 폭(w-10)이 아니다 — 최소 2.5rem(한국어 40 유지)에서 가장 긴 낱말 폭(max-content)까지 넓어지고, 낱말 안에서 꺾지 않는다", () => {
    st.investors = [
      {
        date: "2026-10-29",
        individual: "1",
        foreigner: "-2",
        institution: "3",
      },
    ];
    render();
    const band = container.querySelector("[data-section=investor]")!;
    const grid = band.querySelector(".grid")!;
    expect(grid.className).toContain("minmax(2.5rem,max-content)");
    const labels = [...grid.querySelectorAll(":scope > span.text-end")];
    expect(labels.length).toBe(3);
    for (const l of labels) {
      expect(l.className).not.toContain("w-10");
      expect(l.className).not.toContain("break-all");
      expect(l.className).not.toContain("[overflow-wrap:anywhere]");
    }
    // 값 칸이 먼저 줄어든다(minmax(0,1fr)) · 줄 안이 좁아 값이 본문 아래로 내려가면 60cqw 상한을 푼다(list.md)
    expect(grid.className).toContain("minmax(0,1fr)");
    expect(grid.className).toContain("max-w-none");
  });
});
