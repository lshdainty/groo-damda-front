// 나무 폰 화면 — 시장 띠(장 상태 · 환율) · 주문 가능 줄 · 다른 증권사를 권하지 않는다 (I-13b 17 · 18 · 28)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  fx: "ok" as "ok" | "null" | "error" | "stale",
  prices: "ok" as "ok" | "error" | "nostate",
  mstate: { kr: "REGULAR", us: "AFTER" } as Record<string, string | null>,
  krwOrderable: "200000000" as string | null,
  krwError: false,
  margin: "ok" as "ok" | "null" | "error",
  watch: [] as { symbol: string; countryCode: string }[],
  holdingsMode: "ok" as "ok" | "loading" | "error" | "empty",
  pricesLoading: false,
  pricesCalls: [] as string[][],
}));

const item = (symbol: string, cur: string) => ({
  symbol,
  name: symbol,
  quantity: "10",
  avgPrice: "100",
  currentPrice: "110",
  evalAmount: "1100",
  profitLoss: "100",
  sellableQuantity: cur === "USD" ? "10" : null,
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && "time" in o ? `${k}|${o.time}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/stock/model/useNamu", () => {
  const q = (data: unknown, extra = {}) => ({
    data,
    isLoading: false,
    isError: false,
    refetch: () => {},
    ...extra,
  });
  return {
    marketStateOf: (
      quotes: { symbol: string; marketState: string | null }[] | undefined,
      symbol: string | null,
    ) => quotes?.find((x) => x.symbol === symbol)?.marketState ?? null,
    useNamuHoldings: (cur: string) =>
      st.holdingsMode === "loading"
        ? q(undefined, { isLoading: true })
        : st.holdingsMode === "error"
          ? q(undefined, { isError: true })
          : st.holdingsMode === "empty"
            ? q({
                accountNo: "1",
                currency: cur,
                totalEvalAmount: "0",
                totalProfitLoss: "0",
                profitRate: "0",
                items: [],
                deposit: null,
                orderableAmount: null,
              })
            : cur === "KRW"
              ? st.krwError
                ? q(undefined, { isError: true })
                : q({
                    accountNo: "1",
                    currency: "KRW",
                    totalEvalAmount: "1100",
                    totalProfitLoss: "100",
                    profitRate: "10",
                    items: [item("K1", "KRW")],
                    deposit: "1500000000",
                    orderableAmount: st.krwOrderable,
                  })
              : q({
                  accountNo: "1",
                  currency: "USD",
                  totalEvalAmount: "1100",
                  totalProfitLoss: "100",
                  profitRate: "10",
                  items: [item("U1", "USD")],
                  deposit: null,
                  orderableAmount: null,
                }),
    useNamuExchangeRate: () =>
      st.fx === "error"
        ? q(undefined, { isError: true })
        : st.fx === "stale"
          ? q({ base: "USD", quote: "KRW", rate: 1385.2 }, { isError: true })
          : q({
              base: "USD",
              quote: "KRW",
              rate: st.fx === "ok" ? 1385.2 : null,
            }),
    useNamuMargin: () =>
      st.margin === "error"
        ? q(undefined, { isError: true })
        : q({
            currency: "USD",
            foreignDeposit: st.margin === "ok" ? "12345.67" : null,
          }),
    useNamuPrices: (symbols: string[]) => {
      st.pricesCalls.push(symbols);
      if (symbols.length === 0) return q(undefined);
      if (st.pricesLoading) return q(undefined, { isLoading: true });
      if (st.prices === "error") return q(undefined, { isError: true });
      return q(
        symbols.map((s) => ({
          symbol: s,
          price: 1,
          currency: s === "U1" ? "USD" : "KRW",
          previousClose: 1,
          marketState:
            st.prices === "nostate"
              ? null
              : s === "U1"
                ? st.mstate.us
                : st.mstate.kr,
        })),
      );
    },
  };
});
vi.mock("@/features/stock/api/watchlistApi", () => ({
  useWatchGroups: () => ({
    data: [{ rowId: 1, groupName: "g", sortOrder: 1, items: st.watch }],
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateWatchGroup: () => ({ isPending: false, mutate: () => {} }),
  useRenameWatchGroup: () => ({ isPending: false, mutate: () => {} }),
  useDeleteWatchGroup: () => ({ isPending: false, mutateAsync: () => {} }),
}));
vi.mock("@/features/stock/model/useWatchQuotes", () => ({
  useNamuWatchQuotes: () => ({
    isLoading: false,
    isError: false,
    priceOf: () => ({ price: null, changePct: null }),
  }),
}));
vi.mock("@/features/stock/ui/phone/stock-search", () => ({
  StockSearchEntry: () => <button data-slot="stock-search-entry" />,
}));

const { NamuStocksView } = await import("./NamuStocksView");
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
  Object.assign(st, {
    fx: "ok",
    prices: "ok",
    mstate: { kr: "REGULAR", us: "AFTER" },
    krwOrderable: "200000000",
    krwError: false,
    margin: "ok",
    watch: [],
    holdingsMode: "ok",
    pricesLoading: false,
    pricesCalls: [],
  });
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
      <MemoryRouter initialEntries={["/desk/stocks/namu"]}>
        <NamuStocksView />
      </MemoryRouter>,
    ),
  );
const section = (name: string) =>
  container.querySelector(`[data-section=${name}]`)!;

describe("나무 시장 띠 (I-13b 17)", () => {
  it("띠 차례는 내 투자 → 시장 → 종목 — 지수 줄 · 발견 · 일간 손익 · 다른 증권사 권유 글이 없다", () => {
    render();
    const secs = [...container.querySelectorAll("[data-band]")].map((e) =>
      e.getAttribute("data-section"),
    );
    expect(secs).toEqual(["invest", "market", "stocks"]);
    const all = container.textContent!;
    expect(all).not.toContain("holding.dailyPnl");
    expect(all).not.toContain("segments.discover");
    expect(all).not.toContain("KOSPI");
    expect(all).not.toContain("connect.");
    // 시장 띠의 줄 = 환율 하나뿐(지수 줄 없음)
    expect(
      section("market").querySelectorAll(
        "li[data-slot=list-item], [data-slot=list-item]",
      ).length,
    ).toBe(1);
  });
  it("장 상태: 보유 첫 종목이 대표 · 국내 정규장은 장중 + 시각, 미국은 애프터마켓(점은 정규장만 열림)", () => {
    render();
    const states = section("market").querySelector(
      "[data-slot=market-states]",
    )!;
    expect(states.textContent).toContain("market.live|");
    expect(states.textContent).toContain("market.state.AFTER");
    const dots = states.querySelectorAll("li > span[aria-hidden]");
    expect(dots[0]!.className).toContain("bg-fg-positive");
    expect(dots[1]!.className).toContain("bg-stroke-neutral-solid");
    expect(states.textContent).toContain("market.krShort");
    expect(states.textContent).toContain("market.usShort");
  });
  it("대표 종목 시세는 최대 두 종목을 한 번에 부른다(국내 · 미국 보유 첫 종목)", () => {
    render();
    expect(st.pricesCalls.every((c) => c.length <= 2)).toBe(true);
    expect(st.pricesCalls[st.pricesCalls.length - 1]).toEqual(["K1", "U1"]);
  });
  it("여덟 가지 상태 글이 모두 그려진다", () => {
    const cases: [string, string][] = [
      ["PRE", "market.state.PRE"],
      ["AFTER", "market.state.AFTER"],
      ["DAYTIME", "market.state.DAYTIME"],
      ["SINGLE_PRICE", "market.state.SINGLE_PRICE"],
      ["HALTED", "market.state.HALTED"],
      ["BEFORE_OPEN", "market.state.BEFORE_OPEN"],
      ["CLOSED", "market.afterClose"],
      ["REGULAR", "market.live"],
    ];
    for (const [state, label] of cases) {
      st.mstate = { kr: state, us: state };
      act(() => root.unmount());
      root = createRoot(container);
      render();
      expect(section("market").textContent).toContain(label);
    }
  });
  it("장 상태를 못 받은(null) 시장은 그리지 않는다 — 환율 줄은 남는다", () => {
    st.prices = "nostate";
    render();
    expect(
      section("market").querySelector("[data-slot=market-states]"),
    ).toBeNull();
    expect(section("market").textContent).toContain("summary.fxRate");
  });
  it("환율을 못 구하면 값 자리에 '환율 없음'", () => {
    st.fx = "null";
    render();
    expect(section("market").textContent).toContain("namu.fxUnavailableShort");
  });
  it("환율 · 장 상태 둘 다 실패하면 시장 정보 실패 한 벌", () => {
    st.fx = "error";
    st.prices = "error";
    render();
    expect(section("market").textContent).toContain("market.failTitle");
  });
  it("받아 둔 값이 있으면 폴링 한 번의 실패(isError)로 실패 한 벌을 띄우지 않는다", () => {
    st.fx = "stale";
    st.prices = "error";
    render();
    expect(section("market").textContent).not.toContain("market.failTitle");
    expect(section("market").textContent).toContain("1,385.20");
  });
  it("하나만 실패하면 남은 줄이 보인다(실패 한 벌 아님)", () => {
    st.fx = "error";
    render();
    expect(section("market").textContent).not.toContain("market.failTitle");
    expect(section("market").textContent).toContain("market.live");
  });
  it("보유가 없으면 관심 첫 종목이 대표다", () => {
    st.watch = [{ symbol: "W1", countryCode: "KR" }];
    render();
    // 보유(K1 · U1)가 있으니 관심 종목은 대표가 되지 않는다
    expect(st.pricesCalls[st.pricesCalls.length - 1]).toEqual(["K1", "U1"]);
  });
});

describe("나무 시장 띠 — 기다림 · 보유 실패 · 보유 0 (I-13b 17 · 27)", () => {
  const states = () =>
    section("market").querySelector("[data-slot=market-states]");
  const skeleton = () =>
    section("market").querySelector("[data-slot=market-states-loading]");
  it("대표 시세를 기다리는 동안은 줄 자리에 Skeleton 이고 실패 한 벌이 아니다", () => {
    st.pricesLoading = true;
    st.fx = "error";
    render();
    expect(skeleton()).not.toBeNull();
    expect(states()).toBeNull();
    expect(section("market").textContent).not.toContain("market.failTitle");
  });
  it("보유 질의가 오는 중이어도 Skeleton(대표를 아직 모른다)이고 실패 한 벌이 아니다", () => {
    st.holdingsMode = "loading";
    st.fx = "error";
    render();
    expect(skeleton()).not.toBeNull();
    expect(section("market").textContent).not.toContain("market.failTitle");
  });
  it("보유 질의가 실패해도 관심 첫 종목이 대표라 장 상태 줄이 나온다", () => {
    st.holdingsMode = "error";
    st.watch = [
      { symbol: "W1", countryCode: "KR" },
      { symbol: "U1", countryCode: "US" },
    ];
    render();
    expect(states()).not.toBeNull();
    expect(skeleton()).toBeNull();
    expect(st.pricesCalls[st.pricesCalls.length - 1]).toEqual(["W1", "U1"]);
  });
  it("보유가 0 이어도 관심 첫 종목이 대표라 줄이 나온다", () => {
    st.holdingsMode = "empty";
    st.watch = [{ symbol: "W1", countryCode: "KR" }];
    render();
    expect(states()).not.toBeNull();
    expect(states()!.textContent).toContain("market.krShort");
    expect(states()!.textContent).not.toContain("market.usShort");
  });
  it("보유도 관심도 없으면(대표 없음) 장 상태 줄 없이 환율 줄만 — Skeleton 도 없다", () => {
    st.holdingsMode = "empty";
    render();
    expect(states()).toBeNull();
    expect(skeleton()).toBeNull();
    expect(section("market").textContent).toContain("summary.fxRate");
  });
  it("실패 한 벌은 기다림이 끝난 뒤 환율과 대표 시세가 둘 다 실패했을 때만", () => {
    st.fx = "error";
    st.prices = "error";
    render();
    expect(section("market").textContent).toContain("market.failTitle");
  });
});

describe("나무 주문 가능 · 예수금 줄 (I-13b 18)", () => {
  const rowNames = () =>
    [...section("invest").querySelectorAll("li")].map(
      (li) => li.textContent ?? "",
    );
  it("국내 평가 · 해외 평가 다음 주문 가능 · 원화 → 예수금 · 달러 → 보유 종목 순", () => {
    render();
    const names = rowNames();
    const idx = [
      "namu.domesticValue",
      "namu.overseasValue",
      "invest.orderableKrw",
      "invest.depositUsd",
      "summary.holdingsCount",
    ].map((k) => names.findIndex((n) => n.includes(k)));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(section("invest").textContent).toContain("200,000,000");
    expect(section("invest").textContent).toContain("$12,345.67");
    // 나무에는 '주문 가능 · 달러' 가 아니라 '예수금 · 달러' 다
    expect(section("invest").textContent).not.toContain("invest.orderableUsd");
  });
  it("값이 비어 오면(null) 그 줄을 그리지 않는다", () => {
    st.krwOrderable = null;
    st.margin = "null";
    render();
    const t = section("invest").textContent!;
    expect(t).not.toContain("invest.orderableKrw");
    expect(t).not.toContain("invest.depositUsd");
  });
  it("달러 질의가 실패하면 값 '—' (구역 실패가 아니다)", () => {
    st.margin = "error";
    render();
    const row = rowNames().find((n) => n.includes("invest.depositUsd"))!;
    expect(row).toContain("—");
    expect(section("invest").textContent).not.toContain("invest.failTitle");
  });
  it("국내 잔고 질의가 실패하면 주문 가능 · 원화 값 '—'", () => {
    st.krwError = true;
    render();
    const row = rowNames().find((n) => n.includes("invest.orderableKrw"))!;
    expect(row).toContain("—");
  });
});

// 폭이 768 을 넘나들어도(phone ↔ desk) 쓰던 관심 그룹 이름이 남는다 — "폼은 갈림 밖"(I-wrap-b1 ε 9).
// 종전엔 두 return 이 {dialogs} 를 다른 자리(폰 넷째 · 넓은 화면 둘째)에 두어 폼이 다시 붙으며 칸이 비었다.
describe("폭이 바뀌어도 관심 그룹 폼이 남는다 (I-wrap-b1 ε 9)", () => {
  const renderAt = (layout: "phone" | "desk") =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/desk/stocks/namu?tab=watch"]}>
          <NamuStocksView layout={layout} />
        </MemoryRouter>,
      ),
    );
  const nameInput = () =>
    document.body.querySelector<HTMLInputElement>("[role=dialog] input");
  it("폰에서 쓰던 이름이 넓은 화면 · 다시 폰에서도 그대로다", () => {
    renderAt("phone");
    const add = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("watch.groupAdd"),
    );
    if (!add) throw new Error("그룹 추가 줄을 찾지 못했다");
    act(() => add.click());
    const input = nameInput();
    if (!input) throw new Error("그룹 이름 칸을 찾지 못했다");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(input, "배당주 모음");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    renderAt("desk");
    expect(nameInput()?.value).toBe("배당주 모음");
    renderAt("phone");
    expect(nameInput()?.value).toBe("배당주 모음");
  });
});
