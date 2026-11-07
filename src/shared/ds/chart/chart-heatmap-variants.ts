/*
 * 열지도의 값 — 세기 다섯 단계와 단계마다 글자색. 수치 원본은 groo-design specs/components/chart.yaml 의 heatmapCell · heatmapValue.
 */

/** 칸 폭이 이 값 이상일 때만 칸에 금액을 적는다(px) — "99,999,999,999원" 이 107 이라 999억까지 들어간다 */
export const HEAT_TEXT_MIN_CELL_WIDTH = 112;

/** 왼쪽 시간대 라벨 열 폭(px) */
export const HEAT_LABEL_COLUMN = 56;

// 세기 다섯 — bg-brand-solid 를 카드 면에 섞은 비율(18 · 35 · 55 · 76 · 100%). 넷째는 75% 였다 — 그루 초록에서 어느 글자도 4.5 에 못 미쳐
// 두 브랜드 함께 76% 로 올렸다(2026-10-22 사용자 결정 B). 끊는 자리(HEAT_CUTS)의 75% 는 그대로다
export const HEAT_MIX = [0.18, 0.35, 0.55, 0.76, 1] as const;

// 가장 큰 칸 값에 대한 비율로 끊는 자리 — 8 · 22 · 45 · 75%
export const HEAT_CUTS = [0.08, 0.22, 0.45, 0.75] as const;

export const HEAT_STEP_BG = [
  "bg-[color-mix(in_srgb,var(--color-bg-brand-solid)_18%,var(--color-bg-layer-default))]",
  "bg-[color-mix(in_srgb,var(--color-bg-brand-solid)_35%,var(--color-bg-layer-default))]",
  "bg-[color-mix(in_srgb,var(--color-bg-brand-solid)_55%,var(--color-bg-layer-default))]",
  "bg-[color-mix(in_srgb,var(--color-bg-brand-solid)_76%,var(--color-bg-layer-default))]",
  "bg-bg-brand-solid",
] as const;

// 칸 글자색 — 단계마다 한 번 정한 값을 CSS 변수(--heat-text-N)로 받는다(정하기 전에는 fg-neutral). 임의 값 클래스인 까닭: 단계마다 달라지는 값이라 토큰 하나로 못 적는다
export const HEAT_STEP_TEXT = [
  "text-[color:var(--heat-text-0,var(--color-fg-neutral))]",
  "text-[color:var(--heat-text-1,var(--color-fg-neutral))]",
  "text-[color:var(--heat-text-2,var(--color-fg-neutral))]",
  "text-[color:var(--heat-text-3,var(--color-fg-neutral))]",
  "text-[color:var(--heat-text-4,var(--color-fg-neutral))]",
] as const;

// 툴팁의 네모 — 그 칸의 세기 색
export const HEAT_STEP_SWATCH = [
  "color-mix(in srgb, var(--color-bg-brand-solid) 18%, var(--color-bg-layer-default))",
  "color-mix(in srgb, var(--color-bg-brand-solid) 35%, var(--color-bg-layer-default))",
  "color-mix(in srgb, var(--color-bg-brand-solid) 55%, var(--color-bg-layer-default))",
  "color-mix(in srgb, var(--color-bg-brand-solid) 76%, var(--color-bg-layer-default))",
  "var(--color-bg-brand-solid)",
] as const;

/** 값 → 세기 단계(0 ~ 4). 값이 없으면(0 · null · 빈 값 · 가장 큰 값이 0) -1 */
export function heatStep(
  value: number | null | undefined,
  max: number,
): number {
  if (value == null || !(value > 0) || !(max > 0)) return -1;
  const ratio = value / max;
  return ratio < HEAT_CUTS[0]
    ? 0
    : ratio < HEAT_CUTS[1]
      ? 1
      : ratio < HEAT_CUTS[2]
        ? 2
        : ratio < HEAT_CUTS[3]
          ? 3
          : 4;
}

// ── 단계마다 글자색 ───────────────────────────────────────────
type Rgb = [number, number, number];

const parseRgb = (text: string): Rgb | null => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const luminance = ([r, g, b]: Rgb) => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

export const contrastOf = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * 단계마다 칸 글자색 — 그 단계 바탕(카드 면 + 브랜드 채움 섞음) 위 fg-neutral 이 4.5 를 넘으면 fg-neutral, 아니면 흰 글자(static-white).
 * 칸마다 재지 않는다. 브랜드 · 모드가 바뀔 때만 다섯 단계를 다시 정한다. 계산할 수 없으면(색을 못 읽음) null.
 */
export function computeHeatTexts(
  root: HTMLElement,
): ("neutral" | "white")[] | null {
  const probe = root.ownerDocument.createElement("span");
  probe.style.display = "none";
  root.appendChild(probe);
  const read = (value: string) => {
    probe.style.color = "";
    probe.style.color = value;
    return parseRgb(getComputedStyle(probe).color);
  };
  const brand = read("var(--color-bg-brand-solid)");
  const surface = read("var(--color-bg-layer-default)");
  const fg = read("var(--color-fg-neutral)");
  const white = read("var(--color-static-white)");
  probe.remove();
  if (!brand || !surface || !fg || !white) return null;
  return HEAT_MIX.map((m) => {
    const bg = surface.map((s, i) =>
      Math.round(s + ((brand[i] ?? s) - s) * m),
    ) as Rgb;
    const onFg = contrastOf(fg, bg);
    return onFg >= 4.5 || onFg >= contrastOf(white, bg) ? "neutral" : "white";
  });
}
