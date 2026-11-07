import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/shared/lib/cn";

import {
  CHART_ROOT,
  DONUT_NARROW,
  DONUT_PILL,
  DONUT_ROW,
  DONUT_ROW_PRESSABLE,
  DOT_BG,
  LEGEND_TILE,
  LEGEND_TILE_HIDDEN,
  SUBTLE_BG,
  TOOLTIP_SURFACE,
  formatWon,
  type ChartColor,
  type ChartTone,
} from "./chart-variants";
import { withSeriesDefaults } from "./chart-series";
import { ChartTooltipRow } from "./chart-tooltip-row";
import { useEscapeFirst } from "./use-escape-first";
import { useDsText, withCommaBreaks } from "@/shared/ds/i18n";

/*
 * Groo Chart — 색은 DESIGN.md v110 · v111, 부품은 SEED Layout 의 대시보드 그림(2026-10-08). 수치 원본은 groo-design specs/components/chart.yaml
 * (값은 src/shared/ds/spec/chart.json). groo-design recipes/shadcn/components/ui/chart.tsx 를 첫 판으로 가져왔다. recharts(3.x) 위에 짰다.
 * SEED 에는 차트 컴포넌트도 차트 색도 없다 — 이중 축 · 계열 색 눈금 · 가로 격자 · 세로 점선 가리킴 · "■ 라벨 값" 툴팁 · 위 지표 타일은
 * SEED 그림을, 색 배정 · 범례 · 열지도 · 빈 · 실패 · 접근성은 groo 가 정했다.
 *
 *   Chart               차트 상자 — label(필수, role="img" 의 요약 이름 — "10월 수입 · 지출 추이, 수입 4,200,000원 · …") · height(px) ·
 *                       legendId(대체가 되는 범례의 id → aria-describedby). 자식은 recharts 차트 하나(ResponsiveContainer 로 감싼다) +
 *                       ChartDonutCenter. 라이브러리가 svg 에 다는 role="application" · 이름 없는 tabindex 를 걷는다
 *   ChartTooltip · ChartTooltipContent   툴팁 — 떠 있는 표면 · 머리(headFormatter) · 줄 "■ 라벨 값"(valueFormatter, 기본 원까지).
 *                       ChartTooltip 은 가리킴 선(세로 점선)과 이 내용을 기본으로 단다. 보조 기술에는 숨긴다 — 같은 값은 범례 · 표로 보기가 준다
 *   ChartLegendTiles    선 · 막대 차트 위 지표 타일(role="group") — items({ key, label, color, total }) · hidden(숨긴 key) · onHiddenChange.
 *                       타일은 <button aria-pressed>, 마지막 하나는 끌 수 없다(aria-disabled). id 는 legendId 로 쓴다
 *   ChartDonutLegend    도넛 범례 — 카테고리 목록 items({ key, label, color, percent, amount, onClick? }) — onClick 이 있는 줄만 누르는 줄
 *   ChartDonutCenter    도넛 가운데 합계 — label · amount(원까지). 구멍에 들어가지 않으면 그리지 않고 onFitChange(false) — 쓰는 쪽이 목록 위에 합계를 둔다
 *   ChartDataTable      표로 보기 — caption · columns · rows, visuallyHidden(기본 true — 숨긴 표, false 면 차트 아래 펼친 표)
 *   (chart-heatmap.tsx) ChartHeatmap — 요일 × 시간 열지도
 *   (chart-variants.ts) assignChartColors · formatAxisWon · formatWon · chartAxisProps · chartGridProps
 *
 * 색: 차트 10색(var(--color-chart-{색}) — 라이트 팔레트 700 · 다크 800-dark). 배정 순서 blue → green → orange → violet → pink → indigo → red →
 *   yellow → brown, 회색은 "기타" 전용. 수입 blue · 지출 red.
 * 계열: 차트의 바로 아래 자식에 기본값을 넣는다(쓰는 쪽이 준 값이 이긴다) — Area · Line 선 2 · monotone · 점 없음(가리킨 자리에만 계열 색 점
 *   r 4 + 카드 면 색 테두리 2 = 10), Area 의 면은 같은 색 25% → 0% 세로 그라디언트 · Bar 최대 폭 28 · 위 모서리 4 · Pie 조각 사이 0 ·
 *   12시에서 시계 방향. 그려짐은 300ms 한 번 — 모션 줄이기면 바로(라이브러리 기본 "auto" 를 강제로 켜지 않는다).
 * 툴팁: 머리 12 · fg-neutral-subtle, 줄 "■ 라벨 값". 가리킴 선은 1px 점선(3 · 3) stroke-neutral-weak.
 * 키보드: 차트 상자(Tab 한 칸, role="img")에서 ← · → 로 날짜 · 막대를 옮기며 툴팁을 띄운다 — 처음 누르면 첫 날짜, Esc 로 닫고 상자를 떠나면
 *   닫는다(대화상자 안이어도 Esc 는 툴팁만 닫는다). 포커스 링은 키보드 포커스에만 상자 바깥 2px(띄움 2). 마우스 · 터치로 짚은 자리가 먼저다.
 * 지표 타일: 높이 62 · 폭 100 이상 · 타일 사이 8 · 아래 차트와 8. 켠 계열 바탕 chart-{색}-subtle(테두리 없음), 끈 계열 흰 면 + 안쪽 1px
 *   stroke-neutral-weak(끈 타일만 호버에 bg-layer-default-pressed). 누르면 2px 거리 축소, 키보드 포커스에만 바깥 2px 링.
 * 도넛 범례 줄: 44 이상 · 색 네모 10 ↔ 8 · 이름 14 fg-neutral · % 14 fg-neutral-subtle · 금액 14 · 700 · "원". 누르는 줄은 List 줄과 같다.
 *
 * 레시피와 다른 자리 — ① 도넛 범례 줄의 호버 · 누름 바탕을 ::before 가 아니라 알약 요소(data-slot=chart-donut-pill)에 그린다(같은 자리 · 같은 모서리,
 *   검사기가 요소의 바탕을 읽을 수 있다). ② 표로 보기는 Table(아직 이 폴더에 없다)이 아니라 이 폴더의 단순한 <table> 이다 — Table 이 서면 바꾼다.
 *   ③ 다크가 문서가 아니라 하위 요소에 걸린 곳에서도 색이 맞게(열지도 툴팁의 띄울 자리 — chart-heatmap.tsx). ④ 도넛 구멍 · 칸 폭 같은 잰 값은
 *   ResizeObserver 콜백에서만 상태로 옮긴다(효과 안에서 바로 setState 하지 않는다 — 컴파일러 규칙). ⑤ 손 메모이제이션 없음.
 */

type AnyProps = Record<string, unknown>;

// ── 차트 상자 ─────────────────────────────────────────────────
type ChartContextValue = { hole: number | null };
const ChartContext = React.createContext<ChartContextValue>({ hole: null });

export interface ChartProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 요약 이름 — "{기간} {무엇} — {핵심 값}"(role="img" 의 이름) */
  label: string;
  /** 높이(px) — 쓰는 자리가 정한다(고정 비율을 두지 않는다) */
  height?: number;
  /** 대체가 되는 범례(지표 타일 · 목록)의 id — aria-describedby */
  legendId?: string;
  /** recharts 차트 하나 + ChartDonutCenter */
  children: React.ReactNode;
}

const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  (
    {
      label,
      height,
      legendId,
      className,
      style,
      children,
      onKeyDown,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const idPrefix = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const all = React.Children.toArray(children);
    const overlays = all.filter(
      (c) => React.isValidElement(c) && c.type === ChartDonutCenter,
    );
    const chart = all.find(
      (c): c is React.ReactElement<AnyProps> =>
        React.isValidElement(c) && c.type !== ChartDonutCenter,
    );
    const data = chart?.props.data;
    const navigable =
      chart != null &&
      chart.type !== RechartsPrimitive.PieChart &&
      Array.isArray(data) &&
      data.length > 0;

    // 도넛 구멍 — Pie 의 innerRadius(숫자)로 가운데 합계가 들어가는지 잰다
    const pie = chart
      ? React.Children.toArray(chart.props.children as React.ReactNode).find(
          (c): c is React.ReactElement<AnyProps> =>
            React.isValidElement(c) && c.type === RechartsPrimitive.Pie,
        )
      : undefined;
    const inner = pie?.props.innerRadius;
    const hole = typeof inner === "number" ? inner * 2 : null;

    // 라이브러리가 svg 에 다는 role="application" · tabindex(도넛 조각 g 포함)를 걷는다 — 차트 상자가 이름 있는 role="img" 하나다
    React.useLayoutEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const strip = () => {
        root.querySelectorAll("svg.recharts-surface").forEach((svg) => {
          if (svg.hasAttribute("tabindex")) svg.removeAttribute("tabindex");
          if (svg.hasAttribute("role")) svg.removeAttribute("role");
        });
        // 도넛 조각 묶음(g.recharts-pie)도 tabindex=0 을 달아 이름 없는 초점이 된다 — 안쪽 요소의 tabindex 도 걷는다(03E-004a)
        root
          .querySelectorAll("svg.recharts-surface [tabindex]")
          .forEach((el) => el.removeAttribute("tabindex"));
      };
      strip();
      const observer = new MutationObserver(strip);
      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["tabindex", "role"],
      });
      return () => observer.disconnect();
    }, []);

    // 키보드 — 상자에서 ← · → 를 라이브러리의 키보드 처리로 넘긴다(라이브러리는 svg 를 감싼 .recharts-wrapper 에서 받는다)
    const keyboard = React.useRef({ started: false });
    const [tipOpen, setTipOpen] = React.useState(false);
    const send = (event: Event) =>
      rootRef.current?.querySelector(".recharts-wrapper")?.dispatchEvent(event);
    const hide = () => {
      setTipOpen(false);
      send(new FocusEvent("focusout", { bubbles: true }));
    };
    useEscapeFirst(tipOpen, rootRef, hide);

    return (
      <ChartContext.Provider value={{ hole }}>
        <div
          ref={(node) => {
            rootRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          role="img"
          aria-label={label}
          aria-describedby={legendId}
          tabIndex={navigable ? 0 : undefined}
          data-slot="chart"
          className={cn(CHART_ROOT, className)}
          style={{ height, ...style }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (
              e.defaultPrevented ||
              e.target !== e.currentTarget ||
              !navigable
            )
              return;
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            if (!tipOpen) {
              setTipOpen(true);
              if (!keyboard.current.started) {
                // 처음 — 첫 날짜에 띄운다
                keyboard.current.started = true;
                send(new FocusEvent("focusin", { bubbles: true }));
              } else {
                // 다시 — 닫기 전 자리에 띄운다
                send(
                  new KeyboardEvent("keydown", {
                    key: "Enter",
                    bubbles: true,
                    cancelable: true,
                  }),
                );
              }
              return;
            }
            send(
              new KeyboardEvent("keydown", {
                key: e.key,
                bubbles: true,
                cancelable: true,
              }),
            );
          }}
          onBlur={(e) => {
            onBlur?.(e);
            if (e.target === e.currentTarget && tipOpen) hide();
          }}
          {...props}
        >
          {chart != null && (
            <RechartsPrimitive.ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 1, height: height ?? 1 }}
            >
              {withSeriesDefaults(chart, idPrefix)}
            </RechartsPrimitive.ResponsiveContainer>
          )}
          {overlays}
        </div>
      </ChartContext.Provider>
    );
  },
);
Chart.displayName = "Chart";

// ── 툴팁 ─────────────────────────────────────────────────────
// 가리킴 선 — 선 · 영역 차트는 points, 막대 차트는 그 칸의 가운데에 세로 점선
function ChartCrosshair(props: {
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const { points, x, y, width, height } = props;
  let line: [number, number, number, number] | null = null;
  if (points && points.length >= 2 && points[0] && points[1])
    line = [points[0].x, points[0].y, points[1].x, points[1].y];
  else if (x != null && y != null && width != null && height != null)
    line = [x + width / 2, y, x + width / 2, y + height];
  if (!line) return null;
  return (
    <line
      data-slot="chart-crosshair"
      x1={line[0]}
      y1={line[1]}
      x2={line[2]}
      y2={line[3]}
      strokeWidth={1}
      strokeDasharray="3 3"
      pointerEvents="none"
      className="stroke-stroke-neutral-weak"
    />
  );
}

type TooltipPayloadEntry = {
  name?: React.ReactNode;
  value?: unknown;
  dataKey?: unknown;
  color?: string;
  fill?: string;
  payload?: Record<string, unknown>;
  hide?: boolean;
};

export interface ChartTooltipContentProps {
  /** 머리 — 날짜 · 기간("10월 8일 (목)"). 기본은 받은 라벨 그대로 */
  headFormatter?: (label: React.ReactNode) => React.ReactNode;
  /** 값 — 기본 원까지("4,200,000원", 빼기 U+2212) */
  valueFormatter?: (value: number | string, key: string) => React.ReactNode;
  className?: string;
  // recharts 가 넣는 값
  active?: boolean;
  payload?: readonly TooltipPayloadEntry[];
  label?: React.ReactNode;
}

function ChartTooltipContent({
  active,
  payload,
  label,
  headFormatter,
  valueFormatter,
  className,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item) => item.value != null && !item.hide);
  if (rows.length === 0) return null;
  const head = headFormatter ? headFormatter(label) : label;
  return (
    <div
      aria-hidden
      data-slot="chart-tooltip"
      className={cn(TOOLTIP_SURFACE, className)}
    >
      {head != null && head !== "" && (
        <div
          data-slot="chart-tooltip-head"
          className="text-t2 text-fg-neutral-subtle"
        >
          {head}
        </div>
      )}
      {rows.map((item, i) => {
        const key =
          typeof item.dataKey === "string" || typeof item.dataKey === "number"
            ? String(item.dataKey)
            : String(item.name ?? i);
        const raw = item.value as number | string;
        const value = valueFormatter
          ? valueFormatter(raw, key)
          : typeof raw === "number"
            ? formatWon(raw)
            : raw;
        // 선 · 영역 · 막대는 계열 색, 도넛 조각은 그 조각의 fill(assignChartColors)
        const swatch =
          item.color ??
          item.fill ??
          (typeof item.payload?.fill === "string"
            ? item.payload.fill
            : undefined);
        return (
          <ChartTooltipRow
            key={key}
            swatch={swatch}
            name={item.name}
            value={value}
          />
        );
      })}
    </div>
  );
}
ChartTooltipContent.displayName = "ChartTooltipContent";

type ChartTooltipProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip>;

/** recharts Tooltip — 가리킴 선(세로 점선) · 떠 있는 표면 내용 · 차트 상자 안 겹침(1)을 기본으로 */
function ChartTooltip(props: ChartTooltipProps) {
  return (
    <RechartsPrimitive.Tooltip
      cursor={<ChartCrosshair />}
      content={<ChartTooltipContent />}
      offset={12}
      wrapperStyle={{ zIndex: 1, outline: "none" }}
      {...props}
    />
  );
}
ChartTooltip.displayName = "ChartTooltip";

// ── 지표 타일 ─────────────────────────────────────────────────
export interface ChartLegendItem {
  key: string;
  label: React.ReactNode;
  /** 계열 색 — 강조하지 않는 비교 계열(지난 기간)은 같은 색의 `-weak`(예: "blue-weak") */
  color: ChartTone;
  /** 합계 — 원까지 만든 글("4,200,000원") */
  total: React.ReactNode;
}

export interface ChartLegendTilesProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children" | "hidden"
> {
  items: ChartLegendItem[];
  /** 숨긴 계열의 key */
  hidden?: ReadonlySet<string>;
  onHiddenChange?: (hidden: Set<string>) => void;
}

const ChartLegendTiles = React.forwardRef<
  HTMLDivElement,
  ChartLegendTilesProps
>(
  (
    {
      items,
      hidden,
      onHiddenChange,
      id,
      className,
      "aria-label": ariaLabelProp,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const ariaLabel = ariaLabelProp ?? dsT("chart.legend");
    const off = hidden ?? new Set<string>();
    const shown = items.filter((item) => !off.has(item.key)).length;
    return (
      // 묶음의 이름은 바깥, 대체 글(aria-describedby 가 가리키는 id)은 안쪽 — 차트의 설명이 "수입 4,200,000원 지출 1,240,000원" 이 되게
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        data-slot="chart-legend-tiles"
        className={className}
        {...props}
      >
        <div
          id={id}
          data-slot="chart-legend-list"
          className="mb-x2 flex flex-wrap gap-x2"
        >
          {items.map((item) => {
            const on = !off.has(item.key);
            const locked = on && shown <= 1;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={on}
                aria-disabled={locked || undefined}
                data-slot="chart-legend-tile"
                data-key={item.key}
                className={cn(
                  LEGEND_TILE,
                  on ? SUBTLE_BG[item.color] : LEGEND_TILE_HIDDEN,
                )}
                onPointerDown={(e) => {
                  const el = e.currentTarget;
                  el.style.setProperty(
                    "--press-basis",
                    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
                  );
                }}
                onClick={() => {
                  // 마지막 하나는 끌 수 없다
                  if (locked) return;
                  const next = new Set(off);
                  if (on) next.add(item.key);
                  else next.delete(item.key);
                  onHiddenChange?.(next);
                }}
              >
                <span
                  data-slot="chart-legend-name"
                  className="flex items-center gap-x1_5 text-t3 text-fg-neutral-subtle"
                >
                  <span
                    aria-hidden
                    data-slot="chart-legend-dot"
                    className={cn(
                      "size-[8px] shrink-0 rounded-full",
                      DOT_BG[item.color],
                    )}
                  />
                  {item.label}
                </span>
                <span
                  data-slot="chart-legend-total"
                  className="mt-x0_5 text-t5 font-bold tabular-nums text-fg-neutral"
                >
                  {withCommaBreaks(item.total)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartLegendTiles.displayName = "ChartLegendTiles";

// ── 도넛 ─────────────────────────────────────────────────────
export interface ChartDonutLegendItem {
  key: string;
  label: React.ReactNode;
  color: ChartColor;
  /** "31%" */
  percent: React.ReactNode;
  /** 원까지 — "384,400원" */
  amount: React.ReactNode;
  /** 하위 카테고리가 있는 줄만 — 누르는 줄 */
  onClick?: () => void;
}

export interface ChartDonutLegendProps extends Omit<
  React.HTMLAttributes<HTMLUListElement>,
  "children"
> {
  items: ChartDonutLegendItem[];
}

function DonutLegendBody({ item }: { item: ChartDonutLegendItem }) {
  return (
    <>
      <span
        aria-hidden
        data-slot="chart-donut-swatch"
        className={cn(
          "size-[10px] shrink-0 rounded-[2px]",
          DONUT_NARROW.swatch,
          DOT_BG[item.color],
        )}
      />
      <span
        data-slot="chart-donut-label"
        className={cn("min-w-0 flex-1 text-fg-neutral", DONUT_NARROW.label)}
      >
        {item.label}
      </span>
      <span
        data-slot="chart-donut-percent"
        className={cn(
          "whitespace-nowrap tabular-nums text-fg-neutral-subtle",
          DONUT_NARROW.percent,
        )}
      >
        {item.percent}
      </span>
      <span
        data-slot="chart-donut-amount"
        className={cn(
          "font-bold tabular-nums text-fg-neutral",
          DONUT_NARROW.amount,
        )}
      >
        {withCommaBreaks(item.amount)}
      </span>
    </>
  );
}

const ChartDonutLegend = React.forwardRef<
  HTMLUListElement,
  ChartDonutLegendProps
>(({ items, className, ...props }, ref) => (
  <ul
    ref={ref}
    role="list"
    data-slot="chart-donut-legend"
    className={cn("m-0 flex list-none flex-col p-0", className)}
    {...props}
  >
    {items.map((item) => (
      <li
        key={item.key}
        data-slot="chart-donut-legend-item"
        className="@container/donut flex"
      >
        {item.onClick ? (
          <button
            type="button"
            data-slot="chart-donut-row"
            className={cn(DONUT_ROW, DONUT_ROW_PRESSABLE)}
            onClick={item.onClick}
          >
            <span
              aria-hidden
              data-slot="chart-donut-pill"
              className={DONUT_PILL}
            />
            <DonutLegendBody item={item} />
          </button>
        ) : (
          <div data-slot="chart-donut-row" className={DONUT_ROW}>
            <DonutLegendBody item={item} />
          </div>
        )}
      </li>
    ))}
  </ul>
));
ChartDonutLegend.displayName = "ChartDonutLegend";

export interface ChartDonutCenterProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 위 라벨 — "10월 지출"(12 · fg-neutral-subtle) */
  label?: React.ReactNode;
  /** 합계 — 원까지(16 / 22 · 700). 줄여 쓰지 않는다 */
  amount: React.ReactNode;
  /** 구멍에 들어가는지 — 들어가지 않으면 가운데 글을 그리지 않는다. 쓰는 쪽이 목록 위에 합계를 둔다 */
  onFitChange?: (fits: boolean) => void;
}

// 가운데 글 묶음의 모서리와 구멍 가장자리 사이 — 조각에 붙지 않게
const HOLE_INSET = 4;

function ChartDonutCenter({
  label,
  amount,
  onFitChange,
  className,
  ...props
}: ChartDonutCenterProps) {
  const { hole } = React.useContext(ChartContext);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [fits, setFits] = React.useState(true);
  const report = React.useRef(onFitChange);
  const last = React.useRef(true);
  React.useLayoutEffect(() => {
    report.current = onFitChange;
  });
  // 구멍에 들어가는지는 ResizeObserver 콜백에서 잰다 — 관찰을 시작하면 콜백이 한 번 먼저 불린다
  React.useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || hole == null) return;
    const observer = new ResizeObserver(() => {
      // 글 묶음(폭 × 높이)의 모서리가 구멍(원) 안에 들어가는지
      const next =
        Math.hypot(el.scrollWidth / 2, el.scrollHeight / 2) <=
        hole / 2 - HOLE_INSET;
      if (next === last.current) return;
      last.current = next;
      setFits(next);
      report.current?.(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hole, label, amount]);
  return (
    <div
      aria-hidden
      data-slot="chart-donut-center"
      data-fits={fits || undefined}
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        !fits && "invisible",
        className,
      )}
      {...props}
    >
      <div
        ref={textRef}
        className="flex w-max flex-col items-center text-center font-sans"
      >
        {label != null && (
          <span
            data-slot="chart-donut-center-label"
            className="text-t2 text-fg-neutral-subtle"
          >
            {label}
          </span>
        )}
        <span
          data-slot="chart-donut-center-amount"
          className="text-t5 font-bold whitespace-nowrap tabular-nums text-fg-neutral"
        >
          {amount}
        </span>
      </div>
    </div>
  );
}
ChartDonutCenter.displayName = "ChartDonutCenter";

// ── 표로 보기 ─────────────────────────────────────────────────
export type ChartDataTableColumn =
  string | { label: React.ReactNode; align?: "start" | "end" };

export interface ChartDataTableProps {
  /** 표 이름 — "10월 날짜별 수입 · 지출" */
  caption: string;
  /** 열 — 첫 열은 그 줄의 이름(날짜), 나머지는 기본 오른쪽(숫자) */
  columns: ChartDataTableColumn[];
  /** 줄 × 칸 — 돈은 원까지 만든 글 */
  rows: React.ReactNode[][];
  /** 기본 true — 숨긴 표(보조 기술만). false 면 차트 아래 펼친 표 */
  visuallyHidden?: boolean;
  className?: string;
}

const ALIGN = { start: "text-start", end: "text-end" } as const;

function ChartDataTable({
  caption,
  columns,
  rows,
  visuallyHidden = true,
  className,
}: ChartDataTableProps) {
  const cols = columns.map((column, i) =>
    typeof column === "string"
      ? {
          label: column,
          align: i === 0 ? ("start" as const) : ("end" as const),
        }
      : {
          label: column.label,
          align: column.align ?? (i === 0 ? "start" : "end"),
        },
  );
  return (
    <div
      data-slot="chart-data-table"
      className={cn(visuallyHidden && "sr-only", className)}
    >
      <table className="w-full border-collapse font-sans text-t3 text-fg-neutral">
        <caption className="pb-x2 text-start text-t3 font-bold text-fg-neutral-muted">
          {caption}
        </caption>
        <thead>
          <tr>
            {cols.map((column, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  "px-x2 py-x2 text-t2 font-bold text-fg-neutral-subtle",
                  ALIGN[column.align],
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-stroke-neutral-weak">
              {row.map((cell, c) =>
                c === 0 ? (
                  <th
                    key={c}
                    scope="row"
                    className={cn(
                      "px-x2 py-x2 font-normal",
                      ALIGN[cols[c]?.align ?? "start"],
                    )}
                  >
                    {cell}
                  </th>
                ) : (
                  <td
                    key={c}
                    className={cn(
                      "px-x2 py-x2 tabular-nums",
                      ALIGN[cols[c]?.align ?? "end"],
                    )}
                  >
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
ChartDataTable.displayName = "ChartDataTable";

export {
  Chart,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendTiles,
  ChartDonutLegend,
  ChartDonutCenter,
  ChartDataTable,
};
