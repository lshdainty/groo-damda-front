// 스크롤 호스트 — 요소 상자와 문서(documentElement)가 같은 말로 읽히는지, 그리고 셸 스크롤 주체가 지금은 늘 main 인지.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { asScrollHost, isDocumentScroller, scrollHostOf } from "./scroll-host";
import {
  closestScroller,
  getShellScroller,
  getShellScrollerElement,
  pickShellScroller,
} from "./shell-scroller";

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
}

beforeEach(() => {
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

  it("asScrollHost 는 호스트는 그대로, 요소는 감싼다", () => {
    const h = scrollHostOf(main);
    expect(asScrollHost(h)).toBe(h);
    expect(asScrollHost(main).el).toBe(main);
  });
});

describe("셸 스크롤 주체 — 지금은 늘 main", () => {
  it("폰 폭이어도 문서 스크롤이 꺼 있어 main 이다(PR ② 가 켠다)", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true } as MediaQueryList),
    );
    expect(getShellScrollerElement()).toBe(main);
    expect(getShellScroller()?.isDocument).toBe(false);
  });

  it("고르는 규칙: 폰 + 문서 스크롤일 때만 문서", () => {
    const doc = document.documentElement;
    const pick = (phone: boolean, documentScroll: boolean) =>
      pickShellScroller({ phone, documentScroll, main, doc });
    expect(pick(true, true)).toBe(doc);
    expect(pick(true, false)).toBe(main);
    expect(pick(false, true)).toBe(main);
    expect(pick(false, false)).toBe(main);
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
