// BusyOverlay 의 덮는 범위 — 시트 · 대화상자 딤과 같은 OVERLAY_DIM_BOUNDS(키보드 아래 띠까지). 실제 그림은 실기기로만 —
// 여기서는 클래스(범위)가 딤과 같고 레이아웃 뷰포트만 덮던 inset-0 이 남지 않았는지를 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OVERLAY_DIM_BOUNDS } from "@/shared/ds/overlay/dim-bounds";

import { BusyOverlay } from "./busy-overlay";

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
  vi.useRealTimers();
});

const overlay = () =>
  document.body.querySelector<HTMLElement>('[data-slot="busy-overlay"]');

function expectDimBounds(el: HTMLElement) {
  const classes = el.className.split(/\s+/);
  expect(classes).toEqual(
    expect.arrayContaining(OVERLAY_DIM_BOUNDS.split(" ")),
  );
  expect(classes).toEqual(
    expect.arrayContaining(["-top-[100lvh]", "-bottom-[100lvh]"]),
  );
  expect(classes).not.toContain("inset-0");
  // 범위는 클래스 몫 — 인라인으로 자리를 덮어쓰지 않는다
  for (const prop of ["top", "bottom", "height", "inset"]) {
    expect(el.style.getPropertyValue(prop)).toBe("");
  }
}

describe("BusyOverlay — 화면 위아래로 넘쳐 키보드 아래 띠까지 덮는다(overlay/dim-bounds.ts)", () => {
  it("1초 전 투명 막도, 1초 뒤 딤도 시트 · 대화상자 딤과 같은 범위다 — 층은 z-alert", () => {
    act(() => root.render(<BusyOverlay busy label="해지하는 중" />));
    const el = overlay()!;
    expect(el).not.toBeNull();
    expect(el.parentElement).toBe(document.body);
    expect(el.hasAttribute("data-visible")).toBe(false);
    expectDimBounds(el);
    expect(el.className).toContain("z-(--z-alert)");

    act(() => vi.advanceTimersByTime(1000));
    expect(el.getAttribute("data-visible")).toBe("true");
    expectDimBounds(el);
    expect(el.className).toContain("z-(--z-alert)");
    expect(el.className).toContain("bg-[var(--overlay-dim-light)]");
    // 위아래가 같은 만큼 넘쳐 원은 가운데 그대로
    expect(el.className).toContain("items-center");
    expect(el.className).toContain("justify-center");
    expect(
      el.querySelector('[role="progressbar"]')?.getAttribute("aria-label"),
    ).toBe("해지하는 중");
  });

  it("처리가 끝나면 걷는다", () => {
    act(() => root.render(<BusyOverlay busy label="해지하는 중" />));
    expect(overlay()).not.toBeNull();
    act(() => root.render(<BusyOverlay busy={false} label="해지하는 중" />));
    expect(overlay()).toBeNull();
  });
});
