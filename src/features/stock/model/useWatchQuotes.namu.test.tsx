// 나무 관심 시세 훅 본체(I-13 22 · I-13b 16) — /v1/namu/prices 로만 부르고(50 씩 묶음), 받은 값은 안 보이게 돼도 남긴다
import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const getPrices = vi.hoisted(() => vi.fn());
vi.mock("../api/namuApi", async (orig) => ({
  ...(await orig<typeof import("../api/namuApi")>()),
  namuApi: { getPrices },
}));
const securitiesGet = vi.hoisted(() => vi.fn());
vi.mock("../api/securitiesApi", async (orig) => ({
  ...(await orig<typeof import("../api/securitiesApi")>()),
  securitiesApi: { getPrices: securitiesGet },
}));

const { useNamuWatchQuotes } = await import("./useWatchQuotes");

let root: Root;
let container: HTMLDivElement;
const holder: { current: ReturnType<typeof useNamuWatchQuotes> | null } = {
  current: null,
};
function Probe({ symbols }: { symbols: string[] }) {
  const v = useNamuWatchQuotes(symbols);
  useEffect(() => {
    holder.current = v;
  });
  return null;
}
const mount = (symbols: string[], wrap?: ReactNode) =>
  act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Probe symbols={symbols} />
        {wrap}
      </QueryClientProvider>,
    );
  });
let qc: QueryClient;
const settle = () =>
  act(async () => void (await new Promise((r) => setTimeout(r, 20))));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  getPrices.mockReset();
  securitiesGet.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  holder.current = null;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("나무 관심 시세", () => {
  it("나무 경로로만 부르고 기본 증권사 경로(securitiesApi)는 부르지 않는다", async () => {
    getPrices.mockResolvedValue([
      {
        symbol: "A",
        price: 110,
        currency: "KRW",
        previousClose: 100,
        marketState: "REGULAR",
      },
    ]);
    await mount(["A"]);
    await settle();
    expect(getPrices).toHaveBeenCalledTimes(1);
    expect(getPrices).toHaveBeenCalledWith(["A"]);
    expect(securitiesGet).not.toHaveBeenCalled();
  });
  it("등락률은 전일 종가에서 센다(+10%), 전일 종가가 없거나 0 이면 null", async () => {
    getPrices.mockResolvedValue([
      {
        symbol: "A",
        price: 110,
        currency: "KRW",
        previousClose: 100,
        marketState: null,
      },
      {
        symbol: "B",
        price: 5,
        currency: "KRW",
        previousClose: null,
        marketState: null,
      },
      {
        symbol: "C",
        price: 5,
        currency: "KRW",
        previousClose: 0,
        marketState: null,
      },
    ]);
    await mount(["A", "B", "C"]);
    await settle();
    expect(holder.current!.priceOf("A")).toEqual({ price: 110, changePct: 10 });
    expect(holder.current!.priceOf("B").changePct).toBeNull();
    expect(holder.current!.priceOf("C").changePct).toBeNull();
    expect(holder.current!.priceOf("없는종목")).toEqual({
      price: null,
      changePct: null,
    });
  });
  it("51개는 두 묶음(50 + 1)으로 나눠 부른다", async () => {
    getPrices.mockResolvedValue([]);
    const symbols = Array.from({ length: 51 }, (_, i) => `S${i}`);
    await mount(symbols);
    await settle();
    expect(getPrices).toHaveBeenCalledTimes(2);
    const sizes = getPrices.mock.calls
      .map((c) => (c[0] as string[]).length)
      .sort((a, b) => a - b);
    expect(sizes).toEqual([1, 50]);
  });
  it("받은 값은 심볼 목록에서 빠져도(그룹이 화면 밖으로 나가도) 남는다", async () => {
    getPrices.mockResolvedValue([
      {
        symbol: "A",
        price: 110,
        currency: "KRW",
        previousClose: 100,
        marketState: null,
      },
    ]);
    await mount(["A"]);
    await settle();
    await mount([]);
    await settle();
    expect(holder.current!.priceOf("A").price).toBe(110);
  });
  it("심볼이 없으면 아무것도 부르지 않는다", async () => {
    await mount([]);
    await settle();
    expect(getPrices).not.toHaveBeenCalled();
  });
  it("모든 묶음이 실패하면 isError", async () => {
    getPrices.mockRejectedValue(new Error("x"));
    await mount(["A"]);
    await settle();
    expect(holder.current!.isError).toBe(true);
  });

  it("값 없이 처음 실패한 묶음이 있으면 load(Result Section), 받아 둔 값이 있는 채 실패면 stale(Callout) — 검수 2차 L4", async () => {
    getPrices.mockRejectedValue(new Error("down"));
    await mount(["A"]);
    await settle();
    expect(holder.current!.failed).toBe("load");
    getPrices.mockReset();
    getPrices.mockResolvedValue([
      { symbol: "A", price: 110, currency: "KRW", previousClose: 100 },
    ]);
    await act(async () => {
      await qc.refetchQueries();
    });
    await settle();
    expect(holder.current!.failed).toBeNull();
    getPrices.mockRejectedValue(new Error("down"));
    await act(async () => {
      await qc.refetchQueries().catch(() => undefined);
    });
    await settle();
    expect(holder.current!.failed).toBe("stale");
  });
});
