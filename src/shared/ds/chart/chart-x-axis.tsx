import { Text } from "recharts";
import { measureTextWidth } from "@/shared/lib/groo/axisWidth";
import {
  chartAxisProps,
  chartXTickFullLabels,
  chartXTickInterval,
  chartXTickLabels,
  type ChartXTick,
} from "./chart-variants";

/** recharts 가 눈금 그리기 함수에 넘기는 것 가운데 쓰는 것 — width 는 가로축(= 그리는 자리)의 폭 */
interface XTickRenderProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
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
 */
export function chartXAxisProps(ticks: readonly ChartXTick[]) {
  const axis = chartAxisProps();
  const full = chartXTickFullLabels(ticks);
  // 칸마다 불리므로 폭이 같으면 한 번만 잰다
  let plan: { width: number; labels: (string | null)[] } | undefined;
  const labelsAt = (width: number) => {
    if (plan?.width !== width) {
      const interval = chartXTickInterval(
        ticks.length,
        width,
        measureTextWidth(full),
      );
      plan = { width, labels: chartXTickLabels(ticks, interval) };
    }
    return plan.labels;
  };
  return {
    ...axis,
    interval: 0 as const,
    tick: (p: XTickRenderProps) => {
      const label = labelsAt(Number(p.width) || 0)[p.index ?? -1];
      if (label == null) return <g />;
      return (
        <Text
          x={p.x}
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
