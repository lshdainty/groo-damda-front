// 토스 폰 화면 — 띠 차례 · 금액 줄바꿈 · 부호 · 지수 이름 · 칩 글 · 출처 줄 · 실패/비었음 갈래 (I-13 P 절 5 ~ 12)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  holdings: "ok" as "ok" | "error" | "empty" | "stale-error",
  accounts: "ok" as "ok" | "empty",
  // 시장 구역 — 달력 · 지수 · 환율을 따로 실패시킨다(I-13 12 · 13-1 검수 H4)
  cal: "ok" as "ok" | "error" | "pending" | "holiday",
  idx: "ok" as "ok" | "error",
  fx: "ok" as "ok" | "error",
  /** 금액 가리기 켬 */
  hide: false,
}));

const amt = (n: number) => ({ krw: String(n), usd: null });
const item = (symbol: string, name: string, cur: string, v: number) => ({
  symbol,
  name,
  marketCountry: cur === "USD" ? "US" : "KR",
  currency: cur,
  quantity: "10",
  lastPrice: "1",
  averagePurchasePrice: "1",
  marketValue: {
    purchaseAmount: "1",
    amount: String(v),
    amountAfterCost: String(v),
  },
  profitLoss: {
    amount: "5",
    amountAfterCost: "5",
    rate: "12.34",
    rateAfterCost: "12",
  },
  dailyProfitLoss: { amount: "-3", rate: "-0.5" },
  cost: { commission: "0", tax: null },
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const names: Record<string, string> = {
        "market.KOSPI": "코스피",
        "market.KOSDAQ": "코스닥",
      };
      if (k in names) return names[k];
      if (k.startsWith("market.") && o && "defaultValue" in o)
        return String(o.defaultValue);
      return k;
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/stock/model/useTossStocks", () => {
  const q = (data: unknown, extra = {}) => ({
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: () => {},
    ...extra,
  });
  return {
    useTossAccounts: () =>
      q(
        st.accounts === "empty"
          ? []
          : [{ accountSeq: 1, accountNo: "1", accountType: "G" }],
      ),
    // 계좌가 없으면(accountSeq null) 진짜 훅은 꺼져 있어 데이터가 없다
    useTossHoldings: (seq: number | null) =>
      seq == null
        ? q(undefined, { isSuccess: false })
        : st.holdings === "error"
          ? q(undefined, { isError: true, isSuccess: false })
          : q(
              {
                totalPurchaseAmount: amt(1500000000),
                marketValue: {
                  amount: amt(1834567890),
                  amountAfterCost: amt(1834567890),
                },
                profitLoss: {
                  amount: amt(334567890),
                  amountAfterCost: amt(0),
                  rate: "22.30",
                  rateAfterCost: "0",
                },
                dailyProfitLoss: { amount: amt(-12345678), rate: "-0.67" },
                items:
                  st.holdings === "empty"
                    ? []
                    : [
                        item("U1", "미국종목", "USD", 6185.55),
                        item("K1", "한국종목", "KRW", 8760000),
                      ],
              },
              // 폴링이 한 번 실패해도 받아 둔 값은 남는다 — react-query 는 이때도 isError 를 켠다(검수 M1)
              st.holdings === "stale-error" ? { isError: true } : {},
            ),
    useTossExchangeRate: () =>
      st.fx === "error"
        ? q(undefined, { isError: true, isSuccess: false })
        : q({ rate: "1385.20" }),
    useTossBuyingPower: (seq: number | null, currency: string) =>
      seq == null
        ? q(undefined, { isSuccess: false })
        : q({
            currency,
            cashBuyingPower: currency === "KRW" ? "200000000" : "12345.67",
          }),
    useTossIndicatorPrices: () =>
      st.idx === "error"
        ? q(undefined, { isError: true, isSuccess: false })
        : q([
            { symbol: "KOSPI", timestamp: null, lastPrice: "2651.12" },
            { symbol: "KR3Y", timestamp: null, lastPrice: "3.1" },
          ]),
    useTossIndicatorCandles: () => new Map<string, number[]>(),
    // 서버 응답 꼴 그대로 — `+09:00` 오프셋 ISO date-time(미국 정규장은 한국 시각 22:30 ~ 다음 날 05:00, 자정을 넘는다)
    useTossMarketCalendarKr: () =>
      st.cal === "error"
        ? q(undefined, { isError: true, isSuccess: false })
        : st.cal === "pending"
          ? q(undefined, { isLoading: true, isSuccess: false })
          : q({
              today: {
                date: "2026-10-29",
                integrated:
                  st.cal === "holiday"
                    ? null
                    : {
                        preMarket: null,
                        regularMarket: {
                          startTime: "2026-10-29T09:00:00+09:00",
                          endTime: "2026-10-29T15:30:00+09:00",
                        },
                        afterMarket: null,
                      },
              },
            }),
    useTossMarketCalendarUs: () =>
      st.cal === "error"
        ? q(undefined, { isError: true, isSuccess: false })
        : st.cal === "pending"
          ? q(undefined, { isLoading: true, isSuccess: false })
          : q({
              today: {
                date: "2026-10-29",
                regularMarket:
                  st.cal === "holiday"
                    ? null
                    : {
                        startTime: "2026-10-29T22:30:00+09:00",
                        endTime: "2026-10-30T05:00:00+09:00",
                      },
              },
            }),
    useTossRankings: () => q({ rankings: [] }),
    useTossStockInfo: () => q([]),
  };
});
vi.mock("@/shared/lib/groo/money-text", async (orig) => ({
  ...(await orig<typeof import("@/shared/lib/groo/money-text")>()),
  // 가리기 켬이면 지금 가리는 자리가 전부 "••••" 가 되는지 본다(P 절 7)
  useMasked: () => (text: string) => (st.hide ? "••••" : text),
}));
vi.mock("@/features/stock/api/watchlistApi", () => ({
  useWatchGroups: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateWatchGroup: () => ({ isPending: false, mutate: () => {} }),
  useRenameWatchGroup: () => ({ isPending: false, mutate: () => {} }),
  useDeleteWatchGroup: () => ({ isPending: false, mutateAsync: () => {} }),
}));
vi.mock("@/features/stock/model/useWatchQuotes", () => ({
  useTossWatchQuotes: () => ({
    isLoading: false,
    isError: false,
    priceOf: () => ({ price: null, changePct: null }),
  }),
  useNamuWatchQuotes: () => ({
    isLoading: false,
    isError: false,
    priceOf: () => ({ price: null, changePct: null }),
  }),
}));
vi.mock("@/features/stock/ui/phone/stock-search", () => ({
  StockSearchEntry: () => <button data-slot="stock-search-entry" />,
}));

const { TossStocksView } = await import("./TossStocksView");
let container: HTMLDivElement;
let root: Root;
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
  st.holdings = "ok";
  st.accounts = "ok";
  st.cal = "ok";
  st.idx = "ok";
  st.fx = "ok";
  st.hide = false;
  // 2026-10-29 13:00 한국 — 달력 시각 판정이 벽시계를 타지 않게 고정한다
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T04:00:00Z"));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
});
const render = () =>
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/desk/stocks/toss"]}>
        <TossStocksView />
      </MemoryRouter>,
    ),
  );

describe("토스 폰 화면", () => {
  it("띠 차례는 내 투자 → 시장 → 종목", () => {
    render();
    const secs = [...container.querySelectorAll("[data-band]")].map((e) =>
      e.getAttribute("data-section"),
    );
    expect(secs).toEqual(["invest", "market", "stocks"]);
  });
  it("내 투자 키-값 차례: 매입금액 → 일간 손익 → 주문 가능 원화 → 주문 가능 달러 → 보유 종목 (I-13b 18)", () => {
    render();
    const names = [
      ...container.querySelectorAll("[data-section=invest] li"),
    ].map((li) => li.textContent ?? "");
    const order = [
      "holding.purchaseAmount",
      "holding.dailyPnl",
      "invest.orderableKrw",
      "invest.orderableUsd",
      "summary.holdingsCount",
    ].map((k) => names.findIndex((n) => n.includes(k)));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const text = container.querySelector("[data-section=invest]")!.textContent!;
    expect(text).toContain("200,000,000");
    expect(text).toContain("$12,345.67");
  });
  it("머리는 TopNavigation(← + 증권)", () => {
    render();
    expect(
      container.querySelector("header[data-slot=top-navigation]"),
    ).not.toBeNull();
    expect(container.querySelector("h1")!.textContent).toBe("nav.title");
  });
  it("지표 금액은 쉼표 뒤에서만 줄바꿈하고(wbr), 증감에 +/− 부호가 없다", () => {
    render();
    const v = container.querySelector("[data-slot=card-stat-value]")!;
    expect(v.querySelectorAll("wbr").length).toBeGreaterThan(0);
    const delta = container.querySelector("[data-slot=delta-value]")!;
    expect(delta.textContent).toMatch(/^▲/);
    expect(delta.textContent).not.toMatch(/[+−-]/);
  });
  it("모르는 지수 심볼(KR3Y)은 코스닥으로 접히지 않고 그리지 않는다", () => {
    render();
    const m = container.querySelector("[data-section=market]")!.textContent!;
    expect(m).toContain("코스피");
    expect(m).not.toContain("코스닥");
    expect(m).not.toContain("3.1");
  });
  it("칩 글에 숫자가 없고 출처 줄이 있다", () => {
    render();
    const chips = [...container.querySelectorAll("[role=tab]")].map(
      (e) => e.textContent,
    );
    expect(chips).toEqual([
      "segments.holdings",
      "segments.watch",
      "segments.discover",
    ]);
    expect(chips.join("")).not.toMatch(/\d/);
    expect(container.textContent).toContain("market.dataNotice");
  });
  it("미국 보유는 달러 표기(원 없음)", () => {
    render();
    const rows = container.querySelector("[data-section=stocks]")!.textContent!;
    expect(rows).toContain("$6,185.55");
    expect(rows).toContain("한국종목");
  });
  it("보유 질의 실패는 '불러오지 못했어요' 한 벌이고 연결 안내가 아니다", () => {
    st.holdings = "error";
    render();
    expect(container.textContent).toContain("invest.failTitle");
    expect(container.textContent).toContain("holdings.failTitle");
    expect(container.textContent).not.toContain("connect.");
  });
  it("계좌 목록이 빈 목록이면 빈 상태(지표 0 · '보유 중인 종목이 없어요')", () => {
    st.accounts = "empty";
    render();
    expect(container.textContent).not.toContain("invest.failTitle");
    expect(container.textContent).toContain("holdings.empty");
  });

  // ---- 시장 띠 — 달력 · 지수 · 환율은 구역마다 따로 실패한다(검수 H4) ------------------
  const states = () =>
    container.querySelector("[data-slot=market-states]")?.textContent ?? "";

  it("달력을 받았으면 두 시장 모두 판정한다 — 국내 장중 · 미국 개장 전(22:30)", () => {
    render();
    expect(states()).toContain("market.live");
    expect(states()).toContain("market.preopen");
    expect(
      container.querySelectorAll("[data-slot=market-states] li"),
    ).toHaveLength(2);
  });
  it("달력이 아직이면 '휴장' 이 아니라 Skeleton 이다", () => {
    st.cal = "pending";
    render();
    expect(states()).not.toContain("market.holiday");
    expect(
      container.querySelectorAll("[data-slot=market-state-pending]"),
    ).toHaveLength(2);
  });
  it("달력이 실패하면 그 시장 칸을 줄에서 뺀다 — '휴장' 으로 지어내지 않고, 지수 · 환율은 그대로", () => {
    st.cal = "error";
    render();
    expect(container.querySelector("[data-slot=market-states]")).toBeNull();
    expect(container.textContent).not.toContain("market.holiday");
    expect(container.textContent).not.toContain("market.failTitle");
    const m = container.querySelector("[data-section=market]")!.textContent!;
    expect(m).toContain("코스피");
    expect(m).toContain("1,385.20");
  });
  it("달력이 '세션 없음' 을 줬을 때만 휴장이다", () => {
    st.cal = "holiday";
    render();
    expect(states()).toContain("market.holiday");
  });
  it("지수만 실패하면 지수 줄만 비고 상태 줄 · 환율은 남는다(띠 전체 실패 아님)", () => {
    st.idx = "error";
    render();
    const m = container.querySelector("[data-section=market]")!.textContent!;
    expect(m).not.toContain("market.failTitle");
    expect(m).not.toContain("코스피");
    expect(states()).toContain("market.live");
    expect(m).toContain("1,385.20");
  });
  it("구역이 전부 실패할 때만 '시장 정보를 불러오지 못했어요' 한 벌", () => {
    st.cal = "error";
    st.idx = "error";
    st.fx = "error";
    render();
    expect(
      container.querySelector("[data-section=market]")!.textContent,
    ).toContain("market.failTitle");
  });

  // ---- 폴링 실패 — 받아 둔 값은 실패 화면으로 바뀌지 않는다(검수 M1) -------------------
  it("보유가 폴링에서 실패해도 받아 둔 내 투자 · 보유 목록이 그대로다", () => {
    st.holdings = "stale-error";
    render();
    expect(container.textContent).not.toContain("invest.failTitle");
    expect(container.textContent).not.toContain("holdings.failTitle");
    expect(container.textContent).toContain("$6,185.55");
    expect(container.textContent).toContain("한국종목");
    // 조용히 옛 값으로 두지 않는다 — 내 투자 · 보유 목록에 Callout "시세를 불러오지 못했어요 · 마지막으로 받은 시세"(단계 4).
    // 보이는 내용이 있으니 실패 Result Section 은 아니다
    const bands = container.querySelectorAll("[data-slot=price-stale-callout]");
    expect(bands.length).toBeGreaterThanOrEqual(1);
    expect(bands[0]!.textContent).toContain("detail.priceFail");
    expect(bands[0]!.textContent).toContain("detail.priceStale");
    expect(container.querySelector("[data-slot=price-fail-band]")).toBeNull();
    // 섹션 첫 줄 — 내 투자 띠에서 Callout 이 평가금액 라벨보다 앞이다(숫자를 읽기 전에, 앱 p4a 와 같은 자리)
    const invest = container.querySelector("[data-section=invest]")!;
    const callout = invest.querySelector("[data-slot=price-stale-callout]")!;
    const label = [...invest.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && e.textContent === "summary.title",
    )!;
    expect(
      callout.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("폴링이 모두 정상이면 시세 실패 Callout · 띠가 없다", () => {
    render();
    expect(container.querySelector("[data-slot=price-fail-band]")).toBeNull();
    expect(
      container.querySelector("[data-slot=price-stale-callout]"),
    ).toBeNull();
  });

  it("금액 가리기를 켜면 내 투자 · 보유 줄의 금액이 모두 가려진다", () => {
    st.hide = true;
    render();
    const t = container.textContent!;
    expect(t).not.toContain("1,834,567,890");
    expect(t).not.toContain("3,302,659,766");
    expect(t).not.toContain("$6,185.55");
    expect(t).not.toContain("8,760,000");
    expect(t).toContain("••••");
  });
});
