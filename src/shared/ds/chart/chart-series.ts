import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { ACTIVE_DOT, CHART_DRAW, SERIES_DOT } from "./chart-variants";

/*
 * 차트의 바로 아래 계열에 기본값을 넣는다 — 쓰는 쪽이 준 값이 이긴다. 컴포넌트가 아니라 요소를 고쳐 돌려주는 함수라 .ts 에 둔다(JSX 를 쓰지 않는다).
 *   Area · Line  선 2 · monotone · 점 없음(가리킨 자리에만 계열 색 점 r 4 + 카드 면 색 테두리 2) · 그려짐 300ms. Area 의 면은 같은 색 25% → 0% 세로 그라디언트.
 *                `dots` 를 켜면 값마다 늘 찍는 점(SERIES_DOT — 계열 선 색 r 3 · 테두리 없음)을 기본으로 둔다
 *   Bar          최대 폭 28 · 위 두 모서리 4(음수 막대는 쓰는 쪽이 radius 를 주어 아래 두 모서리로)
 *   Pie          조각 사이 0 · 테두리 없음 · 12시에서 시계 방향
 */

type AnyProps = Record<string, unknown>;

// 차트의 바로 아래 계열에 기본값을 넣는다 — 쓰는 쪽이 준 값이 이긴다. Area 의 면은 같은 색 25% → 0% 세로 그라디언트
export function withSeriesDefaults(
  chart: React.ReactElement<AnyProps>,
  idPrefix: string,
  { dots = false }: { dots?: boolean } = {},
) {
  const gradients: React.ReactElement[] = [];
  // 늘 찍는 점 — 계열 선 색 원. Area 는 면(그라디언트)이 점 색으로 번지지 않게 fill 을 선 색으로 준다
  const dotOf = (props: AnyProps) =>
    dots && typeof props.stroke === "string"
      ? { ...SERIES_DOT, fill: props.stroke }
      : false;
  const pick = (props: AnyProps, defaults: AnyProps) => {
    const out: AnyProps = {};
    for (const [key, value] of Object.entries(defaults))
      if (props[key] === undefined) out[key] = value;
    return out;
  };
  const children = React.Children.map(
    chart.props.children as React.ReactNode,
    (child, index) => {
      if (!React.isValidElement<AnyProps>(child)) return child;
      const props = child.props;
      if (child.type === RechartsPrimitive.Area) {
        const extra = pick(props, {
          type: "monotone",
          strokeWidth: 2,
          dot: dotOf(props),
          activeDot: ACTIVE_DOT,
          ...CHART_DRAW,
        });
        if (props.fill === undefined && typeof props.stroke === "string") {
          const id = `${idPrefix}area${index}`;
          const stroke = props.stroke;
          gradients.push(
            React.createElement(
              "linearGradient",
              { key: id, id, x1: "0", y1: "0", x2: "0", y2: "1" },
              React.createElement("stop", {
                offset: "0%",
                style: { stopColor: stroke, stopOpacity: 0.25 },
              }),
              React.createElement("stop", {
                offset: "100%",
                style: { stopColor: stroke, stopOpacity: 0 },
              }),
            ),
          );
          extra.fill = `url(#${id})`;
          extra.fillOpacity = 1;
        }
        return React.cloneElement(child, extra);
      }
      if (child.type === RechartsPrimitive.Line) {
        return React.cloneElement(
          child,
          pick(props, {
            type: "monotone",
            strokeWidth: 2,
            dot: dotOf(props),
            activeDot: ACTIVE_DOT,
            ...CHART_DRAW,
          }),
        );
      }
      if (child.type === RechartsPrimitive.Bar) {
        return React.cloneElement(
          child,
          pick(props, {
            maxBarSize: 28,
            radius: [4, 4, 0, 0],
            ...CHART_DRAW,
          }),
        );
      }
      if (child.type === RechartsPrimitive.Pie) {
        return React.cloneElement(
          child,
          pick(props, {
            paddingAngle: 0,
            stroke: "none",
            startAngle: 90,
            endAngle: -270,
            ...CHART_DRAW,
          }),
        );
      }
      return child;
    },
  );
  const content =
    gradients.length > 0
      ? [
          React.createElement("defs", { key: `${idPrefix}defs` }, gradients),
          ...(children ?? []),
        ]
      : children;
  return React.cloneElement(chart, undefined, content);
}
