// 스크롤 호스트 — 요소 상자와 문서(documentElement)가 같은 말로 읽히는지, 그리고 셸 스크롤 주체가 지금은 늘 main 인지.
import { useEffect } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPhoneViewport } from "./viewport";

import { asScrollHost, isDocumentScroller, scrollHostOf } from "./scroll-host";
import {
  closestScroller,
  getShellScroller,
  getShellScrollerElement,
  pickShellScroller,
  useShellScroller,
} from "./shell-scroller";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let main: HTMLElement;
const saved: Record<string, PropertyDescriptor | undefined> = {};

// 요소에 scrollTop · scrollHeight · clientHeight 를 흉내 낸다(jsdom 은 레이아웃이 없다)
function fake(el: HTMLElement, { top = 0, height = 1000, client = 300 } = {}) {
  let t = top;
  for (const k of ["scrollTop", "scrollHeight", "clientHeight"])
    saved[k + (el === document.documentElement ? "-doc" : "")] =
      Object.getOwnPropertyDescriptor(el, k);
  Object.defineProperties(el, {
    scrollTop: {
      configurable: true,
      get: () => t,
      set: (v: number) => (t = v),
    },
    scrollHeight: { configurable: true, value: height },
    clientHeight: { configurable: true, value: client },
  });
  // 문서의 보이는 높이는 innerHeight 다(툴바가 숨으면 clientHeight 와 달라진다 — F2)
  if (el === document.documentElement) vi.stubGlobal("innerHeight", client);
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  main = document.createElement("main");
  main.id = "main";
  main.className = "overflow-y-auto"; // 실제 main 은 데스크톱 overflow-y-auto · 폰 m-scroll
  document.body.appendChild(main);
});
afterEach(() => {
  main.remove();
  for (const k of ["scrollTop", "scrollHeight", "clientHeight"])
    delete (document.documentElement as unknown as Record<string, unknown>)[k];
  vi.unstubAllGlobals();
});

describe("scrollHostOf — 요소 상자", () => {
  it("요소는 요소에 듣고 요소의 화면 위치를 윗변으로 쓴다", () => {
    fake(main, { top: 40 });
    main.getBoundingClientRect = () => ({ top: 56 }) as DOMRect;
    const h = scrollHostOf(main);
    expect(h.isDocument).toBe(false);
    expect(h.eventTarget).toBe(main);
    expect(h.getTop()).toBe(40);
    expect(h.getMax()).toBe(700);
    expect(h.viewportTop()).toBe(56);
    h.setTop(90);
    expect(main.scrollTop).toBe(90);
  });

  it("scroll 이벤트는 그 요소의 것만 이 호스트의 것이다(안쪽 상자 · 문서 것은 아니다)", () => {
    const inner = document.createElement("div");
    main.appendChild(inner);
    const h = scrollHostOf(main);
    expect(h.isScrollEvent({ target: main } as unknown as Event)).toBe(true);
    expect(h.isScrollEvent({ target: inner } as unknown as Event)).toBe(false);
    expect(h.isScrollEvent({ target: document } as unknown as Event)).toBe(
      false,
    );
  });
});

describe("scrollHostOf — 문서(documentElement)", () => {
  it("문서는 document 에 듣고 윗변 · 테두리가 0 이다 — getBoundingClientRect 는 -scrollY 라 쓰면 두 번 센다", () => {
    const el = document.documentElement;
    fake(el, { top: 250 });
    el.getBoundingClientRect = () => ({ top: -250 }) as DOMRect;
    const h = scrollHostOf(el);
    expect(isDocumentScroller(el)).toBe(true);
    expect(h.isDocument).toBe(true);
    expect(h.eventTarget).toBe(document);
    expect(h.getTop()).toBe(250);
    expect(h.viewportTop()).toBe(0);
    expect(h.clientTop()).toBe(0);
    expect(h.getMax()).toBe(700);
    delete (el as unknown as Record<string, unknown>).getBoundingClientRect;
  });

  it("scroll 이벤트의 target 은 documentElement 가 아니라 document 다", () => {
    const h = scrollHostOf(document.documentElement);
    expect(h.isScrollEvent({ target: document } as unknown as Event)).toBe(
      true,
    );
    expect(h.isScrollEvent({ target: main } as unknown as Event)).toBe(false);
  });

  it("F2: 문서의 닿을 수 있는 가장 아래는 clientHeight 가 아니라 innerHeight 로 잰다 — 툴바가 숨으면 뷰포트가 커진다", () => {
    const el = document.documentElement;
    fake(el, { height: 1000, client: 300 }); // 툴바가 보일 때의 작은 뷰포트(ICB)
    const h = scrollHostOf(el);
    expect(h.getMax()).toBe(700);
    vi.stubGlobal("innerHeight", 356); // 툴바 56 이 숨은 뒤 — 뷰포트가 그만큼 커졌다
    expect(h.getMax()).toBe(644);
    vi.stubGlobal("innerHeight", 5000); // 본문이 뷰포트보다 짧으면 음수 없이 0
    expect(h.getMax()).toBe(0);
  });

  it("F3: 문서 호스트는 셸 본문(#main) 밖(머리 · 탭 바 · 시트)에서 시작한 입력을 본문의 것으로 치지 않는다", () => {
    const h = scrollHostOf(document.documentElement);
    const inMain = document.createElement("p");
    main.appendChild(inMain);
    const header = document.createElement("header");
    document.body.appendChild(header);
    const ev = (target: EventTarget) => ({ target }) as unknown as Event;
    expect(h.ownsInput(ev(inMain))).toBe(true);
    expect(h.ownsInput(ev(main))).toBe(true);
    expect(h.ownsInput(ev(document.body))).toBe(true);
    expect(h.ownsInput(ev(header))).toBe(false);
    header.remove();
    // 요소 호스트는 그 요소에 듣고 있어 늘 참이다
    expect(scrollHostOf(main).ownsInput(ev(header))).toBe(true);
  });

  it("asScrollHost 는 호스트는 그대로, 요소는 감싼다", () => {
    const h = scrollHostOf(main);
    expect(asScrollHost(h)).toBe(h);
    expect(asScrollHost(main).el).toBe(main);
  });
});

// 훅을 돌려 마지막 값을 읽는다(@testing-library 가 없다)
function renderHook<T>(use: () => T) {
  const result = { current: undefined as T };
  const host = document.createElement("div");
  const root = createRoot(host);
  function Probe() {
    result.current = use();
    return null;
  }
  act(() => root.render(<Probe />));
  return { result, unmount: () => act(() => root.unmount()) };
}

// 폰 판정은 셸과 같은 질의(`(min-width: 768px)` 가 아니면 폰) 하나다(F5)
type Mql = {
  matches: boolean;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: (t: string, f: () => void) => void;
};
function stubWidth(phone: boolean) {
  const listeners = new Set<() => void>();
  let isPhone = phone;
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((q: string) => {
      const mql: Mql = {
        get matches() {
          return q.includes("min-width") ? !isPhone : false;
        },
        addEventListener: (_t, f) => listeners.add(f),
        removeEventListener: (_t, f) => listeners.delete(f),
      };
      return mql;
    }),
  );
  return {
    set(next: boolean) {
      isPhone = next;
      act(() => listeners.forEach((f) => f()));
    },
    listeners,
  };
}

describe("셸 스크롤 주체 — 폰은 문서, 768 이상은 main", () => {
  it("폰이면 문서를 돌려준다", () => {
    stubWidth(true);
    expect(getShellScrollerElement()).toBe(document.documentElement);
    expect(getShellScroller()?.isDocument).toBe(true);
  });

  it("768 이상(태블릿 · 데스크톱)이면 main 이다", () => {
    stubWidth(false);
    expect(getShellScrollerElement()).toBe(main);
    expect(getShellScroller()?.isDocument).toBe(false);
  });

  it("고르는 규칙: 폰이면 문서, 아니면 main", () => {
    const doc = document.documentElement;
    expect(pickShellScroller({ phone: true, main, doc })).toBe(doc);
    expect(pickShellScroller({ phone: false, main, doc })).toBe(main);
  });

  it("셸의 mobile 판정(useDeviceSize)과 같은 질의 — 767.9 같은 소수 폭에서 갈리지 않는다", () => {
    // min-width: 768px 가 거짓이면 폰. (max-width: 767.98px) 질의였다면 767.99 가 둘 사이로 샜다
    stubWidth(true);
    expect(isPhoneViewport()).toBe(true);
    stubWidth(false);
    expect(isPhoneViewport()).toBe(false);
  });

  it("F1: 768 경계를 넘으면 useShellScroller 가 새 ref 를 돌려주고 읽는 상자도 바뀐다", () => {
    const w = stubWidth(true);
    const { result } = renderHook(() => useShellScroller());
    const phoneRef = result.current;
    expect(phoneRef.current).toBe(document.documentElement);
    w.set(false);
    expect(result.current).not.toBe(phoneRef);
    expect(result.current.current).toBe(main);
  });

  it("F1: 소비자의 효과가 경계를 넘으면 새 상자에 다시 붙는다(리스너 이동)", () => {
    const w = stubWidth(true);
    const attached: EventTarget[] = [];
    renderHook(() => {
      const ref = useShellScroller();
      useEffect(() => {
        const host = getShellScroller()!;
        attached.push(host.eventTarget);
      }, [ref]);
    });
    expect(attached).toEqual([document]);
    w.set(false);
    expect(attached).toEqual([document, main]);
    w.set(true);
    expect(attached).toEqual([document, main, document]);
  });

  it("main 이 아직 문서에 없으면 null — 읽는 순간 찾는다", () => {
    main.remove();
    expect(getShellScrollerElement()).toBeNull();
    document.body.appendChild(main);
    expect(getShellScrollerElement()).toBe(main);
  });

  it("closestScroller — 셸 본문은 셸 스크롤 주체, 안쪽 상자는 그 상자", () => {
    const inner = document.createElement("div");
    inner.className = "overflow-y-auto";
    const leaf = document.createElement("p");
    inner.appendChild(leaf);
    main.appendChild(inner);
    const bare = document.createElement("p");
    main.appendChild(bare);
    expect(closestScroller(leaf)).toBe(inner);
    expect(closestScroller(bare)).toBe(main);
    expect(closestScroller(null)).toBeNull();
    const box = document.createElement("div");
    box.className = "m-scroll";
    const x = document.createElement("p");
    box.appendChild(x);
    document.body.appendChild(box);
    expect(closestScroller(x)).toBe(box);
    box.remove();
  });
});
