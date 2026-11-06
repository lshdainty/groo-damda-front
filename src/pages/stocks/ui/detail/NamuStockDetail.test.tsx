// 나무 종목 상세(폰) 통합 — 질의 게이팅 · 매도가능(미국만) · 시세 실패 시 띠 숨김 · 칸이 빈 응답 · 시가총액 (I-13b 19 ~ 24 · 27, 13-1 검수 M1 · M4 · M10)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  country: "KR" as "KR" | "US",
  holding: false,
  quote: "ok" as "ok" | "error" | "stale-error" | "empty" | "pending",
  fetched: true,
  fx: 1385.2 as number | null,
  investorsArgs: [] as [string | null, boolean][],
  dailyArgs: [] as [string | null, string, boolean][],
  quoteArgs: [] as [string | null, string | null][],
  execArgs: [] as [string | null, string | null, boolean][],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const names: Record<string, string> = {
        "market.KOSPI": "코스피",
        "market.NAS": "나스닥",
      };
      if (k in names) return names[k]!;
      if (k === "holding.sharesUnit") return `${o?.count}주`;
      return o && "defaultValue" in o ? String(o.defaultValue) : k;
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));
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
    isLoading: false,
    data:
      st.country === "KR"
        ? {
            nameKr: "숲길전자",
            marketCode: "KOSPI",
            countryCode: "KR",
            securityType: "STOCK",
            currency: "KRW",
          }
        : {
            nameKr: "모아 테크놀로지스",
            marketCode: "NAS",
            countryCode: "US",
            securityType: "STOCK",
            currency: "USD",
          },
  }),
}));
vi.mock("@/features/stock/model/useDailyCandles", () => ({
  useDailyCandles: (symbol: string | null, broker: string, enabled = true) => {
    st.dailyArgs.push([symbol, broker, enabled]);
    return {
      isPending: !enabled,
      isLoading: false,
      isError: false,
      data: enabled ? { candles: [] } : undefined,
      refetch: () => {},
    };
  },
}));
vi.mock("@/features/stock/model/chart-range", async (orig) => ({
  ...(await orig<typeof import("@/features/stock/model/chart-range")>()),
  useCandleAvailability: () => "no",
}));
vi.mock("@/features/stock/model/useNamu", async (orig) => {
  const real = await orig<typeof import("@/features/stock/model/useNamu")>();
  const q = (data: unknown, extra = {}) => ({
    data,
    isLoading: false,
    isPending: false,
    isFetched: true,
    isError: false,
    isSuccess: true,
    refetch: () => {},
    ...extra,
  });
  const holdings = (cur: string) =>
    q({
      accountNo: "1",
      currency: cur,
      totalEvalAmount: "0",
      totalProfitLoss: "0",
      profitRate: "0",
      deposit: null,
      orderableAmount: null,
      items:
        st.holding && cur === (st.country === "KR" ? "KRW" : "USD")
          ? [
              {
                symbol: "A1",
                name: "보유 종목",
                quantity: "120",
                avgPrice: "100",
                currentPrice: "110",
                evalAmount: "13200",
                profitLoss: "1200",
                sellableQuantity: cur === "USD" ? "100" : null,
              },
            ]
          : [],
    });
  const quote = () => ({
    symbol: "A1",
    name: "시세 이름",
    currency: st.country === "KR" ? "KRW" : "USD",
    price: "110",
    previousClose: "100",
    open: "101",
    high: "112",
    low: "99",
    volume: "123456",
    upperLimit: st.country === "KR" ? "130" : null,
    lowerLimit: st.country === "KR" ? "70" : null,
    orderbook: {
      timestamp: null,
      currency: "KRW",
      asks: [{ price: "111", volume: "10" }],
      bids: [{ price: "109", volume: "20" }],
    },
    warnings: [{ warningType: "INVESTMENT_ATTENTION" }],
    marketState: "REGULAR",
    sector: "반도체",
    marketCap: st.country === "KR" ? "444555666777888" : "3500000000000",
    listingDate: "19750611",
    listedShares: "5969782550",
    per: null,
    pbr: null,
    eps: null,
    high52w: null,
    low52w: null,
    foreignRate: null,
    extendedSession: null,
    etf: null,
  });
  return {
    ...real,
    useNamuHoldings: holdings,
    useNamuExchangeRate: () => q({ base: "USD", quote: "KRW", rate: st.fx }),
    useNamuQuote: (market: string | null, symbol: string | null) => {
      st.quoteArgs.push([market, symbol]);
      if (st.quote === "error")
        return q(undefined, { isError: true, isSuccess: false });
      if (st.quote === "pending")
        return q(undefined, {
          isPending: true,
          isLoading: true,
          isFetched: false,
          isSuccess: false,
        });
      if (st.quote === "empty")
        return q(
          Object.fromEntries(
            Object.keys(quote()).map((k) => [k, null]),
          ) as unknown,
        );
      return q(quote(), {
        isFetched: st.fetched,
        ...(st.quote === "stale-error" ? { isError: true } : {}),
      });
    },
    useNamuInvestors: (symbol: string | null, enabled: boolean) => {
      st.investorsArgs.push([symbol, enabled]);
      return q(
        enabled
          ? [
              {
                date: "2026-10-29",
                individual: "100",
                foreigner: null,
                institution: "0",
              },
            ]
          : undefined,
        { isPending: !enabled },
      );
    },
    useNamuExecutions: (
      market: string | null,
      symbol: string | null,
      enabled: boolean,
    ) => {
      st.execArgs.push([market, symbol, enabled]);
      return q(undefined, { isPending: !enabled });
    },
  };
});

const { StockDetailView } = await import("./StockDetailView");
const { i18n } = await import("@/shared/i18n/config");
let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
beforeEach(async () => {
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
  await i18n.changeLanguage("ko");
  Object.assign(st, {
    country: "KR",
    holding: false,
    quote: "ok",
    fetched: true,
    fx: 1385.2,
    investorsArgs: [],
    dailyArgs: [],
    quoteArgs: [],
    execArgs: [],
  });
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
          <StockDetailView broker="NAMU" symbol="A1" />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
const sections = () =>
  [...container.querySelectorAll("[data-band]")].map((e) =>
    e.getAttribute("data-section"),
  );
const section = (name: string) =>
  container.querySelector(`[data-section=${name}]`);

describe("나무 상세 띠 차례 (U3)", () => {
  it("국내 보유 종목: 보유 → 오늘 시세 → 호가 · 체결 → 투자자별 → 기본 정보 → 일별 시세", () => {
    st.holding = true;
    render();
    expect(sections()).toEqual([
      "holding",
      "today",
      "quotes",
      "investor",
      "info",
      "daily",
    ]);
  });
  it("미국 종목에는 투자자별 띠가 없고, 보유가 없으면 내 보유 띠도 없다", () => {
    st.country = "US";
    render();
    expect(sections()).toEqual(["today", "quotes", "info", "daily"]);
  });
});

describe("질의 게이팅 — 나무 초당 5회 한도 (I-13b D)", () => {
  it("상세 시세 질의가 끝나기 전에는 투자자별 · 일별 시세를 열지 않는다", () => {
    st.quote = "pending";
    render();
    expect(st.investorsArgs.every(([, enabled]) => enabled === false)).toBe(
      true,
    );
    expect(st.dailyArgs.every(([, , enabled]) => enabled === false)).toBe(true);
  });
  it("끝나면(성공) 둘 다 연다 — 일별은 나무 경로(broker NAMU)", () => {
    render();
    const lastInv = st.investorsArgs[st.investorsArgs.length - 1]!;
    expect(lastInv).toEqual(["A1", true]);
    const lastDaily = st.dailyArgs[st.dailyArgs.length - 1]!;
    expect(lastDaily).toEqual(["A1", "NAMU", true]);
  });
  it("시세가 실패로 끝나도(isFetched) 둘은 열린다 — 실패가 영원한 기다림이 되지 않는다", () => {
    st.quote = "error";
    render();
    expect(st.investorsArgs[st.investorsArgs.length - 1]).toEqual(["A1", true]);
    const lastDaily = st.dailyArgs[st.dailyArgs.length - 1]!;
    expect(lastDaily[2]).toBe(true);
    expect(section("investor")).not.toBeNull();
  });
  it("시장은 마스터로 정하고 보유 질의를 기다리지 않는다 — 시세 질의 인자는 KR + 심볼", () => {
    render();
    expect(st.quoteArgs[st.quoteArgs.length - 1]).toEqual(["KR", "A1"]);
    st.quoteArgs = [];
    st.country = "US";
    act(() => root.unmount());
    root = createRoot(container);
    render();
    expect(st.quoteArgs[st.quoteArgs.length - 1]).toEqual(["US", "A1"]);
  });
  it("체결 질의는 체결 탭을 고르기 전에는 꺼져 있다", async () => {
    render();
    expect(st.execArgs.every(([, , enabled]) => enabled === false)).toBe(true);
    const tab = [...container.querySelectorAll("[role=radio]")].find(
      (e) => e.textContent === "quotes.trades",
    ) as HTMLElement;
    await act(async () => tab.click());
    expect(st.execArgs[st.execArgs.length - 1]).toEqual(["KR", "A1", true]);
  });
});

describe("내 보유 — 매도가능은 미국만", () => {
  it("미국 보유: '매도가능 100주' 줄이 있다", () => {
    st.country = "US";
    st.holding = true;
    render();
    const t = section("holding")!.textContent!;
    expect(t).toContain("holding.sellable");
    expect(t).toContain("100주");
  });
  it("국내 보유: 매도가능 줄이 없다(칸이 null)", () => {
    st.holding = true;
    render();
    expect(section("holding")!.textContent).not.toContain("holding.sellable");
  });
});

describe("시세 질의 실패 — 머리에 한 번, 그 질의에 기대는 띠는 없다 (I-13b 27)", () => {
  it("실패(받아 둔 값 없음): 머리에 실패 한 벌 · 오늘 시세 · 호가 띠 없음 · 기본 정보는 마스터 세 줄", () => {
    st.quote = "error";
    render();
    expect(container.textContent).toContain("detail.priceFail");
    expect(section("today")).toBeNull();
    expect(section("quotes")).toBeNull();
    const info = section("info")!.textContent!;
    expect(info).toContain("info.market");
    expect(info).toContain("info.securityType");
    expect(info).toContain("info.currency");
    expect(info).not.toContain("info.sector");
    expect(info).not.toContain("info.marketCap");
  });
  it("폴링 한 번 실패(값은 남음): 받아 둔 값을 그대로 그리고, 지금 시세가 아님을 띠 한 줄로 말한다(I-wrap-b2b 단계 4)", () => {
    st.quote = "stale-error";
    render();
    // 숫자 · 오늘 시세는 그대로
    expect(container.textContent).toContain("110");
    expect(section("today")).not.toBeNull();
    // 조용히 옛 값으로 두지 않는다 — 머리와 오늘 시세에 "시세를 불러오지 못했어요"
    expect(container.textContent).toContain("detail.priceFail");
    expect(section("today")!.textContent).toContain("detail.priceFail");
  });
  it("값을 기다리는 동안(isPending)은 머리 · 오늘 시세가 Skeleton 이고 '없어요' 가 없다", () => {
    st.quote = "pending";
    render();
    expect(container.textContent).not.toContain("namu.priceEmpty");
    expect(container.textContent).not.toContain("quotes.orderbookEmpty");
    expect(
      section("today")!.querySelector("[aria-busy], [data-slot=skeleton]"),
    ).not.toBeNull();
  });
});

describe("모든 칸이 null 인 응답 — 깨지지 않고 줄을 그리지 않는다", () => {
  it("오늘 시세 · 투자 정보 줄 없음, 호가 '정보가 없어요', NaN 없음", () => {
    st.quote = "empty";
    render();
    expect(section("today")).toBeNull();
    expect(section("quotes")!.textContent).toContain("quotes.orderbookEmpty");
    const info = section("info")!.textContent!;
    expect(info).not.toContain("info.sector");
    expect(info).not.toContain("info.marketCap");
    expect(container.innerHTML).not.toContain("NaN");
  });
});

describe("오늘 시세 · 기본 정보 값", () => {
  it("국내: 시가 · 고가 · 저가 · 거래량 · 상한가(critical) · 하한가(informative)", () => {
    render();
    const t = section("today")!;
    for (const k of [
      "today.open",
      "today.high",
      "today.low",
      "today.volume",
      "info.upperLimit",
      "info.lowerLimit",
    ])
      expect(t.textContent).toContain(k);
    expect(t.innerHTML).toContain("text-fg-critical");
    expect(t.innerHTML).toContain("text-fg-informative");
    // 상하한가는 기본 정보에서 빠졌다
    expect(section("info")!.textContent).not.toContain("info.upperLimit");
  });
  it("미국: 상하한가 줄이 없다(칸이 null)", () => {
    st.country = "US";
    render();
    expect(section("today")!.textContent).not.toContain("info.upperLimit");
  });
  it("기본 정보 차례: 시장 · 유형 · 통화 · 업종 · 시가총액 · 상장일 · 상장주식수, 거래상태 줄 없음", () => {
    render();
    const t = section("info")!.textContent!;
    const order = [
      "info.market",
      "info.securityType",
      "info.currency",
      "info.sector",
      "info.marketCap",
      "info.listDate",
      "info.listedShares",
    ].map((k) => t.indexOf(k));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(t).not.toContain("info.tradingStatus");
    // 상장일은 표준 날짜(13-1) — 20260611 같은 원문이 아니다
    expect(t).not.toContain("19750611");
    expect(t).toContain("1975년 6월 11일");
  });
  it("미국 시가총액: 환율이 있으면 원, 없으면 줄을 지우지 않고 달러(환율 없이 원으로 지어내지 않는다)", () => {
    st.country = "US";
    render();
    const withFx = section("info")!.textContent!;
    expect(withFx).toContain("원");
    expect(withFx).not.toContain("달러");
    act(() => root.unmount());
    root = createRoot(container);
    st.fx = null;
    render();
    const noFx = section("info")!.textContent!;
    expect(noFx).toContain("info.marketCap");
    expect(noFx).toContain("달러");
    expect(noFx).not.toMatch(/조원/);
  });
  it("미국은 '발행주식수', 국내는 '상장주식수'", () => {
    render();
    expect(section("info")!.textContent).toContain("info.listedShares");
    act(() => root.unmount());
    root = createRoot(container);
    st.country = "US";
    render();
    expect(section("info")!.textContent).toContain("info.sharesOutstanding");
  });
});

describe("머리 — 투자 유의 배지 · 등락", () => {
  it("경고 이름표(투자유의 포함)가 배지로 그려진다", () => {
    render();
    const head = container.querySelector("#stock-name")!.closest("section")!;
    // 이름은 t(`warning.<코드>`, { defaultValue: 코드 }) — 이 시험의 t 목은 defaultValue 를 돌려준다
    expect(head.textContent).toContain("INVESTMENT_ATTENTION");
    expect(
      [...head.querySelectorAll("[data-slot=badge]")].some((b) =>
        b.textContent?.includes("INVESTMENT_ATTENTION"),
      ),
    ).toBe(true);
  });
  it("전일 종가가 있으면 머리 증감 '▲ 10원 · 10.00%' — 부호 + 없음", () => {
    render();
    const head = container
      .querySelector("#stock-name")!
      .closest("section")!.textContent!;
    expect(head).toContain("▲ 10원 · 10.00%");
    expect(head).not.toMatch(/\+10/);
  });
});
