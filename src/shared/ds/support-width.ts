import * as React from "react";

/*
 * 지원 폭 — 가장 좁은 화면은 CSS 폭 320 이다(groo-design DESIGN.md Layout "지원 폭 — 320 이상", WCAG 1.4.10 Reflow).
 * 이 폭까지는 모든 스펙이 그대로고, 폰에서 페이지를 확대하면(사파리 200% 에서 약 200) 이보다 좁아진다. 320 미만은 모양이
 * 덜 다듬어져도 되지만 겹침 · 가림 · 잘림은 막는다 — 부품마다의 동작은 그 부품 스펙에 있다(Segmented Control · Bottom
 * Navigation · Date Picker · Chart).
 *
 * 화면 폭으로 갈리는 부품(Segmented Control)만 이 훅을 쓴다. 자리 폭으로 갈리는 부품(탭 바 칸 · 도넛 자리)은 제 자리를 잰다.
 */

/** 지원하는 가장 좁은 화면 폭(CSS px) */
export const SUPPORT_MIN_WIDTH = 320;

const QUERY = `(max-width: ${SUPPORT_MIN_WIDTH - 0.02}px)`;

const media = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;

function subscribe(onChange: () => void) {
  const mql = media();
  mql?.addEventListener?.("change", onChange);
  return () => mql?.removeEventListener?.("change", onChange);
}

const below = () => media()?.matches ?? false;

/** 화면이 지원 폭(320)보다 좁은가 — 페이지 확대 등. 320 이상이면 늘 false 라 스펙 그대로다 */
export function useBelowSupportWidth() {
  return React.useSyncExternalStore(subscribe, below, () => false);
}
