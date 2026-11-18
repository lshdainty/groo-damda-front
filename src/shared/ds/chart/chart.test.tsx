// Chart 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 색 배정 · 숫자 · 범례 · 툴팁 · 접근성 · 키보드 · 열지도(칸 폭 112 · 세기 단계 · 글자색) · 표로 보기를 잠근다.
import * as React from "react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Chart,
  ChartDataTable,
  ChartDonutCenter,
  ChartDonutLegend,
  ChartLegendTiles,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart";
import { ChartHeatmap } from "./chart-heatmap";
import { withSeriesDefaults } from "./chart-series";
import { chartXAxisProps } from "./chart-x-axis";
import { measureTickWidth } from "@/shared/lib/groo/axisWidth";
import {
  HEAT_CUTS,
  HEAT_MIX,
  HEAT_STEP_BG,
  HEAT_STEP_SWATCH,
  computeHeatTexts,
  heatStep,
} from "./chart-heatmap-variants";
import {
  ACTIVE_DOT,
  CHART_DRAW,
  CHART_HIDE_DOTS,
  CHART_MAX_ITEMS,
  CHART_ORDER,
  DONUT_ROW,
  DONUT_ROW_PRESSABLE,
  DOT_BG,
  LEGEND_TILE,
  LEGEND_TILE_HIDDEN,
  SERIES_DOT,
  SUBTLE_BG,
  TOOLTIP_SURFACE,
  assignChartColors,
  chartAxisProps,
  chartGridProps,
  chartXEndReserve,
  chartXTickFullLabels,
  chartXTickInterval,
  chartXTickLabels,
  formatAxisWon,
  type ChartXTick,
  formatWon,
  type ChartColor,
  chartDonutRadii,
  chartDonutThickness,
} from "./chart-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
/** 가짜 ResizeObserver 가 관찰 중인 요소 · 돌려줄 크기 — 콜백을 직접 부른다(jsdom 은 크기가 없다) */
let observers: { cb: (entries: unknown[]) => void; el: Element }[] = [];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  observers = [];
  globalThis.ResizeObserver = class {
    private cb: (entries: unknown[]) => void;
    constructor(cb: (entries: unknown[]) => void) {
      this.cb = cb;
    }
    observe(el: Element) {
      observers.push({ cb: this.cb, el });
    }
    unobserve() {}
    disconnect() {
      observers = observers.filter((o) => o.cb !== this.cb);
    }
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const render = (node: ReactNode) => act(() => root.render(node));

/** recharts 의 ResponsiveContainer 에 크기를 알린다 — jsdom 은 레이아웃이 없어 그냥은 0 × 0 이라 그리지 않는다 */
const layoutCharts = (width = 400, height = 200) =>
  act(() => {
    for (const o of observers) {
      if (o.el.classList.contains("recharts-responsive-container"))
        o.cb([{ target: o.el, contentRect: { width, height } }]);
    }
  });
const q = <T extends Element = HTMLElement>(sel: string) =>
  container.querySelector<T>(sel);
const qa = <T extends Element = HTMLElement>(sel: string) =>
  Array.from(container.querySelectorAll<T>(sel));
const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

/** 포인터 이벤트 — jsdom 의 MouseEvent 에 pointerType 을 붙인다 */
const pointer = (
  el: Element,
  type: string,
  pointerType: "mouse" | "touch" = "mouse",
  relatedTarget: Element | null = null,
) =>
  act(() => {
    const e = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      relatedTarget,
    });
    Object.defineProperty(e, "pointerType", { value: pointerType });
    el.dispatchEvent(e);
  });

const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  });

describe("색 배정 — assignChartColors", () => {
  const item = (name: string, saved?: ChartColor) => ({ name, saved });

  it("색이 없는 항목은 배정 순서(blue → green → orange …)로 받는다", () => {
    const out = assignChartColors([item("a"), item("b"), item("c")], {
      colorOf: (i) => i.saved,
    });
    expect(out.map((o) => o.color)).toEqual(["blue", "green", "orange"]);
    expect(out[0]!.fill).toBe("var(--color-chart-blue)");
  });

  it("저장된 색과 같은 색이 두 번 나오지 않는다 — 쓰지 않은 색부터", () => {
    // 7번째 순번 색(red)이 저장된 빨강(경조사)과 겹치지 않는다
    const items = [
      item("식비"),
      item("교통"),
      item("경조사", "red"),
      item("구독"),
      item("의료"),
      item("쇼핑"),
      item("문화"),
      item("여행"),
    ];
    const out = assignChartColors(items, { colorOf: (i) => i.saved });
    const colors = out.map((o) => o.color);
    expect(colors.filter((c) => c === "red")).toHaveLength(1);
    expect(colors[2]).toBe("red");
    expect(new Set(colors).size).toBe(colors.length);
    // 쓰지 않은 색은 배정 순서를 지킨다 — red 를 건너뛴다
    expect(colors).toEqual([
      "blue",
      "green",
      "red",
      "orange",
      "violet",
      "pink",
      "indigo",
      "yellow",
    ]);
  });

  it("색이 없다고 회색을 주지 않는다 — 회색은 기타 전용", () => {
    const out = assignChartColors(
      Array.from({ length: 9 }, (_, i) => item(`c${i}`)),
    );
    expect(out.some((o) => o.color === "gray")).toBe(false);
    expect(out.map((o) => o.color)).toEqual(CHART_ORDER);
  });

  it("10개를 넘으면 상위 9 + 회색 기타(groupOthers 가 만든 항목)", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      name: `c${i}`,
      amount: 100 - i,
    }));
    const groupOthers = vi.fn((rest: typeof items) => ({
      name: "기타",
      amount: rest.reduce((a, r) => a + r.amount, 0),
    }));
    const out = assignChartColors(items, { groupOthers });
    expect(out).toHaveLength(10);
    expect(groupOthers).toHaveBeenCalledTimes(1);
    expect(groupOthers.mock.calls[0]![0]).toHaveLength(3);
    const last = out[9]!;
    expect(last.name).toBe("기타");
    expect(last.color).toBe("gray");
    expect(last.fill).toBe("var(--color-chart-gray)");
    expect(out.slice(0, 9).every((o) => o.color !== "gray")).toBe(true);
  });

  it("딱 10개는 묶지 않는다(경계)", () => {
    const items = Array.from({ length: CHART_MAX_ITEMS }, (_, i) => ({
      name: `c${i}`,
    }));
    const out = assignChartColors(items);
    expect(out).toHaveLength(10);
    // 10번째는 쓰지 않은 색이 모자라 배정 순서를 다시 쓴다 — 회색은 아니다
    expect(out[9]!.color).not.toBe("gray");
  });

  it("빈 목록 · 하나", () => {
    expect(assignChartColors([])).toEqual([]);
    expect(assignChartColors([{ name: "a" }])[0]!.color).toBe("blue");
  });
});

describe("숫자 — formatAxisWon · formatWon", () => {
  /** 한 축의 눈금 글자 — 눈금 목록을 함께 넘긴다 */
  const axis = (ticks: number[]) => ticks.map((v) => formatAxisWon(v, ticks));

  it("한 축은 한 단위 — 가장 큰 절댓값이 1만 이상이면 모든 눈금이 만 단위(5,000 · 1만 섞임 없음)", () => {
    expect(axis([0, 5000, 10000, 15000])).toEqual([
      "0",
      "0.5만",
      "1만",
      "1.5만",
    ]);
    expect(axis([0, 10000, 20000, 30000])).toEqual(["0", "1만", "2만", "3만"]);
  });

  it("한 축은 한 단위 — 가장 큰 절댓값이 1만 미만이면 모든 눈금이 쉼표 정수", () => {
    expect(axis([0, 2500, 5000, 7500])).toEqual([
      "0",
      "2,500",
      "5,000",
      "7,500",
    ]);
    expect(axis([0, 2000, 4000, 6000, 8000])).toEqual([
      "0",
      "2,000",
      "4,000",
      "6,000",
      "8,000",
    ]);
  });

  it("가장 큰 절댓값은 음수 쪽도 본다 — 0 아래가 1만을 넘으면 0 위 눈금도 만 단위", () => {
    expect(axis([-10000, -5000, 0, 5000])).toEqual([
      "−1만",
      "−0.5만",
      "0",
      "0.5만",
    ]);
  });

  it("한 축은 한 단위 — 가장 큰 절댓값이 1억 이상이면 모든 눈금이 억 단위(5,000만 · 1억 섞임 없음)", () => {
    expect(axis([0, 50_000_000, 100_000_000, 150_000_000])).toEqual([
      "0",
      "0.5억",
      "1억",
      "1.5억",
    ]);
    expect(
      axis([0, 20_000_000, 40_000_000, 60_000_000, 80_000_000, 100_000_000]),
    ).toEqual(["0", "0.2억", "0.4억", "0.6억", "0.8억", "1억"]);
    // 1억 미만이면 만 단위 그대로
    expect(axis([-30_000_000, 0, 10_000_000])).toEqual([
      "−3,000만",
      "0",
      "1,000만",
    ]);
    // 조도 같은 셈
    expect(axis([0, 500_000_000_000, 1_000_000_000_000])).toEqual([
      "0",
      "0.5조",
      "1조",
    ]);
  });

  it("소수 한 자리(.0 은 버린다) · 값이 숫자가 아니면 빈 글", () => {
    expect(formatAxisWon(12000, [0, 12000])).toBe("1.2만");
    expect(formatAxisWon(123456789, [0, 123456789])).toBe("1.2억");
    expect(formatAxisWon(4000000, [0, 4000000])).toBe("400만");
    expect(formatAxisWon(Number.NaN, [0, 10000])).toBe("");
  });

  it("빼기는 U+2212 하나 — 음수 축 글자", () => {
    expect(formatAxisWon(-30000000, [-30000000, 0])).toBe("−3,000만");
    expect(formatAxisWon(-500, [-500, 0])).toBe("−500");
    expect(formatAxisWon(-30000000, [-30000000, 0])).not.toContain("-");
  });

  it("돈은 줄이지 않고 원까지 — 1억 넘는 금액도", () => {
    expect(formatWon(1240000)).toBe("1,240,000원");
    expect(formatWon(123456789)).toBe("123,456,789원");
    expect(formatWon(99999999999)).toBe("99,999,999,999원");
    expect(formatWon(0)).toBe("0원");
    expect(formatWon(35000.4)).toBe("35,000원");
  });

  it("음수 돈도 U+2212 — 같은 차트 안에서 - 와 − 를 섞지 않는다", () => {
    expect(formatWon(-26140000)).toBe("−26,140,000원");
    expect(formatWon(-26140000)).not.toContain("-");
  });
});

describe("축 · 격자 · 계열 기본값", () => {
  it("눈금 11(0.6875rem) · fg-neutral-subtle · 축 선 · 눈금 선 없음 · 눈금과 사이 8", () => {
    const p = chartAxisProps();
    // rem — 글자 크기 설정(200%)을 따른다. 0.6875rem = 11px(--text-t1)
    expect(p.tick.fontSize).toBe("0.6875rem");
    expect(p.tick.fill).toBe("var(--color-fg-neutral-subtle)");
    expect(p.axisLine).toBe(false);
    expect(p.tickLine).toBe(false);
    expect(p.tickMargin).toBe(8);
  });

  it("눈금 글자 사이 최소 8(spacing-x2) — recharts 기본 5 가 아니다(앱과 같다)", () => {
    expect(chartAxisProps().minTickGap).toBe(8);
    expect(chartAxisProps({ color: "red" }).minTickGap).toBe(8);
  });

  it("이중 축이면 눈금 글자가 그 계열의 색", () => {
    expect(chartAxisProps({ color: "blue" }).tick.fill).toBe(
      "var(--color-chart-blue)",
    );
    expect(chartAxisProps({ color: "red" }).tick.fill).toBe(
      "var(--color-chart-red)",
    );
  });

  it("격자는 가로 점선(3 · 3) stroke-neutral-subtle 만 — 세로 격자 없음", () => {
    expect(chartGridProps.vertical).toBe(false);
    expect(chartGridProps.strokeDasharray).toBe("3 3");
    expect(chartGridProps.stroke).toBe("var(--color-stroke-neutral-subtle)");
  });

  it("가리킨 점은 r 4 + 테두리 2(바깥 지름 10) · 카드 면 색 테두리", () => {
    // SVG 원의 지름은 r × 2 + 테두리 두께 — 4 × 2 + 2 = 10
    expect(ACTIVE_DOT.r * 2 + ACTIVE_DOT.strokeWidth).toBe(10);
    expect(ACTIVE_DOT.stroke).toBe("var(--color-bg-layer-default)");
  });

  it("그려짐은 300ms 한 번 — 모션을 강제로 켜지 않는다(isAnimationActive 를 주지 않는다 = 라이브러리 기본 auto)", () => {
    expect(CHART_DRAW.animationDuration).toBe(300);
    expect("isAnimationActive" in CHART_DRAW).toBe(false);
  });

  it("툴팁은 떠 있는 표면 — 테두리 없음 · 그림자 s3 · 모서리 12 · 위아래 10 · 좌우 12 · 최소 128", () => {
    expect(TOOLTIP_SURFACE).toContain("bg-bg-layer-floating");
    expect(TOOLTIP_SURFACE).toContain("shadow-[var(--shadow-s3)]");
    expect(TOOLTIP_SURFACE).toContain("rounded-r3");
    expect(TOOLTIP_SURFACE).toContain("px-x3");
    expect(TOOLTIP_SURFACE).toContain("py-x2_5");
    expect(TOOLTIP_SURFACE).toContain("min-w-[128px]");
    expect(TOOLTIP_SURFACE).not.toContain("border");
  });
});

const trendData = [
  { day: "1일", income: 100, expense: 50 },
  { day: "2일", income: 200, expense: 80 },
  { day: "3일", income: 150, expense: 20 },
];

describe("차트 상자 — 접근성 · 키보드", () => {
  const trend = (props: Partial<React.ComponentProps<typeof Chart>> = {}) => (
    <Chart label="10월 수입 · 지출 추이" height={200} {...props}>
      <AreaChart data={trendData}>
        <XAxis dataKey="day" />
        <Area dataKey="income" stroke="var(--color-chart-blue)" />
      </AreaChart>
    </Chart>
  );

  it("role=img + 요약 이름, 범례가 대체(aria-describedby)", async () => {
    await render(trend({ legendId: "legend-1" }));
    const box = q("[data-slot=chart]")!;
    expect(box.getAttribute("role")).toBe("img");
    expect(box.getAttribute("aria-label")).toBe("10월 수입 · 지출 추이");
    expect(box.getAttribute("aria-describedby")).toBe("legend-1");
    expect(box.style.height).toBe("200px");
  });

  it("라이브러리가 svg 에 다는 role=application · 이름 없는 tabindex 를 걷는다", async () => {
    await render(trend());
    await layoutCharts();
    const svgs = qa("svg.recharts-surface");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.hasAttribute("role")).toBe(false);
      expect(svg.hasAttribute("tabindex")).toBe(false);
    }
  });

  it("도넛 조각 묶음(g.recharts-pie)의 이름 없는 tabindex 도 걷는다(03E-004a)", async () => {
    await render(
      <Chart label="카테고리" height={160}>
        <PieChart>
          <Pie
            data={[{ v: 1 }, { v: 2 }]}
            dataKey="v"
            innerRadius={58}
            outerRadius={80}
          />
        </PieChart>
      </Chart>,
    );
    await layoutCharts(160, 160);
    expect(qa("svg.recharts-surface").length).toBeGreaterThan(0);
    expect(qa("svg.recharts-surface [tabindex]")).toHaveLength(0);
  });

  describe("도넛이 자리보다 클 때(Layout 지원 폭 — 320 보다 좁은 화면)", () => {
    // 자산 도넛 지름 180(두께 24) — 쓰는 쪽은 chartDonutRadii(180) 을 준다
    const donut = () => (
      <Chart label="카테고리" height={180}>
        <PieChart>
          <Pie
            data={[{ v: 1 }, { v: 2 }]}
            dataKey="v"
            isAnimationActive={false}
            {...chartDonutRadii(180)}
          />
        </PieChart>
        <ChartDonutCenter label="10월 지출" amount="1,240,000원" />
      </Chart>
    );
    /** 차트 상자(자리)의 폭을 알린다 — jsdom 은 레이아웃이 없다 */
    const slot = (width: number) =>
      act(() => {
        const box = q("[data-slot=chart]")!;
        for (const o of observers.filter((x) => x.el === box))
          o.cb([{ target: box, contentRect: { width, height: 180 } }]);
      });
    /** 그려진 조각의 바깥 반지름 — 조각 경로의 첫 호(A rx ry) */
    const drawnOuter = () => {
      const d = q(".recharts-pie-sector path")?.getAttribute("d") ?? "";
      const arc = /A\s*([\d.]+)/.exec(d);
      return arc ? Number(arc[1]) : null;
    };

    it("자리가 지름 이상(312 · 180)이면 준 값 그대로다 — 지름 180 · 상자 높이 180", async () => {
      await render(donut());
      for (const width of [312, 180]) {
        await slot(width);
        await layoutCharts(width, 180);
        const box = q("[data-slot=chart]")!;
        expect(box.hasAttribute("data-donut-fit")).toBe(false);
        expect(box.style.height).toBe("180px");
        expect(drawnOuter()).toBe(90);
      }
    });

    it("자리가 지름보다 좁으면(153) 자리 폭에 맞춰 지름을 줄이고 두께도 지름 ÷ 10 + 6 으로 다시 낸다", async () => {
      await render(donut());
      await slot(153.6);
      const box = q("[data-slot=chart]")!;
      expect(box.getAttribute("data-donut-fit")).toBe("");
      // 지름 153 — 상자 높이도 줄어든 만큼(180 → 153)
      expect(box.style.height).toBe("153px");
      await layoutCharts(153, 153);
      expect(drawnOuter()).toBe(76.5);
      expect(chartDonutRadii(153)).toEqual({
        innerRadius: 76.5 - 21,
        outerRadius: 76.5,
      });
      // 가운데 합계는 줄어든 구멍(지름 111)으로 잰다 — 글 묶음 대각선 절반 55 이하 − 여유
      const inner = q("[data-slot=chart-donut-center] > div")!;
      Object.defineProperty(inner, "scrollWidth", {
        configurable: true,
        value: 100,
      });
      Object.defineProperty(inner, "scrollHeight", {
        configurable: true,
        value: 40,
      });
      await act(() => {
        for (const o of observers.filter((x) => x.el === inner)) o.cb([]);
      });
      expect(q("[data-slot=chart-donut-center]")!.className).toContain(
        "invisible",
      );
      // 자리가 다시 넓어지면 준 값으로 돌아간다
      await slot(312);
      expect(box.hasAttribute("data-donut-fit")).toBe(false);
      expect(box.style.height).toBe("180px");
    });
  });

  it("데이터가 있으면 Tab 한 칸(tabindex 0), 비면 초점을 받지 않는다", async () => {
    await render(trend());
    expect(q("[data-slot=chart]")!.tabIndex).toBe(0);
    await render(
      <Chart label="빈 차트" height={200}>
        <AreaChart data={[]}>
          <Area dataKey="income" />
        </AreaChart>
      </Chart>,
    );
    expect(q("[data-slot=chart]")!.hasAttribute("tabindex")).toBe(false);
  });

  it("도넛은 날짜가 없어 초점을 받지 않는다(범례 목록이 대체)", async () => {
    await render(
      <Chart label="카테고리" height={160}>
        <PieChart>
          <Pie data={[{ v: 1 }]} dataKey="v" />
        </PieChart>
      </Chart>,
    );
    expect(q("[data-slot=chart]")!.hasAttribute("tabindex")).toBe(false);
  });

  it("← → 로 날짜를 옮기며 툴팁을 띄운다 — 처음엔 첫 날짜(focusin), 그다음은 키를 넘긴다", async () => {
    await render(trend());
    await layoutCharts();
    const box = q("[data-slot=chart]")!;
    const wrapper = q(".recharts-wrapper")!;
    const seen: string[] = [];
    wrapper.addEventListener("focusin", () => seen.push("focusin"));
    wrapper.addEventListener("keydown", (e) =>
      seen.push(`keydown:${(e as KeyboardEvent).key}`),
    );
    await key(box, "ArrowRight");
    await key(box, "ArrowRight");
    await key(box, "ArrowLeft");
    expect(seen).toEqual([
      "focusin",
      "keydown:ArrowRight",
      "keydown:ArrowLeft",
    ]);
  });

  it("Esc 로 툴팁을 닫는다(focusout) — 다시 누르면 닫기 전 자리에 띄운다(Enter)", async () => {
    await render(trend());
    await layoutCharts();
    const box = q("[data-slot=chart]")!;
    const wrapper = q(".recharts-wrapper")!;
    const seen: string[] = [];
    wrapper.addEventListener("focusout", () => seen.push("focusout"));
    wrapper.addEventListener("keydown", (e) =>
      seen.push(`keydown:${(e as KeyboardEvent).key}`),
    );
    await key(box, "ArrowRight");
    await key(box, "Escape");
    expect(seen).toContain("focusout");
    seen.length = 0;
    await key(box, "ArrowRight");
    expect(seen).toEqual(["keydown:Enter"]);
  });

  it("차트 상자를 떠나면(blur) 툴팁을 닫는다", async () => {
    await render(trend());
    await layoutCharts();
    const box = q("[data-slot=chart]")!;
    const wrapper = q(".recharts-wrapper")!;
    const seen: string[] = [];
    wrapper.addEventListener("focusout", () => seen.push("focusout"));
    await key(box, "ArrowRight");
    await act(() => {
      box.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    await act(() => {
      box.dispatchEvent(new FocusEvent("blur"));
    });
    expect(seen.length).toBeGreaterThan(0);
  });

  it("Esc 는 툴팁만 닫는다 — 바깥(대화상자)의 Esc 처리기까지 가지 않는다", async () => {
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    await render(trend());
    const box = q("[data-slot=chart]")!;
    await key(box, "ArrowRight");
    await key(box, "Escape");
    document.removeEventListener("keydown", outer);
    expect(outer).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: "Escape" }),
    );
  });

  it("Area 의 면은 같은 색 25% → 0% 세로 그라디언트(겹쳐도 아래 선이 보인다)", async () => {
    await render(trend());
    await layoutCharts();
    const stops = qa("linearGradient stop");
    expect(stops).toHaveLength(2);
    expect(stops[0]!.getAttribute("style")).toContain("0.25");
    expect(stops[1]!.getAttribute("style")).toContain("stop-opacity: 0");
  });

  it("계열 기본값 — Area · Line 선 2 · monotone · 점 없음 · 300ms, Bar 최대 28 · 위 모서리 4, Pie 조각 사이 0 · 12시에서 시계 방향", () => {
    const chart = (
      <AreaChart data={trendData}>
        <Area dataKey="a" stroke="var(--color-chart-blue)" />
        <Line dataKey="b" />
        <Bar dataKey="c" />
        <Pie dataKey="d" />
      </AreaChart>
    );
    const out = withSeriesDefaults(chart, "p");
    const kids = React.Children.toArray(
      out.props.children as React.ReactNode,
    ) as React.ReactElement<Record<string, unknown>>[];
    const [defs, area, line, bar, pie] = kids;
    expect(defs!.type).toBe("defs");
    expect(area!.props).toMatchObject({
      type: "monotone",
      strokeWidth: 2,
      dot: false,
      activeDot: ACTIVE_DOT,
      animationDuration: 300,
      animationEasing: "ease-out",
      fillOpacity: 1,
    });
    expect(String(area!.props.fill)).toMatch(/^url\(#p/);
    expect(line!.props).toMatchObject({
      type: "monotone",
      strokeWidth: 2,
      dot: false,
    });
    expect(bar!.props).toMatchObject({
      maxBarSize: 28,
      radius: [4, 4, 0, 0],
      animationDuration: 300,
    });
    expect(pie!.props).toMatchObject({
      paddingAngle: 0,
      stroke: "none",
      startAngle: 90,
      endAngle: -270,
    });
    // 모션을 강제로 켜지 않는다 — isAnimationActive 를 넣지 않는다(라이브러리 기본 auto = 모션 줄이기면 바로)
    for (const k of [area, line, bar, pie])
      expect("isAnimationActive" in k!.props).toBe(false);
  });

  it("쓰는 쪽이 준 값이 이긴다 — 막대 최대 폭 · 음수 막대 모서리 · 선 굵기 · 직접 준 면(fill)이면 그라디언트를 만들지 않는다", () => {
    const chart = (
      <BarChart data={trendData}>
        <Bar dataKey="c" maxBarSize={10} radius={[0, 0, 4, 4]} />
        <Area dataKey="a" stroke="red" strokeWidth={3} fill="blue" />
      </BarChart>
    );
    const out = withSeriesDefaults(chart, "p");
    const kids = React.Children.toArray(
      out.props.children as React.ReactNode,
    ) as React.ReactElement<Record<string, unknown>>[];
    expect(kids).toHaveLength(2); // 그라디언트 defs 없음
    expect(kids[0]!.props).toMatchObject({
      maxBarSize: 10,
      radius: [0, 0, 4, 4],
    });
    expect(kids[1]!.props).toMatchObject({ strokeWidth: 3, fill: "blue" });
  });

  it("늘 찍는 점(dots) — 켜면 Area · Line 이 값마다 계열 선 색 원(r 3 · 테두리 없음), 기본은 점 없음 · 쓰는 쪽이 준 dot 이 이긴다", () => {
    const chart = (
      <AreaChart data={trendData}>
        <Area dataKey="a" stroke="var(--color-chart-blue)" />
        <Line dataKey="b" stroke="var(--color-chart-red)" />
        <Line dataKey="c" stroke="red" dot={false} />
      </AreaChart>
    );
    const on = React.Children.toArray(
      withSeriesDefaults(chart, "p", { dots: true }).props
        .children as React.ReactNode,
    ) as React.ReactElement<Record<string, unknown>>[];
    const [, area, line, own] = on;
    // Area 의 점은 면(그라디언트)이 아니라 선 색으로 칠한다
    expect(area!.props.dot).toEqual({
      ...SERIES_DOT,
      fill: "var(--color-chart-blue)",
    });
    expect(SERIES_DOT).toEqual({ r: 3, strokeWidth: 0 });
    expect(line!.props.dot).toEqual({
      ...SERIES_DOT,
      fill: "var(--color-chart-red)",
    });
    expect(own!.props.dot).toBe(false);
    // 가리킨 점은 그대로 — 늘 찍는 점 위에 선다
    expect(area!.props.activeDot).toBe(ACTIVE_DOT);
    const off = React.Children.toArray(
      withSeriesDefaults(chart, "p").props.children as React.ReactNode,
    ) as React.ReactElement<Record<string, unknown>>[];
    expect(off[1]!.props.dot).toBe(false);
    expect(off[2]!.props.dot).toBe(false);
  });

  it("늘 찍는 점(dots) — 켠 차트는 값마다 점을 그리고 숨김 규칙을 걷는다, 끈 차트(기본)는 숨김 규칙을 단다", async () => {
    const chart = (dots?: boolean) => (
      <Chart label="추이" height={200} dots={dots}>
        <AreaChart data={trendData}>
          <Area dataKey="income" stroke="var(--color-chart-blue)" />
        </AreaChart>
      </Chart>
    );
    await render(chart(true));
    await layoutCharts();
    const box = q("[data-slot=chart]")!;
    expect(box.className).not.toContain("recharts-area-dots]:hidden");
    const dots = qa(".recharts-area-dots circle");
    expect(dots).toHaveLength(trendData.length);
    for (const d of dots) {
      expect(d.getAttribute("r")).toBe("3");
      expect(d.getAttribute("fill")).toBe("var(--color-chart-blue)");
    }
    await render(chart());
    await layoutCharts();
    expect(q("[data-slot=chart]")!.className).toContain(CHART_HIDE_DOTS);
    expect(qa(".recharts-area-dots circle")).toHaveLength(0);
  });

  it("막대 차트도 레이아웃이 잡히면 그려진다(막대 · 가리킴 선 구조가 깨지지 않는다)", async () => {
    await render(
      <Chart label="막대" height={200}>
        <BarChart data={trendData}>
          <Bar dataKey="income" />
        </BarChart>
      </Chart>,
    );
    await layoutCharts();
    expect(q("[data-slot=chart]")).not.toBeNull();
    expect(qa(".recharts-bar").length).toBeGreaterThan(0);
  });
});

describe("ChartTooltip · ChartTooltipContent", () => {
  const payload = [
    { name: "수입", value: 120000, dataKey: "income", color: "rgb(1, 2, 3)" },
    { name: "지출", value: 86400, dataKey: "expense", color: "rgb(4, 5, 6)" },
  ];

  it('머리 + "■ 라벨 값" 줄 — 값은 원까지(고정폭 숫자 · 700)', async () => {
    await render(
      <ChartTooltipContent active label="10월 8일 (목)" payload={payload} />,
    );
    expect(q("[data-slot=chart-tooltip-head]")!.textContent).toBe(
      "10월 8일 (목)",
    );
    const rows = qa("[data-slot=chart-tooltip-row]");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toBe("수입120,000원");
    expect(rows[1]!.textContent).toBe("지출86,400원");
    const value = rows[0]!.querySelector("[data-slot=chart-tooltip-value]")!;
    expect(value.className).toContain("font-bold");
    expect(value.className).toContain("tabular-nums");
    // 값은 오른쪽, 라벨과 12 이상
    expect(value.className).toContain("ml-auto");
    expect(value.className).toContain("pl-x3");
  });

  it("색 네모는 계열 색 — 도넛 조각은 그 조각의 fill", async () => {
    await render(
      <ChartTooltipContent
        active
        payload={[
          { name: "식비", value: 5, payload: { fill: "rgb(9, 9, 9)" } },
        ]}
      />,
    );
    const swatch = q("[data-slot=chart-tooltip-swatch]")!;
    expect(swatch.style.background).toBe("rgb(9, 9, 9)");
    expect(swatch.className).toContain("size-[8px]");
    expect(swatch.className).toContain("rounded-[2px]");
  });

  it("머리 · 값 가공자 — headFormatter · valueFormatter", async () => {
    await render(
      <ChartTooltipContent
        active
        label="8"
        payload={payload}
        headFormatter={(l) => `10월 ${String(l)}일`}
        valueFormatter={(v, k) => `${k}:${v}`}
      />,
    );
    expect(q("[data-slot=chart-tooltip-head]")!.textContent).toBe("10월 8일");
    expect(
      qa("[data-slot=chart-tooltip-value]").map((e) => e.textContent),
    ).toEqual(["income:120000", "expense:86400"]);
  });

  it("보조 기술에는 숨긴다(aria-hidden) — 같은 값은 범례 · 표로 보기가 준다", async () => {
    await render(<ChartTooltipContent active payload={payload} />);
    expect(q("[data-slot=chart-tooltip]")!.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("가리키지 않거나 값이 없으면 그리지 않는다", async () => {
    await render(<ChartTooltipContent active={false} payload={payload} />);
    expect(q("[data-slot=chart-tooltip]")).toBeNull();
    await render(<ChartTooltipContent active payload={[]} />);
    expect(q("[data-slot=chart-tooltip]")).toBeNull();
    await render(
      <ChartTooltipContent
        active
        payload={[{ name: "수입", value: null, dataKey: "income" }]}
      />,
    );
    expect(q("[data-slot=chart-tooltip]")).toBeNull();
  });

  it('음수 값도 U+2212, 값 0 은 "0원"', async () => {
    await render(
      <ChartTooltipContent
        active
        payload={[
          { name: "순자산", value: -26140000, dataKey: "a" },
          { name: "수입", value: 0, dataKey: "b" },
        ]}
      />,
    );
    expect(
      qa("[data-slot=chart-tooltip-value]").map((e) => e.textContent),
    ).toEqual(["−26,140,000원", "0원"]);
  });

  it("ChartTooltip 은 가리킴 선 · 떠 있는 내용 · 상자 안 겹침(1)을 기본으로 단다", () => {
    const el = ChartTooltip({}) as React.ReactElement<Record<string, unknown>>;
    expect(el.props.offset).toBe(12);
    expect(el.props.wrapperStyle).toEqual({ zIndex: 1, outline: "none" });
    expect(React.isValidElement(el.props.cursor)).toBe(true);
    expect(React.isValidElement(el.props.content)).toBe(true);
  });
});

describe("ChartLegendTiles — 지표 타일", () => {
  it("타일은 폭 100 과 내용의 최소 폭 중 큰 값 — 큰 글자에서 금액이 타일 밖으로 나가지 않는다", async () => {
    await render(
      <ChartLegendTiles
        items={[
          { key: "a", label: "수입", color: "blue", total: "1,234,567,890원" },
        ]}
      />,
    );
    const tile = q("[data-slot=chart-legend-tile]")!;
    expect(tile.className).toContain("min-w-[max(100px,min-content)]");
    expect(q("[data-slot=chart-legend-total]")!.innerHTML).toBe(
      "1,<wbr>234,<wbr>567,<wbr>890원",
    );
  });

  const items = [
    {
      key: "income",
      label: "수입",
      color: "blue" as const,
      total: "4,200,000원",
    },
    {
      key: "expense",
      label: "지출",
      color: "red" as const,
      total: "1,240,000원",
    },
  ];

  it("묶음은 role=group + 이름, 타일은 aria-pressed 버튼 — 점 + 이름 + 합계", async () => {
    await render(<ChartLegendTiles id="legend" items={items} />);
    const group = q("[data-slot=chart-legend-tiles]")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("범례");
    const tiles = qa<HTMLButtonElement>("[data-slot=chart-legend-tile]");
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.type === "button")).toBe(true);
    expect(tiles.map((t) => t.getAttribute("aria-pressed"))).toEqual([
      "true",
      "true",
    ]);
    expect(tiles[0]!.textContent).toBe("수입4,200,000원");
    // 대체 글의 id 는 안쪽 목록 — 차트의 설명이 "수입 … 지출 …" 이 된다
    expect(q("#legend")!.contains(tiles[0]!)).toBe(true);
  });

  it("켠 계열은 그 색의 옅은 바탕, 끈 계열은 흰 면 + 안쪽 1px 테두리(호버에만 누름 바탕)", async () => {
    await render(
      <ChartLegendTiles items={items} hidden={new Set(["expense"])} />,
    );
    const [income, expense] = qa("[data-slot=chart-legend-tile]");
    expect(income!.className).toContain(SUBTLE_BG.blue);
    expect(income!.className).not.toContain("inset_0_0_0_1px");
    expect(expense!.className).toContain("bg-bg-layer-default");
    expect(expense!.className).toContain(
      "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
    );
    expect(expense!.className).toContain("hover:bg-bg-layer-default-pressed");
    expect(expense!.className).not.toContain(SUBTLE_BG.red);
    expect(expense!.getAttribute("aria-pressed")).toBe("false");
  });

  it("누르면 그 계열을 끄고 켠다 — onHiddenChange 에 새 집합", async () => {
    const onHiddenChange = vi.fn();
    await render(
      <ChartLegendTiles items={items} onHiddenChange={onHiddenChange} />,
    );
    await click(qa("[data-slot=chart-legend-tile]")[1]!);
    expect([...(onHiddenChange.mock.calls[0]![0] as Set<string>)]).toEqual([
      "expense",
    ]);
    await render(
      <ChartLegendTiles
        items={items}
        hidden={new Set(["expense"])}
        onHiddenChange={onHiddenChange}
      />,
    );
    await click(qa("[data-slot=chart-legend-tile]")[1]!);
    expect([...(onHiddenChange.mock.calls[1]![0] as Set<string>)]).toEqual([]);
  });

  it("마지막 하나는 끌 수 없다 — aria-disabled, 눌러도 알리지 않는다", async () => {
    const onHiddenChange = vi.fn();
    await render(
      <ChartLegendTiles
        items={items}
        hidden={new Set(["expense"])}
        onHiddenChange={onHiddenChange}
      />,
    );
    const income = qa("[data-slot=chart-legend-tile]")[0]!;
    expect(income.getAttribute("aria-disabled")).toBe("true");
    await click(income);
    expect(onHiddenChange).not.toHaveBeenCalled();
  });

  it("키보드(Enter · Space)는 버튼의 기본 동작 — 타일은 <button> 이다", async () => {
    await render(<ChartLegendTiles items={items} />);
    expect(
      qa("[data-slot=chart-legend-tile]").every((t) => t.tagName === "BUTTON"),
    ).toBe(true);
  });

  it("모양 클래스 — 폭 100 이상 · 모서리 12 · 위아래 10 · 좌우 12 · 누르면 2px 축소(모션 줄이기면 안 함) · 키보드 포커스에만 바깥 링", () => {
    expect(LEGEND_TILE).toContain("min-w-[max(100px,min-content)]");
    expect(LEGEND_TILE).toContain("rounded-r3");
    expect(LEGEND_TILE).toContain("px-x3");
    expect(LEGEND_TILE).toContain("py-x2_5");
    expect(LEGEND_TILE).toContain(
      "active:[scale:calc(1-2/var(--press-basis))]",
    );
    expect(LEGEND_TILE).toContain("motion-reduce:active:[scale:1]");
    expect(LEGEND_TILE).toContain("focus-visible:outline-2");
    expect(LEGEND_TILE).toContain("focus-visible:outline-offset-2");
    expect(LEGEND_TILE).toContain("focus-visible:outline-stroke-focus-ring");
    expect(LEGEND_TILE_HIDDEN).toContain("hover:bg-bg-layer-default-pressed");
  });

  it("색 10 — 점 · 옅은 바탕 클래스가 열마다 있다", () => {
    const colors: ChartColor[] = [
      "blue",
      "green",
      "orange",
      "violet",
      "pink",
      "indigo",
      "red",
      "yellow",
      "brown",
      "gray",
    ];
    for (const c of colors) {
      expect(DOT_BG[c]).toBe(`bg-chart-${c}`);
      expect(SUBTLE_BG[c]).toBe(`bg-chart-${c}-subtle`);
    }
  });
});

describe("ChartDonutLegend · ChartDonutCenter", () => {
  const items = [
    {
      key: "food",
      label: "식비",
      color: "orange" as const,
      percent: "41%",
      amount: "384,400원",
      onClick: vi.fn(),
    },
    {
      key: "sub",
      label: "구독",
      color: "yellow" as const,
      percent: "10%",
      amount: "96,000원",
    },
  ];

  it("목록(ul) — 색 네모 + 이름 + % + 금액(원까지)", async () => {
    await render(<ChartDonutLegend items={items} />);
    expect(q("ul")!.getAttribute("role")).toBe("list");
    const rows = qa("[data-slot=chart-donut-row]");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toBe("식비41%384,400원");
  });

  it("큰 글자 — 줄(li)이 컨테이너이고 줄 안 폭 16rem 미만이면 % · 금액이 이름 아래 왼쪽(List 와 같은 문턱)", async () => {
    await render(<ChartDonutLegend items={items} />);
    const li = q("[data-slot=chart-donut-legend-item]")!;
    expect(li.className).toContain("@container/donut");
    const row = q("[data-slot=chart-donut-row]")!;
    expect(row.className).toContain("@max-[16rem]/donut:grid");
    expect(q("[data-slot=chart-donut-label]")!.className).toContain(
      "@max-[16rem]/donut:col-span-2",
    );
    expect(q("[data-slot=chart-donut-percent]")!.className).toContain(
      "@max-[16rem]/donut:row-start-2",
    );
    expect(q("[data-slot=chart-donut-amount]")!.className).toContain(
      "@max-[16rem]/donut:col-start-3",
    );
  });

  it("금액은 쉼표 뒤에서만 줄을 바꾼다", async () => {
    await render(
      <ChartDonutLegend
        items={[{ ...items[1]!, amount: "1,234,567,890원" }]}
      />,
    );
    expect(q("[data-slot=chart-donut-amount]")!.innerHTML).toBe(
      "1,<wbr>234,<wbr>567,<wbr>890원",
    );
  });

  it("하위가 있는 줄(onClick)만 누르는 줄 — 버튼, 나머지는 글", async () => {
    await render(<ChartDonutLegend items={items} />);
    const [food, sub] = qa("[data-slot=chart-donut-row]");
    expect(food!.tagName).toBe("BUTTON");
    expect(sub!.tagName).toBe("DIV");
    await click(food!);
    expect(items[0]!.onClick).toHaveBeenCalledTimes(1);
  });

  it("누르는 줄은 카드 끝까지 내고 안쪽 6 알약에 호버 · 누름 바탕, 키보드 포커스에만 안쪽 링", () => {
    expect(DONUT_ROW).toContain("min-h-[44px]");
    expect(DONUT_ROW).toContain("text-t4");
    expect(DONUT_ROW).toContain("gap-x2");
    expect(DONUT_ROW_PRESSABLE).toContain("-mx-x6");
    expect(DONUT_ROW_PRESSABLE).toContain("px-x6");
    expect(DONUT_ROW_PRESSABLE).toContain("focus-visible:-outline-offset-2");
  });

  it('누르는 줄만 알약 요소가 있고, 금액에 "원" 이 붙는다', async () => {
    await render(<ChartDonutLegend items={items} />);
    expect(qa("[data-slot=chart-donut-pill]")).toHaveLength(1);
    expect(
      qa("[data-slot=chart-donut-amount]").every((e) =>
        e.textContent!.endsWith("원"),
      ),
    ).toBe(true);
  });

  it("도넛 두께는 지름 ÷ 10 + 6(정수) — 120 → 18 · 160 → 22 · 180 → 24, 반지름은 지름 ÷ 2 에서 두께를 뺀다(Q-012-5)", () => {
    expect(chartDonutThickness(120)).toBe(18);
    expect(chartDonutThickness(160)).toBe(22);
    expect(chartDonutThickness(180)).toBe(24);
    expect(chartDonutRadii(160)).toEqual({ innerRadius: 58, outerRadius: 80 });
    expect(chartDonutRadii(120)).toEqual({ innerRadius: 42, outerRadius: 60 });
  });

  const withCenter = (
    amount: string,
    onFitChange?: (fits: boolean) => void,
  ) => (
    <Chart label="카테고리" height={160}>
      <PieChart>
        <Pie data={[{ v: 1 }]} dataKey="v" innerRadius={58} outerRadius={80} />
      </PieChart>
      <ChartDonutCenter
        label="10월 지출"
        amount={amount}
        onFitChange={onFitChange}
      />
    </Chart>
  );

  /** 가운데 글 묶음의 크기를 정해 두고 ResizeObserver 콜백을 부른다 */
  const measureCenter = async (w: number, h: number) => {
    const inner = q("[data-slot=chart-donut-center] > div")!;
    Object.defineProperty(inner, "scrollWidth", {
      configurable: true,
      value: w,
    });
    Object.defineProperty(inner, "scrollHeight", {
      configurable: true,
      value: h,
    });
    await act(() => {
      for (const o of observers.filter((x) => x.el === inner)) o.cb([]);
    });
  };

  it("구멍에 들어가면 가운데에 합계를 그리고 줄이지 않는다(원까지)", async () => {
    const onFit = vi.fn();
    await render(withCenter("1,240,000원", onFit));
    await measureCenter(80, 40);
    const center = q("[data-slot=chart-donut-center]")!;
    expect(center.getAttribute("data-fits")).toBe("true");
    expect(center.className).not.toContain("invisible");
    expect(q("[data-slot=chart-donut-center-amount]")!.textContent).toBe(
      "1,240,000원",
    );
    expect(onFit).not.toHaveBeenCalled();
    expect(center.getAttribute("aria-hidden")).toBe("true");
  });

  it("들어가지 않으면 가운데 글을 그리지 않고 onFitChange(false) — 쓰는 쪽이 목록 위에 합계를 둔다", async () => {
    const onFit = vi.fn();
    await render(withCenter("123,456,789,012원", onFit));
    await measureCenter(180, 40);
    const center = q("[data-slot=chart-donut-center]")!;
    expect(center.className).toContain("invisible");
    expect(onFit).toHaveBeenCalledWith(false);
    // 글은 "1.2조" 로 줄이지 않는다
    expect(q("[data-slot=chart-donut-center-amount]")!.textContent).toBe(
      "123,456,789,012원",
    );
    // 다시 들어가면 알린다
    await measureCenter(80, 40);
    expect(onFit).toHaveBeenLastCalledWith(true);
  });
});

describe("열지도 — 세기 단계", () => {
  it("값 → 단계 경계(가장 큰 값의 8 · 22 · 45 · 75%)", () => {
    expect(HEAT_CUTS).toEqual([0.08, 0.22, 0.45, 0.75]);
    // 넷째 단계 섞음은 76% 다(2026-10-22 결정 B) — 끊는 자리 75% 는 그대로
    expect(HEAT_MIX).toEqual([0.18, 0.35, 0.55, 0.76, 1]);
    expect(heatStep(7, 100)).toBe(0);
    expect(heatStep(8, 100)).toBe(1);
    expect(heatStep(21, 100)).toBe(1);
    expect(heatStep(22, 100)).toBe(2);
    expect(heatStep(44, 100)).toBe(2);
    expect(heatStep(45, 100)).toBe(3);
    expect(heatStep(74, 100)).toBe(3);
    expect(heatStep(75, 100)).toBe(4);
    expect(heatStep(100, 100)).toBe(4);
  });

  it("값이 없으면(0 · null · undefined · 음수 · 가장 큰 값 0) 단계가 없다(-1)", () => {
    for (const v of [0, null, undefined, -5]) expect(heatStep(v, 100)).toBe(-1);
    expect(heatStep(5, 0)).toBe(-1);
  });

  it("단계마다 바탕 — 브랜드 채움을 카드 면에 18 · 35 · 55 · 76 · 100% 섞는다", () => {
    expect(HEAT_STEP_BG).toHaveLength(5);
    for (const [i, pct] of [18, 35, 55, 76].entries()) {
      expect(HEAT_STEP_BG[i]).toContain(`_${pct}%,`);
      expect(HEAT_STEP_SWATCH[i]).toContain(` ${pct}%,`);
    }
    expect(HEAT_STEP_BG[4]).toBe("bg-bg-brand-solid");
    expect(HEAT_STEP_SWATCH[4]).toBe("var(--color-bg-brand-solid)");
  });
});

describe("열지도 — 단계마다 글자색(4.5:1)", () => {
  /** 색 이름 → rgb — getComputedStyle 을 흉내 낸다(jsdom 은 var() 를 풀지 못한다) */
  const stub = (colors: Record<string, string>) => {
    vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => {
      const value = (el as HTMLElement).style?.color ?? "";
      const name = /--color-([a-z-]+)/.exec(value)?.[1] ?? "";
      return { color: colors[name] ?? "" } as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle);
  };

  it("넷째 단계(76%) 위 흰 글자 대비 — Desk 라이트 4.74, 4.5 를 넘는다(75% 는 4.63)", () => {
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lum = (rgb: number[]) =>
      0.2126 * lin(rgb[0]!) + 0.7152 * lin(rgb[1]!) + 0.0722 * lin(rgb[2]!);
    const brand = [1, 71, 173]; // Desk 라이트 bg-brand-solid
    const white = [255, 255, 255];
    const ratioAt = (p: number) => {
      const mix = brand.map((b, k) => p * b + (1 - p) * white[k]!);
      return (lum(white) + 0.05) / (lum(mix) + 0.05);
    };
    expect(ratioAt(HEAT_MIX[3])).toBeCloseTo(4.74, 2);
    expect(ratioAt(HEAT_MIX[3])).toBeGreaterThan(4.5);
    expect(ratioAt(0.75)).toBeLessThan(4.7);
  });

  it("Desk 라이트 — 18 · 35 · 55% 는 fg-neutral, 76 · 100% 는 흰 글자", () => {
    stub({
      "bg-brand-solid": "rgb(1, 71, 173)",
      "bg-layer-default": "rgb(255, 255, 255)",
      "fg-neutral": "rgb(26, 31, 46)",
      "static-white": "rgb(255, 255, 255)",
    });
    expect(computeHeatTexts(document.body)).toEqual([
      "neutral",
      "neutral",
      "neutral",
      "white",
      "white",
    ]);
  });

  it("다크 — 모두 fg-neutral", () => {
    stub({
      "bg-brand-solid": "rgb(16, 73, 164)",
      "bg-layer-default": "rgb(36, 41, 56)",
      "fg-neutral": "rgb(245, 246, 250)",
      "static-white": "rgb(255, 255, 255)",
    });
    expect(computeHeatTexts(document.body)).toEqual([
      "neutral",
      "neutral",
      "neutral",
      "neutral",
      "neutral",
    ]);
  });

  it("색을 읽지 못하면 정하지 않는다(null) — 기본 fg-neutral 이 남는다", () => {
    stub({});
    expect(computeHeatTexts(document.body)).toBeNull();
  });
});

describe("ChartHeatmap", () => {
  const rows = [
    { key: "am", label: "오전", sub: "6~12시" },
    { key: "eve", label: "저녁", sub: "18~22시" },
  ];
  const columns = [
    { key: "mon", label: "월" },
    { key: "wed", label: "수" },
    { key: "sat", label: "토" },
  ];
  const values = [
    [0, 10000, null],
    [35000, 12000, 340000],
  ];

  const heat = (
    props: Partial<React.ComponentProps<typeof ChartHeatmap>> = {},
  ) => (
    <ChartHeatmap
      label="10월 요일 · 시간대별 지출, 가장 많은 때 토요일 저녁"
      rows={rows}
      columns={columns}
      values={values}
      tooltipLabel={(r, c) => `${c.label}요일 ${r.label} ${r.sub}`}
      {...props}
    />
  );

  /** 첫 칸 폭을 정해 ResizeObserver 콜백을 부른다 */
  const setCellWidth = async (w: number) => {
    const first = q("[data-slot=chart-heatmap-cell]")!;
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue({
      width: w,
      height: w,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: w,
      bottom: w,
      toJSON() {},
    });
    await act(() => {
      for (const o of observers.filter((x) => x.el === first)) o.cb([]);
    });
  };

  it("role=img + 요약 이름 · Tab 한 칸 · 칸 · 머리는 보조 기술에 숨긴다(값은 툴팁 · 표로 보기)", async () => {
    await render(heat());
    const box = q("[data-slot=chart-heatmap]")!;
    expect(box.getAttribute("role")).toBe("img");
    expect(box.getAttribute("aria-label")).toBe(
      "10월 요일 · 시간대별 지출, 가장 많은 때 토요일 저녁",
    );
    expect(box.tabIndex).toBe(0);
    for (const cell of qa("[data-slot=chart-heatmap-cell]"))
      expect(cell.getAttribute("aria-hidden")).toBe("true");
  });

  it("왼쪽 시간대 라벨 열 56 + 요일 칸 — 격자, 칸은 정사각형 · 모서리 4 · 사이 6", async () => {
    await render(heat());
    const box = q("[data-slot=chart-heatmap]")!;
    expect(box.style.gridTemplateColumns).toBe(
      "56px repeat(3, minmax(0, 1fr))",
    );
    expect(box.className).toContain("gap-x1_5");
    const cell = q("[data-slot=chart-heatmap-cell]")!;
    expect(cell.className).toContain("aspect-square");
    expect(cell.className).toContain("rounded-r1");
    expect(qa("[data-slot=chart-heatmap-cell]")).toHaveLength(6);
  });

  it("세기 단계가 칸에 붙고 값이 없는 칸은 bg-neutral-weak", async () => {
    await render(heat());
    const cells = qa("[data-slot=chart-heatmap-cell]");
    // 가장 큰 값 340,000 → 토 저녁 단계 4 · 35,000(10%) 1 · 12,000(3.5%) 0
    expect(cells.map((c) => c.getAttribute("data-step"))).toEqual([
      "-1",
      "0",
      "-1",
      "1",
      "0",
      "4",
    ]);
    expect(cells[0]!.className).toContain("bg-bg-neutral-weak");
    expect(cells[5]!.className).toContain("bg-bg-brand-solid");
  });

  it("가장 큰 칸에 고리를 두르지 않는다 — 키보드로 오기 전에는 outline 이 없다", async () => {
    await render(heat());
    for (const cell of qa("[data-slot=chart-heatmap-cell]"))
      expect(cell.className).not.toContain("outline");
  });

  it('칸 폭 112 이상이면 원까지("35,000원") · 빈 칸은 "—", 좁으면 글 없이 색만', async () => {
    await render(heat());
    await setCellWidth(111);
    expect(
      qa("[data-slot=chart-heatmap-cell]").every((c) => c.textContent === ""),
    ).toBe(true);
    await setCellWidth(112);
    const texts = qa("[data-slot=chart-heatmap-cell]").map(
      (c) => c.textContent,
    );
    expect(texts).toEqual([
      "—",
      "10,000원",
      "—",
      "35,000원",
      "12,000원",
      "340,000원",
    ]);
    // 다시 좁아지면 글을 감춘다(글자 크기는 그대로)
    await setCellWidth(81);
    expect(
      qa("[data-slot=chart-heatmap-cell]").every((c) => c.textContent === ""),
    ).toBe(true);
  });

  it("돈을 줄여 쓰지 않는다 — 1억 넘는 금액 · 999억도 원까지, 글자를 줄여 맞추지 않는다", async () => {
    await render(
      heat({
        values: [
          [123456789, 99999999999, 1],
          [null, 0, 70000000000],
        ],
      }),
    );
    await setCellWidth(120);
    const texts = qa("[data-slot=chart-heatmap-cell]").map(
      (c) => c.textContent,
    );
    expect(texts).toEqual([
      "123,456,789원",
      "99,999,999,999원",
      "1원",
      "—",
      "—",
      "70,000,000,000원",
    ]);
    expect(texts.join("")).not.toMatch(/억|만(?!원)/);
    const cell = q("[data-slot=chart-heatmap-cell]")!;
    expect(cell.className).toContain("text-t1");
    expect(cell.className).toContain("font-bold");
    expect(cell.className).toContain("tabular-nums");
    expect(cell.className).toContain("whitespace-nowrap");
    expect(cell.className).not.toMatch(/text-\[\d/);
  });

  it("textMinCellWidth · formatValue 를 바꿀 수 있다", async () => {
    await render(
      heat({ textMinCellWidth: 40, formatValue: (v) => `${v / 1000}천` }),
    );
    await setCellWidth(44);
    expect(qa("[data-slot=chart-heatmap-cell]")[3]!.textContent).toBe("35천");
  });

  it("칸 글자색은 단계마다 CSS 변수(--heat-text-N)로 — 정하기 전에는 fg-neutral", async () => {
    await render(heat());
    const cells = qa("[data-slot=chart-heatmap-cell]");
    expect(cells[5]!.className).toContain(
      "var(--heat-text-4,var(--color-fg-neutral))",
    );
    expect(cells[1]!.className).toContain(
      "var(--heat-text-0,var(--color-fg-neutral))",
    );
    // 빈 칸의 "—" 는 fg-neutral-subtle
    expect(cells[0]!.className).toContain("text-fg-neutral-subtle");
  });

  it('툴팁 — 마우스를 올리면 "월요일 오전 6~12시" · "■ 지출 35,000원"(네모는 그 칸의 세기 색), 벗어나면 닫힌다', async () => {
    await render(heat());
    const cell = qa("[data-slot=chart-heatmap-cell]")[3]!;
    await pointer(cell, "pointermove");
    const tip = document.querySelector("[data-slot=chart-heatmap-tooltip]")!;
    expect(tip).not.toBeNull();
    expect(tip.getAttribute("aria-hidden")).toBe("true");
    expect(
      tip.querySelector("[data-slot=chart-tooltip-head]")!.textContent,
    ).toBe("월요일 저녁 18~22시");
    expect(
      tip.querySelector("[data-slot=chart-tooltip-row]")!.textContent,
    ).toBe("지출35,000원");
    expect(
      (tip.querySelector("[data-slot=chart-tooltip-swatch]") as HTMLElement)
        .style.background,
    ).toContain("color-mix");
    // 떠 있는 층 — z-floating
    expect(tip.className).toContain("z-(--z-floating)");
    await pointer(cell, "pointerout", "mouse", document.body);
    expect(
      document.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).toBeNull();
  });

  it("글이 보이는 넓은 칸에서도 툴팁이 뜬다", async () => {
    await render(heat());
    await setCellWidth(140);
    await pointer(qa("[data-slot=chart-heatmap-cell]")[5]!, "pointermove");
    expect(
      document.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).not.toBeNull();
  });

  it('값이 없는 칸의 툴팁은 "없음", 줄 이름은 valueLabel', async () => {
    await render(heat({ valueLabel: "수입" }));
    await pointer(qa("[data-slot=chart-heatmap-cell]")[0]!, "pointermove");
    expect(
      document.querySelector(
        "[data-slot=chart-heatmap-tooltip] [data-slot=chart-tooltip-row]",
      )!.textContent,
    ).toBe("수입없음");
  });

  it("터치로 누르면 손을 떼도 남고, 다른 곳을 누르면 닫힌다 · 다른 칸을 누르면 옮긴다", async () => {
    await render(heat());
    const cells = qa("[data-slot=chart-heatmap-cell]");
    await pointer(cells[3]!, "pointerdown", "touch");
    await pointer(cells[3]!, "pointerout", "touch", document.body);
    expect(
      document.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).not.toBeNull();
    await pointer(cells[5]!, "pointerdown", "touch");
    expect(
      document.querySelector(
        "[data-slot=chart-heatmap-tooltip] [data-slot=chart-tooltip-row]",
      )!.textContent,
    ).toBe("지출340,000원");
    await pointer(document.body, "pointerdown", "touch");
    expect(
      document.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).toBeNull();
  });

  it("키보드 — 처음 누르면 첫 칸, ← → 요일 · ↑ ↓ 시간대(끝에서 멈춘다), 지금 칸에 바깥 링, Esc 로 닫는다", async () => {
    await render(heat());
    const box = q("[data-slot=chart-heatmap]")!;
    const head = () =>
      document.querySelector(
        "[data-slot=chart-heatmap-tooltip] [data-slot=chart-tooltip-head]",
      )?.textContent;
    await key(box, "ArrowRight");
    expect(head()).toBe("월요일 오전 6~12시");
    await key(box, "ArrowRight");
    expect(head()).toBe("수요일 오전 6~12시");
    await key(box, "ArrowDown");
    expect(head()).toBe("수요일 저녁 18~22시");
    await key(box, "ArrowDown"); // 끝에서 멈춘다
    expect(head()).toBe("수요일 저녁 18~22시");
    await key(box, "ArrowLeft");
    await key(box, "ArrowLeft"); // 끝에서 멈춘다
    expect(head()).toBe("월요일 저녁 18~22시");
    const ring = qa("[data-slot=chart-heatmap-cell]").filter(
      (c) => c.getAttribute("data-active") === "keyboard",
    );
    expect(ring).toHaveLength(1);
    expect(ring[0]!.className).toContain("outline-2");
    expect(ring[0]!.className).toContain("outline-offset-2");
    await key(box, "ArrowUp");
    expect(head()).toBe("월요일 오전 6~12시");
    await key(box, "Escape");
    expect(head()).toBeUndefined();
  });

  it("상자를 떠나면(blur) 키보드 툴팁이 닫힌다", async () => {
    await render(heat());
    const box = q("[data-slot=chart-heatmap]")!;
    await key(box, "ArrowRight");
    expect(
      document.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).not.toBeNull();
    await act(() => {
      box.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    // React 의 onBlur 는 focusout 으로 받는다
    expect(
      document.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).toBeNull();
  });

  it("툴팁은 다크 판(하위 .dark 요소)이 있으면 그 안에 띄운다 — body 의 라이트 색을 받지 않게", async () => {
    const dark = document.createElement("div");
    dark.className = "dark";
    dark.setAttribute("data-theme", "dark");
    container.appendChild(dark);
    const darkRoot = createRoot(dark);
    act(() => darkRoot.render(heat()));
    await pointer(
      dark.querySelectorAll("[data-slot=chart-heatmap-cell]")[3]!,
      "pointermove",
    );
    expect(
      dark.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).not.toBeNull();
    act(() => darkRoot.unmount());
  });

  it("빈 · 한 칸 · 모두 0 이어도 깨지지 않는다", async () => {
    await render(heat({ rows: [], columns: [], values: [] }));
    expect(qa("[data-slot=chart-heatmap-cell]")).toHaveLength(0);
    await render(
      heat({ rows: [rows[0]!], columns: [columns[0]!], values: [[0]] }),
    );
    expect(q("[data-slot=chart-heatmap-cell]")!.getAttribute("data-step")).toBe(
      "-1",
    );
    await render(
      heat({
        values: [
          [0, 0, 0],
          [0, 0, 0],
        ],
      }),
    );
    expect(
      qa("[data-slot=chart-heatmap-cell]").every(
        (c) => c.getAttribute("data-step") === "-1",
      ),
    ).toBe(true);
    // 빈 상자에서 키를 눌러도 아무 일이 없다
    await render(heat({ rows: [], columns: [], values: [] }));
    await key(q("[data-slot=chart-heatmap]")!, "ArrowRight");
    expect(
      document.querySelector("[data-slot=chart-heatmap-tooltip]"),
    ).toBeNull();
  });
});

describe("ChartDataTable — 표로 보기", () => {
  const columns = ["날짜", "수입", "지출"];
  const rows = [
    ["10월 1일", "0원", "18,000원"],
    ["10월 2일", "4,200,000원", "36,000원"],
  ];

  it("표 이름(caption) · 열 머리(scope=col) · 첫 열은 줄 머리(scope=row) · 숫자는 오른쪽", async () => {
    await render(
      <ChartDataTable
        caption="10월 날짜별 수입 · 지출"
        columns={columns}
        rows={rows}
      />,
    );
    expect(q("caption")!.textContent).toBe("10월 날짜별 수입 · 지출");
    const heads = qa("thead th");
    expect(heads.map((h) => h.getAttribute("scope"))).toEqual([
      "col",
      "col",
      "col",
    ]);
    expect(heads[0]!.className).toContain("text-start");
    expect(heads[1]!.className).toContain("text-end");
    const rowHeads = qa("tbody th");
    expect(rowHeads.map((h) => h.textContent)).toEqual([
      "10월 1일",
      "10월 2일",
    ]);
    expect(rowHeads[0]!.getAttribute("scope")).toBe("row");
    const cells = qa("tbody td");
    expect(cells).toHaveLength(4);
    expect(cells[1]!.className).toContain("tabular-nums");
    expect(cells[1]!.className).toContain("text-end");
  });

  it("기본은 숨긴 표(sr-only — 보조 기술만), visuallyHidden={false} 면 펼친 표", async () => {
    await render(<ChartDataTable caption="표" columns={columns} rows={rows} />);
    expect(q("[data-slot=chart-data-table]")!.className).toContain("sr-only");
    await render(
      <ChartDataTable
        caption="표"
        columns={columns}
        rows={rows}
        visuallyHidden={false}
      />,
    );
    expect(q("[data-slot=chart-data-table]")!.className).not.toContain(
      "sr-only",
    );
  });

  it("열 정렬을 바꿀 수 있고, 줄이 없어도 머리는 남는다", async () => {
    await render(
      <ChartDataTable
        caption="표"
        columns={[{ label: "이름" }, { label: "메모", align: "start" }]}
        rows={[]}
      />,
    );
    const heads = qa("thead th");
    expect(heads[1]!.className).toContain("text-start");
    expect(qa("tbody tr")).toHaveLength(0);
  });
});

/**
 * 가로 눈금 — 글자 사이 최소 8 로 끝 눈금을 지키며 앞에서부터 건너뛰고, 연도는 **보이는** 눈금 기준(QA: 폰 402 에서
 * 해가 바뀌는 "2026. 1." 이 건너뛰기로 빠져 연도가 통째로 사라졌다 — "12월 · 빈칸 · 2월").
 */
describe("가로 눈금 — 솎기 · 보이는 눈금의 연도", () => {
  /** 월 눈금 — from(해 · 달)부터 n 칸 */
  const months = (year: number, month: number, n: number): ChartXTick[] =>
    Array.from({ length: n }, (_, i) => {
      const y = year + Math.floor((month - 1 + i) / 12);
      const m = ((month - 1 + i) % 12) + 1;
      return { label: `${m}월`, yearLabel: `${y}. ${m}.`, year: y };
    });

  it("간격 — 들어가는 수 = ⌊폭 ÷ (가장 긴 글 + 8)⌋, 간격 = ⌈칸 수 ÷ 들어가는 수⌉(앱과 같은 셈)", () => {
    expect(chartXTickInterval(12, 400, 24)).toBe(1); // 400 / 32 = 12 칸
    expect(chartXTickInterval(12, 300, 24)).toBe(2); // 9 칸
    expect(chartXTickInterval(12, 120, 24)).toBe(4); // 3 칸
    // 글자 사이가 5(recharts 기본)였다면 12 칸이 들어갔을 폭 — 8 이라 건너뛴다
    expect(chartXTickInterval(12, 12 * (24 + 5), 24)).toBe(2);
    // 폭이 없으면 끝 하나
    expect(chartXTickInterval(12, 0, 24)).toBe(12);
  });

  it("모두 보이면 해가 바뀌는 첫 눈금에만 연도(글 폭을 재는 기준)", () => {
    const t = months(2025, 12, 12);
    expect(chartXTickFullLabels(t).slice(0, 3)).toEqual([
      "12월",
      "2026. 1.",
      "2월",
    ]);
    expect(chartXTickLabels(t, 1)).toEqual(chartXTickFullLabels(t));
  });

  it("해가 바뀌는 칸이 건너뛰기로 빠지면 그 뒤 처음 보이는 눈금이 연도를 이어받는다", () => {
    // 25년 11월 ~ 26년 10월, 두 칸마다(끝에서) — 1월(해가 바뀌는 칸)이 빠진다
    const labels = chartXTickLabels(months(2025, 11, 12), 2);
    expect(labels).toEqual([
      null,
      "12월",
      null,
      "2026. 2.",
      null,
      "4월",
      null,
      "6월",
      null,
      "8월",
      null,
      "10월",
    ]);
  });

  it("끝 눈금은 늘 남고, 첫 보이는 눈금도 맨 앞 칸과 해가 다르면 연도를 받는다", () => {
    // 25년 12월 ~ 26년 11월, 두 칸마다 — 12월(맨 앞)이 빠지고 첫 보이는 1월이 연도
    const labels = chartXTickLabels(months(2025, 12, 12), 2);
    expect(labels[11]).toBe("11월");
    expect(labels.filter((l) => l != null)).toEqual([
      "2026. 1.",
      "3월",
      "5월",
      "7월",
      "9월",
      "11월",
    ]);
    // 여섯 칸마다 — 해가 두 번 바뀌어도 보이는 눈금끼리 견준다
    expect(
      chartXTickLabels(months(2024, 12, 13), 6).filter((l) => l != null),
    ).toEqual(["12월", "2025. 6.", "12월"]);
  });

  it("해가 없는 눈금(요일 · 주)은 연도를 붙이지 않는다", () => {
    const t = ["1주", "2주", "3주"].map((label) => ({ label }));
    expect(chartXTickLabels(t, 1)).toEqual(["1주", "2주", "3주"]);
  });

  it("차트에서 — 폭이 좁아 연도 눈금이 빠지면 다음 보이는 눈금에 연도가 붙는다(recharts 에 맡기지 않는다)", async () => {
    const ticks = months(2025, 11, 12);
    const data = chartXTickFullLabels(ticks).map((m, v) => ({ m, v }));
    // jsdom 은 글 폭을 못 재 글자 수로 어림한다 — "2026. 1." 56, 그리는 폭 390 → 6 칸 → 두 칸마다
    await render(
      <BarChart width={400} height={160} data={data}>
        <XAxis dataKey="m" {...chartXAxisProps(ticks)} />
        <Bar dataKey="v" />
      </BarChart>,
    );
    const shown = qa(".recharts-cartesian-axis-tick-value").map(
      (el) => el.textContent,
    );
    expect(shown).toEqual(["12월", "2026. 2.", "4월", "6월", "8월", "10월"]);
    // 넓으면 모두 보이고 연도는 1월에만
    await render(
      <BarChart width={1200} height={160} data={data}>
        <XAxis dataKey="m" {...chartXAxisProps(ticks)} />
        <Bar dataKey="v" />
      </BarChart>,
    );
    const all = qa(".recharts-cartesian-axis-tick-value").map(
      (el) => el.textContent,
    );
    expect(all).toHaveLength(12);
    expect(all.filter((l) => l?.includes("2026"))).toEqual(["2026. 1."]);
  });

  it("강조할 칸(emphasize) — 보일 때 진하게(fg-neutral · 700), 나머지는 눈금 색 그대로", async () => {
    const ticks = months(2026, 6, 6);
    const data = chartXTickFullLabels(ticks).map((m, v) => ({ m, v }));
    await render(
      <BarChart width={1200} height={160} data={data}>
        <XAxis dataKey="m" {...chartXAxisProps(ticks, { emphasize: 3 })} />
        <Bar dataKey="v" />
      </BarChart>,
    );
    const shown = qa(".recharts-cartesian-axis-tick-value");
    expect(shown).toHaveLength(6);
    expect(shown[3]!.getAttribute("font-weight")).toBe("700");
    expect(shown[3]!.getAttribute("fill")).toBe("var(--color-fg-neutral)");
    expect(shown[2]!.getAttribute("font-weight")).toBeNull();
  });
});

/**
 * 끝 눈금 · 글자 크기가 바뀜 — 이음 QA(2026-11-18, 달마다 쓴 휴가 · 1 ~ 11월 · 최대 3일 · 차트 폭 266 · html font-size 200%).
 * 페이지가 떠 있는 동안 글자를 키우자 ① 솎기 간격이 2 달 그대로라 글 사이가 1 까지 붙고 ② 끝 글 "11월" 이 차트 오른쪽 밖으로
 * 8 잘리고 ③ 세로축 폭이 옛 글자 크기라 "3일" 이 왼쪽 밖으로 9 잘렸다. 끝 눈금은 그 달(오늘이 든 달)이다 — 12월은 아직 없다.
 */
describe("가로 끝 글 자리 · 글자 크기가 바뀌면 다시 잰다", () => {
  const months = (n: number): ChartXTick[] =>
    Array.from({ length: n }, (_, i) => ({ label: `${i + 1}월` }));
  /** jsdom 은 글 폭이 없다 — 눈금 글자 크기(--text-t1)의 숨은 글은 글자 수 어림(한글 11 · 그 밖 7) × 배율로 잰다 */
  let scale = 1;
  const textWidth = (s: string) =>
    [...s].reduce((w, c) => w + (c > "ᄀ" ? 11 : 7), 0) * scale;
  beforeEach(() => {
    scale = 1;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const width = this.style.fontSize.includes("--text-t1")
          ? textWidth(this.textContent ?? "")
          : 0;
        return {
          width,
          height: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON() {},
        } as DOMRect;
      },
    );
  });
  /** 글자 크기를 바꾼다 — 숨은 글을 지켜보는 ResizeObserver 를 부른다 */
  const setScale = (next: number) =>
    act(() => {
      scale = next;
      for (const o of observers.filter((x) => x.el.textContent === "0000"))
        o.cb([]);
    });

  it("끝 글 자리 — 축 없으면 max(8, ⌈끝 글 폭 ÷ 2⌉), 오른쪽 축이 있으면 모자란 만큼만(연도 단 글이 넓으면 그 폭)", () => {
    const widthOf = (l: string) => l.length * 8;
    // "11월" 24 → 12
    expect(chartXEndReserve(months(11), widthOf)).toBe(12);
    // 좁은 끝 글도 적어도 8 — "1" 8 → 4 → 8
    expect(chartXEndReserve([{ label: "1" }], widthOf)).toBe(8);
    // 오른쪽 축 40 이 덮으면 더 비우지 않는다 · 축 8 이면 모자란 4 만
    expect(chartXEndReserve(months(11), widthOf, 40)).toBe(0);
    expect(chartXEndReserve(months(11), widthOf, 8)).toBe(4);
    // 끝 칸이 해가 바뀌는 칸이면 "2026. 1." 64 → 32
    const ticks: ChartXTick[] = [
      { label: "12월", yearLabel: "2025. 12.", year: 2025 },
      { label: "1월", yearLabel: "2026. 1.", year: 2026 },
    ];
    expect(chartXEndReserve(ticks, widthOf)).toBe(32);
    expect(chartXEndReserve([], widthOf)).toBe(0);
  });

  /** 달마다 쓴 휴가와 같은 막대 — 1 ~ 11월 · 최대 3일 · 세로축 폭은 쓰는 쪽이 그때 글자 크기로 잰 값 */
  const usage = (yWidth: number) => {
    const ticks = months(11);
    const data = ticks.map((t, i) => ({
      m: t.label,
      v: [0, 1, 0, 3, 0, 0, 0.5, 0, 0, 2, 0][i]!,
    }));
    const fmt = (n: number) => `${n}일`;
    return (
      <Chart label="달마다 쓴 휴가" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="m" {...chartXAxisProps(ticks)} />
          <YAxis
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tickFormatter={fmt}
            width={yWidth}
            {...chartAxisProps()}
          />
          <Bar dataKey="v" isAnimationActive={false} />
        </BarChart>
      </Chart>
    );
  };
  const xLabels = () =>
    qa(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value")
      .filter((el) => el.textContent)
      .map((el) => {
        const x = Number(el.getAttribute("x"));
        const w = textWidth(el.textContent!);
        return { text: el.textContent!, left: x - w / 2, right: x + w / 2 };
      });
  const yLeft = () =>
    Math.min(
      ...qa(
        ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
      ).map(
        (el) => Number(el.getAttribute("x")) - textWidth(el.textContent ?? ""),
      ),
    );
  const expectFits = (chartEnd: number) => {
    const xs = xLabels();
    // 끝 눈금(11월)이 남고 차트 오른쪽 끝을 넘지 않는다 — 옮기지 않고, 그리는 자리 오른쪽에 끝 글 반 폭을 비웠다
    expect(xs[xs.length - 1]?.text).toBe("11월");
    expect(xs[xs.length - 1]!.right).toBeLessThanOrEqual(chartEnd + 0.01);
    // 건너뛴 간격이 끝까지 고르다 — 끝 글을 당기다 앞 글을 빼지 않는다(chart.md "끝 글 자리는 비워 둡니다")
    const gaps = xs
      .map((x) => parseInt(x.text, 10))
      .slice(1)
      .map((n, i) => n - parseInt(xs[i]!.text, 10));
    expect(new Set(gaps).size).toBeLessThanOrEqual(1);
    // 글 사이 8 이상
    for (let i = 1; i < xs.length; i++)
      expect(xs[i]!.left - xs[i - 1]!.right).toBeGreaterThanOrEqual(8);
    // 세로축 글이 왼쪽 밖으로 잘리지 않는다
    expect(yLeft()).toBeGreaterThanOrEqual(0);
  };

  it("글자 200% 로 처음 그릴 때 — 끝 글 11월이 차트 안에 들고 글 사이 8 이상", async () => {
    scale = 2;
    await render(usage(measureTickWidth(["0일", "1일", "2일", "3일"])));
    await layoutCharts(266, 200);
    // 차트 폭 266
    expectFits(266);
  });

  it("페이지가 떠 있는 동안 글자를 200% 로 키우면 — 건너뛰기 · 끝 글 자리 · 세로축 폭을 다시 잰다", async () => {
    // 100% 에서 잰 세로축 폭을 쓰는 쪽이 그대로 준다(useAxisWidth · niceValueAxis 가 그 순간 잰 값)
    await render(usage(measureTickWidth(["0일", "1일", "2일", "3일"])));
    await layoutCharts(266, 200);
    expectFits(266);
    const before = xLabels().length;
    await setScale(2);
    expectFits(266);
    expect(xLabels().length).toBeLessThan(before);
    // 다시 100% 로 — 솎기도 돌아온다
    await setScale(1);
    expect(xLabels().length).toBe(before);
  });
});

/**
 * 계열 표식의 꼴 — 막대 모양을 따른다(chart.md "미리 잡는 일정의 값은 예외" · groo-design #251). 이음 "달마다 휴가" 는 쓴 휴가(채움)와
 * 예정(옅은 바탕 + 1px 테두리)이 같은 파랑이라, 타일 점 · 툴팁 색 네모가 둘 다 채움이면 어느 것이 예정인지 가를 수 없다.
 */
describe("계열 표식 — fill · outline", () => {
  it("지표 타일 점 — 기본은 계열 색 채움, outline 은 옅은 바탕 + 1px 계열 색 테두리", async () => {
    await render(
      <ChartLegendTiles
        items={[
          { key: "used", label: "쓴 휴가", color: "blue", total: "3일" },
          {
            key: "plan",
            label: "예정",
            color: "blue",
            total: "2일",
            marker: "outline",
          },
        ]}
      />,
    );
    const [used, plan] = qa<HTMLElement>("[data-slot=chart-legend-dot]");
    expect(used!.className.split(" ")).toContain(DOT_BG.blue);
    expect(used!.hasAttribute("data-marker")).toBe(false);
    expect(used!.style.borderWidth).toBe("");
    expect(plan!.getAttribute("data-marker")).toBe("outline");
    expect(plan!.className.split(" ")).toContain(SUBTLE_BG.blue);
    expect(plan!.className.split(" ")).not.toContain(DOT_BG.blue);
    expect(plan!.style.borderWidth).toBe("1px");
    expect(plan!.style.borderStyle).toBe("solid");
    expect(plan!.getAttribute("style")).toContain("var(--color-chart-blue)");
    // 크기는 그대로 8(테두리는 안쪽 — border-box)
    expect(plan!.className).toContain("size-[8px]");
  });

  it("툴팁 색 네모 — markers 로 고른 계열만 옅은 바탕(그 계열 fill) + 1px 테두리(그 계열 stroke)", async () => {
    await render(
      <ChartTooltipContent
        active
        label="11월"
        markers={{ plan: "outline" }}
        payload={[
          { name: "쓴 휴가", dataKey: "used", value: 1, fill: "rgb(1, 2, 3)" },
          {
            name: "예정",
            dataKey: "plan",
            value: 0.5,
            fill: "rgb(200, 210, 220)",
            stroke: "rgb(1, 2, 3)",
          },
        ]}
      />,
    );
    const [used, plan] = qa<HTMLElement>("[data-slot=chart-tooltip-swatch]");
    expect(used!.style.background).toBe("rgb(1, 2, 3)");
    expect(used!.style.borderWidth).toBe("");
    expect(used!.hasAttribute("data-marker")).toBe(false);
    expect(plan!.getAttribute("data-marker")).toBe("outline");
    expect(plan!.style.background).toBe("rgb(200, 210, 220)");
    expect(plan!.style.borderWidth).toBe("1px");
    expect(plan!.style.borderStyle).toBe("solid");
    expect(plan!.style.borderColor).toBe("rgb(1, 2, 3)");
  });

  it("툴팁 outline — 계열에 stroke 가 없으면 테두리는 그 계열 색", async () => {
    await render(
      <ChartTooltipContent
        active
        markers={{ plan: "outline" }}
        payload={[
          {
            name: "예정",
            dataKey: "plan",
            value: 2,
            color: "rgb(4, 5, 6)",
            fill: "rgb(7, 8, 9)",
          },
        ]}
      />,
    );
    const swatch = q<HTMLElement>("[data-slot=chart-tooltip-swatch]")!;
    expect(swatch.style.background).toBe("rgb(7, 8, 9)");
    expect(swatch.style.borderWidth).toBe("1px");
    expect(swatch.style.borderColor).toBe("rgb(4, 5, 6)");
  });
});
