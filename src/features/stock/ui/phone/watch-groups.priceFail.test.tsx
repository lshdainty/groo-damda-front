// 관심 시세를 못 받았을 때(I-wrap-b2b 단계 4) — 예전에는 줄마다 "—" 만 보이고 실패를 말하지 않았다.
// 지금: 관심 목록 맨 위 "시세를 불러오지 못했어요" + [다시 시도], 줄은 그대로("—" 또는 받아 둔 값).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchGroup } from "../../api/stockApi";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { WatchGroups } = await import("./watch-groups");

const groups = [
  {
    rowId: 1,
    groupName: "관심",
    items: [
      {
        rowId: 11,
        symbol: "005930",
        nameKr: "숲길전자",
        marketCode: "KOSPI",
        currency: "KRW",
      },
    ],
  },
] as unknown as WatchGroup[];

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const draw = (quotesFailed: "load" | "stale" | null, onRetryQuotes = vi.fn()) =>
  act(() =>
    root.render(
      <WatchGroups
        groups={groups}
        onRetry={() => {}}
        priceOf={() => ({ price: null, changePct: null })}
        track={() => () => {}}
        onOpen={() => {}}
        onAddGroup={() => {}}
        onRenameGroup={() => {}}
        onDeleteGroup={() => {}}
        quotesFailed={quotesFailed}
        onRetryQuotes={onRetryQuotes}
      />,
    ),
  );

describe("관심 시세 실패", () => {
  it("처음부터 실패(보이는 시세 없음): 맨 위 Result Section + [다시 시도], 종목 줄은 그대로", () => {
    const retry = vi.fn();
    draw("load", retry);
    const band = container.querySelector("[data-slot=price-fail-band]");
    expect(band?.textContent).toContain("detail.priceFail");
    expect(container.textContent).toContain("숲길전자");
    act(() => band!.querySelector("button")!.click());
    expect(retry).toHaveBeenCalled();
  });

  it("받아 둔 시세가 있는 채 실패: Result Section 이 아니라 Callout(상자 전체가 다시 시도) — '마지막으로 받은 시세'", () => {
    const retry = vi.fn();
    draw("stale", retry);
    expect(container.querySelector("[data-slot=price-fail-band]")).toBeNull();
    const callout = container.querySelector("[data-slot=price-stale-callout]");
    expect(callout?.textContent).toContain("detail.priceFail");
    expect(callout?.textContent).toContain("detail.priceStale");
    act(() => callout!.querySelector("button")!.click());
    expect(retry).toHaveBeenCalled();
  });

  it("실패가 아니면 둘 다 없다", () => {
    draw(null);
    expect(container.querySelector("[data-slot=price-fail-band]")).toBeNull();
    expect(
      container.querySelector("[data-slot=price-stale-callout]"),
    ).toBeNull();
  });
});
