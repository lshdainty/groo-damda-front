// 세로 눈금 시험 받침 — jsdom 은 레이아웃이 없어 글 크기 · 차트 크기를 정해 준다(QA 조건: 폰 320 · 글자 100% → 300%).
//   · 글자 크기 배율은 그 글의 글자 크기 값이 rem(`0.6875rem` · `var(--text-t1)`)일 때만 걸린다 — px · `-static` 토큰은 그대로다.
//     브라우저가 푸는 것과 같다(groo-design #260 — 차트 그림 안 글은 글자 크기 설정을 따르지 않는다)
//   · recharts 가 눈금 글을 재는 숨은 글(`recharts_measurement_span`) — 높이 = 11px × 1.5, 폭 = 글자 수 어림. 눈금 글 크기는
//     ds `CHART_TICK_SIZE` 다(recharts 는 그 값을 숨은 글에 옮기지 않는다 — 그래서 그 값으로 배율을 정한다)
//   · 세로축 폭을 재는 숨은 글(axisWidth.ts — font-size `AXIS_TICK_FONT_SIZE`) — 같은 폭 어림
//   · 눈금 글 줄 높이를 재는 숨은 글(line-height `--text-t1-static--line-height`) — 15
//   · ResizeObserver — 차트 상자마다 그 상자 높이(Chart `height`)와 [width] 를 알린다
import { act } from "react";
import { vi } from "vitest";

import { CHART_TICK_SIZE } from "@/shared/ds/chart/chart-variants";

/** 글자 크기 배율 — 1 = 100%, 2 = 200% */
export const tickScale = { value: 1 };
/** 글꼴 폭 배율 — 웹폰트가 도착해 같은 크기의 글이 넓어진 것(1 = 대체 글꼴) */
export const fontWidth = { value: 1 };

/** 11px 글 폭 어림 — 한글 11 · 숫자 6.6(고정폭) · 점 · 쉼표 · 빈칸 2.8 · 그 밖 7 */
const glyphs = (s: string) =>
  [...s].reduce(
    (w, c) =>
      w + (c > "ᄀ" ? 11 : /[0-9]/.test(c) ? 6.6 : /[., ]/.test(c) ? 2.8 : 7),
    0,
  ) * fontWidth.value;

/** 글자 크기 값의 배율 — rem 이면 글자 크기 설정을 따르고(배율), px · `-static` 토큰이면 그대로(1) */
export const scaleOf = (value: string): number =>
  /rem\b|var\(--text-t\d+(--line-height)?\)/.test(value) ? tickScale.value : 1;

/** 눈금 글의 배율 — ds `CHART_TICK_SIZE` 를 푼다 */
export const tickTextScale = () => scaleOf(CHART_TICK_SIZE);

let observers: { cb: (entries: unknown[]) => void; el: Element }[] = [];

/** beforeEach 에서 부른다 — 가짜 ResizeObserver · 글 크기 */
export function installValueAxisHarness() {
  observers = [];
  tickScale.value = 1;
  fontWidth.value = 1;
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
      const axis = this.style.fontSize.startsWith("var(--text-t1");
      // 눈금 글 줄 높이를 재는 숨은 글(axisWidth.ts measureTickLineHeight)
      const line = /--text-t1(-static)?--line-height/.test(
        this.style.lineHeight,
      );
      const width = recharts
        ? glyphs(text) * tickTextScale()
        : axis
          ? glyphs(text) * scaleOf(this.style.fontSize)
          : 0;
      const height = recharts
        ? 11 * 1.5 * tickTextScale()
        : line
          ? 15 * scaleOf(this.style.lineHeight)
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

/**
 * 페이지가 떠 있는 동안 글자 크기를 바꾼다 — 배율을 바꾸고, 눈금 글꼴 판의 숨은 글(axisWidth.ts subscribeTickFont — "0000")을
 * 지켜보는 ResizeObserver 를 부른다(그 글 폭이 바뀌었으면 판이 오르고 지켜보는 차트 · 훅이 다시 그린다 — 눈금 글이 `-static` 이면
 * 폭이 같아 판이 오르지 않는다)
 */
export const changeTickScale = (scale: number) =>
  act(() => {
    tickScale.value = scale;
    for (const o of observers.filter((x) => x.el.textContent === "0000"))
      o.cb([]);
  });

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

/** 차트 상자 하나의 가로 눈금 글 — 보이는 글만, 왼쪽부터. 글 폭은 받침의 어림(눈금 글이 rem 이면 배율 포함)으로 왼쪽 · 오른쪽 끝을 낸다 */
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
      const w = glyphs(t.textContent!) * tickTextScale();
      return { text: t.textContent!, left: x - w / 2, right: x + w / 2 };
    })
    .sort((a, b) => a.left - b.left);
}

/**
 * 세로축 끝 글의 자리(#250) — 차트 상자 하나에서 세로 눈금 글(눈금 선 가운데, 줄 높이 15 — rem 이면 × 배율)의 맨 위 · 맨 아래 끝과
 * 가로 눈금 글의 위 끝(글 줄 시작 y)을 낸다. 맨 위 ≥ 0 이면 차트 상자 안, 맨 아래 ≤ 가로 글 위 끝이면 겹치지 않는다
 */
export function edgeLabelBox(
  root: ParentNode,
  { chart = 0 }: { chart?: number } = {},
): { yTop: number; yBottom: number; xTop: number } {
  const box = root.querySelectorAll("[data-slot=chart]")[chart];
  const half = (15 * tickTextScale()) / 2;
  const ys = Array.from(
    box?.querySelectorAll(
      ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
    ) ?? [],
  ).map((t) => Number(t.getAttribute("y")));
  const xs = Array.from(
    box?.querySelectorAll(
      ".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value",
    ) ?? [],
  )
    .filter((t) => t.textContent)
    .map((t) => Number(t.getAttribute("y")));
  return {
    yTop: Math.min(...ys) - half,
    yBottom: Math.max(...ys) + half,
    xTop: Math.min(...xs),
  };
}

/** 웹폰트가 도착해 눈금 글 폭이 [ratio] 배가 된다 — 눈금 글꼴 판의 숨은 글을 지켜보는 ResizeObserver 를 부른다 */
export const changeTickFont = (ratio: number) =>
  act(() => {
    fontWidth.value = ratio;
    for (const o of observers.filter((x) => x.el.textContent === "0000"))
      o.cb([]);
  });
