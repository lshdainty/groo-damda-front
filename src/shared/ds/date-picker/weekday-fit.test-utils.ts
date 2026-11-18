// 일곱 칸 격자 시험 받침 — jsdom 은 레이아웃이 없어 글 폭 · 칸 폭을 정해 준다(QA 조건: 폰 320 · 글자 100% → 300%).
//   · 글 폭 = 글자 수 어림(라틴 0.62em · 숫자 0.6em · 빈칸 0.25em · 한글 1em) × 글자 크기
//   · 글자 크기 = 그 요소(또는 조상)의 글자 클래스 — 상한 클래스(WEEK_GRID_TEXT, `var(--text-tN)` 이 든 것)면 min(기준 × 배율, 기준 × 2),
//     그냥 `text-tN` 이면 기준 × 배율. 기준은 토큰 px(t1 11 · t2 12 · t3 13 · t4 14 · t5 16). 브라우저가 rem 토큰을 푸는 것과 같은 셈이다
//   · 칸 폭 = [cellWidth] — 견본(`weekday-probe`)을 품은 요소가 칸이다
//   · ResizeObserver — 지켜보는 요소를 모아 두고, 글자 크기를 바꾸면 크기가 바뀌는 것(견본 · 줄 · 글자 크기 판의 숨은 글)에 알린다
import { act } from "react";
import { vi } from "vitest";

import { WEEKDAY_PROBE_SLOT } from "./weekday-fit";

const BASE: Record<string, number> = { t1: 11, t2: 12, t3: 13, t4: 14, t5: 16 };

export const grid = { scale: 1, cellWidth: 320 / 7 };

/** 그 요소의 글자 크기(px) — 가장 가까운 글자 클래스로 */
export function fontPx(el: Element | null): number {
  for (let e = el; e; e = e.parentElement) {
    const cls = e.getAttribute("class") ?? "";
    const capped = cls.match(/text-\[length:min\(var\(--text-(t\d)\)/);
    if (capped) {
      const base = BASE[capped[1]!]!;
      return Math.min(base * grid.scale, base * 2);
    }
    const plain = cls.match(/(?:^|\s)text-(t\d)(?=\s|$)/);
    if (plain) return BASE[plain[1]!]! * grid.scale;
  }
  return 16 * grid.scale;
}

/** 글 폭 어림 */
export const textWidth = (text: string, px: number) =>
  [...text].reduce(
    (w, c) =>
      w + (c > "ᄀ" ? 1 : /[0-9]/.test(c) ? 0.6 : c === " " ? 0.25 : 0.62) * px,
    0,
  );

/** 요소에 보이는 글의 폭 — 견본은 빼고 잰다 */
export const shownWidth = (el: Element) => {
  const clone = el.cloneNode(true) as Element;
  clone
    .querySelectorAll(`[data-slot=${WEEKDAY_PROBE_SLOT}]`)
    .forEach((p) => p.remove());
  return textWidth(clone.textContent ?? "", fontPx(el));
};

let observers: { cb: (entries: unknown[]) => void; el: Element }[] = [];

const rect = (width: number) =>
  ({
    width,
    height: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON() {},
  }) as DOMRect;

/** beforeEach 에서 부른다 */
export function installWeekGridHarness() {
  observers = [];
  grid.scale = 1;
  grid.cellWidth = 320 / 7;
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
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.dataset.slot === WEEKDAY_PROBE_SLOT)
        return rect(textWidth(this.textContent ?? "", fontPx(this)));
      if (this.querySelector(`:scope > [data-slot=${WEEKDAY_PROBE_SLOT}]`))
        return rect(grid.cellWidth);
      // 글자 크기 판의 숨은 글(axisWidth.ts subscribeTickFont — "0000", `--text-t1`)
      if (this.style.fontSize.includes("--text-t1"))
        return rect(textWidth(this.textContent ?? "", 11 * grid.scale));
      return rect(0);
    },
  );
}

const isTickFont = (el: Element) =>
  el instanceof HTMLElement && el.style.fontSize.includes("--text-t1");

/**
 * 페이지가 뜬 뒤 글자 크기를 바꾼다(html font-size) — 브라우저처럼 크기가 바뀐 관찰 대상(견본 · 요일 줄 · 글자 크기 판의 숨은 글)에 알린다.
 * [only] 가 "font" 면 글자 크기 판의 숨은 글에만 알린다(견본 관찰이 알림을 놓친 경우)
 */
export const changeTextScale = (scale: number, only?: "font") =>
  act(() => {
    grid.scale = scale;
    for (const o of [...observers]) {
      if (only === "font" && !isTickFont(o.el)) continue;
      o.cb([{ target: o.el }]);
    }
  });
