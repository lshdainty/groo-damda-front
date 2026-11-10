import { dsText } from "@/shared/ds/i18n";
/*
 * Groo Color Swatch — 카테고리 · 태그 · 라벨 · 저축 목표 · 캘린더에 붙일 색을 고르는 묶음(2026-10-09). 수치 원본은 groo-design specs/components/color-swatch.yaml(값은 src/shared/ds/spec/color-swatch.json).
 * groo-design recipes/shadcn/components/ui/color-swatch.tsx 를 첫 판으로 가져왔다 — 이 파일은 색 이름 · 차례 · 배정 · 칸 클래스 · 대비 셈, 컴포넌트는 color-swatch.tsx 다
 * (컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침). ChartColor 는 차트 색 열 이름 — 이 레포에는 shared/ds 차트가 아직 없어 여기서 정한다(색은 groo-tokens.css 의 --color-chart-* — 다크는 토큰이 스스로 바꾼다).
 * SEED 에는 색 고르기 부품이 없다 — 칸의 칠 · 크기 · 고른 표시 · 키보드 · 새 항목의 첫 색은 groo 가 정했다(사용자 결정 12C · 13B · 14B).
 * 옛 Color Swatch(폭을 나눈 정사각 칸 · currentColor 테두리 · 마우스 1.05배 · options 를 받는 묶음)를 대신한다.
 *
 *   ColorSwatchGroup   묶음(radiogroup · 5 × 2). value · defaultValue(ChartColor 또는 "current" — 지금 색 칸, null 이면 고른 칸 없음) ·
 *                      onValueChange(value) · currentColor(팔레트 밖 저장 색 hex — 주면 "지금 색" 칸) · autoColor(색 없는 항목에 차트가 줄
 *                      ChartColor — 주면 "자동" 칸) · disabled · aria-label(Field 밖에서만). Field 안이면 라벨이 묶음 이름, 설명 · 오류가
 *                      설명이 되고(useFieldGroup) Field 의 막힘 · 오류 · 필수를 받는다(useFieldGroupState). 칸 이름 · 차례 · 2차원 화살표는 스스로
 *   firstUnusedColor(used)   v110 배정 순서(파랑 → 초록 → 주황 → 보라 → 분홍 → 남색 → 빨강 → 노랑 → 갈색)에서 used 에 없는 첫 색.
 *                      아홉 색을 다 쓰면 파랑부터, 회색은 주지 않는다(차트의 "기타" 전용) — 새 항목은 늘 빨강으로 시작하지 않는다
 *   COLOR_NAMES        색 이름 — { red: "빨강", … } · COLOR_SWATCH_ORDER — 색상환 차례(빨강 → … → 갈색 → 회색)
 *
 * 칸: 원 40(누르는 44 — ::before) · 5개씩 두 줄 · 사이 12(폭과 상관없이 248), v110 차트 색(라이트 700 · 다크 800-dark)으로 꽉 채운다 —
 *   옅게 섞은 칸 · v111 옅은 바탕 칸은 쓰지 않는다. 칸의 이름은 색 이름("빨강") — "색상 N" · hex 를 이름으로 두지 않는다. 보조 기술이
 *   읽고, 마우스를 올리거나 키보드 초점이 오면 같은 이름의 툴팁(groo Tooltip — 네이티브 title 은 쓰지 않는다, Icon Picker 칸과 같다)이
 *   뜬다 — 색으로 가리기 어려운 사람도 이름을 본다. 지금 색 칸은 이름이 아래 글로 보이므로 툴팁을 두지 않는다. 호버는 모양이 바뀌지
 *   않는다(커서만).
 * 고름: 칸 바깥 2 띄운 2px 고리(stroke-neutral-contrast — Select Box 의 고른 테두리와 같은 색, outline) + 가운데 체크 16 · 선 2.5
 *   (fg-neutral-inverted — 라이트 흰 · 다크 짙은 글자. 다크 800-dark 칸 위 흰 체크는 읽히지 않는다). 키보드 포커스 링은 고리 바깥
 *   (띄움 6 · 2px — ::after). 누르면 칸 2px 거리 축소(40 → 0.95, 모션 줄이기면 하지 않는다).
 * 지금 색 · 자동(14B): 고치는 항목의 색이 팔레트 밖(가져오기의 #9E9E9E)이면 "지금 색" 칸에 그 색을 그대로(두 모드 같은 값 — 체크는
 *   fg-neutral · fg-neutral-inverted 가운데 그 색 위 대비가 큰 쪽, 모드 · 브랜드가 바뀌면 다시 정한다), 색이 없으면 "자동" 칸에 차트가 줄 색을 점선 원(2px
 *   stroke-neutral-solid)으로 격자 앞에 둔다 — 세로 선(1px stroke-neutral-weak, 사이 16)으로 가르고 칸 아래 6 에 같은 이름 글(12 / 16 ·
 *   fg-neutral-muted). 그 칸을 고르면(처음에 골라져 있다) 값은 "current" — 저장 값을 그대로 둔다. 몰래 빨강으로 바꾸지 않는다.
 *   칸 · 선 · 격자의 폭은 321(40 + 16 + 1 + 16 + 248)이다. 놓인 자리가 그보다 좁으면(360 폰 본문 312) 지금 색 칸을 격자 위 줄에 두고
 *   선을 가로 1px(격자 폭)로 가른다 — 사이는 그대로 16. 넓으면(390 폰 342 · 대화상자) 옆으로 둔다. 묶음이 놓인 자리의 폭으로
 *   가르므로(@container) 묶음은 그 폭을 다 쓴다 — 폭을 내용으로 정하는 자리(팝오버)에서는 321 로 잰다.
 * 키보드(radiogroup): 묶음에 Tab 하나(고른 칸, 없으면 첫 칸). ← → 는 차례대로 옮기며 고른다(줄 끝에서 다음 줄로, 끝에서 처음으로 —
 *   지금 색 칸은 차례의 맨 앞, RTL 은 반대), ↑ ↓ 는 위아래 줄의 같은 칸(두 줄이라 오간다 — 지금 색 칸에서는 위 줄에 있어도 그대로),
 *   Home · End · PageUp · PageDown 은 받지 않는다(ignoreRadioJumpKeys — 하나 고르기는 화살표만, 2026-10-17 03-E 결정 3 후속). Space 는 초점의 칸을 고르고, Enter 는 폼을 제출한다(진짜 radio 와 같다 — Radio 묶음과 같은 규칙).
 * 막힘: 색은 그대로 두고 누르기만 막는다(진짜 disabled — Tab 에서 빠진다). 고른 칸의 고리는 stroke-neutral-solid 로 남긴다.
 */

/** 차트 색 열 이름 — v110 10색. 값은 groo-tokens.css 의 --color-chart-<이름>(라이트 700 · 다크 800-dark) */
export type ChartColor =
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

/** 색상환 차례 — 격자의 차례(5 × 2) */
export const COLOR_SWATCH_ORDER: readonly ChartColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "indigo",
  "violet",
  "pink",
  "brown",
  "gray",
];

/** 색 이름 — 칸의 이름(라디오). 지금 언어대로 */
export const colorName = (color: ChartColor) => dsText(`colorSwatch.${color}`);

// v110 배정 순서 — chart.tsx 의 CHART_ORDER 와 같다(회색은 "기타" 전용이라 없다)
export const ASSIGN_ORDER: readonly ChartColor[] = [
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

/** 같은 목록이 아직 쓰지 않은 첫 색(v110 배정 순서) — 아홉 색을 다 쓰면 파랑, 회색은 주지 않는다 */
export function firstUnusedColor(
  used: Iterable<ChartColor | null | undefined>,
): ChartColor {
  const taken = new Set<ChartColor | null | undefined>(used);
  return ASSIGN_ORDER.find((color) => !taken.has(color)) ?? "blue";
}

// Tailwind 는 소스의 글자 그대로를 읽으므로 열을 다 적는다
export const SWATCH_BG: Record<ChartColor, string> = {
  red: "bg-chart-red",
  orange: "bg-chart-orange",
  yellow: "bg-chart-yellow",
  green: "bg-chart-green",
  blue: "bg-chart-blue",
  indigo: "bg-chart-indigo",
  violet: "bg-chart-violet",
  pink: "bg-chart-pink",
  brown: "bg-chart-brown",
  gray: "bg-chart-gray",
};

export const COLUMNS = 5;

// 칸 — 원 40 · 누르는 44. 고른 고리는 바깥 2 띄운 2px outline, 키보드 포커스 링은 그 바깥 6 에 ::after 로(고리와 겹치지 않게)
export const SWATCH = [
  "relative block size-[40px] shrink-0 cursor-pointer rounded-full border-0 p-0",
  "before:absolute before:-inset-[2px] before:rounded-full before:content-['']",
  "outline-offset-2 aria-checked:outline-2 aria-checked:outline-solid aria-checked:outline-stroke-neutral-contrast",
  "disabled:aria-checked:outline-stroke-neutral-solid not-aria-checked:focus-visible:outline-none",
  "after:pointer-events-none after:absolute after:-inset-[6px] after:rounded-full after:content-['']",
  "focus-visible:after:outline-2 focus-visible:after:outline-solid focus-visible:after:outline-stroke-focus-ring",
  "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] [--press-basis:40] active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "disabled:cursor-not-allowed disabled:[scale:1]",
].join(" ");

// 체크 16 · 누르는 44 · 포커스 링 간격 6 도 px 그대로(color-swatch.yaml:71 — 글자 크기를 따르지 않는다). 체크는 고른 칸 가운데
export const CHECK =
  "pointer-events-none absolute inset-0 flex items-center justify-center [&_svg]:size-[16px]";

// 지금 색 칸이 있으면 묶음이 놓인 자리의 폭으로 가른다 — 321(칸 40 + 16 + 선 1 + 16 + 격자 248, color-swatch.yaml divider.stackBelow)
// 보다 좁으면 지금 색 칸 · 선 · 격자를 세로로. 폭을 내용으로 정하는 자리(팝오버 · fit-content)에서는 321 로 잰다(contain-intrinsic)
// 321 은 지금 색 칸이 40 일 때의 값이다 — 실제 판정은 color-swatch.tsx 가 칸의 실제 폭으로 다시 잰다(글자 확대에서 칸이 넓어진다).
// 폭을 내용으로 정하는 자리의 기본 폭만 inline style(containIntrinsicInlineSize)로 그 값을 받는다
export const STACK_CONTAINER = "@container w-full min-w-0";
// 선 — 세로로 쌓이면 가로 1px(격자 폭), 옆으로 두면 세로 1px(격자 높이). 사이는 늘 16
export const DIVIDER_STACKED =
  "h-px shrink-0 self-stretch bg-stroke-neutral-weak";
export const DIVIDER_SIDE =
  "h-auto w-px shrink-0 self-stretch bg-stroke-neutral-weak";

export type Rgb = [number, number, number];
export const parseRgb = (text: string): Rgb | null => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
export const luminance = ([r, g, b]: Rgb) => {
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

export type CheckTone = "neutral" | "inverted";
export const CHECK_COLOR: Record<CheckTone, string> = {
  neutral: "text-fg-neutral",
  inverted: "text-fg-neutral-inverted",
};
