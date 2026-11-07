/**
 * groo-design chart palette base hex ↔ light variant 매핑.
 *
 * DB (expense_category.color) 는 base hex 만 저장하는 single-source.
 * 다크모드 swap 은 CSS variable alias (`--color-chart-*`, index.css 정의) 가
 * 처리하며, 본 헬퍼는 base hex → alias var 문자열 변환을 수행한다.
 *
 * groo-tokens.css `--color-chart-*` base hex 값:
 *   red    #c73838  orange #b36418  yellow #8c7400
 *   green  #2d8060  blue   #2c70bf  indigo #5e60c8
 *   violet #8b4dba  pink   #b83b7a  brown  #9a6536  gray #6b7484
 */

export type ChartKey =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "indigo"
  | "violet"
  | "pink"
  | "brown"
  | "gray";

export type ChartPair = {
  key: ChartKey;
  /** 라이트 모드 base hex — DB 저장값 single-source. */
  base: string;
  /** 다크 모드 light variant hex (참고용 — 실제 swap 은 CSS alias 가 처리). */
  light: string;
  /** CSS variable alias — 라이트/다크에서 자동 swap. */
  cssVar: string;
};

export const CHART_PAIRS: ChartPair[] = [
  {
    key: "red",
    base: "#c73838",
    light: "#eca0a0",
    cssVar: "--color-chart-red",
  },
  {
    key: "orange",
    base: "#b36418",
    light: "#e8b266",
    cssVar: "--color-chart-orange",
  },
  {
    key: "yellow",
    base: "#8c7400",
    light: "#d4b83a",
    cssVar: "--color-chart-yellow",
  },
  {
    key: "green",
    base: "#2d8060",
    light: "#6bcb86",
    cssVar: "--color-chart-green",
  },
  {
    key: "blue",
    base: "#2c70bf",
    light: "#7bbbed",
    cssVar: "--color-chart-blue",
  },
  {
    key: "indigo",
    base: "#5e60c8",
    light: "#abb0f0",
    cssVar: "--color-chart-indigo",
  },
  {
    key: "violet",
    base: "#8b4dba",
    light: "#d2a8ec",
    cssVar: "--color-chart-violet",
  },
  {
    key: "pink",
    base: "#b83b7a",
    light: "#eca0bc",
    cssVar: "--color-chart-pink",
  },
  {
    key: "brown",
    base: "#9a6536",
    light: "#dcb088",
    cssVar: "--color-chart-brown",
  },
  {
    key: "gray",
    base: "#6b7484",
    light: "#b5bbc5",
    cssVar: "--color-chart-gray",
  },
];

const BASE_TO_PAIR = new Map(CHART_PAIRS.map((p) => [p.base.toLowerCase(), p]));

/**
 * 카테고리 색의 fg / bg 를 결정한다.
 *
 * - base hex 가 chart palette 안에 있으면 alias CSS var (다크 자동 swap)
 * - 알 수 없는 hex 는 그대로 (사용자 커스텀 색)
 * - 색 없음(undefined / null) → semantic 토큰 fallback
 */
export function getPaletteByColor(color: string | null | undefined): {
  color: string;
  bg: string;
  /** 옅은 바탕 위 글자 — 팔레트 색은 chart-{hue}-contrast */
  fg: string;
} {
  if (!color) {
    // 색 없음(예: 예산 '전체' 행) — 컬러 타일과 동일하게 brand 색 @18% 틴트.
    // bg-brand-subtle(=primary base @12%) 은 다크에서 어두운 navy 라 light variant
    // 인 fg-brand-strong 기반 틴트로 통일(앱 softBg(fgBrand) 정합).
    return {
      color: "var(--fg-brand-strong)",
      bg: "var(--color-bg-brand-weak)",
      fg: "var(--fg-brand-strong)",
    };
  }
  const pair = BASE_TO_PAIR.get(color.toLowerCase());
  if (pair) {
    // 칠하는 값은 v111 짝 — 글 chart-{hue}, 옅은 바탕 chart-{hue}-weak(라이트 200 · 다크 300, 불투명)
    return {
      color: `var(${pair.cssVar})`,
      bg: `var(${pair.cssVar}-weak)`,
      fg: `var(${pair.cssVar}-contrast)`,
    };
  }
  if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color)) {
    const hex =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    // 커스텀(비팔레트) 색: 다크에서 흰색과 혼합해 밝게(--swatch-lift: 라이트 0% / 다크 38%).
    // 팔레트 색은 위 alias 분기에서 처리 → 이 분기는 커스텀 hex 만(예: 캘린더 기본 색).
    return {
      color: `color-mix(in oklab, white var(--swatch-lift), ${hex})`,
      bg: `color-mix(in oklch, ${hex} 18%, transparent)`,
      fg: `color-mix(in oklab, ${hex} 70%, var(--fg-primary))`,
    };
  }
  return {
    color: "var(--fg-brand-strong)",
    bg: "var(--color-bg-brand-weak)",
    fg: "var(--fg-brand-strong)",
  };
}

/**
 * 저장된 hex 가 차트 10색의 기본 값이면 그 색 이름 — ds `assignChartColors` 의 `colorOf` 에 쓴다.
 * 저장된 hex 는 이름표다(DESIGN v110). 팔레트 밖 hex · 색 없음은 null — 그 차트에서 쓰지 않은 색이 배정된다.
 */
export function chartColorOf(
  color: string | null | undefined,
): ChartKey | null {
  if (!color) return null;
  return BASE_TO_PAIR.get(color.toLowerCase())?.key ?? null;
}
