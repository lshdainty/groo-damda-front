// 고정 지출 문장 — 값이 "0.1% 미만" 이면 조사가 안 맞아 숫자 없는 다른 문장으로 간다(B3 1A 후속).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FixedOverviewSection } from "./fixed-parts";
import type { StatsModel } from "./stats-model";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("./stats-parts", async (orig) => ({
  ...(await orig<typeof import("./stats-parts")>()),
  PeriodButton: () => null,
}));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (fixed: number) =>
  act(() =>
    root.render(
      <FixedOverviewSection
        kind="expense"
        place="card"
        m={
          {
            rangeQ: {
              isError: false,
              isLoading: false,
              data: { totalExpense: 1_000_000, fixedExpense: fixed },
            },
            setManageOpen: () => {},
          } as unknown as StatsModel
        }
      />,
    ),
  );

describe("고정 지출 문장", () => {
  it("보통 값은 비율이 들어간 문장", () => {
    render(332_000);
    expect(container.textContent).toContain("지출의 33.2%가 고정이에요");
  });
  it("0.05% 미만이면 '미만이' 로 조사가 갈린다", () => {
    render(400); // 0.04%
    expect(container.textContent).toContain("지출의 0.1% 미만이 고정이에요");
    expect(container.textContent).not.toContain("미만가");
  });
});
