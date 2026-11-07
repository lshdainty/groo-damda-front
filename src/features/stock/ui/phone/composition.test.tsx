// 포트폴리오 구성 도넛은 ds Chart 다 — 자산 구성 도넛과 같은 길(Pie + chartDonutRadii · ChartDonutCenter, chart.md · I-wrap-b1 ε 8).
// 종전엔 옛 shared/ui/groo/charts 의 Donut(ui/chart 위 손 PieChart · 두께 20 고정 · 손 팔레트)이었다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) =>
      o?.count != null ? `${o.count}종목` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { CompositionBody } = await import("./composition");
const { setHiddenCardsLocal } =
  await import("@/shared/lib/groo/hide-amounts-core");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => setHiddenCardsLocal([]));
  act(() => root.unmount());
  container.remove();
});

describe("구성 도넛 (I-wrap-b1 ε 8)", () => {
  it("ds Chart 상자(role=img · 이름 · 범례 연결) + 가운데 종목 수, 옛 donut-wrap 이 없다", () => {
    act(() =>
      root.render(
        <CompositionBody
          data={{
            items: [
              { key: "A", name: "가나전자", pct: 60, krwValue: 123_456_789 },
              { key: "B", name: "다라바이오", pct: 40, krwValue: 82_304_526 },
            ],
          }}
        />,
      ),
    );
    const chart = container.querySelector<HTMLElement>("[role=img]");
    expect(chart).not.toBeNull();
    // 이름은 제목만 — 비중 · 금액은 범례(aria-describedby)가 읽는다(통계 도넛과 같다, I-wrap-b1 ε 검수 M2)
    expect(chart!.getAttribute("aria-label")).toBe("portfolio.title");
    const legend = container.querySelector("[data-slot=chart-donut-legend]");
    expect(chart!.getAttribute("aria-describedby")).toBe(legend?.id);
    expect(
      container.querySelector("[data-slot=chart-donut-center-amount]")
        ?.textContent,
    ).toBe("2종목");
    expect(container.querySelector(".donut-wrap")).toBeNull();
  });

  it("범례는 자산 구성과 같은 ds ChartDonutLegend — 색 칸 차트 색 순서(blue · green) · 비중 한 자리 · 평가액 원까지(자르지 않음)", () => {
    act(() =>
      root.render(
        <CompositionBody
          data={{
            items: [
              { key: "A", name: "가나전자", pct: 60, krwValue: 123_456_789 },
              { key: "B", name: "다라바이오", pct: 40, krwValue: 82_304_526 },
            ],
          }}
        />,
      ),
    );
    const rows = [
      ...container.querySelectorAll("[data-slot=chart-donut-legend-item]"),
    ];
    expect(rows).toHaveLength(2);
    const swatch = (r: Element) =>
      r.querySelector("[data-slot=chart-donut-swatch]")!.className;
    expect(swatch(rows[0]!)).toContain("blue");
    expect(swatch(rows[1]!)).toContain("green");
    const cell = (r: Element, slot: string) =>
      r.querySelector(`[data-slot=chart-donut-${slot}]`)!.textContent;
    expect(cell(rows[0]!, "label")).toBe("가나전자");
    expect(cell(rows[0]!, "percent")).toBe("60.0%");
    expect(cell(rows[0]!, "amount")).toMatch(/^123,456,789/);
    // 옛 손 범례(List 줄 · 인라인 색 칸)가 없다
    expect(container.querySelector("[data-slot=list-item]")).toBeNull();
  });

  it("금액 가리기를 켜면 화면 읽기 이름에도 비중 · 금액 숫자가 없다 — 범례도 가린다", () => {
    act(() => setHiddenCardsLocal(["stocks.summary"]));
    act(() =>
      root.render(
        <CompositionBody
          data={{
            items: [
              { key: "A", name: "가나전자", pct: 60, krwValue: 123_456_789 },
              { key: "B", name: "다라바이오", pct: 40, krwValue: 82_304_526 },
            ],
          }}
        />,
      ),
    );
    const label = container
      .querySelector("[role=img]")!
      .getAttribute("aria-label")!;
    expect(label).not.toMatch(/\d/);
    const legend = container.querySelector("[data-slot=chart-donut-legend]")!;
    expect(legend.textContent).not.toMatch(/60\.0%|123,456,789/);
  });

  it('종목이 10개를 넘으면 상위 9 + "기타" 하나(회색) — 가운데 종목 수는 전체(I-wrap-b1 ε 검수 L1)', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      key: `K${i}`,
      name: `종목${i + 1}`,
      pct: 12 - i,
      krwValue: (12 - i) * 1_000_000,
    }));
    act(() => root.render(<CompositionBody data={{ items }} />));
    const rows = [
      ...container.querySelectorAll("[data-slot=chart-donut-legend-item]"),
    ];
    expect(rows).toHaveLength(10);
    const last = rows[9]!;
    expect(
      last.querySelector("[data-slot=chart-donut-label]")!.textContent,
    ).toBe("others");
    expect(
      last.querySelector("[data-slot=chart-donut-swatch]")!.className,
    ).toContain("gray");
    // 그 밖 셋(3 + 2 + 1 백만)의 합
    expect(
      last.querySelector("[data-slot=chart-donut-amount]")!.textContent,
    ).toMatch(/^6,000,000/);
    const swatches = rows.map(
      (r) => r.querySelector("[data-slot=chart-donut-swatch]")!.className,
    );
    expect(swatches.filter((c) => c.includes("gray"))).toHaveLength(1);
    expect(
      container.querySelector("[data-slot=chart-donut-center-amount]")
        ?.textContent,
    ).toBe("12종목");
  });
});
