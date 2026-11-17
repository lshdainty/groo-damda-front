// 키보드가 뜬 채 손가락으로 누른 닫기 [×] 는 손을 뗄 때(pointerup) 닫는다(overlay/release-press.ts).
//
// QA 2026-11-18(iPhone · Safari 26, 1/6) — 키보드가 뜬 채 [×] 를 누르면 pointerdown 만 오고 click 이 오지 않아 시트가 닫히지
// 않았다. iOS 의 click 은 터치가 끝난 뒤 따로 짓는 합성 이벤트라 그 사이 화면이 움직이면 버려진다. 손을 뗀 것(pointerup)으로도
// 닫히게 하고, 이어 오는 같은 누름의 click 은 거둔다. 키보드가 없는 경로 · 마우스 · 키보드(Enter · Space)는 click 그대로다.
import * as React from "react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "@/shared/ds/bottom-sheet";
import { Dialog, DialogBody, DialogContent } from "@/shared/ds/dialog";
import { __resetClosingSurfaceForTest } from "@/shared/ds/overlay/closing-surface";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type FakeViewport = EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};

const LAYOUT = 844;
let container: HTMLDivElement;
let root: Root;
let vv: FakeViewport;

function narrow(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // 앞 시험이 [×] 자리에서 닫아 건 따닥 지킴(같은 자리 두 번째 누름 삼키기)이 다음 시험의 누름을 먹지 않게
  __resetClosingSurfaceForTest();
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.history.replaceState(null, "");
  narrow(false);
  vv = Object.assign(new EventTarget(), {
    height: LAYOUT,
    offsetTop: 0,
    scale: 1,
  });
  Object.defineProperty(window, "visualViewport", {
    value: vv,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: LAYOUT,
    configurable: true,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  delete (document.documentElement as { clientHeight?: number }).clientHeight;
  delete (window as { visualViewport?: unknown }).visualViewport;
  vi.restoreAllMocks();
  await new Promise((r) => setTimeout(r, 100));
});

const render = (node: ReactNode) => act(() => root.render(node));

async function keyboard(up: boolean) {
  vv.height = up ? 494 : LAYOUT;
  await act(async () => {
    vv.dispatchEvent(new Event("resize"));
  });
}

/** [×] 의 자리 — jsdom 은 크기가 0 이라 심는다(누르는 영역 44) */
function placeAt(el: HTMLElement) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left: 320,
    top: 300,
    right: 364,
    bottom: 344,
    width: 44,
    height: 44,
    x: 320,
    y: 300,
    toJSON() {},
  });
  return el;
}

function pointer(
  el: Element,
  type: "pointerdown" | "pointerup" | "pointercancel",
  { x = 340, y = 320, pointerType = "touch" } = {},
) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  });
}

function click(el: Element, detail = 1) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        detail,
        clientX: 340,
        clientY: 320,
      }),
    );
  });
}

function Sheet({
  onOpenChange,
  dirty,
}: {
  onOpenChange: (open: boolean) => void;
  dirty?: boolean;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <BottomSheet
      form
      dirty={dirty}
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
      }}
    >
      <BottomSheetContent title="거래 추가">
        <BottomSheetBody>
          <input aria-label="금액" inputMode="decimal" />
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

const sheetClose = () =>
  placeAt(
    document.querySelector<HTMLButtonElement>(
      "[data-slot=bottom-sheet-close]",
    )!,
  );
const alertOpen = () =>
  document.querySelector('[role="alertdialog"][data-state="open"]');

async function openSheet({
  withKeyboard = true,
  dirty = false,
}: { withKeyboard?: boolean; dirty?: boolean } = {}) {
  const onOpenChange = vi.fn();
  render(<Sheet onOpenChange={onOpenChange} dirty={dirty} />);
  if (withKeyboard) {
    act(() => document.querySelector<HTMLInputElement>("input")!.focus());
    await keyboard(true);
  }
  return onOpenChange;
}

describe("닫기 [×] — 키보드가 뜬 채 손가락으로 누르면 뗄 때 닫는다", () => {
  it("click 이 오지 않아도(pointerdown · pointerup 만) 닫는다 — 키보드를 내린 뒤", async () => {
    const onOpenChange = await openSheet();
    const close = sheetClose();
    pointer(close, "pointerdown");
    pointer(close, "pointerup");
    // 키보드가 내려가는 중 — 닫기는 시작됐다(초점이 칸을 떠났다)
    expect(document.activeElement?.tagName).not.toBe("INPUT");
    await keyboard(false);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("이어 온 같은 누름의 click 은 거둔다 — 닫기는 한 번", async () => {
    const onOpenChange = await openSheet();
    const close = sheetClose();
    pointer(close, "pointerdown");
    pointer(close, "pointerup");
    click(close);
    await keyboard(false);
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("바뀐 값이 있으면 뗄 때 한 번만 묻는다 — 이어 온 click 이 다시 청하지 않는다", async () => {
    const onOpenChange = await openSheet({ dirty: true });
    const close = sheetClose();
    pointer(close, "pointerdown");
    pointer(close, "pointerup");
    expect(alertOpen()).toBeTruthy();
    click(close);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("단추 밖으로 밀고 떼면 닫지 않는다", async () => {
    const onOpenChange = await openSheet();
    const close = sheetClose();
    pointer(close, "pointerdown");
    pointer(close, "pointerup", { x: 200, y: 500 });
    await keyboard(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("터치가 취소되면(pointercancel — 스크롤 · 끌기) 닫지 않는다", async () => {
    const onOpenChange = await openSheet();
    const close = sheetClose();
    pointer(close, "pointerdown");
    pointer(close, "pointercancel");
    pointer(close, "pointerup");
    await keyboard(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("마우스는 click 그대로다 — 뗄 때 닫지 않는다", async () => {
    const onOpenChange = await openSheet();
    const close = sheetClose();
    pointer(close, "pointerdown", { pointerType: "mouse" });
    pointer(close, "pointerup", { pointerType: "mouse" });
    await keyboard(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("키보드가 없으면 click 그대로다 — 뗄 때는 닫지 않고 click 에 닫는다(지금 동작)", async () => {
    const onOpenChange = await openSheet({ withKeyboard: false });
    const close = sheetClose();
    pointer(close, "pointerdown");
    pointer(close, "pointerup");
    expect(onOpenChange).not.toHaveBeenCalled();
    click(close);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("키보드(Enter · Space)로 누른 click(detail 0)은 그대로 닫는다", async () => {
    const onOpenChange = await openSheet({ withKeyboard: false });
    click(sheetClose(), 0);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("대화상자(1280 이상 · 태블릿)의 닫기도 같다 — 이어 온 click 은 Radix 닫기로 넘기지 않는다", async () => {
    narrow(true);
    const onOpenChange = vi.fn();
    function Wide() {
      const [open, setOpen] = React.useState(true);
      return (
        <Dialog
          dirty
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <DialogContent title="메모">
            <DialogBody>
              <input aria-label="금액" />
            </DialogBody>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Wide />);
    act(() => document.querySelector<HTMLInputElement>("input")!.focus());
    await keyboard(true);
    const close = placeAt(
      document.querySelector<HTMLButtonElement>("[data-slot=dialog-close]")!,
    );
    pointer(close, "pointerdown");
    pointer(close, "pointerup");
    expect(alertOpen()).toBeTruthy();
    // 이어 온 click 이 Radix 닫기로 가면 다시 청한다 — 거뒀으면 묻는 창은 하나 그대로, 닫히지 않는다
    click(close);
    expect(document.querySelectorAll('[role="alertdialog"]').length).toBe(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
