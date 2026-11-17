// 키보드가 뜬 채 닫으면 키보드를 먼저 내리고, 다 내려간 뒤에 닫는다(overlay/close-after-keyboard.ts).
//
// QA 2026-11-18(iPhone · Safari 26) — 홈 + → 금액 칸(숫자 키패드) → [×] → 곧바로 하단 "가계부" 가 3/3 이동하지 않았다. 이어 누른
// 탭은 문서에 pointerdown 조차 오지 않았다 — 키보드가 내려가는 동안 iOS 가 새 터치를 넘기지 않는다. 시트는 [×] 에 바로 사라져
// 사용자는 내려가는 중에 누른다. 그래서 시트가 사라지는 때를 키보드가 다 내려간 뒤로 옮긴다.
//
// jsdom 에는 visualViewport 가 없어 이벤트를 받는 최소한을 심는다(use-keyboard-viewport.test.tsx 와 같다).
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

import { KEYBOARD_CLOSE_WAIT_MS } from "./close-after-keyboard";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type FakeViewport = EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};

const LAYOUT = 844;
/** 숫자 키패드 350 이 뜬 보이는 높이 */
const WITH_KEYPAD = 494;

let container: HTMLDivElement;
let root: Root;
let vv: FakeViewport;

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
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
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
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]")!;
const amount = () =>
  document.querySelector<HTMLInputElement>("input[aria-label=금액]")!;

/** 키보드를 올린다(보이는 영역이 줄어든다) · 내린다 — iOS 는 모션이 끝난 뒤 resize 를 한 번 보낸다 */
async function keyboard(up: boolean) {
  vv.height = up ? WITH_KEYPAD : LAYOUT;
  await act(async () => {
    vv.dispatchEvent(new Event("resize"));
  });
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    );
  });
}

function Sheet({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = React.useState(true);
  return (
    <BottomSheet
      form
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

const closeButton = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=bottom-sheet-close]")!;

async function openWithKeypad(onOpenChange = vi.fn()) {
  render(<Sheet onOpenChange={onOpenChange} />);
  act(() => amount().focus());
  await keyboard(true);
  expect(document.activeElement).toBe(amount());
  return onOpenChange;
}

describe("키보드가 뜬 채 닫기 — 키보드를 먼저 내리고 닫는다", () => {
  it("[×] — 칸의 초점을 시트로 옮겨 키보드를 내리고, 보이는 영역이 돌아오면 닫는다", async () => {
    const onOpenChange = await openWithKeypad();

    click(closeButton());
    // 아직 닫지 않는다 — 키보드가 내려가는 동안 시트는 보이는 채(열린 채) 남는다
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(sheet().getAttribute("data-state")).toBe("open");
    // 초점은 칸을 떠나 시트(초점 가둠 안)로 — 키보드가 내려가기 시작한다
    expect(document.activeElement).toBe(sheet());

    await keyboard(false);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(sheet().getAttribute("data-state")).toBe("closed");
  });

  it("보이는 영역이 돌아왔다는 알림이 오지 않아도 상한(400ms) 뒤에 닫는다", async () => {
    const onOpenChange = await openWithKeypad();
    click(closeButton());
    await wait(KEYBOARD_CLOSE_WAIT_MS - 150);
    expect(onOpenChange).not.toHaveBeenCalled();
    await wait(200);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("기다리는 동안 다시 눌러도(Esc · [×]) 한 번만 닫는다", async () => {
    const onOpenChange = await openWithKeypad();
    click(closeButton());
    click(closeButton());
    act(() => {
      sheet().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await keyboard(false);
    await wait(KEYBOARD_CLOSE_WAIT_MS + 50);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("보이는 영역이 반쯤 돌아온 resize(안드로이드처럼 여러 번)에는 아직 닫지 않는다", async () => {
    const onOpenChange = await openWithKeypad();
    click(closeButton());
    vv.height = 700; // 아직 144 가려 있다(키보드로 보는 60 초과)
    await act(async () => {
      vv.dispatchEvent(new Event("resize"));
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    await keyboard(false);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("키보드가 없으면 그 자리에서 바로 닫는다 — 지금 동작 그대로", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet onOpenChange={onOpenChange} />);
    click(closeButton());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("초점 칸 없이 키보드만 내려가는 중(도구줄 [완료] 뒤 곧바로 [×])이어도 다 내려간 뒤에 닫는다", async () => {
    const onOpenChange = await openWithKeypad();
    act(() => amount().blur());
    click(closeButton());
    expect(onOpenChange).not.toHaveBeenCalled();
    await keyboard(false);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("기다리는 동안 시트가 내려가면(언마운트) 늦게 닫지 않는다", async () => {
    const onOpenChange = await openWithKeypad();
    click(closeButton());
    act(() => root.render(null));
    await keyboard(false);
    await wait(KEYBOARD_CLOSE_WAIT_MS + 50);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("대화상자(1280 이상 · 태블릿 키보드)도 같다", async () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    const onOpenChange = vi.fn();
    function Wide() {
      const [open, setOpen] = React.useState(true);
      return (
        <Dialog
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
    act(() => amount().focus());
    await keyboard(true);
    click(
      document.querySelector<HTMLButtonElement>("[data-slot=dialog-close]")!,
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(amount());
    await keyboard(false);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });
});
