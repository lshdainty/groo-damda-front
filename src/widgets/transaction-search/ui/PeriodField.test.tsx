// 거래 검색 고급 필터의 빠른 기간은 가계부 거르기와 같은 벌 셋이다 — 이번 주 · 이번 달 · 최근 3개월(I-wrap-b1 ε · 앱 α 검수).
// 종전엔 다섯(지난 달 · 올해 포함)이라 같은 필터가 화면마다 달랐다. 앱 검색 · 가계부 거르기도 셋이다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// 글은 실제 사전(ko)을 쓴다 — 빠른 기간 이름은 ds 사전에서 온다
beforeAll(async () => {
  const { i18n } = await import("@/shared/i18n/config");
  await i18n.changeLanguage("ko");
  Element.prototype.scrollTo = function () {} as Element["scrollTo"];
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const { PeriodField } = await import("./PeriodField");

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

describe("검색 빠른 기간 (I-wrap-b1 ε)", () => {
  it("이번 주 · 이번 달 · 최근 3개월 셋 — 지난 달 · 올해는 없다", () => {
    act(() => root.render(<PeriodField from="" to="" onChange={() => {}} />));
    const trigger = container.querySelector<HTMLElement>(
      "[aria-haspopup=dialog]",
    )!;
    act(() => trigger.click());
    const group = document.body.querySelector(
      "[data-slot=date-picker-presets]",
    )!;
    expect(
      [...group.querySelectorAll("[role=radio]")].map((b) => b.textContent),
    ).toEqual(["이번 주", "이번 달", "최근 3개월"]);
  });
});
