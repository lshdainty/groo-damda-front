import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from "./dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let wide = false;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("1280px"),
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
  await new Promise((r) => setTimeout(r, 50));
});

const mount = (onBack?: () => void) =>
  act(() =>
    root.render(
      <ResponsiveDialog form defaultOpen>
        <ResponsiveDialogContent title="신용카드 추가" onBack={onBack}>
          <ResponsiveDialogBody>본문</ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    ),
  );
const q = (sel: string) => document.querySelector<HTMLElement>(sel);

describe("머리 뒤로 가기(onBack)", () => {
  it("시트 — 이름 '뒤로' · 40 상자 · 아이콘 24 · 누르면 부른다 · 초점 차례 맨 앞", () => {
    wide = false;
    const onBack = vi.fn();
    mount(onBack);
    const back = q("[data-slot=bottom-sheet-back]")!;
    expect(back.getAttribute("aria-label")).toBe("뒤로");
    expect(back.className).toContain("size-[40px]");
    expect(back.className).toContain("[&>svg]:size-[24px]");
    expect(back.className).toContain("before:size-[44px]");
    // 제목은 상자 오른쪽 사이 4 에서 시작한다(36)
    expect(q("[data-slot=bottom-sheet-title]")!.className).toContain(
      "pl-[36px]",
    );
    const title = q("[data-slot=bottom-sheet-title]")!;
    expect(
      back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // ← 는 모두 꺾쇠(chevron-left) — 화살표(arrow-left)를 쓰지 않는다
    expect(back.querySelector("svg")!.getAttribute("class")).toContain(
      "lucide-chevron-left",
    );
    act(() => back.click());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("대화상자 — 같은 단추, 입력 폼이라 닫기는 없다", () => {
    wide = true;
    const onBack = vi.fn();
    mount(onBack);
    const back = q("[data-slot=dialog-back]")!;
    expect(back.getAttribute("aria-label")).toBe("뒤로");
    expect(q("[data-slot=dialog-close]")).toBeNull();
    expect(back.querySelector("svg")!.getAttribute("class")).toContain(
      "lucide-chevron-left",
    );
    expect(q("[data-slot=dialog-title]")!.className).toContain("pl-[36px]");
    act(() => back.click());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("onBack 이 없으면 단추도 제목 들임도 없다", () => {
    wide = false;
    mount();
    expect(q("[data-slot=bottom-sheet-back]")).toBeNull();
    expect(q("[data-slot=bottom-sheet-title]")!.className).not.toContain(
      "pl-[36px]",
    );
  });
});
