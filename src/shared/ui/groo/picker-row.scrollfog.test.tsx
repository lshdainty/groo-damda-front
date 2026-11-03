// PickerRow 의 끝 흐림은 호출처가 정한다 — 목록형(사용자 값 길이)만 켜고 달력 · 고정 선택지는 끈다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PickerRow } from "./picker-row";

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
  // 1280 미만(시트)
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
const openRow = async () => {
  act(() => {
    container.querySelector<HTMLButtonElement>("button")!.click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const body = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-body]");

describe("PickerRow scrollFog", () => {
  it("scrollFog 를 주면 시트 본문에 끝 흐림이 걸린다", async () => {
    render(
      <PickerRow title="카테고리" surfaceTitle="카테고리" scrollFog>
        목록
      </PickerRow>,
    );
    await openRow();
    expect(body()!.getAttribute("data-scroll-fog")).toBe("overlayBody");
  });

  it("안 주면 걸리지 않는다(달력 · 고정 선택지)", async () => {
    render(
      <PickerRow title="종류" surfaceTitle="종류">
        선택지
      </PickerRow>,
    );
    await openRow();
    expect(body()!.hasAttribute("data-scroll-fog")).toBe(false);
  });
});
