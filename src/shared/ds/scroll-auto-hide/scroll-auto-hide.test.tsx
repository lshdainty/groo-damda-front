// Scroll Auto Hide 의 동작 — sticky · top · 바탕 · 겹침은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 위치(1:1 · 50% 스냅 · 맨 위 근처 · 모션 줄이기 · 초점)는 jsdom 에 레이아웃이 없어 영역 · 상자의 크기 · 스크롤 위치를 흉내 내 본다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollAutoHide } from "./scroll-auto-hide";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let resize: () => void;
let reduced: boolean;
let mediaListener: (() => void) | undefined;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  reduced = false;
  mediaListener = undefined;
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
      get matches() {
        return reduced;
      },
      addEventListener: (_: string, cb: () => void) => {
        mediaListener = cb;
      },
      removeEventListener() {},
    })),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const HEIGHT = 100;

// 상자 · 영역의 크기와 스크롤 위치를 흉내 낸다 — 영역 높이 100, 상자 높이 300, 내용 1000
function mount(children: ReactNode = <p>머리</p>, asChild = false) {
  const ref = createRef<HTMLDivElement>();
  act(() =>
    root.render(
      <div ref={ref} data-box>
        {asChild ? (
          <ScrollAutoHide asChild scrollContainerRef={ref}>
            <header>{children}</header>
          </ScrollAutoHide>
        ) : (
          <ScrollAutoHide
            scrollContainerRef={ref}
            className="bg-bg-layer-default z-2"
          >
            {children}
          </ScrollAutoHide>
        )}
      </div>,
    ),
  );
  const box = ref.current!;
  const area = box.querySelector<HTMLElement>("[data-scroll-auto-hide]")!;
  let scrollTop = 0;
  Object.defineProperties(box, {
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    },
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 300 },
  });
  box.getBoundingClientRect = () => ({ top: 0, height: 300 }) as DOMRect;
  area.getBoundingClientRect = () =>
    ({ top: 0 - 0, height: HEIGHT }) as DOMRect;
  act(() => resize());
  const scrollTo = (top: number) => {
    scrollTop = top;
    act(() => {
      box.dispatchEvent(new Event("scroll"));
    });
  };
  const translate = () =>
    Number(
      /translate3d\(0px, (-?[\d.]+)px/.exec(area.style.transform)?.[1] ?? 0,
    );
  return { box, area, scrollTo, translate };
}

describe("ScrollAutoHide — 구조", () => {
  it("sticky · top 0 으로 스크롤 상자 맨 위에 붙고 바탕 · 겹침은 쓰는 쪽이 className 으로 정한다", () => {
    const { area } = mount();
    expect(area.tagName).toBe("DIV");
    expect(area.getAttribute("data-slot")).toBe("scroll-auto-hide");
    expect(area.className.split(" ")).toEqual(
      expect.arrayContaining(["sticky", "top-0", "bg-bg-layer-default", "z-2"]),
    );
  });

  it("asChild — 자식 하나를 루트로 쓰고 자식의 data-slot 을 덮지 않는다", () => {
    const { area } = mount(<h1 data-slot="mine">머리</h1>, true);
    expect(area.tagName).toBe("HEADER");
    expect(area.getAttribute("data-slot")).toBeNull();
    expect(area.className.split(" ")).toContain("sticky");
  });

  it("숨겨도 aria-hidden · inert 를 걸지 않는다 — 숨는 영역은 그 안 내용의 역할 그대로(초점이 오면 드러나므로)", () => {
    const { area, scrollTo } = mount(<button type="button">소비 요약</button>);
    scrollTo(500);
    expect(area.hasAttribute("inert")).toBe(false);
    expect(area.getAttribute("aria-hidden")).toBeNull();
    expect(area.querySelector("button")!.tabIndex).toBe(0);
  });

  it("내려도 DOM 차례 · 높이를 바꾸지 않고 transform 만 쓴다", () => {
    const { area, scrollTo } = mount();
    scrollTo(60);
    expect(area.style.transform).toMatch(/^translate3d\(/);
    expect(area.style.height).toBe("");
    expect(area.style.maxHeight).toBe("");
  });
});

describe("ScrollAutoHide — 따라가기(1:1)", () => {
  it("아래로 내린 만큼 숨는다 — 영역 높이를 넘으면 더는 숨지 않는다", () => {
    const { scrollTo, translate } = mount();
    scrollTo(30);
    expect(translate()).toBe(-30);
    scrollTo(80);
    expect(translate()).toBe(-80);
    scrollTo(400);
    expect(translate()).toBe(-HEIGHT);
  });

  it("위로 올린 만큼 드러난다 — 맨 위에서는 다 보인다", () => {
    const { scrollTo, translate } = mount();
    scrollTo(400);
    expect(translate()).toBe(-HEIGHT);
    scrollTo(340);
    expect(translate()).toBe(-40);
    scrollTo(0);
    expect(translate()).toBe(0);
  });

  it("맨 위 근처에서는 스크롤한 거리보다 더 숨지 않는다", () => {
    const { scrollTo, translate } = mount();
    scrollTo(10);
    expect(translate()).toBe(-10);
  });
});

describe("ScrollAutoHide — 스크롤이 끝나면 50% 로 스냅(200ms · motion-ease-enter)", () => {
  // 400 까지 내려 다 숨긴 뒤 위로 올려 중간에서 멈춘다 — 맨 위 근처가 아니라 더 숨을 수 있는 자리다
  const stopAt = (
    api: ReturnType<typeof mount>,
    top: number,
    end = () => {
      act(() => {
        api.box.dispatchEvent(new Event("scrollend"));
      });
    },
  ) => {
    api.scrollTo(400);
    api.scrollTo(top);
    end();
  };

  it("절반 넘게 숨었으면 다 숨고, 전환은 transform 200ms 토큰이다", () => {
    const api = mount();
    stopAt(api, 360); // 60 숨음
    expect(api.translate()).toBe(-HEIGHT);
    expect(api.area.style.transition).toBe(
      "transform var(--motion-duration-d4) var(--motion-ease-enter)",
    );
  });

  it("절반 못 미치게 숨었으면 다 드러난다", () => {
    const api = mount();
    stopAt(api, 340); // 40 숨음
    expect(api.translate()).toBe(0);
  });

  it("딱 절반이면 드러난다(기준은 50% 이상 보이면 다 드러남)", () => {
    const api = mount();
    stopAt(api, 350); // 50 숨음
    expect(api.translate()).toBe(0);
  });

  it("scrollend 가 없는 브라우저는 마지막 스크롤 120ms 뒤에 스냅한다", () => {
    vi.useFakeTimers();
    // scrollend 가 없는 브라우저 — 타이머 경로(jsdom 은 onscrollend 를 null 로 가진다)
    Object.defineProperty(HTMLElement.prototype, "onscrollend", {
      configurable: true,
      value: undefined,
    });
    const { scrollTo, translate } = mount();
    scrollTo(400);
    scrollTo(360);
    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(translate()).toBe(-60);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(translate()).toBe(-HEIGHT);
    Reflect.deleteProperty(HTMLElement.prototype, "onscrollend");
  });
});

describe("ScrollAutoHide — 모션 줄이기 · 초점", () => {
  it("모션 줄이기면 자동 숨김을 끈다 — 내려도 머리가 늘 보인다", () => {
    reduced = true;
    const { scrollTo, translate, box } = mount();
    scrollTo(300);
    expect(translate()).toBe(0);
    act(() => {
      box.dispatchEvent(new Event("scrollend"));
    });
    expect(translate()).toBe(0);
  });

  it("숨은 뒤에 모션 줄이기를 켜면 바로 다 드러난다", () => {
    const { scrollTo, translate } = mount();
    scrollTo(300);
    expect(translate()).toBe(-HEIGHT);
    reduced = true;
    act(() => mediaListener?.());
    expect(translate()).toBe(0);
  });

  it("숨은 영역 안으로 초점이 오면 바로 다 드러낸다 — 보이지 않는 단추에 초점이 머물지 않는다", () => {
    const { area, scrollTo, translate } = mount(
      <button type="button">소비 요약</button>,
    );
    scrollTo(300);
    expect(translate()).toBe(-HEIGHT);
    act(() => area.querySelector("button")!.focus());
    expect(translate()).toBe(0);
    expect(area.style.transition).toBe("");
  });

  it("영역이 풀리면(unmount) 걸어 둔 transform 을 걷는다", () => {
    const { area, scrollTo } = mount();
    scrollTo(60);
    expect(area.style.transform).not.toBe("");
    act(() => root.unmount());
    expect(area.style.transform).toBe("");
    root = createRoot(container);
  });
});

describe("ScrollAutoHide — groo 확장(남는 부분 · 위 고정 줄)", () => {
  // 영역 높이 100 중 아래 40(윗변 60)이 남는 부분 · 위에 48 짜리 고정 줄이 따로 있어 sticky top 48
  function mountKeep({ stickyTop = 0 }: { stickyTop?: number } = {}) {
    const boxRef = createRef<HTMLDivElement>();
    const keepRef = createRef<HTMLDivElement>();
    act(() =>
      root.render(
        <div ref={boxRef}>
          <ScrollAutoHide
            scrollContainerRef={boxRef}
            keepRef={keepRef}
            style={{ top: stickyTop }}
          >
            <button type="button">소비 요약</button>
            <div ref={keepRef}>
              <button type="button">15</button>
            </div>
          </ScrollAutoHide>
        </div>,
      ),
    );
    const box = boxRef.current!;
    const area = box.querySelector<HTMLElement>("[data-scroll-auto-hide]")!;
    const keep = keepRef.current!;
    let scrollTop = 0;
    Object.defineProperties(box, {
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (v: number) => {
          scrollTop = v;
        },
      },
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 300 },
    });
    box.getBoundingClientRect = () => ({ top: 0, height: 300 }) as DOMRect;
    // 잴 때는 relative — 제자리(고정 줄 아래 stickyTop) + relative 로 밀린 top 만큼
    area.getBoundingClientRect = () =>
      ({ top: stickyTop + stickyTop, height: HEIGHT }) as DOMRect;
    keep.getBoundingClientRect = () =>
      ({ top: stickyTop + stickyTop + 60, height: 40 }) as DOMRect;
    act(() => resize());
    const scrollTo = (top: number) => {
      scrollTop = top;
      act(() => {
        box.dispatchEvent(new Event("scroll"));
      });
    };
    const translate = () =>
      Number(
        /translate3d\(0px, (-?[\d.]+)px/.exec(area.style.transform)?.[1] ?? 0,
      );
    return { area, keep, scrollTo, translate };
  }

  it("keepRef — 남는 부분 안의 초점은 드러내지 않고(누르는 칸이 밀리지 않는다), 숨은 부분의 초점은 드러낸다", () => {
    const { area, keep, scrollTo, translate } = mountKeep();
    scrollTo(400);
    expect(translate()).toBe(-60);
    act(() => keep.querySelector("button")!.focus());
    expect(translate()).toBe(-60);
    act(() => area.querySelector("button")!.focus());
    expect(translate()).toBe(0);
  });

  it("keepRef — 남는 부분 위까지만 숨는다(주 달력은 남는다)", () => {
    const { scrollTo, translate } = mountKeep();
    scrollTo(30);
    expect(translate()).toBe(-30);
    scrollTo(400);
    expect(translate()).toBe(-60);
  });

  it("keepRef — 50% 스냅도 숨는 높이(60) 기준이다", () => {
    const { scrollTo, translate } = mountKeep();
    scrollTo(400);
    scrollTo(375); // 25 드러남 → 보이는 비 25/60 < 50%
    const box = container.firstElementChild!;
    act(() => {
      box.dispatchEvent(new Event("scrollend"));
    });
    expect(translate()).toBe(-60);
  });

  it("sticky top 이 있으면 붙는 순간부터 센다 — 위 고정 줄 아래에서 1:1", () => {
    const { scrollTo, translate } = mountKeep({ stickyTop: 48 });
    scrollTo(30);
    expect(translate()).toBe(-30);
    scrollTo(400);
    expect(translate()).toBe(-60);
  });
});
