import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * groo 토큰 스케일을 twMerge 에 알린다 — groo-design `recipes/shadcn/lib/utils.ts` 와 같다.
 *
 * 기본 설정은 groo 이름을 그 자리의 스케일로 읽지 못한다.
 *   - `text-t4` · `text-t2` 를 글자 크기가 아니라 글자 색으로 읽어, 앞의 `text-fg-neutral` ·
 *     `text-[var(--fg-brand)]` 를 지운다(Button accent+sm 에서 브랜드색이 사라져 흰색을 이어받았다).
 *   - `px-x4` · `rounded-r2` 를 여백 · 모서리로 못 읽어, 뒤에서 덮어 쓴 `p-0` · `rounded-full` 과
 *     둘 다 남긴다 — 그러면 어느 쪽이 이길지 CSS 순서가 정한다.
 * 이름은 groo-tokens.css 의 `--spacing-*` · `--radius-*` · `--text-*` 와 같다. 토큰을 더하면 여기도 더한다.
 * 옛 이름(spacing xs~3xl · radius xs~2xl · 글자 display/title/body/label/caption/badge/overline)은 2026-11-16 걷었다.
 */
const SPACING = [
  "x0_5",
  "x1",
  "x1_5",
  "x2",
  "x2_5",
  "x3",
  "x3_5",
  "x4",
  "x4_5",
  "x5",
  "x6",
  "x7",
  "x8",
  "x9",
  "x10",
  "x12",
  "x13",
  "x14",
  "x16",
  "global-gutter",
  "between-chips",
  "component-default",
  "between-text",
  "nav-to-title",
  "screen-bottom",
];
const RADIUS = [
  "r0_5",
  "r1",
  "r1_5",
  "r2",
  "r2_5",
  "r3",
  "r3_5",
  "r4",
  "r5",
  "r6",
];
const TEXT = [
  "t1",
  "t2",
  "t3",
  "t4",
  "t5",
  "t6",
  "t7",
  "t8",
  "t9",
  "t10",
  "t11",
  "t12",
  "t13",
  "t14",
  "screen-title",
  "article-body",
  "article-note",
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: SPACING,
      radius: RADIUS,
      // 글자 크기는 사용자 글자 설정을 따르는 것(rem)과 고정(-static) 둘 다
      text: [...TEXT, ...TEXT.map((t) => `${t}-static`)],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};
