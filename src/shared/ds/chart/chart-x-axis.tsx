import { Text } from "recharts";
import {
  measureTextWidth,
  readTickFontVersion,
} from "@/shared/lib/groo/axisWidth";
import {
  chartAxisProps,
  chartXTickFullLabels,
  chartXTickInterval,
  chartXTickLabels,
  type ChartXTick,
} from "./chart-variants";

/** recharts 가 눈금 그리기 함수에 넘기는 것 가운데 쓰는 것 — width 는 가로축(= 그리는 자리)의 폭 */
export interface XTickRenderProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  verticalAnchor?: "start" | "middle" | "end";
  className?: string;
  /**
   * 같은 화면 · 같은 기간 차트 묶음(`ChartXGroup`) — 이 차트가 자기 폭으로 센 간격을 받아 묶음의 간격(가장 큰 것)을 돌려준다.
   * ds Chart 가 `xGroup` 을 받으면 넣어 준다. 없으면 자기 간격을 쓴다
   */
  sharedInterval?: (own: number) => number;
}

/** chartXAxisProps 가 만든 눈금 그리기 함수 → 그 눈금 목록. ds Chart 가 끝 글 자리(chartXEndReserve)를 비우려고 찾아 쓴다 */
const ticksOfRenderer = new WeakMap<object, readonly ChartXTick[]>();

/** XAxis 의 tick 이 chartXAxisProps 로 만든 것이면 그 눈금 목록 */
export const chartXTicksOf = (
  tick: unknown,
): readonly ChartXTick[] | undefined =>
  typeof tick === "function" ? ticksOfRenderer.get(tick) : undefined;

/**
 * 가로축(날짜 · 월 · 주 · 요일 — 칸마다 글 하나) — `<XAxis dataKey="month" {...chartXAxisProps(ticks)} />`. `chartAxisProps()` 대신 펼친다.
 * 가로 눈금 글이 있는 카르테시안 차트는 모두 이 길을 탄다 — `chartAxisProps()` 만 펼치면 recharts 가 눈금을 골라 빼고(앞에서부터,
 * 간격 고르지 않음) 끝 글 자리도 비우지 않는다.
 *
 * 남길 눈금을 recharts 에 맡기지 않고 직접 정한다(chart.md "큰 글자" · "날짜 · 시각 눈금"): 글자 사이 최소 8 로 들어가는 칸을
 * 세어 끝(가장 최근) 눈금을 지키고 앞에서부터 건너뛰고(앱 `p_chart_cartesian` 과 같은 셈), 연도는 **남은 눈금** 가운데 해가
 * 바뀌는 첫 눈금에 붙인다. recharts 에는 모든 칸을 그리게 하고(`interval` 0) 건너뛴 칸은 빈 자리로 둔다. 툴팁 머리는 계속 dataKey 글이다.
 *
 * 끝 글은 옮기지 않는다 — ds Chart 가 그리는 자리 오른쪽에 끝 글 폭의 절반을 비워(`chartXEndReserve`) 끝 글이 차트 끝을 넘지 않으므로
 * 건너뛴 간격이 끝까지 고르다(chart.md "끝 글 자리는 비워 둡니다"). 같은 화면 · 같은 기간 차트 묶음이면 묶음의 간격(가장 큰 것 —
 * 가장 좁은 차트의 간격)을 쓴다(`sharedInterval` — chart.md "같은 화면 · 같은 기간 차트는 같은 날짜 글").
 * 잰 값은 그리는 자리 폭 · 눈금 글자 크기의 판(`readTickFontVersion`)이 같을 때만 다시 쓴다 — 글자 크기가 페이지가 떠 있는 동안
 * 바뀌면(ds Chart 가 그 판을 지켜 다시 그린다) 건너뛰기를 새로 센다.
 */
export function chartXAxisProps(
  ticks: readonly ChartXTick[],
  {
    emphasize,
  }: {
    /** 강조할 칸 — 고른 기간(예산 이행률의 고른 달). 보일 때만 진하게(fg-neutral · 700), 건너뛰기는 다른 칸과 같다(앱 p_chart_cartesian `_emphasized`) */
    emphasize?: number;
  } = {},
) {
  const axis = chartAxisProps();
  const full = chartXTickFullLabels(ticks);
  // 칸마다 불리므로 그리는 자리 폭 · 글자 크기가 같으면 한 번만 센다(글 폭을 재는 것이 비싸다)
  let own: { key: string; interval: number } | undefined;
  let plan: { interval: number; labels: (string | null)[] } | undefined;
  const labelsAt = (p: XTickRenderProps) => {
    const width = Number(p.width) || 0;
    const key = `${width}|${readTickFontVersion()}`;
    if (own?.key !== key)
      own = {
        key,
        interval: chartXTickInterval(
          ticks.length,
          width,
          measureTextWidth(full),
        ),
      };
    const interval = p.sharedInterval?.(own.interval) ?? own.interval;
    if (plan?.interval !== interval)
      plan = { interval, labels: chartXTickLabels(ticks, interval) };
    return plan.labels;
  };
  const tick = (p: XTickRenderProps) => {
    const label = labelsAt(p)[p.index ?? -1];
    if (label == null) return <g />;
    const strong = emphasize != null && p.index === emphasize;
    return (
      <Text
        x={p.x}
        y={p.y}
        textAnchor={p.textAnchor}
        verticalAnchor={p.verticalAnchor}
        className={p.className}
        fill={strong ? "var(--color-fg-neutral)" : axis.tick.fill}
        fontSize={axis.tick.fontSize}
        fontWeight={strong ? 700 : undefined}
      >
        {label}
      </Text>
    );
  };
  ticksOfRenderer.set(tick, ticks);
  return {
    ...axis,
    interval: 0 as const,
    // 눈금 선을 긋지 않으니 그 길이(기본 6)도 두지 않는다 — 글은 그리는 자리에서 8(tickMargin) 아래, 줄 높이는 ds Chart 가 글 줄 + 8 로 잡는다
    tickSize: 0,
    tick,
  };
}
