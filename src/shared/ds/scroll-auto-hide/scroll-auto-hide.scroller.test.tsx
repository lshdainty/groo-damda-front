// 스크롤 상자가 요소일 때와 문서(documentElement)일 때 같은 결과 — 폰이 문서 스크롤로 바뀌는 PR 의 안전망.
// 같은 장면(영역 높이 100 · 내용 속 y=20 에 놓임 · 스크롤 상자 높이 300)을 두 상자로 흉내 낸다:
// 요소 상자는 머리 56 아래(윗변 56)에 있고, 문서는 윗변이 늘 -scrollY 다. 두 경우 스크롤 거리 → 숨는 거리가 같아야 한다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollAutoHide } from "./scroll-auto-hide";
import { SCROLL_AUTO_HIDE_SYNC_EVENT } from "./use-scroll-auto-hide";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let host: HTMLDivElement;
let root: Root;
let resize: () => void;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  resize = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  for (const k of ["scrollTop", "scrollHeight", "clientHeight"])
    delete (document.documentElement as unknown as Record<string, unknown>)[k];
  delete (document.documentElement as unknown as Record<string, unknown>)
    .getBoundingClientRect;
  vi.unstubAllGlobals();
});

const AREA_H = 100;
const CONTENT_Y = 20; // 영역이 상자 내용 안에서 놓인 자리
const HEAD = 56;

function mount(kind: "element" | "document") {
  const box = document.createElement("div");
  document.body.appendChild(box);
  const el = kind === "element" ? box : document.documentElement;
  let top = 0;
  Object.defineProperties(el, {
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (v: number) => (top = v),
    },
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 300 },
  });
  vi.stubGlobal("innerHeight", 300); // 문서 상자의 보이는 높이는 innerHeight 다
  // 요소 상자는 머리 아래(56)에 놓이고, 문서의 윗변은 늘 -scrollY
  const boxTop = () => (kind === "element" ? HEAD : -top);
  el.getBoundingClientRect = () => ({ top: boxTop(), height: 300 }) as DOMRect;
  const ref = { current: el };
  act(() =>
    root.render(
      <ScrollAutoHide scrollContainerRef={ref}>
        <p>머리</p>
      </ScrollAutoHide>,
    ),
  );
  const area = document.querySelector<HTMLElement>("[data-scroll-auto-hide]")!;
  // 상자 안 내용 y=20 의 영역 — 화면 위치 = 상자 윗변 + 20 − 스크롤 위치(문서는 윗변 0 이 아니라 −scrollY 라 그대로 20 − 0 이 된다)
  area.getBoundingClientRect = () =>
    ({
      top: (kind === "element" ? HEAD : 0) + CONTENT_Y - top,
      height: AREA_H,
    }) as DOMRect;
  act(() => resize()); // 흉내 낸 크기로 처음 잰다
  // 스크롤 이벤트의 자리 — 요소는 요소, 문서는 document
  const source: EventTarget = kind === "element" ? box : document;
  const scrollTo = (y: number) => {
    top = y;
    act(() => {
      source.dispatchEvent(new Event("scroll"));
    });
  };
  // 내용이 바뀌어 다시 잴 때 — 스크롤한 뒤에 재는 쪽이 식의 함정(scrollTop 을 이중으로 세는 것)을 드러낸다
  const remeasure = () => act(() => resize());
  const translate = () =>
    Number(
      /translate3d\(0px, (-?[\d.]+)px/.exec(area.style.transform)?.[1] ?? 0,
    );
  return {
    box,
    source,
    scrollTo,
    jump: (y: number) => {
      top = y;
    },
    remeasure,
    translate,
    sync: () =>
      act(
        () => void source.dispatchEvent(new Event(SCROLL_AUTO_HIDE_SYNC_EVENT)),
      ),
    cleanup: () => box.remove(),
  };
}

describe.each(["element", "document"] as const)(
  "Scroll Auto Hide — 스크롤 상자가 %s",
  (kind) => {
    it("영역 자리(내용 y=20) 앞에서는 숨지 않고, 그 뒤로 영역 높이까지 1:1 로 숨는다", () => {
      const m = mount(kind);
      m.scrollTo(10);
      expect(m.translate()).toBe(0);
      m.scrollTo(70);
      expect(m.translate()).toBe(-50); // 자리에서 50 내림
      m.scrollTo(250);
      expect(m.translate()).toBe(-AREA_H); // 영역 높이가 한계
      m.cleanup();
    });

    it("올리면 같은 거리만큼 드러난다", () => {
      const m = mount(kind);
      m.scrollTo(250);
      m.scrollTo(220);
      expect(m.translate()).toBe(-AREA_H + 30);
      m.scrollTo(100);
      expect(m.translate()).toBe(0);
      m.cleanup();
    });

    it("스크롤한 뒤 다시 재도(내용 높이 변화 등) 숨은 정도가 그대로다 — 문서 윗변(-scrollY)을 그대로 쓰면 자리가 어긋나 풀린다", () => {
      const m = mount(kind);
      m.scrollTo(250);
      expect(m.translate()).toBe(-AREA_H);
      m.remeasure();
      expect(m.translate()).toBe(-AREA_H);
      m.cleanup();
    });

    it("위치 보정 알림(sync)은 같은 자리에서 받는다 — 숨김 정도는 그대로, 기준 위치만 옮긴다", () => {
      const m = mount(kind);
      m.scrollTo(70);
      expect(m.translate()).toBe(-50);
      m.jump(130); // 쓰는 쪽이 scrollTop 을 직접 옮긴 것 — 사람의 스크롤이 아니다
      m.sync();
      expect(m.translate()).toBe(-50); // 보정한 60 은 세지 않는다
      m.scrollTo(140); // 이후 사람의 스크롤은 기준 위치(130)부터 센다
      expect(m.translate()).toBe(-60);
      m.cleanup();
    });
  },
);
