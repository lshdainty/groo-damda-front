// 키보드가 내려간 뒤에도 시트가 키보드 높이에 떠 있는 문제(2026-11-10 사용자 제보).
//
// vaul 은 키보드가 뜨면 시트에 `style.bottom` · `style.height` 를 박는다. "열렸나" 를 뒤집기로 기억해
// 숫자 키패드 → 글자 키보드로 옮기면 거꾸로 되고, 초점을 빼 내리면 처리기가 안 돌아 값이 남는다.
// jsdom 에서는 vaul 의 키보드 처리가 돌지 않으므로 vaul 이 박았을 값을 손으로 심고, 뷰포트를 흉내 내
// "지금 키보드가 없으면 지운다 · 있으면 건드리지 않는다" 만 잠근다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
} from "./bottom-sheet";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let vv: EventTarget & { height: number };

/** jsdom 엔 visualViewport 가 없다 — 이벤트를 받는 최소한을 심는다. */
function setViewport({ inner, visual }: { inner: number; visual: number }) {
  Object.defineProperty(window, "innerHeight", {
    value: inner,
    configurable: true,
  });
  vv.height = visual;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  vv = Object.assign(new EventTarget(), { height: 844 });
  Object.defineProperty(window, "visualViewport", {
    value: vv,
    configurable: true,
  });
  setViewport({ inner: 844, visual: 844 });
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
const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]");

function Sheet({ open = true }: { open?: boolean }) {
  return (
    <BottomSheet open={open} form>
      <BottomSheetContent title="거래">
        <BottomSheetBody>
          <input aria-label="금액" inputMode="decimal" />
          <textarea aria-label="메모" />
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/** 이벤트 한 번 + 다음 프레임(복구는 rAF 뒤에 돈다). */
async function fire(target: EventTarget, type: string) {
  await act(async () => {
    target.dispatchEvent(new Event(type, { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
}

describe("시트 키보드 높이 복구", () => {
  it("숫자칸 → 글자칸 → 초점 빼고 내림 — 남은 bottom · height 를 지운다", async () => {
    render(<Sheet />);
    const el = sheet()!;
    expect(el).toBeTruthy();

    // 숫자 키패드(250) — vaul 이 관리하는 동안
    setViewport({ inner: 844, visual: 594 });
    el.style.bottom = "250px";
    await fire(vv, "resize");
    expect(el.style.bottom).toBe("250px");

    // 글자 키보드(330) — vaul 의 열림 표시가 뒤집힌다
    setViewport({ inner: 844, visual: 514 });
    el.style.bottom = "330px";
    el.style.height = "400px";
    await fire(vv, "resize");
    expect(el.style.bottom).toBe("330px");

    // 초점을 빼서 내림 — vaul 처리기가 안 돌아 값이 남은 채 뷰포트만 돌아온다
    setViewport({ inner: 844, visual: 844 });
    await fire(vv, "resize");

    expect(el.style.bottom).toBe("");
    expect(el.style.height).toBe("");
  });

  it("resize 없이 focusout · visualViewport scroll 만 와도 지운다(iOS)", async () => {
    render(<Sheet />);
    const el = sheet()!;
    el.style.bottom = "330px";
    await fire(document, "focusout");
    expect(el.style.bottom).toBe("");

    el.style.bottom = "330px";
    await fire(vv, "scroll");
    expect(el.style.bottom).toBe("");
  });

  it("키보드가 떠 있는 동안(60 초과)에는 지우지 않는다", async () => {
    render(<Sheet />);
    const el = sheet()!;
    setViewport({ inner: 844, visual: 514 });
    el.style.bottom = "330px";
    el.style.height = "400px";
    for (const [t, type] of [
      [vv, "resize"],
      [vv, "scroll"],
      [document, "focusout"],
      [window, "resize"],
    ] as const) {
      await fire(t, type);
    }
    expect(el.style.bottom).toBe("330px");
    expect(el.style.height).toBe("400px");
  });

  it("키보드 높이 60 이하(주소창 변화 정도)는 키보드가 아니다 — 지운다", async () => {
    render(<Sheet />);
    const el = sheet()!;
    setViewport({ inner: 844, visual: 790 });
    el.style.bottom = "54px";
    await fire(vv, "resize");
    expect(el.style.bottom).toBe("");
  });

  it("삼성 인터넷 — 레이아웃 뷰포트가 같이 줄어(innerHeight == visual) 반쪽으로 남은 높이도 푼다", async () => {
    render(<Sheet />);
    const el = sheet()!;
    // 키보드가 사라졌는데 두 값이 줄어든 채 같다 → 키보드 높이 0
    setViewport({ inner: 422, visual: 422 });
    el.style.height = "369.594px";
    await fire(vv, "resize");
    expect(el.style.height).toBe("");

    // 그래도 진짜 키보드(차이 > 60)면 반쪽 높이 근처 값이어도 건드리지 않는다
    setViewport({ inner: 844, visual: 422 });
    el.style.height = "369.594px";
    await fire(vv, "resize");
    expect(el.style.height).toBe("369.594px");
  });

  it("닫았다 다시 열면 이전 값이 남지 않는다", async () => {
    render(<Sheet />);
    sheet()!.style.bottom = "330px";
    render(<Sheet open={false} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // 닫는 모션을 jsdom 이 끝내지 않으니 알려 준다
    await act(async () => {
      for (const el of document.querySelectorAll<HTMLElement>(
        "[data-state=closed]",
      )) {
        const e = new Event("animationend", { bubbles: true });
        Object.assign(e, { animationName: getComputedStyle(el).animationName });
        el.dispatchEvent(e);
      }
      await new Promise((r) => setTimeout(r, 0));
    });
    render(<Sheet open />);
    await fire(vv, "resize");
    expect(sheet()!.style.bottom).toBe("");
  });

  it("시트가 둘 겹쳐도 각자 지운다", async () => {
    render(
      <>
        <Sheet />
        <BottomSheet open form>
          <BottomSheetContent title="고르기">
            <BottomSheetBody>
              <input aria-label="검색" />
            </BottomSheetBody>
          </BottomSheetContent>
        </BottomSheet>
      </>,
    );
    const els = document.querySelectorAll<HTMLElement>(
      "[data-slot=bottom-sheet-content]",
    );
    expect(els.length).toBe(2);
    els.forEach((e) => (e.style.bottom = "330px"));
    await fire(vv, "resize");
    els.forEach((e) => expect(e.style.bottom).toBe(""));
  });

  it("visualViewport 가 없어도 죽지 않는다", async () => {
    Object.defineProperty(window, "visualViewport", {
      value: undefined,
      configurable: true,
    });
    render(<Sheet />);
    const el = sheet()!;
    el.style.bottom = "330px";
    await fire(window, "resize");
    expect(el.style.bottom).toBe("");
  });
});
