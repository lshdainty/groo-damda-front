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

/** 눈금 글자 — 1만 미만은 쉼표 정수, 그 위는 만 · 억 · 조에 소수 한 자리(.0 은 버린다). 빼기는 U+2212 */
export function formatAxisWon(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? MINUS : "";
  const n = Math.abs(value);
  if (dsLanguage().startsWith("en")) {
    // 영어는 compact 표기 — 12K · 123K · 1.2M
    return (
      sign +
      new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n)
    );
  }
  if (n < 10000) return sign + Math.round(n).toLocaleString("ko-KR");
  let scaled = n / 10000;
  let unit = "만";
  for (const bigger of ["억", "조"]) {
    if (round1(scaled) < 10000) break;
    scaled /= 10000;
    unit = bigger;
  }
  return (
    sign +
    round1(scaled).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) +
    unit
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
 * SVG 글자는 var() 를 속성으로 못 받아 토큰(`--text-badge` = 0.6875rem)과 같은 값을 적는다.
 * 세로축 폭 측정(`axisWidth.ts` AXIS_TICK_FONT_SIZE)이 같은 토큰이라 폭 · 글자가 늘 같이 움직인다.
 */
export const CHART_TICK_SIZE = "0.6875rem";

/** XAxis · YAxis 에 펼친다 — 눈금 11 · fg-neutral-subtle(이중 축이면 계열 색) · 축 선 · 눈금 선 없음 · 눈금과 그리는 자리 사이 8 */
export function chartAxisProps({ color }: ChartAxisOptions = {}) {
  return {
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
    tick: {
      fill: color ? chartVar(color) : "var(--color-fg-neutral-subtle)",
      fontSize: CHART_TICK_SIZE,
    },
  } as const;
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
  // 가리킨 점의 테두리는 카드 면 색(라이브러리 기본 흰색을 덮는다) · 늘 찍는 점은 두지 않는다
  "[&_.recharts-active-dot_.recharts-dot]:stroke-bg-layer-default [&_.recharts-line-dots]:hidden [&_.recharts-area-dots]:hidden",
  "[&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-sector]:outline-none",
].join(" ");

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
