// React Compiler 를 거친 코드로 금액 줄 판정을 본다 — 판정 훅이 처음 잰 값에 묶이면 글자 크기를 키워도 단추가 옆에 남는다.
// vitest 는 컴파일러 없이 돌아 그 결함이 안 보이므로, 앱 빌드와 같은 플러그인으로 변환한 모듈을 부른다(axisWidth.compiled.test 와 같은 방법).
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importCompiled } from "@/shared/lib/react-compiler.test-utils";

type AmountRowModule = typeof import("./amount-row");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let scale = 1;
let resize: (() => void)[] = [];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  scale = 1;
  resize = [];
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) {
      resize.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.dataset.row != null ? 312 : 0;
    },
  );
  // 금액은 한 줄로 잴 때 11 글자 × 0.6 × 24 × 배율, 단추는 98 × 배율
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const el = this as HTMLElement;
      const width = el.hasAttribute("data-amount-row-amount")
        ? el.style.whiteSpace === "nowrap"
          ? 11 * 0.6 * 24 * scale
          : 0
        : el.tagName === "BUTTON"
          ? 98 * scale
          : 0;
      return { width } as DOMRect;
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("React Compiler 를 거친 금액 줄 판정", () => {
  it("판정 함수는 판(version)을 열쇠로 받고, 글자 크기가 바뀌면 다시 판정한다(처음 값에 묶이지 않는다)", async () => {
    const { module, code } = await importCompiled<AmountRowModule>(
      "src/shared/lib/groo/amount-row.ts",
    );
    expect(code).toContain("react/compiler-runtime");
    const seen: boolean[] = [];
    const Probe = () => {
      const ref = useRef<HTMLDivElement>(null);
      const stacked = module.useAmountRowStacks(ref);
      seen.push(stacked);
      return (
        <div ref={ref} data-row="">
          <div>
            <div data-amount-row-amount="">1,234,567원</div>
          </div>
          <button type="button">소비 요약</button>
        </div>
      );
    };
    await act(async () => root.render(createElement(Probe)));
    expect(seen[seen.length - 1]).toBe(false);
    scale = 3;
    await act(async () => resize.forEach((cb) => cb()));
    expect(seen[seen.length - 1]).toBe(true);
    scale = 1;
    await act(async () => resize.forEach((cb) => cb()));
    expect(seen[seen.length - 1]).toBe(false);
  });
});
