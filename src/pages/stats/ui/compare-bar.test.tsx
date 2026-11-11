// 비교 막대 줄 — 넓으면 한 줄, 좁으면 위 줄(이름 줄바꿈 · 금액 오른쪽) + 막대. 쌓기(금액을 아래로)는 flex-wrap 이 맡는다 —
// 이름 칸의 min-width 가 가장 긴 낱말(min-content)이라 금액 폭 + 8 + 그 낱말이 줄 폭을 넘을 때만 금액이 내려간다(렌더로 확인: I-28-2-web-renders/stack-*).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompareBar } from "./compare-bar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let host: HTMLDivElement;
let root: Root;
let widths = { container: 312, name: 70, amount: 100 };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  widths = { container: 312, name: 70, amount: 100 };
  // jsdom 은 배치가 없다 — 폭을 숨은 재기 글 · 줄 요소에서 읽는 자리를 직접 준다
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.className.includes("whitespace-nowrap") &&
        this.getAttribute("aria-hidden")
        ? this.className.includes("text-t2")
          ? widths.name
          : widths.amount
        : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => widths.container,
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = () =>
  act(() =>
    root.render(
      <CompareBar
        label="2026년 9월"
        amount="123,456,789원"
        max={0.5}
        current
      />,
    ),
  );
const layout = () =>
  host.querySelector<HTMLElement>("[data-layout]")!.dataset.layout;

describe("CompareBar", () => {
  it("넓으면 한 줄 — 이름 · 막대 · 금액", () => {
    mount();
    expect(layout()).toBe("row");
    expect(host.querySelector("[data-slot=compare-bar-name]")).toBeNull();
  });

  it("좁으면 위 줄(이름 줄바꿈 가능 · 금액 제 폭) + 막대 — 이름이 먼저 줄을 바꾼다", () => {
    widths.container = 250; // 70 + 10 + 64 + 10 + 100 = 254 > 250
    mount();
    expect(layout()).toBe("column");
    const name = host.querySelector<HTMLElement>(
      "[data-slot=compare-bar-name]",
    )!;
    const amount = host.querySelector<HTMLElement>(
      "[data-slot=compare-bar-amount]",
    )!;
    // 이름 = 남는 폭을 쓰고(flex-1) 가장 긴 낱말까지만 줄어든다(min-w-min) · 낱말 단위(break-keep)
    expect(name.className).toMatch(/\bflex-1\b/);
    expect(name.className).toMatch(/\bmin-w-min\b/);
    expect(name.className).toMatch(/\bbreak-keep\b/);
    expect(name.className).not.toMatch(/break-words|break-all/);
    // 금액 = 제 폭(flex-none) · 한 줄 · 오른쪽 끝 · 사이 gap 8(gap-x-x2)
    expect(amount.className).toMatch(/\bflex-none\b/);
    expect(amount.className).toMatch(/whitespace-nowrap/);
    expect(amount.parentElement!.className).toMatch(/\bflex-wrap\b/);
    expect(amount.parentElement!.className).toMatch(/gap-x-x2\b/);
    // 막대는 위 줄 아래(같은 부모의 다음 형제)
    expect(
      amount.parentElement!.nextElementSibling?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("색은 Chart 규칙(10B) · DA-10 — 이번 chart-blue · 지난 blue-600(다크 blue-700, 바탕 3:1), 트랙 · 테두리 없음", () => {
    mount();
    const fill = (h: HTMLElement) =>
      h.querySelector<HTMLElement>("[aria-hidden=true] > div")!;
    expect(fill(host).className).toMatch(/\bbg-chart-blue\b(?!-)/);
    expect(fill(host).className).not.toMatch(/fg-brand|border/);
    expect(
      host.querySelector<HTMLElement>("[aria-hidden=true]")!.className,
    ).not.toMatch(/\bbg-/);
    act(() =>
      root.render(
        <CompareBar label="지난달" amount="1원" max={0.5} current={false} />,
      ),
    );
    // DA-10(11-11) — 옅은 chart-blue-weak 는 바탕 1.26:1 이라 한 단계 진하게
    expect(fill(host).className).toContain("bg-blue-600");
    expect(fill(host).className).toContain("dark:bg-blue-700");
    expect(fill(host).className).not.toContain("chart-blue-weak");
    expect(fill(host).className).not.toMatch(/neutral-weak|border/);
  });
});
