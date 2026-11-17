import * as React from "react";

import { layoutViewportHeight } from "@/shared/ds/overlay";

import { KEYBOARD_GAP } from "./bottom-navigation-variants";

/*
 * Bottom Navigation 의 문맥 · 훅 · 도우미 — 컴포넌트 파일은 컴포넌트만 내보낸다(빠른 새로 고침).
 */

export type BottomNavigationContextValue = {
  compact: boolean;
  /** 라벨을 보이지 않게(sr-only) — 줄어들기 시작할 때 · 다 펴질 때까지 · 칸이 좁을 때 */
  labelsHidden: boolean;
  /** 칸 폭이 + 원 44 보다 좁다(320 보다 좁은 화면) — 원을 36 으로 */
  narrow: boolean;
  scrollToTop: () => void;
};

export const BottomNavigationContext =
  React.createContext<BottomNavigationContextValue | null>(null);

export function useBottomNavigation(name: string) {
  const ctx = React.useContext(BottomNavigationContext);
  if (!ctx) throw new Error(`${name} 는 BottomNavigation 안에 둔다.`);
  return ctx;
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type ScrollRoot =
  React.RefObject<HTMLElement | null> | HTMLElement | null | undefined;

export const resolveRoot = (root: ScrollRoot) =>
  root && "current" in root ? root.current : (root ?? null);

// 화면 키보드가 열렸는가 — visualViewport 가 레이아웃 화면(clientHeight)보다 KEYBOARD_GAP 넘게 작다. innerHeight 는
// iOS Safari 가 키보드가 뜬 채 스크롤하면 줄어 키보드를 못 알아본다(overlay 의 layoutViewportHeight)
function subscribeViewport(onChange: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", onChange);
  return () => vv?.removeEventListener("resize", onChange);
}
function keyboardOpenNow() {
  const vv = window.visualViewport;
  return !!vv && layoutViewportHeight() - vv.height * vv.scale > KEYBOARD_GAP;
}
export function useKeyboardOpen() {
  return React.useSyncExternalStore(
    subscribeViewport,
    keyboardOpenNow,
    () => false,
  );
}

/** 지금 주소가 그 탭의 첫 화면(href)인가 */
export function isAt(href: string) {
  const url = new URL(href, window.location.href);
  const here = window.location;
  return (
    url.pathname === here.pathname &&
    url.search === here.search &&
    url.hash === here.hash
  );
}

/** 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 --press-basis 로 놓는다 */
export function measurePress(el: HTMLElement) {
  el.style.setProperty(
    "--press-basis",
    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
  );
}
