// Bottom Sheet 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import * as React from "react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/shared/ds/button";
import { SnackbarProvider } from "@/shared/ds/snackbar";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetTrigger,
} from "./bottom-sheet";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.history.replaceState(null, "");
  // 1280 미만(시트) — jsdom 에는 matchMedia 가 없다
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 100));
});

const render = (node: ReactNode) => act(() => root.render(node));
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

// vaul 이 넣은 CSS 의 내려가는 모션을 jsdom 은 끝내지 않는다 — Radix 가 animationend 를 기다리다 시트를 치우지 못한다.
// 모션이 끝났다고 알려 준다(시트 · 딤)
const settle = () =>
  act(async () => {
    for (const el of document.querySelectorAll<HTMLElement>(
      "[data-state=closed]",
    )) {
      const e = new Event("animationend", { bubbles: true });
      Object.assign(e, { animationName: getComputedStyle(el).animationName });
      el.dispatchEvent(e);
    }
    await new Promise((r) => setTimeout(r, 0));
  });

const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]");
const overlay = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-overlay]");
const closeButton = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=bottom-sheet-close]");
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent === text,
  )!;

function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  });
}
const pointerDown = (el: Element) =>
  act(() => {
    el.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
  });

function Sheet({
  form,
  dirty,
  description,
  showCloseButton,
  snapPoints,
  onOpenChange,
  scrollFog,
}: {
  form?: boolean;
  dirty?: boolean;
  description?: string;
  showCloseButton?: boolean;
  snapPoints?: string[];
  onOpenChange?: (open: boolean) => void;
  scrollFog?: boolean;
}) {
  return (
    <>
      <BottomSheet
        form={form}
        dirty={dirty}
        snapPoints={snapPoints}
        onOpenChange={onOpenChange}
      >
        <BottomSheetTrigger>열기</BottomSheetTrigger>
        <BottomSheetContent
          title="기간"
          description={description}
          showCloseButton={showCloseButton}
        >
          <BottomSheetBody scrollFog={scrollFog}>
            <input aria-label="메모" />
          </BottomSheetBody>
          <BottomSheetFooter>
            <Button variant="neutralWeak">초기화</Button>
            <Button>적용</Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
      <p data-testid="behind">뒤 화면</p>
    </>
  );
}

function open() {
  const trigger = byText("열기");
  act(() => {
    trigger.focus();
    trigger.click();
  });
}

describe("역할 · 이름 · 설명", () => {
  it("role=dialog + aria-modal, 제목 aria-labelledby · 설명 aria-describedby", async () => {
    render(<Sheet description="고른 기간의 거래만 보여요." />);
    open();
    await tick();
    const s = sheet()!;
    expect(s.getAttribute("role")).toBe("dialog");
    expect(s.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(s.getAttribute("aria-labelledby")!)?.textContent,
    ).toBe("기간");
    expect(
      document.getElementById(s.getAttribute("aria-describedby")!)?.textContent,
    ).toBe("고른 기간의 거래만 보여요.");
  });

  it("설명이 없으면 aria-describedby 를 걷는다", async () => {
    render(<Sheet />);
    open();
    await tick();
    expect(sheet()!.hasAttribute("aria-describedby")).toBe(false);
  });

  it("닫기 버튼 이름은 '닫기', 손잡이는 없다(스냅 높이가 없으면)", async () => {
    render(<Sheet />);
    open();
    await tick();
    expect(closeButton()!.getAttribute("aria-label")).toBe("닫기");
    expect(
      document.querySelector("[data-slot=bottom-sheet-handle]"),
    ).toBeNull();
  });

  it("닫기 버튼을 끌 수 있고, 그러면 제목 오른쪽을 비우지 않는다", async () => {
    render(<Sheet showCloseButton={false} />);
    open();
    await tick();
    expect(closeButton()).toBeNull();
    expect(
      document.querySelector("[data-slot=bottom-sheet-title]")!.className,
    ).not.toContain("pr-x10");
  });

  it("제목은 닫기 버튼이 있으면 오른쪽 64 를 비운다", async () => {
    render(<Sheet />);
    open();
    await tick();
    expect(
      document.querySelector("[data-slot=bottom-sheet-title]")!.className,
    ).toContain("pr-x10");
  });
});

describe("닫는 길", () => {
  it("닫기 버튼은 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet onOpenChange={onOpenChange} />);
    open();
    await tick();
    act(() => closeButton()!.click());
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("Esc 는 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet onOpenChange={onOpenChange} />);
    open();
    await tick();
    key(sheet()!, "Escape");
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("조회 · 고르기 시트는 바깥(딤)을 누르면 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    pointerDown(overlay()!);
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("입력 폼(form)은 바깥(딤)을 눌러도 닫지 않는다", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet form onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    pointerDown(overlay()!);
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(sheet()).not.toBeNull();
  });

  it("뒤로 가기(popstate)는 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet onOpenChange={onOpenChange} />);
    open();
    await tick();
    expect(window.history.state?.grooOverlayBack).toBe(true);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("바뀐 값이 있으면 닫기 전에 묻는다", () => {
  it("dirty 에서 닫기 버튼 — 확인창이 뜨고 시트는 그대로", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet form dirty onOpenChange={onOpenChange} />);
    open();
    await tick();
    onOpenChange.mockClear();
    act(() => closeButton()!.click());
    await tick();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(sheet()).not.toBeNull();
    const alert = document.querySelector("[role=alertdialog]")!;
    expect(alert.textContent).toContain("작성한 내용이 사라져요");
  });

  it("[계속 작성] 은 그대로 두고 초점을 묻기 전 자리로 돌린다", async () => {
    render(<Sheet form dirty />);
    open();
    await tick();
    const input = document.querySelector<HTMLInputElement>("input")!;
    act(() => input.focus());
    act(() => closeButton()!.click());
    await tick();
    act(() => byText("계속 작성").click());
    await tick();
    expect(sheet()).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it("[나가기] 는 시트를 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet form dirty onOpenChange={onOpenChange} />);
    open();
    await tick();
    act(() => closeButton()!.click());
    await tick();
    act(() => byText("나가기").click());
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await settle();
    expect(sheet()).toBeNull();
  });

  it("바뀐 값이 없으면 바로 닫는다", async () => {
    render(<Sheet form />);
    open();
    await tick();
    act(() => closeButton()!.click());
    await tick();
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    await settle();
    expect(sheet()).toBeNull();
  });
});

describe("초점 · 모달", () => {
  it("열면 초점이 시트로, 닫으면 연 자리(트리거)로", async () => {
    render(<Sheet />);
    open();
    await tick();
    expect(document.activeElement).toBe(sheet());
    act(() => closeButton()!.click());
    await settle();
    await tick();
    expect(document.activeElement).toBe(byText("열기"));
  });

  it("부모가 open 을 둔 채 시트를 통째로 지워 닫아도 연 줄로 초점이 돌아온다(가계부 상세 — I-wrap-b5 1-b)", async () => {
    const Host = () => {
      const [shown, setShown] = React.useState(false);
      return (
        <>
          <button
            type="button"
            data-testid="row"
            onClick={() => setShown(true)}
          >
            줄
          </button>
          {shown && (
            <BottomSheet open onOpenChange={(o) => !o && setShown(false)}>
              <BottomSheetContent title="상세">
                <BottomSheetBody>본문</BottomSheetBody>
              </BottomSheetContent>
            </BottomSheet>
          )}
        </>
      );
    };
    render(<Host />);
    const row = document.querySelector<HTMLElement>("[data-testid=row]")!;
    act(() => row.focus());
    act(() => row.click());
    await tick();
    expect(document.activeElement).toBe(sheet());
    act(() => {
      sheet()!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await settle();
    await tick();
    await tick();
    expect(document.activeElement).toBe(row);
  });

  it("뒤 화면을 보조 기술에서 숨기고 스크롤을 잠근다", async () => {
    render(<Sheet />);
    open();
    await tick();
    expect(
      document.querySelector("[data-testid=behind]")!.closest("[aria-hidden]"),
    ).not.toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
  });

  it("열린 동안 Tab 이 시트 안을 돈다", async () => {
    render(<Sheet />);
    open();
    await tick();
    const last = byText("적용");
    act(() => last.focus());
    key(last, "Tab");
    expect(sheet()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);
  });
});

describe("본문 · 바닥 · 손잡이", () => {
  it("scrollFog 면 위 20 · 아래 80 여백(마스크는 Scroll Fog 가 건다 — jsdom 에는 토큰이 없다)", async () => {
    render(<Sheet scrollFog />);
    open();
    await tick();
    const body = document.querySelector<HTMLElement>(
      "[data-slot=bottom-sheet-body]",
    )!;
    expect(body.getAttribute("data-scroll-fog")).toBe("overlayBody");
    expect(body.className).toContain("pb-[80px]");
    expect(body.className).toContain("pt-[20px]");
  });

  it("scrollFog 가 없으면 본문 끝 여백은 맨 끝일 때만(last:pb-x4)", async () => {
    render(<Sheet />);
    open();
    await tick();
    const body = document.querySelector<HTMLElement>(
      "[data-slot=bottom-sheet-body]",
    )!;
    expect(body.className).toContain("last:pb-x4");
    expect(body.hasAttribute("data-scroll-fog")).toBe(false);
  });

  it("바닥 버튼은 Button large 48 이고 반씩 나눠 가진다 — 라벨이 반 폭을 넘으면 세로로 쌓는다(ResponsivePair)", async () => {
    render(<Sheet />);
    open();
    await tick();
    expect(byText("적용").className).toContain("h-[48px]");
    expect(byText("초기화").className).toContain("h-[48px]");
    expect(
      document.querySelector("[data-slot=bottom-sheet-footer]")!.className,
    ).toMatch(/flex-wrap-reverse.*\[&>\*\]:grow/);
  });

  it("바닥은 스낵바가 피할 자리다 — 띠가 바닥 버튼 윗변 위 8 에 선다(--snackbar-avoid = 바닥 높이)", async () => {
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      800,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 700,
      width: 360,
      height: 100,
    } as DOMRect);
    render(
      <SnackbarProvider>
        <Sheet />
      </SnackbarProvider>,
    );
    open();
    await tick();
    const region = document.querySelector<HTMLElement>(
      "[data-slot=snackbar-region]",
    )!;
    expect(region.style.getPropertyValue("--snackbar-avoid")).toBe("100px");
  });

  it("스냅 높이가 있으면 손잡이를 달고 보조 기술에서 숨긴다 — 누르면 다음 높이, 마지막에서 닫는다", async () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet snapPoints={["300px", "500px"]} onOpenChange={onOpenChange} />,
    );
    open();
    await tick();
    const handle = document.querySelector<HTMLElement>(
      "[data-slot=bottom-sheet-handle]",
    )!;
    expect(handle.getAttribute("aria-hidden")).toBe("true");
    act(() => handle.click()); // 300 → 500
    await tick();
    expect(sheet()).not.toBeNull();
    act(() => handle.click()); // 가장 높은 높이 — 닫는다
    await tick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("form 이면 스냅 높이를 쓰지 않는다 — 손잡이가 없다", async () => {
    render(<Sheet form snapPoints={["300px", "500px"]} />);
    open();
    await tick();
    expect(
      document.querySelector("[data-slot=bottom-sheet-handle]"),
    ).toBeNull();
  });
});

describe("띄울 자리 · 모달 끄기", () => {
  it("container 를 주고 modal={false} 면 그 안에 열리고 뒤 화면을 숨기지 않는다", async () => {
    const place = document.createElement("div");
    document.body.appendChild(place);
    render(
      <>
        <BottomSheet open modal={false} container={place}>
          <BottomSheetContent title="기간">
            <BottomSheetBody>본문</BottomSheetBody>
          </BottomSheetContent>
        </BottomSheet>
        <p data-testid="behind">뒤 화면</p>
      </>,
    );
    await tick();
    expect(place.contains(sheet())).toBe(true);
    expect(place.contains(overlay())).toBe(true);
    expect(
      document.querySelector("[data-testid=behind]")!.closest("[aria-hidden]"),
    ).toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    place.remove();
  });
});

// F-1 — 문서가 스크롤하는 폰: vaul 의 iOS 잠금은 Trigger 로 열 때만 켜져 문서 스크롤을 0 으로 보냈다 되돌린다. 꺼 둔다
describe("Trigger 로 연 시트는 iOS 에서도 문서 스크롤을 건드리지 않는다", () => {
  const spoof = (key: "platform" | "userAgent", value: string) => {
    const prev = Object.getOwnPropertyDescriptor(navigator, key);
    Object.defineProperty(navigator, key, { configurable: true, value });
    return () => {
      if (prev) Object.defineProperty(navigator, key, prev);
      else delete (navigator as unknown as Record<string, unknown>)[key];
    };
  };

  it("window.scrollTo 를 부르지 않고 body 를 position:fixed 로 만들지 않는다(isIOS · isSafari 참)", async () => {
    const restore = [
      spoof("platform", "iPhone"),
      spoof(
        "userAgent",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ];
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    try {
      render(<Sheet />);
      await tick();
      act(() => byText("열기")!.click());
      await tick();
      await new Promise((r) => setTimeout(r, 400)); // vaul 의 툴바 보정 타이머(300ms)까지
      expect(sheet()).not.toBeNull();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(document.body.style.position).not.toBe("fixed");
      expect(document.body.style.top).toBe("");
    } finally {
      scrollTo.mockRestore();
      restore.forEach((r) => r());
    }
  });
});
