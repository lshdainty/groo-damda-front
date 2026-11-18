// React Compiler 를 거친 코드로 글자 크기 판을 본다 — 이음 QA(2026-11-18): `useTickLineHeight` 가 판을 버리고 측정만 불러
// 컴파일러가 처음 잰 줄 높이에 묶었다. 페이지가 뜬 뒤 글자를 300% 로 키워도 세로 눈금 칸 수(chartValueIntervals)가 그대로라
// 다섯 줄이 겹쳤다. vitest 는 컴파일러 없이 돌아 이 결함이 안 보였다 — 그래서 이 파일은 앱 빌드와 같은 플러그인으로 변환한
// 모듈(react-compiler.test-utils)을 부른다.
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
  changeTickScale,
  installValueAxisHarness,
  layoutCharts,
  yTickLabels,
  yTickPositions,
} from "./value-axis.test-utils";

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

describe("React Compiler 를 거친 axisWidth — 페이지가 뜬 뒤 글자를 키우면 다시 잰다", () => {
  it("useTickLineHeight — 100% 15 → 200% 로 키우면 30(판을 열쇠로 넘긴다)", async () => {
    const { module, code } = await importCompiled<AxisWidthModule>(
      "src/shared/lib/groo/axisWidth.ts",
    );
    // 컴파일러가 이 훅을 변환했다(캐시 `_c`) — 변환 안 된 코드를 보는 시험이 아니다
    expect(code).toContain("react/compiler-runtime");
    expect(compiledBody(code, "useTickLineHeight")).toContain("_c(");
    const seen: number[] = [];
    const Probe = () => {
      seen.push(module.useTickLineHeight());
      return null;
    };
    await render(createElement(Probe));
    expect(seen[seen.length - 1]).toBe(15);
    await changeTickScale(2);
    expect(seen[seen.length - 1]).toBe(30);
    // 세로 눈금 칸 수도 따라간다 — 차트 200: 200% 200 − 15 − 5 − (19 + 30) = 131 → 4 칸
    expect(
      Math.floor(module.chartValueIntervals(200, seen[seen.length - 1]!)),
    ).toBe(4);
  });

  it("useAxisWidth — 100% 18 + 16 → 200% 로 키우면 36 + 16, 컴파일러가 건너뛰지 않는다", async () => {
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
    await changeTickScale(2);
    expect(seen[seen.length - 1]).toBe(36 + 16);
  });
});

describe("React Compiler 를 거친 Chart — 페이지가 뜬 뒤 글자를 키우면 눈금 줄 높이 · 세로축 폭을 다시 잰다", () => {
  /** 달마다 쓴 휴가 같은 막대 — 세로축 폭은 쓰는 쪽이 100% 에서 잰 값(60 보다 좁은 34) */
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

  it("가로 눈금 줄(max(8, ⌈글 줄 ÷ 2⌉ + 4) + 글 줄)이 27 → 49 로 늘어 그리는 자리 아래 끝이 올라가고, 세로축 글이 왼쪽 밖으로 잘리지 않는다", async () => {
    const { module } = await importCompiled<ChartModule>(
      "src/shared/ds/chart/chart.tsx",
    );
    await render(usage(module.Chart));
    await layoutCharts(266);
    // 0 눈금 = 그리는 자리 아래 끝 = 200 − 아래 여백 5 − 가로 눈금 줄
    const bottomAt = () => yTickPositions(container)[0];
    expect(bottomAt()).toBe(200 - 5 - 27);
    await changeTickScale(2);
    await layoutCharts(266);
    expect(bottomAt()).toBe(200 - 5 - 49);
    expect(yTickLabels(container)).toEqual(["0일", "1일", "2일", "3일"]);
    // 세로 눈금 글 오른쪽 끝(x) − 글 폭 ≥ 0 — 폭 34 그대로면 "3일"(200% 36)이 왼쪽 밖으로 나간다
    const left = Array.from(
      container.querySelectorAll(
        ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value",
      ),
    ).map((t) => Number(t.getAttribute("x")) - (6.6 + 11) * 2);
    expect(Math.min(...left)).toBeGreaterThanOrEqual(0);
  });
});
