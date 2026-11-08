// Progress Circle 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProgressCircle } from "./progress-circle";

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

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.querySelector("svg")!;
}

const range = () =>
  container.querySelector<SVGCircleElement>(
    "[data-slot=progress-circle-range]",
  )!;

describe("ProgressCircle", () => {
  it("값이 없으면 도는 원 — 이름은 기본 '불러오는 중', 값 속성은 두지 않는다", () => {
    const svg = render(<ProgressCircle />);
    expect(svg.getAttribute("role")).toBe("progressbar");
    expect(svg.getAttribute("aria-label")).toBe("불러오는 중");
    expect(svg.hasAttribute("aria-valuenow")).toBe(false);
    expect(svg.dataset.mode).toBe("indeterminate");
    // 기본은 40 · neutral
    expect(svg.dataset.size).toBe("40");
    expect(svg.dataset.tone).toBe("neutral");
  });

  it("값이 있으면 min · max 를 지켜 채운다 — 0 ~ 5 중 3 이면 60%", () => {
    const svg = render(<ProgressCircle value={3} min={0} max={5} />);
    expect(svg.dataset.mode).toBe("determinate");
    expect(svg.getAttribute("aria-valuenow")).toBe("3");
    expect(svg.getAttribute("aria-valuemin")).toBe("0");
    expect(svg.getAttribute("aria-valuemax")).toBe("5");
    expect(svg.getAttribute("aria-valuetext")).toBe("60%");
    // 원둘레 100 중 60 이 보인다
    expect(range().style.strokeDashoffset).toBe("40");
  });

  it("반올림해 100 이 되는 값은 99% 로 읽는다", () => {
    const svg = render(<ProgressCircle value={99.6} />);
    expect(svg.getAttribute("aria-valuetext")).toBe("99%");
  });

  it("범위를 벗어난 값은 끝에서 멈춘다", () => {
    const svg = render(<ProgressCircle value={150} />);
    expect(svg.getAttribute("aria-valuenow")).toBe("100");
    expect(svg.getAttribute("aria-valuetext")).toBe("100%");
    expect(range().style.strokeDashoffset).toBe("0");
  });

  it("값이 0 이면 호를 지운다 — 둥근 끝이 점으로 남지 않게", () => {
    render(<ProgressCircle value={0} />);
    expect(range().style.opacity).toBe("0");
  });

  it("aria-labelledby 를 주면 기본 이름을 달지 않는다", () => {
    const svg = render(<ProgressCircle aria-labelledby="upload-title" />);
    expect(svg.hasAttribute("aria-label")).toBe(false);
    expect(svg.getAttribute("aria-labelledby")).toBe("upload-title");
  });

  it("값 글을 바꿀 수 있다", () => {
    const svg = render(
      <ProgressCircle value={2} max={4} valueText="4장 중 2장" />,
    );
    expect(svg.getAttribute("aria-valuetext")).toBe("4장 중 2장");
  });
});
