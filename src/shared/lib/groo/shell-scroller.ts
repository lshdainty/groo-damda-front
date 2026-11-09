import { useEffect, useState, type RefObject } from "react";
import { isPhoneViewport, TABLET_QUERY } from "./viewport";
import { scrollHostOf, type ScrollHost } from "./scroll-host";

/*
 * 셸의 본문 스크롤 주체 — 스크롤을 읽고 듣는 자리가 `main` 을 직접 집지 않고 이 한 곳을 읽는다.
 * 폰(768 미만 — `useDeviceSize` 의 mobile 과 같은 질의)은 문서(`documentElement`)가 스크롤한다 — 브라우저는 문서 스크롤일 때만
 * 주소 · 아래 바를 숨긴다. 폰의 풀스크린 화면도 같다(main 이 어느 화면에서도 스크롤 상자가 아니다). 768 이상은 `#main` 이다.
 */

export const SHELL_SCROLLER_ID = "main";

/** 정하는 규칙(순수) — 폰이면 문서, 아니면 main */
export function pickShellScroller({
  phone,
  main,
  doc,
}: {
  phone: boolean;
  main: HTMLElement | null;
  doc: HTMLElement | null;
}): HTMLElement | null {
  return phone ? doc : main;
}

/** 지금 본문 스크롤 상자 요소 — 읽는 순간 찾는다(셸과 화면이 한 번에 그려질 때 main 이 아직 문서에 없을 수 있다) */
export function getShellScrollerElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return pickShellScroller({
    phone: isPhoneViewport(),
    main: document.getElementById(SHELL_SCROLLER_ID),
    doc: (document.scrollingElement ?? document.documentElement) as HTMLElement,
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

/**
 * 셸 스크롤 상자 ref. 폰 ↔ 태블릿 경계(768)를 넘으면 **새 ref 객체**를 돌려준다 — 소비자의 효과 deps 에 이 ref 가 들어 있어
 * 상자(문서 ↔ main)가 바뀌면 리스너가 새 상자에 다시 붙는다(F1). 경계를 넘지 않으면 같은 객체다.
 */
export function useShellScroller() {
  const [ref, setRef] = useState(createShellScrollerRef);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mql = window.matchMedia(TABLET_QUERY);
    const onChange = () => setRef(createShellScrollerRef);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return ref;
}

const SCROLL_PARENT = `#${SHELL_SCROLLER_ID}, .overflow-y-auto`;

/**
 * `from` 를 품은 가장 가까운 스크롤 상자 — 셸 본문(`#main`)이면 그 자리의 스크롤 주체로 바꿔 돌려준다.
 * 안쪽 상자(`.overflow-y-auto`)는 그대로다.
 */
export function closestScroller(from: Element | null): HTMLElement | null {
  const found = from?.closest<HTMLElement>(SCROLL_PARENT) ?? null;
  if (found && found.id === SHELL_SCROLLER_ID) return getShellScrollerElement();
  return found;
}
