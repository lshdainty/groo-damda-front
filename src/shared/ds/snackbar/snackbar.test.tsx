// Snackbar 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SnackbarAvoidOverlap,
  SnackbarProvider,
  SnackbarView,
} from "./snackbar";
import { useSnackbar, type SnackbarApi } from "./snackbar-context";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// 띄우는 쪽 — useSnackbar 가 돌려준 것을 그릴 때마다 알린다
function Consumer({ onApi }: { onApi: (api: SnackbarApi) => void }) {
  const snackbar = useSnackbar();
  useEffect(() => {
    onApi(snackbar);
  });
  return null;
}

/** Provider 를 그리고 띄우는 쪽을 돌려준다 */
function mount(extra?: ReactNode) {
  let api: SnackbarApi | undefined;
  act(() =>
    root.render(
      <SnackbarProvider>
        <Consumer onApi={(a) => (api = a)} />
        {extra}
      </SnackbarProvider>,
    ),
  );
  return api!;
}

const region = () =>
  document.querySelector<HTMLElement>("[data-slot=snackbar-region]");
const bands = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-slot=snackbar]"));
const band = () => bands()[0];
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

// 사라지는 애니메이션이 있는 것처럼 — jsdom 은 애니메이션이 없어(animation-name: none) 닫히면 바로 걷는다
function withExitAnimation() {
  vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
    animationName: "exit",
    animationDuration: "0.1s",
    animationDelay: "0s",
  } as CSSStyleDeclaration);
}

describe("Snackbar", () => {
  it("SnackbarProvider 밖에서 useSnackbar 를 부르면 알려 준다", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => act(() => root.render(<Consumer onApi={() => {}} />))).toThrow(
      /SnackbarProvider/,
    );
  });

  it("띄우면 화면 아래 자리(body 끝)에 role=status 띠가 뜬다 — 초점은 옮기지 않는다", () => {
    const api = mount(
      <button type="button" id="here">
        여기
      </button>,
    );
    const here = document.getElementById("here")!;
    act(() => here.focus());
    act(() => api.show({ message: "거래를 저장했어요." }));

    const place = region()!;
    expect(place.parentElement).toBe(document.body);
    expect(place.getAttribute("role")).toBe("region");
    expect(place.getAttribute("aria-label")).toBe("알림");
    expect(place.getAttribute("aria-live")).toBe("polite");
    expect(place.className).toContain("z-(--z-snackbar)");

    const b = band()!;
    expect(b.getAttribute("role")).toBe("status");
    expect(b.getAttribute("aria-atomic")).toBe("true");
    expect(b.tabIndex).toBe(0);
    expect(b.dataset.state).toBe("open");
    expect(b.textContent).toContain("거래를 저장했어요.");
    // neutral 은 아이콘이 없다
    expect(b.querySelector("[data-slot=snackbar-icon]")).toBeNull();
    expect(document.activeElement).toBe(here);
  });

  it("positive · critical 만 장식 아이콘을 둔다 — 반전 짝 색", () => {
    const api = mount();
    act(() => api.show({ tone: "positive", message: "목표를 모았어요." }));
    let icon = band()!.querySelector("[data-slot=snackbar-icon]")!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("class")).toContain("text-fg-positive-inverted");

    act(() => api.show({ tone: "critical", message: "넣지 못했어요." }));
    icon = band()!.querySelector("[data-slot=snackbar-icon]")!;
    expect(icon.getAttribute("class")).toContain("text-fg-critical-inverted");
  });

  it("4초 뒤 닫히고, 사라지는 동안은 aria-hidden · 끝나면 걷는다", () => {
    withExitAnimation();
    const api = mount();
    act(() => api.show({ message: "거래를 저장했어요." }));
    advance(3999);
    expect(band()!.dataset.state).toBe("open");
    advance(1);
    expect(band()!.dataset.state).toBe("closed");
    expect(band()!.getAttribute("aria-hidden")).toBe("true");
    expect(band()!.tabIndex).toBe(-1);
    // 사라짐 100ms + 여유 50ms
    advance(150);
    expect(band()).toBeUndefined();
  });

  it("액션이 있으면 6초 — 누르면 그 일을 하고 닫는다", () => {
    const api = mount();
    const restore = vi.fn();
    act(() =>
      api.show({
        message: "거래를 삭제했어요.",
        action: { label: "되돌리기", onClick: restore },
      }),
    );
    advance(5999);
    expect(band()).toBeDefined();
    const action = band()!.querySelector<HTMLButtonElement>(
      "[data-slot=snackbar-action]",
    )!;
    expect(action.getAttribute("type")).toBe("button");
    expect(action.textContent).toBe("되돌리기");
    act(() => action.click());
    expect(restore).toHaveBeenCalledTimes(1);
    expect(band()).toBeUndefined();

    act(() =>
      api.show({
        message: "거래를 삭제했어요.",
        action: { label: "되돌리기", onClick: restore },
      }),
    );
    advance(6000);
    expect(band()).toBeUndefined();
  });

  it("액션의 일이 던져도 띠는 닫는다 — 던진 것은 삼키지 않는다", () => {
    // React 는 이벤트 핸들러가 던진 것을 창의 error 로 알린다 — 여기서 받아 테스트 밖으로 새지 않게 한다
    const reported = vi.fn((e: ErrorEvent) => e.preventDefault());
    window.addEventListener("error", reported);
    try {
      const api = mount();
      act(() =>
        api.show({
          message: "거래를 삭제했어요.",
          action: {
            label: "되돌리기",
            onClick: () => {
              throw new Error("되돌리지 못함");
            },
          },
        }),
      );
      const action = band()!.querySelector<HTMLButtonElement>(
        "[data-slot=snackbar-action]",
      )!;
      act(() => action.click());
      expect(band()).toBeUndefined();
      expect(reported).toHaveBeenCalledTimes(1);
      expect(reported.mock.calls[0]![0].error).toHaveProperty(
        "message",
        "되돌리지 못함",
      );
    } finally {
      window.removeEventListener("error", reported);
    }
  });

  it("마우스를 올리면 멈추고, 떠나면 처음부터 다시 센다", () => {
    const api = mount();
    act(() => api.show({ message: "거래를 저장했어요." }));
    advance(3000);
    act(() => {
      band()!.dispatchEvent(
        new PointerEvent("pointerover", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
    });
    advance(10000);
    expect(band()).toBeDefined();
    act(() => {
      band()!.dispatchEvent(
        new PointerEvent("pointerout", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
    });
    advance(3999);
    expect(band()).toBeDefined();
    advance(1);
    expect(band()).toBeUndefined();
  });

  it("손가락으로 누르고 있으면 멈추고, 띠 밖에서 떼도 다시 센다", () => {
    const api = mount();
    act(() => api.show({ message: "거래를 저장했어요." }));
    act(() => {
      band()!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    advance(10000);
    expect(band()).toBeDefined();
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    advance(4000);
    expect(band()).toBeUndefined();
  });

  it("키보드 초점이 들어오면 멈추고(focus-visible), 나가면 다시 센다 — 포인터 초점은 멈추지 않는다", () => {
    const api = mount(
      <button type="button" id="here">
        여기
      </button>,
    );
    const here = document.getElementById("here")!;
    // 포인터로 준 초점 — jsdom 의 :focus-visible 은 거짓이다
    act(() => api.show({ message: "첫째" }));
    act(() => band()!.focus());
    advance(4000);
    expect(band()).toBeUndefined();

    // 키보드 초점 — jsdom 은 키보드 방식을 흉내 내지 못해 :focus-visible 을 참으로 둔다
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible" || matches.call(this, selector);
    });
    act(() => api.show({ message: "둘째" }));
    act(() => band()!.focus());
    advance(10000);
    expect(band()).toBeDefined();
    act(() => here.focus());
    advance(3999);
    expect(band()).toBeDefined();
    advance(1);
    expect(band()).toBeUndefined();
  });

  it("손가락으로 누른 뒤 스크립트가 옮긴 초점에는 멈추지 않는다 — :focus-visible 을 이어받아도 직전 입력이 포인터면 키보드 초점이 아니다", () => {
    const api = mount();
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible" || matches.call(this, selector);
    });
    document.documentElement.dataset.input = "pointer";
    try {
      act(() => api.show({ message: "첫째" }));
      act(() => band()!.focus());
      advance(4000);
      expect(band()).toBeUndefined();

      // 키보드로 오면 멈춘다
      document.documentElement.dataset.input = "keyboard";
      act(() => api.show({ message: "둘째" }));
      act(() => band()!.focus());
      advance(10000);
      expect(band()).toBeDefined();
    } finally {
      delete document.documentElement.dataset.input;
    }
  });

  it("띠 안에 초점이 있다가 닫히면 띠에 들어오기 전 자리로 돌려준다", () => {
    const api = mount(
      <button type="button" id="here">
        여기
      </button>,
    );
    const here = document.getElementById("here")!;
    act(() => api.show({ message: "거래를 저장했어요." }));
    act(() => here.focus());
    act(() => band()!.focus());
    const close = band()!.querySelector<HTMLButtonElement>(
      "[data-slot=snackbar-close]",
    )!;
    act(() => close.focus());
    act(() => close.click());
    expect(band()).toBeUndefined();
    expect(document.activeElement).toBe(here);
  });

  it("보조 기술용 닫기 — 이름 '닫기' · type=button, 누르면 닫힌다. Esc 로는 닫히지 않는다", () => {
    const api = mount();
    act(() => api.show({ message: "거래를 저장했어요." }));
    act(() => {
      band()!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(band()).toBeDefined();
    const close = band()!.querySelector<HTMLButtonElement>(
      "[data-slot=snackbar-close]",
    )!;
    expect(close.getAttribute("aria-label")).toBe("닫기");
    expect(close.getAttribute("type")).toBe("button");
    act(() => close.click());
    expect(band()).toBeUndefined();
  });

  it("한 번에 하나 — 새 띠는 지금 띠를 바로 내보내고, 내보내는 중에 또 오면 마지막 것만 남는다", () => {
    withExitAnimation();
    const api = mount();
    act(() => api.show({ message: "첫째" }));
    act(() => api.show({ message: "둘째" }));
    act(() => api.show({ message: "셋째" }));
    expect(bands()).toHaveLength(1);
    expect(band()!.dataset.state).toBe("closed");
    expect(band()!.textContent).toContain("첫째");
    advance(150);
    expect(bands()).toHaveLength(1);
    expect(band()!.dataset.state).toBe("open");
    expect(band()!.textContent).toContain("셋째");
  });

  it("액션 띠는 끝날 때까지 지킨다 — 새 띠는 바로 바꾸지 않고 그 띠가 시간으로 닫힌 뒤에 뜬다", () => {
    withExitAnimation();
    const api = mount();
    act(() =>
      api.show({
        message: "지웠어요",
        action: { label: "되돌리기", onClick: () => {} },
      }),
    );
    act(() => api.show({ message: "다음 띠" }));
    expect(band()!.dataset.state).toBe("open");
    expect(band()!.textContent).toContain("지웠어요");
    advance(5900);
    expect(band()!.textContent).toContain("지웠어요");
    advance(100);
    advance(300);
    expect(band()!.textContent).toContain("다음 띠");
    expect(band()!.dataset.state).toBe("open");
  });

  it("액션 없는 띠끼리는 바로 바뀐다 — 지금 띠를 내보내고 새 띠가 뜬다", () => {
    withExitAnimation();
    const api = mount();
    act(() => api.show({ message: "첫째" }));
    act(() => api.show({ message: "둘째" }));
    expect(band()!.dataset.state).toBe("closed");
    advance(150);
    expect(band()!.dataset.state).toBe("open");
    expect(band()!.textContent).toContain("둘째");
  });

  it("액션 띠를 기다리는 중에 두 번 더 오면 마지막 것만 남는다 — 닫기로 끝내면 그것이 뜬다", () => {
    withExitAnimation();
    const api = mount();
    act(() =>
      api.show({
        message: "지웠어요",
        action: { label: "되돌리기", onClick: () => {} },
      }),
    );
    act(() => api.show({ message: "둘째" }));
    act(() => api.show({ message: "셋째" }));
    expect(band()!.textContent).toContain("지웠어요");
    const close = band()!.querySelector<HTMLButtonElement>(
      "button[aria-label=닫기]",
    )!;
    act(() => close.click());
    advance(150);
    expect(bands()).toHaveLength(1);
    expect(band()!.textContent).toContain("셋째");
  });

  it("dismiss() 는 띠를 닫고 기다리는 것도 버린다", () => {
    withExitAnimation();
    const api = mount();
    act(() => api.show({ message: "첫째" }));
    act(() => api.show({ message: "둘째" }));
    act(() => api.dismiss());
    advance(150);
    expect(band()).toBeUndefined();
  });

  it("띠 누름을 바깥 누름으로 올리지 않는다 — 열린 시트 · 대화상자가 닫히지 않는다", () => {
    const outside = vi.fn();
    document.addEventListener("pointerdown", outside);
    try {
      const api = mount();
      act(() => api.show({ message: "거래를 저장했어요." }));
      act(() => {
        band()!.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true }),
        );
      });
      expect(outside).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("pointerdown", outside);
    }
  });

  it("useSnackbar 가 돌려주는 것은 늘 같고, Provider 가 다시 그려져도 시간을 처음부터 세지 않는다", () => {
    const onApi = vi.fn();
    const tree = () => (
      <SnackbarProvider>
        <Consumer onApi={onApi} />
      </SnackbarProvider>
    );
    act(() => root.render(tree()));
    const api = onApi.mock.calls[0]![0] as SnackbarApi;
    act(() => api.show({ message: "거래를 저장했어요." }));
    advance(3000);
    act(() => root.render(tree()));
    expect(onApi).toHaveBeenCalledTimes(2);
    expect(onApi.mock.calls[1]![0]).toBe(api);
    advance(1000);
    expect(band()).toBeUndefined();
  });

  it("SnackbarAvoidOverlap — 감싼 요소의 윗변 위에 선다(안전 영역과 둘 중 큰 쪽은 CSS 가 고른다)", () => {
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      800,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 744,
      width: 360,
      height: 56,
    } as DOMRect);
    const tree = (withTabBar: boolean) => (
      <SnackbarProvider>
        {withTabBar && (
          <SnackbarAvoidOverlap>
            <nav id="tab-bar" />
          </SnackbarAvoidOverlap>
        )}
      </SnackbarProvider>
    );
    act(() => root.render(tree(true)));
    expect(document.getElementById("tab-bar")).not.toBeNull();
    expect(region()!.style.getPropertyValue("--snackbar-avoid")).toBe("56px");
    act(() => root.render(tree(false)));
    expect(region()!.style.getPropertyValue("--snackbar-avoid")).toBe("0px");
  });

  it("화면 키보드가 올라오면 띠가 키보드 바로 위에 선다 — 확대 중에는 세지 않는다", () => {
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      800,
    );
    const vv = new EventTarget() as EventTarget & {
      scale: number;
      offsetTop: number;
      height: number;
    };
    vv.scale = 1;
    vv.offsetTop = 0;
    vv.height = 800;
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: vv,
    });
    try {
      act(() => root.render(<SnackbarProvider />));
      expect(region()!.style.getPropertyValue("--snackbar-avoid")).toBe("0px");
      vv.height = 500;
      act(() => {
        vv.dispatchEvent(new Event("resize"));
      });
      expect(region()!.style.getPropertyValue("--snackbar-avoid")).toBe(
        "300px",
      );
      vv.scale = 2;
      act(() => {
        vv.dispatchEvent(new Event("resize"));
      });
      expect(region()!.style.getPropertyValue("--snackbar-avoid")).toBe("0px");
    } finally {
      Reflect.deleteProperty(window, "visualViewport");
    }
  });

  it("SnackbarAvoidOverlap 은 Provider 밖이면 자식을 그대로 그린다", () => {
    act(() =>
      root.render(
        <SnackbarAvoidOverlap>
          <nav id="tab-bar" />
        </SnackbarAvoidOverlap>,
      ),
    );
    expect(document.getElementById("tab-bar")).not.toBeNull();
  });

  it("SnackbarView(카탈로그용 띠)는 제자리에 그리고 닫히지 않는다", () => {
    act(() =>
      root.render(
        <SnackbarView
          tone="positive"
          message="목표 금액을 모두 모았어요."
          action={{ label: "목표 보기", onClick: () => {} }}
        />,
      ),
    );
    const b = container.firstElementChild as HTMLElement;
    expect(b.dataset.slot).toBe("snackbar");
    advance(10000);
    act(() =>
      b.querySelector<HTMLButtonElement>("[data-slot=snackbar-close]")!.click(),
    );
    expect(container.firstElementChild).toBe(b);
    expect(b.dataset.state).toBe("open");
  });
});
