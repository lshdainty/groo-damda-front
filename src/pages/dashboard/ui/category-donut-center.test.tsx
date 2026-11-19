// 1280 홈 · 통계 도넛 — 가운데 합계는 글자 크기 설정을 따르지 않는 글(t5-static)이다. 가운데에 들어가는지 재는 숨은 글도 같은 글이어야
// 한다 — QA(dev f844fe49): 숨은 글이 rem(t5)이라 300% 에서 세 배 폭으로 재 "안 든다"고 보고 합계를 도넛 아래 줄로 옮겼다(앱 #614 와 같은 결함).
// jsdom 은 레이아웃이 없어 글 폭을 글자 클래스로 푼다 — text-tN(rem)이면 기준 × 배율, text-tN-static 이면 기준 그대로(브라우저와 같은 셈).
import { readFileSync } from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chartDonutRadii } from "@/shared/ds/chart";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { CategoryBody } = await import("./home-parts");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const TEXT_PX: Record<string, number> = { t2: 12, t3: 13, t4: 14, t5: 16 };
let scale = 1;

/** 글 폭 어림 — 숫자 · 쉼표 0.6em, 그 밖 1em. 글자 크기는 그 요소의 글자 클래스로 */
function fontPx(el: Element): number {
  const m = (el.getAttribute("class") ?? "").match(
    /(?:^|\s)text-(t\d+)(-static)?(?=\s|$)/,
  );
  if (!m) return 16 * scale;
  const base = TEXT_PX[m[1]!] ?? 16;
  return m[2] ? base : base * scale;
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  scale = 1;
  // 관찰을 시작하면 콜백을 한 번 부른다(브라우저와 같다) — 판정을 재는 숨은 글(span)만. 차트 상자 · recharts 는 크기 정보가 필요해 부르지 않는다
  globalThis.ResizeObserver = class {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe(el: Element) {
      if (el.tagName === "SPAN") this.cb([]);
    }
    unobserve() {}
    disconnect() {}
  } as never;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const text = this.textContent ?? "";
      const em = [...text].reduce((w, c) => w + (/[\d,]/.test(c) ? 0.6 : 1), 0);
      const width = em * fontPx(this);
      return {
        width,
        height: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect;
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

// 1280 홈 도넛 — 지름 200. 합계 "1,234,567원" — 100% 폭 ≈ 7 × 0.6 × 16 + 2 × 0.6 × 16 + 16 = 102.4
const SIZE = 200;
const render = () =>
  act(() =>
    root.render(
      <CategoryBody
        center
        size={SIZE}
        month={11}
        slices={[
          {
            id: 1,
            name: "식비",
            amount: 1_234_567,
            color: "red",
            fill: "var(--color-chart-red)",
          } as never,
        ]}
      />,
    ),
  );

describe("1280 도넛 가운데 합계 — 판정과 그림이 같은 static 글", () => {
  it("100% — 합계가 가운데에 있고 아래 합계 줄이 없다", () => {
    render();
    expect(
      container.querySelector("[data-slot=chart-donut-center]"),
    ).not.toBeNull();
    expect(container.querySelector("[data-slot=home-donut-total]")).toBeNull();
  });

  it("300% — 가운데 글은 커지지 않으므로 그대로 가운데에 있다(아래 줄로 옮기지 않는다)", () => {
    scale = 3;
    render();
    // 판정에 쓰는 숨은 글이 rem 이었다면 폭 ≈ 307 > 구멍 − 16 이라 아래 줄로 옮겨졌다
    const hole = chartDonutRadii(SIZE).innerRadius * 2;
    expect(102.4 * 3).toBeGreaterThan(hole - 16);
    expect(
      container.querySelector("[data-slot=chart-donut-center]"),
    ).not.toBeNull();
    expect(container.querySelector("[data-slot=home-donut-total]")).toBeNull();
    // 가운데 합계 글은 static — 그림과 판정이 같은 글
    const amount = container.querySelector(
      "[data-slot=chart-donut-center-amount]",
    )!;
    expect(amount.className).toContain("text-t5-static");
  });

  it("통계 도넛도 같은 판정 — 숨은 글이 가운데 합계와 같은 ds 글(CHART_DONUT_CENTER_AMOUNT)", () => {
    for (const file of [
      "src/pages/stats/ui/stats-parts.tsx",
      "src/pages/dashboard/ui/home-parts.tsx",
    ]) {
      const src = readFileSync(path.resolve(process.cwd(), file), "utf8");
      const measure = src.slice(src.indexOf("ref={measureRef}"));
      expect(measure.slice(0, 400), file).toContain(
        "CHART_DONUT_CENTER_AMOUNT",
      );
      expect(measure.slice(0, 400), file).not.toMatch(/text-t5(?!-static)/);
    }
  });
});
