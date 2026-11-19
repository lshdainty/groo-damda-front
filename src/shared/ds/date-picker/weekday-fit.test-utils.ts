// 일곱 칸 격자 · 글자 크기 시험 받침 — jsdom 은 레이아웃이 없어 글 폭 · 칸 폭을 정해 준다(QA 조건: 폰 320 · 글자 100% → 300%).
//   · 글 폭 = 글자 수 어림(라틴 0.62em · 숫자 0.6em · 빈칸 0.25em · 한글 1em) × 글자 크기
//   · 글자 크기 = 그 요소(또는 조상)의 글자 클래스 — `text-tN`(rem 토큰)이면 기준 × 배율, `text-tN-static`(px 토큰)이면 기준 그대로.
//     기준은 토큰 px(t1 11 · t2 12 · t3 13 · t4 14 · t5 16 …). 브라우저가 rem · px 토큰을 푸는 것과 같은 셈이다(groo-design #260 —
//     크게 보여 줄 내용은 커지고, 디자인 틀은 그대로)
//   · 칸 폭 = [cellWidth] — 견본(`weekday-probe`)을 품은 요소가 칸이다
//   · ResizeObserver — 지켜보는 요소를 모아 두고, 글자 크기를 바꾸면 모두에게 알린다(브라우저는 크기가 바뀐 것에만 알리지만, 다 알려도
//     다시 잰 값이 같아야 한다 — 그대로 두는 쪽이 정말 그대로인지 본다)
import { act } from "react";
import { vi } from "vitest";

import { WEEKDAY_PROBE_SLOT } from "./weekday-fit";

/** 글자 토큰 px(groo-tokens.css — rem 토큰 × 16 = static 토큰) */
export const TEXT_PX: Record<string, number> = {
  t1: 11,
  t2: 12,
  t3: 13,
  t4: 14,
  t5: 16,
  t6: 18,
  t7: 20,
  t8: 22,
  t9: 24,
  t10: 26,
  t11: 28,
  t12: 32,
  t13: 40,
  t14: 48,
};

export const grid = { scale: 1, cellWidth: 320 / 7 };

/** 클래스 글에서 글자 크기(px) — 글자 클래스가 없으면 null */
export function classFontPx(cls: string, scale = grid.scale): number | null {
  const m = cls.match(/(?:^|\s)text-(t\d+)(-static)?(?=\s|$)/);
  if (!m) return null;
  const base = TEXT_PX[m[1]!]!;
  return m[2] ? base : base * scale;
}

/** 그 요소의 글자 크기(px) — 가장 가까운 글자 클래스로 */
export function fontPx(el: Element | null, scale = grid.scale): number {
  for (let e = el; e; e = e.parentElement) {
    const px = classFontPx(e.getAttribute("class") ?? "", scale);
    if (px != null) return px;
  }
  return 16 * scale;
}

/** 100% 에서의 글자 크기 — 그대로 두는 쪽은 지금(300%) 값과 같아야 한다 */
export const fontPxAt100 = (el: Element | null) => fontPx(el, 1);

/** CSS 글자 크기 값(SVG fontSize · style) — rem · var(--text-tN) 은 배율을 따르고 px · var(--text-tN-static) 은 그대로 */
export function cssFontPx(value: string, scale = grid.scale): number {
  const rem = value.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16 * scale;
  const px = value.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]);
  const token = value.match(/^var\(--text-(t\d+)(-static)?\)$/);
  if (token) {
    const base = TEXT_PX[token[1]!]!;
    return token[2] ? base : base * scale;
  }
  throw new Error(`글자 크기를 풀 수 없다: ${value}`);
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
      // 견본 — 글자 클래스가 안쪽 글에 있으면(별자리 7일 띠) 그 글의 크기로
      if (this.dataset.slot === WEEKDAY_PROBE_SLOT)
        return rect(
          textWidth(
            this.textContent ?? "",
            fontPx(this.querySelector("[class*=text-t]") ?? this),
          ),
        );
      if (this.querySelector(`:scope > [data-slot=${WEEKDAY_PROBE_SLOT}]`))
        return rect(grid.cellWidth);
      // 눈금 글꼴 판의 숨은 글(axisWidth.ts subscribeTickFont — "0000")
      if (this.style.fontSize.startsWith("var(--text-"))
        return rect(
          textWidth(this.textContent ?? "", cssFontPx(this.style.fontSize)),
        );
      return rect(0);
    },
  );
}

/**
 * 페이지가 뜬 뒤 글자 크기를 바꾼다(html font-size) — 지켜보는 요소(견본 · 요일 줄 · 눈금 글꼴 판의 숨은 글) 모두에게 알린다
 */
export const changeTextScale = (scale: number) =>
  act(() => {
    grid.scale = scale;
    for (const o of [...observers]) o.cb([{ target: o.el }]);
  });
