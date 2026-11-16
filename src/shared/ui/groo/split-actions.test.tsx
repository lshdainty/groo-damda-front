// 내역 분할의 `항목 추가` · `균등 분배` 가 space-between 으로 양 끝에 흩어져 있어 두 개가
// 한 묶음인지 각자 다른 일인지 읽히지 않았다(사용자 지정 2026-09-17). 얇은 네모 바를 반으로
// 갈라 각 칸에 하나씩 둔다 — spec button.md Layout > Split bar.
//
// jsdom 에는 tailwind CSS 가 없으므로 그 값을 만드는 유틸 클래스를 본다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Button } from "@/shared/ui/button";
import { SplitActions } from "@/shared/ui/groo/split-actions";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (node: ReactNode) => act(() => root.render(node));
const bar = () => container.firstElementChild!;

const twoActions = (
  <SplitActions
    left={
      <Button variant="ghost" size="sm">
        항목 추가
      </Button>
    }
    right={
      <Button variant="ghost" size="sm">
        균등 분배
      </Button>
    }
  />
);

describe("반반 액션 바", () => {
  it("본문 폭을 꽉 채우고 칸을 반씩 나눈다", () => {
    render(twoActions);
    const cls = Array.from(bar().classList);
    expect(cls).toContain("w-full");
    expect(cls).toContain("flex");
    expect(cls).toContain("[&>button]:flex-1");
  });

  it("네모다 — pill 이면 선택 컨트롤과 구분이 안 된다", () => {
    render(twoActions);
    const cls = Array.from(bar().classList);
    expect(cls).toContain("rounded-[var(--radius-r2)]");
    expect(cls).not.toContain("rounded-full");
    // 칸 모서리는 컨테이너가 깎는다.
    expect(cls).toContain("overflow-hidden");
    expect(cls).toContain("[&>button]:rounded-none");
  });

  it("칸 사이 구분선은 글자 높이만큼만 — 바를 위아래로 가르지 않는다", () => {
    render(twoActions);
    const sep = container.querySelector('[data-orientation="vertical"]')!;
    expect(sep, "칸 사이에 구분선이 없다").not.toBeNull();
    // 글자 크기에 맞춘 높이 — h-full 이면 바를 끝까지 가른다.
    expect(Array.from(sep.classList)).toContain("h-[var(--text-t2)]");
    expect(Array.from(sep.classList)).not.toContain("h-full");
    // 세로 가운데 — 위아래 여백이 남아야 한다.
    expect(Array.from(bar().classList)).toContain("items-center");
    // 칸 자체는 테두리를 그리지 않는다(그리면 높이를 못 줄인다).
    for (const b of container.querySelectorAll("button")) {
      expect(Array.from(b.classList).some((c) => /^border-l/.test(c))).toBe(
        false,
      );
    }
  });

  it("얇다 — 칸은 sm(32)", () => {
    render(twoActions);
    for (const b of container.querySelectorAll("button")) {
      expect(b.classList, b.textContent ?? "").toContain("h-8");
    }
  });

  it("선택 컨트롤이 아니다 — 눌린 상태가 없다", () => {
    render(twoActions);
    for (const b of container.querySelectorAll("button")) {
      expect(b.getAttribute("data-state")).toBeNull();
      expect(b.getAttribute("aria-pressed")).toBeNull();
    }
  });
});
