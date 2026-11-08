// Progress 의 동작 — 높이 · 색 · 글자는 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Progress, ProgressBar } from "./progress";

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
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

const part = (slot: string) =>
  container.querySelector<HTMLElement>(`[data-slot=${slot}]`)!;

describe("Progress", () => {
  it("이름 줄 · 막대 · 금액 줄 — 막대는 미터, 보이는 글은 보조 기술에 숨긴다", () => {
    const el = render(
      <Progress label="식비 예산" value={350000} max={400000} />,
    );
    expect(el.dataset.slot).toBe("progress");
    expect(el.dataset.meaning).toBe("limit");
    expect(el.dataset.state).toBe("enabled");

    // 오른쪽 글은 반올림한 정수 비율(87.5 → 88), 금액 줄은 "현재 / 목표"
    expect(part("progress-label").textContent).toBe("식비 예산");
    expect(part("progress-status").textContent).toBe("88%");
    expect(part("progress-amount").textContent).toBe("350,000원 / 400,000원");
    expect(part("progress-header").getAttribute("aria-hidden")).toBe("true");
    expect(part("progress-amount").getAttribute("aria-hidden")).toBe("true");

    const meter = part("progress-track");
    expect(meter.getAttribute("role")).toBe("meter");
    expect(meter.getAttribute("aria-label")).toBe(
      "식비 예산 400,000원 중 350,000원",
    );
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("400000");
    expect(meter.getAttribute("aria-valuenow")).toBe("350000");
    expect(meter.getAttribute("aria-valuetext")).toBe("88%");
    expect(part("progress-fill").style.width).toBe("87.5%");
  });

  it("큰 글자 — 이름 줄은 줄 안 폭 16rem 미만이면 오른쪽 글을 이름 아래 왼쪽으로(List 와 같은 문턱)", () => {
    const el = render(<Progress label="식비 예산" value={1} max={2} />);
    expect(el.className).toContain("@container/progress");
    expect(part("progress-header").className).toContain(
      "@max-[16rem]/progress:flex-col",
    );
    // 이름은 줄을 바꾼다 — 말줄임 없음
    expect(part("progress-label").className).toContain("break-keep");
    expect(part("progress-label").className).not.toContain("truncate");
  });

  it("한도를 넘으면 — 채움 끝까지 · 위험 색, 오른쪽 글 'N원 초과', 값은 목표에서 멈춘다", () => {
    const el = render(
      <Progress label="교통 예산" value={120000} max={100000} />,
    );
    expect(el.dataset.state).toBe("over");
    const status = part("progress-status");
    expect(status.textContent).toBe("20,000원 초과");
    expect(status.dataset.state).toBe("over");
    expect(status.className).toContain("data-[state=over]:text-fg-critical");
    expect(status.className).toContain("data-[state=over]:font-bold");

    const fill = part("progress-fill");
    expect(fill.style.width).toBe("100%");
    expect(fill.dataset.state).toBe("over");
    expect(fill.className).toContain("data-[state=over]:bg-fg-critical");

    const meter = part("progress-track");
    expect(meter.getAttribute("aria-valuenow")).toBe("100000");
    expect(meter.getAttribute("aria-valuetext")).toBe("20,000원 초과");
  });

  it("반올림해 100 이 되는 값은 99% — 100% 는 정확히 닿았을 때만", () => {
    render(<Progress label="식비 예산" value={99600} max={100000} />);
    expect(part("progress-status").textContent).toBe("99%");
  });

  it("한도에 딱 닿은 것은 넘침이 아니다", () => {
    const el = render(
      <Progress label="식비 예산" value={400000} max={400000} />,
    );
    expect(el.dataset.state).toBe("enabled");
    expect(part("progress-status").textContent).toBe("100%");
  });

  it("목표에 닿으면 — 채움 끝까지, 오른쪽 글 '달성'(색은 그대로)", () => {
    const el = render(
      <Progress
        meaning="goal"
        label="현대카드 M 전월 실적"
        value={390000}
        max={300000}
      />,
    );
    expect(el.dataset.state).toBe("reached");
    expect(part("progress-status").textContent).toBe("달성");
    expect(part("progress-fill").style.width).toBe("100%");
    // 채움은 그대로 브랜드 — 넘침 색은 한도에만
    expect(part("progress-fill").dataset.state).toBe("reached");
    const meter = part("progress-track");
    expect(meter.getAttribute("aria-valuenow")).toBe("300000");
    expect(meter.getAttribute("aria-valuetext")).toBe("달성");
    // 금액 줄은 실제 값을 보인다
    expect(part("progress-amount").textContent).toBe("390,000원 / 300,000원");

    render(
      <Progress meaning="goal" label="비상금" value={300000} max={300000} />,
    );
    expect(part("progress").dataset.state).toBe("reached");
  });

  it("목표에 못 미치면 비율 — 돈이 아닌 값은 그 단위로", () => {
    const el = render(
      <Progress
        meaning="goal"
        label="오늘 근무"
        value={6}
        max={8}
        formatValue={(h) => `${h}시간`}
      />,
    );
    expect(el.dataset.state).toBe("enabled");
    expect(part("progress-status").textContent).toBe("75%");
    expect(part("progress-amount").textContent).toBe("6시간 / 8시간");
    expect(part("progress-track").getAttribute("aria-label")).toBe(
      "오늘 근무 8시간 중 6시간",
    );
  });

  it("0 보다 작은 값은 0 — 값이 0 이면 채움이 없고, 0 보다 크면 적어도 높이만큼", () => {
    render(<Progress label="문화 예산" value={-5000} max={100000} />);
    expect(part("progress-status").textContent).toBe("0%");
    expect(part("progress-amount").textContent).toBe("0원 / 100,000원");
    expect(part("progress-fill").style.width).toBe("0%");
    expect(part("progress-fill").className).not.toContain("min-w-[8px]");

    render(<Progress label="문화 예산" value={100} max={100000} />);
    expect(part("progress-fill").className).toContain("min-w-[8px]");
  });

  it("목표가 0 이면 — 값이 있으면 끝까지, 없으면 비운다", () => {
    render(<Progress label="경조사 예산" value={0} max={0} />);
    expect(part("progress-fill").style.width).toBe("0%");
    expect(part("progress").dataset.state).toBe("enabled");
    render(<Progress label="경조사 예산" value={10000} max={0} />);
    expect(part("progress-fill").style.width).toBe("100%");
    expect(part("progress-status").textContent).toBe("10,000원 초과");
  });

  it("값이 바뀔 때만 채움이 따라 찬다 — 폭 전환은 모션 줄이기면 끈다", () => {
    render(<Progress label="식비 예산" value={100000} max={400000} />);
    const fill = part("progress-fill");
    expect(fill.className).toContain(
      "[transition:width_var(--motion-duration-d6)_var(--motion-ease-enter)]",
    );
    expect(fill.className).toContain("motion-reduce:transition-none");
    render(<Progress label="식비 예산" value={200000} max={400000} />);
    // 같은 요소의 폭만 바뀐다 — 새로 그리지 않아 전환이 걸린다
    expect(part("progress-fill")).toBe(fill);
    expect(fill.style.width).toBe("50%");
  });
});

describe("ProgressBar", () => {
  it("막대만 — 이름 · 값 글은 부르는 쪽이 준다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = render(
      <ProgressBar
        value={88}
        max={100}
        aria-label="식비 예산 100% 중 88%"
        aria-valuetext="88%"
      />,
    );
    expect(el.getAttribute("role")).toBe("meter");
    expect(el.getAttribute("aria-label")).toBe("식비 예산 100% 중 88%");
    expect(el.getAttribute("aria-valuetext")).toBe("88%");
    expect(el.getAttribute("aria-valuenow")).toBe("88");
    expect(warn).not.toHaveBeenCalled();
  });

  it("개발 중 — 이름 · 값 글이 없으면 알린다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ProgressBar value={1} max={2} />);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockClear();
    render(
      <ProgressBar
        value={1}
        max={2}
        aria-labelledby="budget-title"
        aria-valuetext="50%"
      />,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
