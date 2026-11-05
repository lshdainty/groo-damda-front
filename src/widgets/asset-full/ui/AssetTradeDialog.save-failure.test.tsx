// 매매 저장 실패(I-28-5 3b) — 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글), 값은 남김, 이중 제출 가드.
//
// 잠그는 것: ① 요청은 silent ② 실패하면 맨 위 Callout 고정 글 · 입력값 유지 · 서버 글 없음
// ③ 보유 수량 부족 코드(ASSET_012)만 다른 고정 글 ④ 같은 틱 두 번 눌러도 요청 한 번.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset, AssetHolding } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  opts: [] as unknown[],
  mutate: null as unknown as ReturnType<typeof vi.fn>,
  error: null as unknown,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/asset", () => ({
  useCreateTrade: (o?: unknown) => {
    st.opts.push(o);
    return {
      mutate: st.mutate,
      reset: () => {},
      isPending: false,
      isError: st.error != null,
      error: st.error,
    };
  },
  useAssets: () => ({ data: { assets: [] } }),
  useTradePreview: () => ({ data: undefined }),
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSymbolName: () => ({ data: undefined }),
}));

const { AssetTradeDialog } = await import("./AssetTradeDialog");

const asset = { rowId: 1, assetName: "증권 계좌" } as unknown as Asset;
const holding = {
  linked: false,
  holdingName: "가상 종목",
  holdingType: "STOCK",
  quantity: "10",
  avgPrice: "1000",
} as unknown as AssetHolding;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  st.opts = [];
  st.mutate = vi.fn();
  st.error = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

const mount = () =>
  act(() =>
    root.render(
      <AssetTradeDialog asset={asset} holding={holding} onClose={vi.fn()} />,
    ),
  );
const inputs = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-slot=text-input-value]"),
  );
const type = (el: HTMLInputElement, v: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const buyButton = () =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (b) => b.textContent === "trade.actionBuy",
  )!;
const fill = () => {
  type(inputs()[0]!, "3");
  type(inputs()[1]!, "30000");
};

describe("매매 저장 실패", () => {
  it("요청은 silent — 서버 원문 토스트가 안 뜬다", () => {
    mount();
    for (const o of st.opts) expect(o).toEqual({ silent: true });
    expect(st.opts.length).toBeGreaterThan(0);
  });

  it("실패하면 폼 맨 위 Callout 고정 글 · 값 그대로 · 서버 글 없음", () => {
    st.error = new Error("예수금 부족 서버 원문");
    mount();
    fill();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "trade.saveFailed",
    );
    expect(document.body.textContent).not.toContain("서버 원문");
    expect(inputs()[0]!.value).toBe("3");
    expect(inputs()[1]!.value).toBe("30,000");
  });

  it("보유 수량 부족 코드(ASSET_012)는 고정 글이 따로 있다", () => {
    st.error = { response: { data: { code: "ASSET_012", message: "x" } } };
    mount();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "trade.saveInsufficientQty",
    );
  });

  it("실패가 없으면 Callout 도 없다", () => {
    mount();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("같은 틱에 두 번 눌러도 요청은 한 번 — 끝나면(onSettled) 다시 된다", () => {
    mount();
    fill();
    act(() => {
      buyButton().click();
      buyButton().click();
    });
    expect(st.mutate).toHaveBeenCalledTimes(1);
    const cbs = st.mutate.mock.calls[0]![1] as { onSettled: () => void };
    act(() => cbs.onSettled());
    act(() => buyButton().click());
    expect(st.mutate).toHaveBeenCalledTimes(2);
  });
});
