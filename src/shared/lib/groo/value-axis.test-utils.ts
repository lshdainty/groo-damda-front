// 세로 눈금 시험 받침 — jsdom 은 레이아웃이 없어 글 크기 · 차트 크기를 정해 준다(QA 조건: 폰 320 · 글자 200%).
//   · recharts 가 눈금 글을 재는 숨은 글(`recharts_measurement_span`) — 높이 = 11px × 1.5 × 배율, 폭 = 글자 수 어림 × 배율.
//     그 글은 position:absolute 라 블록이 되어 body 의 줄 높이(1.5 — index.css)를 받는다(200% 에서 33)
//   · 세로축 폭을 재는 숨은 글(axisWidth.ts — font-size `--text-t1`) — 같은 폭 어림
//   · 눈금 글 줄 높이를 재는 숨은 글(line-height `--text-t1--line-height`) — 15 × 배율(200% 에서 30)
//   · ResizeObserver — 차트 상자마다 그 상자 높이(Chart `height`)와 [width] 를 알린다
import { act } from "react";
import { vi } from "vitest";

/** 글자 크기 배율 — 1 = 100%, 2 = 200% */
export const tickScale = { value: 1 };

/** 11px 글 폭 어림 — 한글 11 · 숫자 6.6(고정폭) · 점 · 쉼표 · 빈칸 2.8 · 그 밖 7 */
const glyphs = (s: string) =>
  [...s].reduce(
    (w, c) =>
      w + (c > "ᄀ" ? 11 : /[0-9]/.test(c) ? 6.6 : /[., ]/.test(c) ? 2.8 : 7),
    0,
  );

let observers: { cb: (entries: unknown[]) => void; el: Element }[] = [];

/** beforeEach 에서 부른다 — 가짜 ResizeObserver · 글 크기 */
export function installValueAxisHarness() {
  observers = [];
  tickScale.value = 1;
  globalThis.ResizeObserver = class {
    private cb: (entries: unknown[]) => void;
    constructor(cb: (entries: unknown[]) => void) {
      this.cb = cb;
    }
    observe(el: Element) {
      observers.push({ cb: this.cb, el });
    }
    unobserve() {}
    disconnect() {
      observers = observers.filter((o) => o.cb !== this.cb);
    }
  } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const text = this.textContent ?? "";
      const recharts = this.id === "recharts_measurement_span";
      const axis = this.style.fontSize.includes("--text-t1");
      // 눈금 글 줄 높이를 재는 숨은 글(axisWidth.ts measureTickLineHeight — line-height `--text-t1--line-height` = 15 / 16rem)
      const line = this.style.lineHeight.includes("--text-t1--line-height");
      const width = recharts || axis ? glyphs(text) * tickScale.value : 0;
      const height = recharts
        ? 11 * 1.5 * tickScale.value
        : line
          ? 15 * tickScale.value
          : 0;
      return {
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect;
    },
  );
}

/** recharts 의 ResponsiveContainer 에 크기를 알린다 — 높이는 그 차트 상자의 높이(Chart `height`) */
export const layoutCharts = (width: number) =>
  act(() => {
    for (const o of observers) {
      if (!o.el.classList.contains("recharts-responsive-container")) continue;
      const box = o.el.closest<HTMLElement>("[data-slot=chart]");
      const height = parseFloat(box?.style.height ?? "") || 200;
      o.cb([{ target: o.el, contentRect: { width, height } }]);
    }
  });

/** 차트 상자 하나의 세로 눈금 글 — 왼쪽 축(yAxisId 첫째)부터. 아래(작은 값)에서 위 순서 */
export function yTickLabels(
  root: ParentNode,
  { axis = 0, chart = 0 }: { axis?: number; chart?: number } = {},
): string[] {
  const box = root.querySelectorAll("[data-slot=chart]")[chart];
  // recharts 3 은 눈금 글을 축 묶음 밖 글 층(`recharts-yAxis-tick-labels`)에 축마다 따로 둔다
  const axes = box?.querySelectorAll(".recharts-yAxis-tick-labels") ?? [];
  const el = axes[axis];
  if (!el) return [];
  return Array.from(el.querySelectorAll(".recharts-cartesian-axis-tick-value"))
    .map((t) => ({
      text: t.textContent ?? "",
      y: Number(t.getAttribute("y")),
    }))
    .sort((a, b) => b.y - a.y)
    .map((t) => t.text);
}

/** 차트 상자 하나의 세로 눈금 글 자리(y) — 아래에서 위 순서. 이웃 사이가 눈금 글 줄 높이 이상이면 겹치지 않는다 */
export function yTickPositions(
  root: ParentNode,
  { axis = 0, chart = 0 }: { axis?: number; chart?: number } = {},
): number[] {
  const box = root.querySelectorAll("[data-slot=chart]")[chart];
  const el = box?.querySelectorAll(".recharts-yAxis-tick-labels")[axis];
  if (!el) return [];
  return Array.from(el.querySelectorAll(".recharts-cartesian-axis-tick-value"))
    .map((t) => Number(t.getAttribute("y")))
    .sort((a, b) => b - a);
}

/** 차트 상자 하나의 가로 눈금 글 — 보이는 글만, 왼쪽부터. 글 폭은 받침의 어림(배율 포함)으로 왼쪽 · 오른쪽 끝을 낸다 */
export function xTickLabels(
  root: ParentNode,
  { chart = 0 }: { chart?: number } = {},
): { text: string; left: number; right: number }[] {
  const box = root.querySelectorAll("[data-slot=chart]")[chart];
  return Array.from(
    box?.querySelectorAll(
      ".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value",
    ) ?? [],
  )
    .filter((t) => t.textContent)
    .map((t) => {
      const x = Number(t.getAttribute("x"));
      const w = glyphs(t.textContent!) * tickScale.value;
      return { text: t.textContent!, left: x - w / 2, right: x + w / 2 };
    })
    .sort((a, b) => a.left - b.left);
}
