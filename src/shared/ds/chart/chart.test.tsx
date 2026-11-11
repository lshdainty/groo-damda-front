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
  CHART_MAX_ITEMS,
  CHART_ORDER,
  DONUT_ROW,
  DONUT_ROW_PRESSABLE,
  DOT_BG,
  LEGEND_TILE,
  LEGEND_TILE_HIDDEN,
  SUBTLE_BG,
  TOOLTIP_SURFACE,
  assignChartColors,
  chartAxisProps,
  chartGridProps,
  formatAxisWon,
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
  it("축은 만 · 억 · 조로 줄이고 소수 한 자리(.0 은 버린다)", () => {
    expect(formatAxisWon(0)).toBe("0");
    expect(formatAxisWon(9999)).toBe("9,999");
    expect(formatAxisWon(10000)).toBe("1만");
    expect(formatAxisWon(12000)).toBe("1.2만");
    expect(formatAxisWon(4000000)).toBe("400만");
    expect(formatAxisWon(123456789)).toBe("1.2억");
    expect(formatAxisWon(1e12)).toBe("1조");
    expect(formatAxisWon(Number.NaN)).toBe("");
  });

  it("빼기는 U+2212 하나 — 음수 축 글자", () => {
    expect(formatAxisWon(-30000000)).toBe("−3,000만");
    expect(formatAxisWon(-500)).toBe("−500");
    expect(formatAxisWon(-30000000)).not.toContain("-");
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
    // rem — 글자 크기 설정(200%)을 따른다. 0.6875rem = 11px(--text-badge)
    expect(p.tick.fontSize).toBe("0.6875rem");
    expect(p.tick.fill).toBe("var(--color-fg-neutral-subtle)");
    expect(p.axisLine).toBe(false);
    expect(p.tickLine).toBe(false);
    expect(p.tickMargin).toBe(8);
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
