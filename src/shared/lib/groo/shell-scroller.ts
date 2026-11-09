import { useState, type RefObject } from "react";
import { scrollHostOf, type ScrollHost } from "./scroll-host";

/*
 * 셸의 본문 스크롤 주체 — 스크롤을 읽고 듣는 자리가 `main` 을 직접 집지 않고 이 한 곳을 읽는다.
 * 지금은 어디서나 `#main`(폰 · 태블릿 · 데스크톱)이다. 폰이 문서 스크롤로 바뀌면(I-fix-2.0.0 B PR ②) 이 파일의
 * `PHONE_DOCUMENT_SCROLL` 만 켠다 — 폰(768 미만)에서 `documentElement` 를 돌려준다.
 */

export const SHELL_SCROLLER_ID = "main";
const PHONE_QUERY = "(max-width: 767.98px)";

/** 폰이 문서 스크롤을 쓰는가 — PR ② 가 켠다. 지금은 꺼 있어 폰도 main 이다 */
const PHONE_DOCUMENT_SCROLL = false as boolean;

/** 정하는 규칙(순수) — 폰이고 문서 스크롤이 켜져 있으면 문서, 아니면 main */
export function pickShellScroller({
  phone,
  documentScroll,
  main,
  doc,
}: {
  phone: boolean;
  documentScroll: boolean;
  main: HTMLElement | null;
  doc: HTMLElement | null;
}): HTMLElement | null {
  return phone && documentScroll ? doc : main;
}

function isPhone() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(PHONE_QUERY).matches
  );
}

/** 지금 본문 스크롤 상자 요소 — 읽는 순간 찾는다(셸과 화면이 한 번에 그려질 때 main 이 아직 문서에 없을 수 있다) */
export function getShellScrollerElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return pickShellScroller({
    phone: isPhone(),
    documentScroll: PHONE_DOCUMENT_SCROLL,
    main: document.getElementById(SHELL_SCROLLER_ID),
    doc: document.scrollingElement as HTMLElement | null,
  });
}

export function getShellScroller(): ScrollHost | null {
  const el = getShellScrollerElement();
  return el ? scrollHostOf(el) : null;
}

/** 스크롤 상자 ref — 읽는 순간 찾는 getter ref. 렌더 때 한 번 집으면 늦은 마운트에서 null 로 굳는다 */
export function createShellScrollerRef() {
  return {
    get current() {
      return getShellScrollerElement();
    },
  } as RefObject<HTMLElement | null>;
}

export function useShellScroller() {
  const [ref] = useState(createShellScrollerRef);
  return ref;
}

const SCROLL_PARENT = ".m-scroll, .overflow-y-auto";

/**
 * `from` 를 품은 가장 가까운 스크롤 상자 — 셸 본문(`#main`)이면 그 자리의 스크롤 주체로 바꿔 돌려준다.
 * 안쪽 상자(`.overflow-y-auto`)는 그대로다.
 */
export function closestScroller(from: Element | null): HTMLElement | null {
  const found = from?.closest<HTMLElement>(SCROLL_PARENT) ?? null;
  if (found && found.id === SHELL_SCROLLER_ID) return getShellScrollerElement();
  return found;
}
