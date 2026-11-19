// React Compiler 를 거친 코드로 차트 눈금을 본다 — 차트 그림 안 글(축 눈금)은 글자 크기 설정을 따르지 않는다(chart.md "글자 크기",
// groo-design #260). 300%(처음부터 · 뜬 뒤)에서도 눈금 줄 높이 · 세로축 폭 · 가로 눈금 줄이 100% 와 같다 — 차트 높이도 그대로라
// 그리는 자리가 줄지 않는다. 웹폰트가 늦게 도착해 눈금 글 폭이 바뀌면(눈금 글꼴 판) 세로축 폭을 다시 잰다.
// vitest 는 컴파일러 없이 돌아 컴파일러가 값을 처음 한 번에 묶는 결함이 안 보인다 — 그래서 이 파일은 앱 빌드와 같은 플러그인으로
// 변환한 모듈(react-compiler.test-utils)을 부른다.
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chartAxisProps, chartXAxisProps } from "@/shared/ds/chart";
import {
  compiledBody,
  importCompiled,
} from "@/shared/lib/react-compiler.test-utils";

import {
  changeTickFont,
  changeTickScale,
  installValueAxisHarness,
  layoutCharts,
  tickScale,
  yTickLabels,
  yTickPositions,
} from "./value-axis.test-utils";
import { AXIS_TICK_FONT_SIZE } from "./axisWidth";

type AxisWidthModule = typeof import("./axisWidth");
type ChartModule = typeof import("@/shared/ds/chart/chart");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installValueAxisHarness();
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

describe("React Compiler 를 거친 axisWidth — 글자 크기를 키워도 눈금은 그대로", () => {
  it("눈금 줄 높이는 재지 않는 상수 15 — 줄 높이를 재던 훅 · 함수가 남지 않고, 300% 에도 세로 눈금 칸 수 · 가로 눈금 줄이 같다", async () => {
    const { module, code } = await importCompiled<AxisWidthModule>(
      "src/shared/lib/groo/axisWidth.ts",
    );
    expect(code).toContain("react/compiler-runtime");
    expect(module.CHART_TICK_LINE).toBe(15);
    expect(module.CHART_X_TICK_GAP).toBe(12);
    expect(module.CHART_X_AXIS_HEIGHT).toBe(27);
    // 글자 배율을 따라 줄 높이를 다시 재던 장치는 걷었다 — 이름조차 남지 않는다
    expect(module).not.toHaveProperty("useTickLineHeight");
    expect(module).not.toHaveProperty("measureTickLineHeight");
    // 세로 눈금 칸 수 — 차트 200: 200 − 8 − 5 − (12 + 15) = 160 → 10 칸. 처음부터 300% · 뜬 뒤 300% 모두 같다
    tickScale.value = 3;
    expect(module.chartValueIntervals(200)).toBe(10);
    tickScale.value = 1;
    expect(module.chartValueIntervals(200)).toBe(10);
    await changeTickScale(3);
    expect(module.chartValueIntervals(200)).toBe(10);
    expect(module.chartTopMargin(0)).toBe(8);
  });

  it("useAxisWidth — 300% 에도 18 + 16 그대로, 웹폰트로 눈금 글 폭이 바뀌면 다시 잰다(컴파일러가 건너뛰지 않는다)", async () => {
    const { module, code } = await importCompiled<AxisWidthModule>(
      "src/shared/lib/groo/axisWidth.ts",
    );
    // eslint-disable · 손 useMemo 를 걷어 컴파일러가 이 훅도 변환한다
    expect(compiledBody(code, "useAxisWidth")).toContain("_c(");
    const seen: number[] = [];
    const Probe = ({ labels }: { labels: string[] }) => {
      seen.push(module.useAxisWidth(labels));
      return null;
    };
    // 렌더마다 새 배열이어도 같은 글이면 같은 값
    await render(createElement(Probe, { labels: ["0일", "3일"] }));
    await render(createElement(Probe, { labels: ["0일", "3일"] }));
    expect(seen[seen.length - 1]).toBe(18 + 16);
    await changeTickScale(3);
    expect(seen[seen.length - 1]).toBe(18 + 16);
    // 웹폰트 도착 — 같은 11px 라도 글꼴이 넓으면 폭이 바뀐다(눈금 글꼴 판이 오른다)
    await changeTickFont(2);
    expect(seen[seen.length - 1]).toBe(36 + 16);
  });
});

describe("React Compiler 를 거친 Chart — 글자 크기를 키워도 눈금 줄 · 그리는 자리 · 세로축 폭이 그대로", () => {
  /** 달마다 쓴 휴가 같은 막대 — 세로축 폭은 쓰는 쪽이 잰 값(60 보다 좁은 34) */
  const usage = (Chart: ChartModule["Chart"]) => {
    const months = Array.from({ length: 11 }, (_, i) => ({
      label: `${i + 1}월`,
    }));
    const data = months.map((t, i) => ({ m: t.label, v: i % 3 }));
    return (
      <Chart label="달마다 쓴 휴가" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="m" {...chartXAxisProps(months)} />
          <YAxis
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tickFormatter={(n: number) => `${n}일`}
            width={34}
            interval={0}
            {...chartAxisProps()}
          />
          <Bar dataKey="v" isAnimationActive={false} />
        </BarChart>
      </Chart>
    );
  };

  it("눈금 글자 크기는 11px(rem 아님) — SVG 글 · 세로축 폭을 재는 글 모두", () => {
    expect(chartAxisProps().tick.fontSize).toBe("11px");
    expect(AXIS_TICK_FONT_SIZE).toBe("var(--text-t1-static)");
  });

  it("처음부터 300% — 가로 눈금 줄 27(12 + 15), 그리는 자리 아래 끝이 100% 와 같다", async () => {
    const { module } = await importCompiled<ChartModule>(
      "src/shared/ds/chart/chart.tsx",
    );
    tickScale.value = 3;
    await render(usage(module.Chart));
    await layoutCharts(266);
    expect(yTickPositions(container)[0]).toBe(200 - 5 - 27);
    expect(yTickLabels(container)).toEqual(["0일", "1일", "2일", "3일"]);
  });

  it("뜬 뒤 100% → 300% — 가로 눈금 줄 · 세로 눈금 자리가 그대로, 세로축 글이 왼쪽 밖으로 잘리지 않는다", async () => {
    const { module } = await importCompiled<ChartModule>(
      "src/shared/ds/chart/chart.tsx",
    );
    await render(usage(module.Chart));
    await layoutCharts(266);
    const before = yTickPositions(container);
    expect(before[0]).toBe(200 - 5 - 27);
    await changeTickScale(3);
    await layoutCharts(266);
    expect(yTickPositions(container)).toEqual(before);
    expect(yTickLabels(container)).toEqual(["0일", "1일", "2일", "3일"]);
    // 세로 눈금 글 오른쪽 끝(x) − 글 폭(11px 고정) ≥ 0
    const left = Array.from(
      container.querySelectorAll(
        ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
      ),
    ).map((t) => Number(t.getAttribute("x")) - (6.6 + 11));
    expect(Math.min(...left)).toBeGreaterThanOrEqual(0);
  });
});
