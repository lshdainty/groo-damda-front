import type * as React from "react";
import { dsLanguage, dsMoney } from "@/shared/ds/i18n";
/*
 * Groo Chart 의 값 · 모양 · 숫자 — 수치 원본은 groo-design specs/components/chart.yaml(값은 src/shared/ds/spec/chart.json),
 * 색은 DESIGN.md v110(차트 10색 — 라이트 팔레트 700 · 다크 800-dark) · v111(옅은 바탕).
 * groo-design recipes/shadcn/components/ui/chart.tsx 를 첫 판으로 가져왔다 — 이 파일은 컴포넌트 아닌 것(색 배정 · 숫자 · 축 값 ·
 * 클래스), 컴포넌트는 chart.tsx · chart-heatmap.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// ── 색 ───────────────────────────────────────────────────────
export type ChartColor =
  | "blue"
  | "green"
  | "orange"
  | "violet"
  | "pink"
  | "indigo"
  | "red"
  | "yellow"
  | "brown"
  | "gray";

/** 색이 없는 항목의 배정 순서(v110) — 회색은 "기타" 전용이라 없다. 수입은 blue, 지출은 red */
export const CHART_ORDER: readonly ChartColor[] = [
  "blue",
  "green",
  "orange",
  "violet",
  "pink",
  "indigo",
  "red",
  "yellow",
  "brown",
];

/** 항목이 이 개수를 넘으면 상위 9 + 회색 "기타" 로 묶는다 */
export const CHART_MAX_ITEMS = 10;

/** 차트 색 + 같은 색의 옅은 단계(v111) — 강조하지 않는 비교 계열(지난 기간)의 색 */
export type ChartTone = ChartColor | `${ChartColor}-weak`;

export const chartVar = (color: ChartTone) => `var(--color-chart-${color})`;

/**
 * 계열 표식(지표 타일 점 · 툴팁 색 네모)의 꼴 — 막대 모양을 따른다(chart.md "미리 잡는 일정의 값은 예외" · groo-design #251).
 * `fill` 은 계열 색 채움(기본). `outline` 은 옅은 바탕(`chart-{색}-subtle`) + 1px 계열 색 테두리 — 옅은 바탕 + 테두리로 그린 계열(예정)이
 * 같은 색의 채운 계열(쓴 값)과 표식으로도 갈린다.
 */
export type ChartMarker = "fill" | "outline";

/** outline 표식의 테두리 — 1px 계열 색(인라인 border, 크기는 그대로 — box-sizing border-box). 색이 var() 라 낱칸으로 적는다 */
export const outlineMarkerStyle = (color: string): React.CSSProperties => ({
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: color,
});

// Tailwind 는 소스의 글자 그대로를 읽으므로 열을 다 적는다
export const DOT_BG: Record<ChartTone, string> = {
  blue: "bg-chart-blue",
  green: "bg-chart-green",
  orange: "bg-chart-orange",
  violet: "bg-chart-violet",
  pink: "bg-chart-pink",
  indigo: "bg-chart-indigo",
  red: "bg-chart-red",
  yellow: "bg-chart-yellow",
  brown: "bg-chart-brown",
  gray: "bg-chart-gray",
  "blue-weak": "bg-chart-blue-weak",
  "green-weak": "bg-chart-green-weak",
  "orange-weak": "bg-chart-orange-weak",
  "violet-weak": "bg-chart-violet-weak",
  "pink-weak": "bg-chart-pink-weak",
  "indigo-weak": "bg-chart-indigo-weak",
  "red-weak": "bg-chart-red-weak",
  "yellow-weak": "bg-chart-yellow-weak",
  "brown-weak": "bg-chart-brown-weak",
  "gray-weak": "bg-chart-gray-weak",
};

export const SUBTLE_BG: Record<ChartTone, string> = {
  blue: "bg-chart-blue-subtle",
  green: "bg-chart-green-subtle",
  orange: "bg-chart-orange-subtle",
  violet: "bg-chart-violet-subtle",
  pink: "bg-chart-pink-subtle",
  indigo: "bg-chart-indigo-subtle",
  red: "bg-chart-red-subtle",
  yellow: "bg-chart-yellow-subtle",
  brown: "bg-chart-brown-subtle",
  gray: "bg-chart-gray-subtle",
  "blue-weak": "bg-chart-blue-subtle",
  "green-weak": "bg-chart-green-subtle",
  "orange-weak": "bg-chart-orange-subtle",
  "violet-weak": "bg-chart-violet-subtle",
  "pink-weak": "bg-chart-pink-subtle",
  "indigo-weak": "bg-chart-indigo-subtle",
  "red-weak": "bg-chart-red-subtle",
  "yellow-weak": "bg-chart-yellow-subtle",
  "brown-weak": "bg-chart-brown-subtle",
  "gray-weak": "bg-chart-gray-subtle",
};

export type ChartColored<T> = T & {
  /** 차트 색 이름 — 범례 · 타일 */
  color: ChartColor;
  /** var(--color-chart-{색}) — recharts 의 fill · stroke(Pie 는 data 의 fill 을 쓴다) */
  fill: string;
};

export interface AssignChartColorsOptions<T> {
  /** 저장된 색 — 카테고리 · 계좌에 사용자가 고른 색. 없으면 null */
  colorOf?: (item: T) => ChartColor | null | undefined;
  /** 10개를 넘을 때 상위 9 뒤의 항목을 하나로 묶은 "기타"(회색) — 항목은 큰 순서로 넘긴다 */
  groupOthers?: (rest: T[]) => T;
}

/**
 * 저장된 색 먼저, 나머지는 그 차트에서 아직 쓰지 않은 색부터 배정 순서로(사용자 결정 9A) — 저장된 색과 같은 색이 두 번 나오지 않는다.
 * 10개를 넘으면 상위 9 + 회색 "기타". 회색은 "기타" 에만 — 색이 없다고 주지 않는다.
 */
export function assignChartColors<T extends object>(
  items: readonly T[],
  { colorOf, groupOthers }: AssignChartColorsOptions<T> = {},
): ChartColored<T>[] {
  const over = items.length > CHART_MAX_ITEMS;
  const head = over ? items.slice(0, 9) : [...items];
  const rest = over ? items.slice(9) : [];
  const saved = head.map((item) => colorOf?.(item) ?? null);
  const used = new Set(saved.filter((c): c is ChartColor => c != null));
  const free = CHART_ORDER.filter((c) => !used.has(c));
  let next = 0;
  const out: ChartColored<T>[] = head.map((item, i) => {
    let color = saved[i];
    if (color == null) {
      // 쓰지 않은 색이 다 떨어지면(저장된 색이 많을 때) 배정 순서를 처음부터 다시 쓴다
      color =
        free[next] ??
        CHART_ORDER[(next - free.length) % CHART_ORDER.length] ??
        "blue";
      next++;
    }
    return { ...item, color, fill: chartVar(color) };
  });
  if (over) {
    if (groupOthers) {
      out.push({
        ...groupOthers(rest),
        color: "gray",
        fill: chartVar("gray"),
      });
    } else {
      if (import.meta.env.DEV)
        console.warn(
          '[assignChartColors] 10개가 넘으면 groupOthers 로 상위 9 뒤를 "기타" 하나로 묶는다.',
        );
      for (const item of rest)
        out.push({ ...item, color: "gray", fill: chartVar("gray") });
    }
  }
  return out;
}

// ── 숫자 ─────────────────────────────────────────────────────
/** 빼기는 U+2212 하나 — 같은 차트 안에서 "-" 와 "−" 를 섞지 않는다 */
export const MINUS = "−";
const round1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;

/** 축 단위 — 눈금 가운데 가장 큰 절댓값이 그 값 이상이면 그 축의 모든 눈금이 그 단위다(큰 것부터) */
const AXIS_UNITS = [
  { min: 1e12, label: "조" },
  { min: 1e8, label: "억" },
  { min: 1e4, label: "만" },
] as const;

/** 영어 축 단위 — 천 단위로 센다(chart.md "축 · 격자" · International Design, groo-design #250). 1,000M 이 아니라 1B */
const AXIS_UNITS_EN = [
  { min: 1e9, label: "B" },
  { min: 1e6, label: "M" },
  { min: 1e3, label: "K" },
] as const;

/**
 * 눈금 글자 — **한 축은 한 단위**(chart.md "축 · 격자"). 그 축의 눈금([ticks]) 가운데 가장 큰 절댓값이 1억 이상이면 모든 눈금을
 * 억 단위(0.5억 · 1억 · 1.5억), 1만 이상이면 만 단위(0.5만 · 1만 · 1.5만), 아니면 쉼표 정수(2,000 · 4,000)로 쓴다(조도 같은 셈).
 * 값 하나만 보고 정하면 한 축에 "5,000 · 1만" · "5,000만 · 1억" 이 섞인다. 소수는 한 자리(.0 은 버린다) — 눈금 간격이
 * 1 · 2 · 5 × 10ⁿ(`niceAxis`)이라 한 자리 안에서 글자가 눈금 위치와 맞는다. 0 은 "0", 빼기는 U+2212.
 * [ticks] 는 그 축이 그리는 눈금 목록 그대로다 — 세로축 폭도 같은 목록 · 같은 글자로 잰다(`niceValueAxis`).
 * 영어는 천 단위로 센다 — 가장 큰 절댓값이 1B 이상이면 B, 1M 이상이면 M, 1K 이상이면 K, 아니면 쉼표 정수(0.5K · 1K · 500K · 1M ·
 * 1.5B — 1,000M 이 아니라 1B). 예전엔 값마다 compact 로 줄여 한 축에 "500 · 1K" 가 섞였다. 언어는 앱 i18n(i18next)을 따른다.
 */
export function formatAxisWon(value: number, ticks: readonly number[]): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? MINUS : "";
  const n = Math.abs(value);
  // 영어는 천 단위(K · M · B), 한국어는 만 단위(만 · 억 · 조) — 한 축은 한 단위(가장 큰 절댓값으로 고른다)
  const en = dsLanguage().startsWith("en");
  const locale = en ? "en-US" : "ko-KR";
  const axisMax = Math.max(
    n,
    ...ticks.filter(Number.isFinite).map((t) => Math.abs(t)),
  );
  const unit = (en ? AXIS_UNITS_EN : AXIS_UNITS).find((u) => axisMax >= u.min);
  if (!unit) return sign + Math.round(n).toLocaleString(locale);
  if (n === 0) return "0";
  return (
    sign +
    round1(n / unit.min).toLocaleString(locale, { maximumFractionDigits: 1 }) +
    unit.label
  );
}

/** 도넛 두께 — 지름 ÷ 10 + 6 을 정수로(120 → 18 · 160 → 22 · 180 → 24). 문턱 없이 지름을 따라 고르게 굵어진다(Q-012-5 C) */
export const chartDonutThickness = (diameter: number) =>
  Math.round(diameter / 10 + 6);

/** 도넛 지름에서 Pie 의 반지름 — 차트 높이를 지름과 같게 두고 <Pie {...chartDonutRadii(160)}> 로 펼친다 */
export const chartDonutRadii = (diameter: number) => {
  const outerRadius = diameter / 2;
  return {
    innerRadius: outerRadius - chartDonutThickness(diameter),
    outerRadius,
  };
};

/** 돈은 줄이지 않고 원까지(툴팁 · 지표 타일 · 도넛 가운데 · 열지도 칸 · 대체 표) — 빼기는 U+2212 */
export const formatWon = (value: number) =>
  (value < 0 ? MINUS : "") + dsMoney(Math.abs(value));

// ── 축 · 격자 ─────────────────────────────────────────────────
export interface ChartAxisOptions {
  /** 이중 축 — 그 축이 맡은 계열의 색. 주지 않으면 fg-neutral-subtle */
  color?: ChartColor;
}

/**
 * 눈금 글자 크기 — 11 / 15(rem 이라 설정의 글자 크기 · 200% 를 따른다) · 고정폭 숫자.
 * SVG 글자는 var() 를 속성으로 못 받아 토큰(`--text-t1` = 0.6875rem)과 같은 값을 적는다.
 * 세로축 폭 측정(`axisWidth.ts` AXIS_TICK_FONT_SIZE)이 같은 토큰이라 폭 · 글자가 늘 같이 움직인다.
 */
export const CHART_TICK_SIZE = "0.6875rem";

/**
 * 눈금 글자 사이 최소 거리 — `spacing-x2`(8). 겹치면 recharts 가 사이 눈금을 건너뛴다(chart.md "큰 글자" — 웹 · 앱 같음,
 * 앱 `p_chart_cartesian` 의 칸 셈도 글자 폭 + 8). recharts 기본값 5 를 쓰지 않는다.
 */
export const CHART_TICK_GAP = 8;

/** XAxis · YAxis 에 펼친다 — 눈금 11 · fg-neutral-subtle(이중 축이면 계열 색) · 축 선 · 눈금 선 없음 · 눈금과 그리는 자리 사이 8 · 눈금 글자 사이 최소 8 */
export function chartAxisProps({ color }: ChartAxisOptions = {}) {
  return {
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
    minTickGap: CHART_TICK_GAP,
    tick: {
      fill: color ? chartVar(color) : "var(--color-fg-neutral-subtle)",
      fontSize: CHART_TICK_SIZE,
    },
  } as const;
}

// ── 가로 눈금 솎기 · 연도 ─────────────────────────────────────
/** 가로 눈금 하나 — 연도 없는 글([label])과 해가 바뀔 때 쓰는 글([yearLabel]), 그 칸의 해([year]). 해가 없으면 연도를 붙이지 않는다 */
export interface ChartXTick {
  label: string;
  yearLabel?: string;
  year?: number;
}

const withYear = (t: ChartXTick, prevYear: number | undefined) =>
  t.yearLabel != null &&
  t.year != null &&
  prevYear != null &&
  t.year !== prevYear
    ? t.yearLabel
    : t.label;

/** 모든 눈금이 보일 때의 글 — 해가 바뀌는 첫 눈금에만 연도. 눈금 글자 폭을 재는 기준이다(앱이 categories 로 재는 글과 같다) */
export const chartXTickFullLabels = (ticks: readonly ChartXTick[]): string[] =>
  ticks.map((t, i) => withYear(t, i > 0 ? ticks[i - 1]!.year : undefined));

/**
 * 가로 눈금 간격 — 글자 사이 최소 8(`CHART_TICK_GAP`)로 몇 칸이 들어가는지 세어, 끝(가장 최근) 눈금을 지키고 앞에서부터 건너뛴다
 * (chart.md "큰 글자"). 앱 `p_chart_cartesian` 과 같은 셈 — 들어가는 수 = ⌊그리는 폭 ÷ (가장 긴 글 + 8)⌋, 간격 = ⌈칸 수 ÷ 들어가는 수⌉.
 */
export function chartXTickInterval(
  count: number,
  plotWidth: number,
  labelWidth: number,
): number {
  const fit = Math.max(
    1,
    Math.floor(Math.max(0, plotWidth) / (labelWidth + CHART_TICK_GAP)),
  );
  return Math.max(1, Math.ceil(count / fit));
}

/**
 * 보이는 눈금의 글 — 건너뛴 눈금은 null. 끝 눈금에서 [interval] 칸마다 남긴다.
 * 연도는 **보이는 눈금** 기준이다: 앞에 보이는 눈금(첫 눈금이면 맨 앞 칸)과 해가 다르면 연도를 붙인다 — 해가 바뀌는 칸이
 * 건너뛰기로 빠지면 그 뒤 처음 보이는 눈금이 연도를 이어받는다("12월 · 2026. 2. · 4월", 연도가 통째로 사라지지 않는다).
 */
export function chartXTickLabels(
  ticks: readonly ChartXTick[],
  interval: number,
): (string | null)[] {
  let prevYear = ticks[0]?.year;
  return ticks.map((t, i) => {
    if ((ticks.length - 1 - i) % Math.max(1, interval) !== 0) return null;
    const label = withYear(t, prevYear);
    if (t.year != null) prevYear = t.year;
    return label;
  });
}

/**
 * 끝 눈금 글의 자리 — 그리는 자리 오른쪽에 비울 폭(chart.md "큰 글자" · "끝 글 자리는 비워 둡니다"). 끝 글 가운데가 그리는 자리 오른쪽
 * 끝에 서므로 글 폭의 절반이 그 밖으로 나간다. 오른쪽 세로축이 있으면 그 축 폭이 먼저 그 자리를 덮고, 모자란 만큼만 더 비운다 —
 * 끝 글이 차트 오른쪽 끝(오른쪽 축 바깥 끝)을 넘지 않는다.
 *
 *   오른쪽 축이 없으면   비울 폭 = max(8, ⌈끝 글 폭 ÷ 2⌉)
 *   오른쪽 축이 있으면   비울 폭 = max(0, ⌈끝 글 폭 ÷ 2⌉ − 오른쪽 축 폭) — 축 폭과 더해 오른쪽 자리 = max(오른쪽 축 폭, ⌈끝 글 폭 ÷ 2⌉)
 *                        (오른쪽 축 아래 눈금 줄은 비어 있어 끝 글이 그 자리를 같이 쓴다 — 앱 p_chart_cartesian 과 같다)
 *
 * 끝 글 폭은 연도를 단 글("2026. 1.")과 안 단 글 가운데 넓은 쪽이다 — 건너뛰기에 따라 끝 글에 연도가 붙을 수 있다.
 * 끝 글을 안으로 당기다 앞 글을 빼는 일이 없어, 건너뛴 간격이 끝까지 고르다(앱 p_chart_cartesian 과 같은 셈).
 */
export function chartXEndReserve(
  ticks: readonly ChartXTick[],
  widthOf: (label: string) => number,
  rightAxisWidth = 0,
): number {
  const tail = ticks[ticks.length - 1];
  if (!tail) return 0;
  const w = Math.max(
    widthOf(tail.label),
    tail.yearLabel != null ? widthOf(tail.yearLabel) : 0,
  );
  const half = Math.ceil(w / 2);
  // 오른쪽 축이 없으면 적어도 8(앱과 같다), 있으면 축 폭이 먼저 덮고 모자란 만큼만
  return rightAxisWidth > 0
    ? Math.max(0, half - rightAxisWidth)
    : Math.max(CHART_TICK_GAP, half);
}

/** CartesianGrid 에 펼친다 — 가로 점선(3 · 3) stroke-neutral-subtle 만. 세로 격자 · 축 선은 긋지 않는다 */
export const chartGridProps = {
  vertical: false,
  strokeDasharray: "3 3",
  stroke: "var(--color-stroke-neutral-subtle)",
} as const;

// ── 계열 기본값 ───────────────────────────────────────────────
/** 가리킨 자리의 점 — r 4 + 테두리 2(바깥 지름 10), 테두리는 카드 면 색. 늘 찍어 두지 않는다 */
export const ACTIVE_DOT = {
  r: 4,
  strokeWidth: 2,
  stroke: "var(--color-bg-layer-default)",
} as const;

/**
 * 늘 찍는 점(`dots`) — 가리킨 점에서 카드 면 색 테두리를 뺀 계열 색 원(지름 6 · 테두리 없음). 색(fill)은 계열의 선 색을 쓴다.
 * 기본은 꺼짐이고, 켜도 가리킨 점(ACTIVE_DOT)이 그 위에 선다(chart.md "늘 찍는 점 — dots")
 */
export const SERIES_DOT = { r: 3, strokeWidth: 0 } as const;

/** 그려짐 300ms 한 번 — 모션 줄이기면 바로(라이브러리 기본 isAnimationActive="auto" 를 강제로 켜지 않는다) */
export const CHART_DRAW = {
  animationDuration: 300,
  animationEasing: "ease-out",
} as const;

// ── 모양 ─────────────────────────────────────────────────────
// 차트 상자 — 카드 본문 안 폭 100% · 바탕 없음. 키보드 포커스에만 링(바깥 2px, 띄움 2)
export const CHART_ROOT = [
  "relative w-full rounded-r2 font-sans",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
  "[&_.recharts-cartesian-axis-tick-value]:tabular-nums",
  // 가리킨 점의 테두리는 카드 면 색(라이브러리 기본 흰색을 덮는다)
  "[&_.recharts-active-dot_.recharts-dot]:stroke-bg-layer-default",
  "[&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-sector]:outline-none",
].join(" ");

// 늘 찍는 점은 두지 않는다 — `dots` 를 켜지 않은 차트(기본)에 붙인다
export const CHART_HIDE_DOTS =
  "[&_.recharts-line-dots]:hidden [&_.recharts-area-dots]:hidden";

// 툴팁 — 떠 있는 표면: bg-layer-floating · s3 · 모서리 12 · 위아래 10 · 좌우 12 · 최소 128 · 테두리 없음 · 머리 ↔ 줄 · 줄 사이 4
export const TOOLTIP_SURFACE =
  "flex min-w-[128px] flex-col gap-x1 rounded-r3 bg-bg-layer-floating px-x3 py-x2_5 font-sans text-fg-neutral shadow-[var(--shadow-s3)]";

// 지표 타일 — 모서리 12 · 위아래 10 · 좌우 12 · 폭 100 이상 · 누르면 2px 거리 축소 · 키보드 포커스에만 바깥 2px 링
export const LEGEND_TILE = [
  // 폭 100 이상 — 글(금액)이 타일을 넘지 않게 최소 폭은 100 과 내용의 최소 폭(쉼표 뒤 줄바꿈) 중 큰 값. 모자라면 다음 줄로 내려간다
  "flex min-w-[max(100px,min-content)] flex-[1_1_0] cursor-pointer flex-col items-start rounded-r3 border-0 px-x3 py-x2_5 text-start font-sans",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1] aria-disabled:cursor-not-allowed aria-disabled:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// 끈 타일 — 흰 면 + 안쪽 1px stroke-neutral-weak(레이아웃이 움직이지 않게 그림자로), 호버에만 누름 바탕(켠 타일은 바탕 그대로)
export const LEGEND_TILE_HIDDEN =
  "bg-bg-layer-default shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)] hover:bg-bg-layer-default-pressed";

// 도넛 범례 줄 — 최소 44 · 이름 14(t4) · 사이 8. 줄 안 폭이 16em(= 16rem) 보다 좁으면(큰 글자) List 와 같게 % · 금액을 이름 아래 왼쪽으로
// 내린다(list.md:142-148 "큰 글자에서 값을 본문 아래로"). 줄(li)이 컨테이너다
export const DONUT_ROW = [
  "relative isolate flex min-h-[44px] w-full items-center gap-x2 text-start font-sans text-t4",
  "@max-[16rem]/donut:grid @max-[16rem]/donut:grid-cols-[auto_auto_minmax(0,1fr)] @max-[16rem]/donut:items-start @max-[16rem]/donut:gap-y-x0_5 @max-[16rem]/donut:py-x2",
].join(" ");
export const DONUT_NARROW = {
  swatch: "@max-[16rem]/donut:mt-x1",
  label: "@max-[16rem]/donut:col-span-2",
  percent: "@max-[16rem]/donut:col-start-2 @max-[16rem]/donut:row-start-2",
  amount:
    "@max-[16rem]/donut:col-start-3 @max-[16rem]/donut:row-start-2 @max-[16rem]/donut:justify-self-start",
} as const;

// 누르는 줄 — List 줄처럼 카드 끝까지(본문 여백 24 를 되돌린다), 글자는 그대로 24 에 선다. 키보드 포커스에만 안쪽 2px 링
export const DONUT_ROW_PRESSABLE = [
  "group/donut-row -mx-x6 w-[calc(100%+var(--spacing-x6)*2)] cursor-pointer border-0 bg-transparent px-x6",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
].join(" ");

// 호버 · 누름 바탕(알약) — 좌우 6 들어온 모서리 10(카드 16 − 6 — List 의 동심 모서리). 요소로 둬서 검사기가 바탕을 읽는다
export const DONUT_PILL = [
  "pointer-events-none absolute inset-y-0 inset-x-x1_5 -z-10 rounded-r2_5 bg-transparent",
  "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
  "group-hover/donut-row:bg-bg-layer-default-pressed group-active/donut-row:bg-bg-layer-default-pressed",
].join(" ");
