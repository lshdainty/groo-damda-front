// 막힌 것은 불투명도로 흐리게 하지 않고 비활성 전용 색을 쓴다(01-029 · 기초 STA-01).
// 옛 공용 셋(캘린더 막힌 날 · 색 견본)의 남은 opacity-50 을 걷었다 — 클래스로 잠근다(색 값은 groo-tokens 가 정한다).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Calendar } from "./calendar";
import { ColorSwatchGroup } from "./color-swatch";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Radix 슬라이더는 손잡이 크기를 ResizeObserver 로 잰다 — jsdom 에는 없다
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const classesOf = (el: Element) => (el.getAttribute("class") ?? "").split(" ");

describe("막힘은 전용 색 — opacity-50 을 쓰지 않는다", () => {
  it("캘린더의 막힌 날은 fg-disabled 글자 — 불투명도 없음", () => {
    act(() =>
      root.render(
        <Calendar
          mode="single"
          month={new Date(2026, 9, 1)}
          disabled={{ before: new Date(2026, 9, 10) }}
        />,
      ),
    );
    const disabledDays = container.querySelectorAll("td[data-disabled=true]");
    expect(disabledDays.length).toBeGreaterThan(0);
    for (const day of disabledDays) {
      expect(classesOf(day)).toContain("text-fg-disabled");
      expect(classesOf(day)).not.toContain("opacity-50");
      // 막힌 날 칸은 회색 채운 원이 아니라 바탕 없음 + 취소선(date-picker 스펙)
      const button = day.querySelector("button")!;
      expect(classesOf(button)).toContain("disabled:bg-transparent");
      expect(classesOf(button)).toContain("line-through");
      expect(classesOf(button)).not.toContain("disabled:bg-bg-disabled");
    }
  });

  it("막힌 색 견본은 색은 그대로 · 누르기만 막고 · 고른 채 막히면 고리만 회색", () => {
    act(() =>
      root.render(
        <ColorSwatchGroup
          disabled
          defaultValue="a"
          aria-label="색"
          options={[
            { value: "a", bg: "#ffd6d6", fg: "#c00000", label: "빨강" },
            { value: "b", bg: "#d6e4ff", fg: "#0040c0", label: "파랑" },
          ]}
        />,
      ),
    );
    const items = container.querySelectorAll<HTMLButtonElement>("[role=radio]");
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.disabled).toBe(true);
      const cls = classesOf(item);
      expect(cls.some((c) => /(^|:)opacity-/.test(c))).toBe(false);
      expect(cls).toContain("disabled:cursor-not-allowed");
      expect(cls).toContain(
        "disabled:data-[state=checked]:border-stroke-neutral-solid",
      );
      // 색이 곧 값이다 — 인라인 배경은 그대로
    }
    expect(items[0]!.style.background).not.toBe("");
  });
});
