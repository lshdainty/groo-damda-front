import { Text } from "recharts";
import {
  measureTextWidth,
  readTickFontVersion,
} from "@/shared/lib/groo/axisWidth";
import {
  chartAxisProps,
  chartXTickFullLabels,
  chartXTickGeometry,
  chartXTickInterval,
  chartXTickLayout,
  type ChartXTick,
} from "./chart-variants";

/** recharts 가 눈금 그리기 함수에 넘기는 것 가운데 쓰는 것 — width 는 가로축(= 그리는 자리)의 폭 */
interface XTickRenderProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
  payload?: { coordinate?: number; offset?: number };
  padding?: unknown;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  verticalAnchor?: "start" | "middle" | "end";
  className?: string;
}

/**
 * 시간(월 · 일) 가로축 — `<XAxis dataKey="month" {...chartXAxisProps(ticks)} />`. `chartAxisProps()` 대신 펼친다.
 *
 * 남길 눈금을 recharts 에 맡기지 않고 직접 정한다(chart.md "큰 글자" · "날짜 · 시각 눈금"): 글자 사이 최소 8 로 들어가는 칸을
 * 세어 끝(가장 최근) 눈금을 지키고 앞에서부터 건너뛰고(앱 `p_chart_cartesian` 과 같은 셈), 연도는 **남은 눈금** 가운데 해가
 * 바뀌는 첫 눈금에 붙인다. recharts 가 건너뛰게 두면 어느 눈금이 남는지 몰라 "2026. 1." 이 빠지면서 연도가 통째로 사라졌다.
 * 그래서 recharts 에는 모든 칸을 그리게 하고(`interval` 0) 건너뛴 칸은 빈 자리로 둔다. 툴팁 머리는 계속 dataKey 글이다.
 * 끝 눈금 글이 그리는 자리 끝을 넘으면 안으로 옮기고, 그래서 앞 글과 붙으면 앞 글을 뺀다(`chartXTickLayout` — recharts preserveEnd 와 같은 셈).
 * 잰 값은 축 폭 · 자리 · 눈금 글자 크기의 판(`readTickFontVersion`)이 같을 때만 다시 쓴다 — 글자 크기가 페이지가 떠 있는 동안
 * 바뀌면(ds Chart 가 그 판을 지켜 다시 그린다) 솎기 · 끝 맞춤을 새로 잰다.
 */
export function chartXAxisProps(ticks: readonly ChartXTick[]) {
  const axis = chartAxisProps();
  const full = chartXTickFullLabels(ticks);
  // 칸마다 불리므로 축 폭 · 자리 · 글자 크기가 같으면 한 번만 잰다
  let plan:
    { key: string; labels: (string | null)[]; dx: number[] } | undefined;
  const planAt = (p: XTickRenderProps) => {
    const width = Number(p.width) || 0;
    const geometry = chartXTickGeometry({
      coordinate: Number(p.payload?.coordinate ?? p.x) || 0,
      index: p.index ?? 0,
      offset: Number(p.payload?.offset) || 0,
      width,
      count: ticks.length,
      padding: p.padding,
    });
    const key = `${width}|${Math.round(geometry.start * 100)}|${readTickFontVersion()}`;
    if (plan?.key !== key) {
      const interval = chartXTickInterval(
        ticks.length,
        width,
        measureTextWidth(full),
      );
      plan = {
        key,
        ...chartXTickLayout(ticks, interval, {
          coordinate: (i) => geometry.first + i * geometry.step,
          end: geometry.end,
          widthOf: (label) => measureTextWidth([label]),
        }),
      };
    }
    return plan;
  };
  return {
    ...axis,
    interval: 0 as const,
    tick: (p: XTickRenderProps) => {
      const { labels, dx } = planAt(p);
      const label = labels[p.index ?? -1];
      if (label == null) return <g />;
      return (
        <Text
          x={(Number(p.x) || 0) + (dx[p.index ?? -1] ?? 0)}
          y={p.y}
          textAnchor={p.textAnchor}
          verticalAnchor={p.verticalAnchor}
          className={p.className}
          fill={axis.tick.fill}
          fontSize={axis.tick.fontSize}
        >
          {label}
        </Text>
      );
    },
  };
}
