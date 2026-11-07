// 통계 도넛 비중 — 범례 · 표가 같은 소수 한 자리(B3 1A). 합이 0 이면 비중도 "0.0%".
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DonutChartBody } from "./stats-parts";
import type { StatsModel } from "./stats-model";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
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

const row = (rowId: number, amount: number) => ({
  rowId,
  name: `카테고리${rowId}`,
  amount,
  icon: null,
  color: null,
  hasChildren: false,
});
const model = (rows: ReturnType<typeof row>[]) =>
  ({
    donutView: rows,
    donutTotal: rows.reduce((a, r) => a + r.amount, 0),
    donutTotalLabel: "지출",
    periodLbl: "11월",
    isDrilled: false,
    setActiveParentId: () => {},
  }) as unknown as StatsModel;

describe("통계 도넛 비중", () => {
  it("범례 · 표가 같은 소수 한 자리", () => {
    act(() =>
      root.render(
        <DonutChartBody
          m={model([row(1, 3_320_000), row(2, 6_680_000)])}
          place="card"
          size={180}
          mask={(s) => s}
        />,
      ),
    );
    const legend = container.querySelector(
      "[data-slot=chart-donut-legend]",
    )!.textContent!;
    expect(legend).toContain("33.2%");
    expect(legend).toContain("66.8%");
    expect(
      Array.from(container.querySelectorAll("td")).map((c) => c.textContent),
    ).toContain("33.2%");
  });

  it("딱 떨어지는 값도 한 자리 — 30.0%", () => {
    act(() =>
      root.render(
        <DonutChartBody
          m={model([row(1, 300), row(2, 700)])}
          place="card"
          size={180}
          mask={(s) => s}
        />,
      ),
    );
    expect(container.textContent).toContain("30.0%");
    expect(container.textContent).toContain("70.0%");
  });

  it("합이 0 이면 0.0%", () => {
    act(() =>
      root.render(
        <DonutChartBody
          m={model([row(1, 0), row(2, 0)])}
          place="card"
          size={180}
          mask={(s) => s}
        />,
      ),
    );
    const cells = Array.from(container.querySelectorAll("td")).map(
      (c) => c.textContent,
    );
    expect(cells.filter((c) => c === "0.0%").length).toBeGreaterThan(0);
  });
});
