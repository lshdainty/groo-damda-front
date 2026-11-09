/*
 * 스크롤 상자 한 개를 다루는 작은 인터페이스 — 상자가 요소(main · 안쪽 상자)여도 문서(`documentElement`)여도 같은 말로 읽고 쓴다.
 *
 * 문서 스크롤이 요소 스크롤과 다른 점 셋(폰 문서 스크롤 전환의 안전망 — I-fix-2.0.0 B):
 * 1. `scroll` 이벤트는 `documentElement` 가 아니라 `document` 로 온다(target 도 `document`). 그래서 듣는 자리는 `eventTarget`.
 * 2. 상자의 화면 위치(`getBoundingClientRect().top`)가 `-scrollY` 다 — 요소 상자처럼 스크롤 위치를 더해 쓰면 두 번 센다.
 *    `viewportTop()` 은 문서일 때 0 이다(문서 좌표 = 스크롤 위치 + 요소의 화면 위치).
 * 3. `clientTop`(테두리) 은 문서에 없다.
 * 그 밖(scrollTop · scrollHeight · clientHeight · scrollTo)은 `documentElement` 가 요소처럼 받는다.
 */

export type ScrollHost = {
  /** 스크롤 상자 요소 — 문서면 `documentElement` */
  readonly el: HTMLElement;
  /** 문서가 스크롤하는가 */
  readonly isDocument: boolean;
  /** scroll · scrollend · wheel · touch 이벤트를 듣는 자리 — 문서면 `document`, 아니면 `el` */
  readonly eventTarget: EventTarget;
  getTop(): number;
  setTop(top: number): void;
  /** 닿을 수 있는 가장 아래(scrollHeight − clientHeight) — 음수 없음 */
  getMax(): number;
  /** 상자 윗변의 화면 위치 — 문서는 0 */
  viewportTop(): number;
  /** 상자 윗 테두리 두께 — 문서는 0 */
  clientTop(): number;
  scrollTo(options: ScrollToOptions): void;
  /** 이 scroll 이벤트가 이 상자의 것인가(capture 로 듣는 자리에서 안쪽 상자의 것을 거른다) */
  isScrollEvent(e: Event): boolean;
};

export function isDocumentScroller(el: Element): boolean {
  const doc = el.ownerDocument;
  return el === doc.documentElement || el === doc.scrollingElement;
}

export function scrollHostOf(el: HTMLElement): ScrollHost {
  const isDocument = isDocumentScroller(el);
  const eventTarget: EventTarget = isDocument ? el.ownerDocument : el;
  return {
    el,
    isDocument,
    eventTarget,
    getTop: () => el.scrollTop,
    setTop: (top) => {
      el.scrollTop = top;
    },
    getMax: () => Math.max(0, el.scrollHeight - el.clientHeight),
    viewportTop: () => (isDocument ? 0 : el.getBoundingClientRect().top),
    clientTop: () => (isDocument ? 0 : el.clientTop),
    scrollTo: (options) => el.scrollTo(options),
    isScrollEvent: (e) =>
      e.target === el || (isDocument && e.target === el.ownerDocument),
  };
}

/** 이미 호스트면 그대로, 요소면 감싼다 — 요소를 받던 함수가 호스트도 받게 한다 */
export function asScrollHost(box: HTMLElement | ScrollHost): ScrollHost {
  return "eventTarget" in box ? box : scrollHostOf(box);
}
