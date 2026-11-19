import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/lib/cn";

import { ChartTooltipRow } from "./chart-tooltip-row";
import {
  HEAT_LABEL_COLUMN,
  HEAT_STEP_BG,
  HEAT_STEP_SWATCH,
  HEAT_STEP_TEXT,
  HEAT_TEXT_MIN_CELL_WIDTH,
  computeHeatTexts,
  heatStep,
} from "./chart-heatmap-variants";
import { TOOLTIP_SURFACE, formatWon } from "./chart-variants";
import { useEscapeFirst } from "./use-escape-first";
import { useDsText } from "@/shared/ds/i18n";
import { useWeekdayNarrow, WeekdayProbe } from "@/shared/ds/date-picker";

/*
 * Groo Chart 의 열지도 — 요일 × 시간 같은 두 축의 세기. 수치 원본은 groo-design specs/components/chart.yaml 의 heatmapCell · heatmapValue.
 * groo-design recipes/shadcn/components/ui/chart.tsx 의 ChartHeatmap 을 파일로 나눴다(chart.tsx 는 컴포넌트가 많다).
 *
 * 왼쪽 시간대 라벨 열 56(이름 13 · 700 + 시간 11 · fg-neutral-subtle) + 요일 칸, 위 요일 머리 12 · fg-neutral-subtle. 칸은 정사각형 · 모서리 4 · 사이 6.
 * 세기 다섯 — bg-brand-solid 를 카드 면에 18 · 35 · 55 · 76 · 100% 섞는다(가장 큰 값의 8 · 22 · 45 · 75% 에서 끊는다), 값이 없으면 bg-neutral-weak.
 * 가장 큰 칸에 고리를 두르지 않는다(사용자 결정 22A — 포커스 링과 헷갈린다).
 * 칸 폭(ResizeObserver 로 잰다)이 textMinCellWidth(112) 이상일 때만 칸에 원까지(11 / 15 · 700 · 고정폭 숫자, 빈 칸은 "—" fg-neutral-subtle),
 * 좁으면 글 없이 세기 색만 — 글자를 줄이거나 돈을 줄여("3.5만") 쓰지 않는다. 값은 툴팁 · 표로 보기가 준다.
 * 칸 글자색은 단계마다 한 번 정한다 — 그 단계 바탕 위 fg-neutral 이 4.5 를 넘으면 fg-neutral, 아니면 static-white.
 * 툴팁(머리 tooltipLabel · 줄 "■ {valueLabel} 값", 네모는 그 칸의 세기 색)은 가리키면(마우스) · 누르면(터치 — 다른 곳을 누를 때까지) ·
 * 키보드로 옮기면 뜬다 — 글이 보이는 넓은 칸에서도.
 * 열지도의 글(시간대 라벨 · 요일 머리 · 칸 값)은 글자 크기 설정을 따르지 않는다(`-static` — chart.md "글자 크기", groo-design #260).
 * 툴팁 · 표로 보기는 커지고, 값은 그 자리에서 크게 읽는다. 키보드: 상자(Tab 한 칸)에서 ← → 요일 · ↑ ↓ 시간대(처음 누르면 첫 칸), 지금 칸에
 * 바깥 2px 링(띄움 2), Esc · 떠나면 닫는다. 툴팁은 화면 위 떠 있는 층(z-floating 200, 포털)이라 카드 모서리에 잘리지 않는다.
 *
 * 레시피와 다른 자리 — ① 칸 글자색 · 툴팁 자리를 상태가 아니라 DOM(CSS 변수 · style)에 쓴다(효과 안에서 setState 하지 않는다 — 컴파일러 규칙).
 *   ② 툴팁의 포털 자리는 body 가 아니라 가장 가까운 다크 판(.dark · [data-theme])이다 — 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의 다크 판)에서도 색이 맞게.
 */

export interface ChartHeatmapRow {
  key: string;
  /** 시간대 이름 — "저녁"(13 · 700) */
  label: React.ReactNode;
  /** 시간 — "18~22시"(11 · fg-neutral-subtle) */
  sub?: React.ReactNode;
}

export interface ChartHeatmapColumn {
  key: string;
  /** 요일 — "수" · 영어 두 글자 "We"(12 · fg-neutral-subtle, 글자 크기 설정을 따르지 않는다 — text-t2-static) */
  label: React.ReactNode;
  /**
   * 칸에 [label] 이 들지 않을 때의 요일 — 영어 한 글자 "W"(groo-design #256 International Design "날짜"). 주면 칸마다 [label] 견본을 두고
   * 하나라도 칸을 넘으면 모든 칸을 이 글로 줄인다(날짜 고르기 요일 줄과 같은 판정 — `useWeekdayNarrow`). 요일 머리는 줄을 바꾸지 않는다
   */
  narrowLabel?: React.ReactNode;
}

export interface ChartHeatmapProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 요약 이름 — role="img" 의 이름("10월 요일 · 시간대별 지출, 가장 많은 때 토요일 저녁") */
  label: string;
  rows: ChartHeatmapRow[];
  columns: ChartHeatmapColumn[];
  /** 줄 × 칸 — 0 · null 은 값 없음 */
  values: (number | null | undefined)[][];
  /** 칸 · 툴팁의 값 — 기본 원까지("35,000원") */
  formatValue?: (value: number) => string;
  /** 툴팁 줄의 이름 — 기본 "지출"("■ 지출 35,000원") */
  valueLabel?: string;
  /** 칸 폭이 이보다 좁으면 칸에 글을 두지 않는다 — 기본 112 */
  textMinCellWidth?: number;
  /** 툴팁 머리 — 기본 "{요일} {시간대} {시간}" */
  tooltipLabel?: (
    row: ChartHeatmapRow,
    column: ChartHeatmapColumn,
  ) => React.ReactNode;
}

type HeatActive = {
  row: number;
  col: number;
  source: "pointer" | "touch" | "keyboard";
  /** 툴팁을 띄울 자리 — 다크 판이 하위 요소면 그 안 */
  container: Element;
};

const themeContainer = (el: Element) =>
  el.closest("[data-theme], .dark") ?? el.ownerDocument.body;

const ChartHeatmap = React.forwardRef<HTMLDivElement, ChartHeatmapProps>(
  (
    {
      label,
      rows,
      columns,
      values,
      formatValue = formatWon,
      valueLabel: valueLabelProp,
      textMinCellWidth = HEAT_TEXT_MIN_CELL_WIDTH,
      tooltipLabel,
      className,
      onKeyDown,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const valueLabel = valueLabelProp ?? dsT("chartHeatmap.value");
    const rootRef = React.useRef<HTMLDivElement>(null);
    const firstCellRef = React.useRef<HTMLSpanElement>(null);
    const tipRef = React.useRef<HTMLDivElement>(null);
    const [cellWidth, setCellWidth] = React.useState(0);
    const [active, setActive] = React.useState<HeatActive | null>(null);
    const max = Math.max(
      0,
      ...values.flat().map((v) => (typeof v === "number" && v > 0 ? v : 0)),
    );
    const showText = cellWidth >= textMinCellWidth;
    // 요일 머리 — 칸에 두 글자가 들지 않으면 모든 칸을 narrowLabel 로(narrowLabel 이 없으면 견본도 두지 않는다)
    const fits = columns.some((c) => c.narrowLabel != null);
    const narrow = useWeekdayNarrow(
      rootRef,
      columns.map((c) => String(c.label)).join("\u0000"),
    );

    // 칸 폭 — 창 크기 · 회전에 따라 112 를 넘나들면 글을 보이고 감춘다(글자 크기는 그대로). 관찰을 시작하면 콜백이 한 번 먼저 불린다
    React.useLayoutEffect(() => {
      const cell = firstCellRef.current;
      if (!cell) return;
      const observer = new ResizeObserver(() =>
        setCellWidth(cell.getBoundingClientRect().width),
      );
      observer.observe(cell);
      return () => observer.disconnect();
    }, [columns.length, rows.length]);

    // 칸 글자색 — 브랜드 · 모드(문서의 class · data-theme · 색 모드)가 바뀔 때 다섯 단계만 다시 정해 CSS 변수에 쓴다
    React.useLayoutEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const apply = () => {
        const texts = computeHeatTexts(root);
        if (!texts) return;
        texts.forEach((t, i) =>
          root.style.setProperty(
            `--heat-text-${i}`,
            t === "white"
              ? "var(--color-static-white)"
              : "var(--color-fg-neutral)",
          ),
        );
      };
      apply();
      const doc = root.ownerDocument;
      const observer = new MutationObserver(apply);
      observer.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
      // 다크 판이 하위 요소면 그 요소의 class · data-theme 도 본다
      const scope = root.closest("[data-theme], .dark");
      if (scope && scope !== doc.documentElement)
        observer.observe(scope, {
          attributes: true,
          attributeFilter: ["class", "data-theme"],
        });
      const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
      scheme?.addEventListener?.("change", apply);
      return () => {
        observer.disconnect();
        scheme?.removeEventListener?.("change", apply);
      };
    }, []);

    // 툴팁 자리 — 칸 위 8(모자라면 아래), 화면 가장자리와 8. 스크롤 · 크기가 바뀌면 따라간다(요소의 style 에 직접 쓴다)
    React.useLayoutEffect(() => {
      if (!active) return;
      const place = () => {
        const cell = rootRef.current?.querySelector<HTMLElement>(
          `[data-row="${active.row}"][data-col="${active.col}"]`,
        );
        const tip = tipRef.current;
        if (!cell || !tip) return;
        const c = cell.getBoundingClientRect();
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;
        const left = Math.min(
          Math.max(8, c.left + c.width / 2 - w / 2),
          window.innerWidth - 8 - w,
        );
        const above = c.top - 8 - h;
        tip.style.left = `${left}px`;
        tip.style.top = `${above >= 8 ? above : c.bottom + 8}px`;
        tip.style.visibility = "visible";
      };
      place();
      window.addEventListener("scroll", place, true);
      window.addEventListener("resize", place);
      return () => {
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
      };
    }, [active]);

    // 터치로 띄운 툴팁은 다른 곳을 누를 때까지 남는다
    React.useEffect(() => {
      if (active?.source !== "touch") return;
      const onDown = (e: PointerEvent) => {
        const target = e.target instanceof Element ? e.target : null;
        if (
          target?.closest('[data-slot="chart-heatmap-cell"]') &&
          rootRef.current?.contains(target)
        )
          return;
        setActive(null);
      };
      document.addEventListener("pointerdown", onDown, true);
      return () => document.removeEventListener("pointerdown", onDown, true);
    }, [active?.source]);

    useEscapeFirst(active?.source === "keyboard", rootRef, () =>
      setActive(null),
    );

    const activeRow = active ? rows[active.row] : undefined;
    const activeCol = active ? columns[active.col] : undefined;
    const activeValue = active ? values[active.row]?.[active.col] : undefined;
    const activeStep = active ? heatStep(activeValue, max) : -1;

    return (
      <div
        ref={(node) => {
          rootRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        role="img"
        aria-label={label}
        tabIndex={0}
        data-slot="chart-heatmap"
        className={cn(
          "relative grid w-full gap-x1_5 rounded-r2 font-sans",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
          className,
        )}
        style={{
          gridTemplateColumns: `${HEAT_LABEL_COLUMN}px repeat(${columns.length}, minmax(0, 1fr))`,
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || e.target !== e.currentTarget) return;
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
          };
          const step = moves[e.key];
          if (!step || rows.length === 0 || columns.length === 0) return;
          e.preventDefault();
          const container = themeContainer(e.currentTarget);
          setActive((prev) =>
            prev?.source === "keyboard"
              ? {
                  row: Math.min(
                    rows.length - 1,
                    Math.max(0, prev.row + step[0]),
                  ),
                  col: Math.min(
                    columns.length - 1,
                    Math.max(0, prev.col + step[1]),
                  ),
                  source: "keyboard",
                  container,
                }
              : // 처음 — 첫 칸(마우스로 짚던 칸이 있으면 그 칸)부터
                {
                  row: prev?.row ?? 0,
                  col: prev?.col ?? 0,
                  source: "keyboard",
                  container,
                },
          );
        }}
        onBlur={(e) => {
          onBlur?.(e);
          if (e.target === e.currentTarget && active?.source === "keyboard")
            setActive(null);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && active?.source === "pointer")
            setActive(null);
        }}
        {...props}
      >
        <span aria-hidden />
        {columns.map((column) => (
          <span
            key={column.key}
            aria-hidden
            data-slot="chart-heatmap-column"
            className={cn(
              "relative whitespace-nowrap text-center text-fg-neutral-subtle text-t2-static",
            )}
          >
            {narrow && column.narrowLabel != null
              ? column.narrowLabel
              : column.label}
            {fits && <WeekdayProbe>{column.label}</WeekdayProbe>}
          </span>
        ))}
        {rows.map((row, r) => (
          <React.Fragment key={row.key}>
            <span
              aria-hidden
              data-slot="chart-heatmap-row"
              className="flex min-w-0 flex-col justify-center"
            >
              <span className="text-t3-static font-bold text-fg-neutral">
                {row.label}
              </span>
              {row.sub != null && (
                <span className="text-t1-static text-fg-neutral-subtle">
                  {row.sub}
                </span>
              )}
            </span>
            {columns.map((column, c) => {
              const value = values[r]?.[c];
              const step = heatStep(value, max);
              const isActive = active?.row === r && active.col === c;
              return (
                <span
                  key={column.key}
                  ref={r === 0 && c === 0 ? firstCellRef : undefined}
                  aria-hidden
                  data-slot="chart-heatmap-cell"
                  data-row={r}
                  data-col={c}
                  data-step={step}
                  data-active={isActive ? active.source : undefined}
                  className={cn(
                    "flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-r1 text-t1-static font-bold whitespace-nowrap tabular-nums",
                    step < 0
                      ? "bg-bg-neutral-weak text-fg-neutral-subtle"
                      : cn(HEAT_STEP_BG[step], HEAT_STEP_TEXT[step]),
                    // 키보드로 온 칸 — 바깥 2px 링(띄움 2). 가장 큰 칸의 고리는 두지 않는다
                    isActive &&
                      active.source === "keyboard" &&
                      "outline-2 outline-offset-2 outline-stroke-focus-ring",
                  )}
                  onPointerMove={(e) => {
                    if (e.pointerType === "mouse" && !isActive)
                      setActive({
                        row: r,
                        col: c,
                        source: "pointer",
                        container: themeContainer(e.currentTarget),
                      });
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType !== "mouse")
                      setActive({
                        row: r,
                        col: c,
                        source: "touch",
                        container: themeContainer(e.currentTarget),
                      });
                  }}
                >
                  {showText
                    ? step < 0
                      ? "—"
                      : formatValue(value as number)
                    : null}
                </span>
              );
            })}
          </React.Fragment>
        ))}
        {active &&
          activeRow &&
          activeCol &&
          createPortal(
            <div
              ref={tipRef}
              aria-hidden
              data-slot="chart-heatmap-tooltip"
              className={cn(
                TOOLTIP_SURFACE,
                "pointer-events-none fixed z-(--z-floating)",
              )}
              // 자리를 잡기 전에는 보이지 않는다 — 효과가 style 로 left · top 과 visibility 를 쓴다
              style={{ left: 0, top: 0, visibility: "hidden" }}
            >
              <div
                data-slot="chart-tooltip-head"
                className="text-t2 text-fg-neutral-subtle"
              >
                {tooltipLabel
                  ? tooltipLabel(activeRow, activeCol)
                  : [
                      activeCol.label,
                      " ",
                      activeRow.label,
                      activeRow.sub != null ? " " : "",
                      activeRow.sub,
                    ]}
              </div>
              <ChartTooltipRow
                swatch={
                  activeStep < 0
                    ? "var(--color-bg-neutral-weak)"
                    : HEAT_STEP_SWATCH[activeStep]
                }
                name={valueLabel}
                value={
                  activeStep < 0
                    ? dsT("common.none")
                    : formatValue(activeValue as number)
                }
              />
            </div>,
            active.container,
          )}
      </div>
    );
  },
);
ChartHeatmap.displayName = "ChartHeatmap";

export { ChartHeatmap };
