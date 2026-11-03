import { cva } from "class-variance-authority";
import type * as React from "react";

/*
 * Groo Chip 의 클래스 · 상수 — 칩 · 입력값 칩 · 묶음 · 스크롤 칸 · 지우기. 수치 원본은 groo-design
 * specs/components/chip.yaml(값은 src/shared/ds/spec/chip.json). 무엇이 언제 바뀌는지는 chip.tsx 머리 주석이다
 * (컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침). Tabs 의 Chip Tabs 도 chipVariants 를 그대로 쓴다.
 */

export type ChipSize = "small" | "medium" | "large";

// 칩 — 고름은 [&:is([data-state=checked],[data-selected])]: Radix 칩(체크박스 · 라디오)의 data-state 와 Chip · Chip Tabs 의
// data-selected 를 한 규칙으로 받는다. 클래스는 글자 그대로 적는다(Tailwind 는 소스의 글자를 읽는다 — 문자열을 이어 붙이면 만들어지지 않는다). 안 고름 · 고름의 바탕 · 글자 · 테두리(안쪽 1px — 칩 크기가 변하지 않는다), 호버 · 누름 바탕.

export const chipVariants = cva(
  [
    "relative inline-flex max-w-full shrink-0 cursor-pointer select-none items-center justify-center gap-x1_5 whitespace-nowrap rounded-full font-sans text-t4 font-medium no-underline",
    // 누르는 영역 44 — 보이는 칩보다 작으면 ::before 가 넓힌다(Button 과 같다)
    "before:absolute before:left-1/2 before:top-1/2 before:h-full before:min-h-[44px] before:w-full before:min-w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
    // 바탕 · 글자 · 테두리는 color-transition, 축소는 pressed-scale
    "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),color_var(--motion-duration-color-transition)_var(--motion-ease-easing),box-shadow_var(--motion-duration-color-transition)_var(--motion-ease-easing),scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
    "active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
    // 비활성 — 호버 · 누름 바탕보다 뒤에 나와 이긴다. 막힌 바탕은 변형마다 둔다(Solid 안 고름은 바탕 그대로, 글 · 아이콘만 fg-disabled — 03-B 결정 1 A). 고른 채 막힘은 고름의 바탕 · 글자를 덮고 짙은 1px 를 남긴다
    "disabled:cursor-not-allowed disabled:[scale:1] disabled:text-fg-disabled",
    "[&:is([data-state=checked],[data-selected])]:disabled:bg-bg-disabled [&:is([data-state=checked],[data-selected])]:disabled:text-fg-disabled [&:is([data-state=checked],[data-selected])]:disabled:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-solid)]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        solid: [
          "bg-bg-neutral-weak-alpha text-fg-neutral hover:bg-bg-neutral-weak-alpha-pressed active:bg-bg-neutral-weak-alpha-pressed disabled:bg-bg-neutral-weak-alpha",
          "[&:is([data-state=checked],[data-selected])]:bg-bg-neutral-inverted [&:is([data-state=checked],[data-selected])]:text-fg-neutral-inverted [&:is([data-state=checked],[data-selected])]:hover:bg-bg-neutral-inverted-pressed [&:is([data-state=checked],[data-selected])]:active:bg-bg-neutral-inverted-pressed",
        ].join(" "),
        // 고르면 짙은 채움 — 테두리는 지운다(SEED Chip Tabs 와 같다)
        outlineStrong: [
          "bg-transparent text-fg-neutral shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)] hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed disabled:bg-bg-disabled",
          "[&:is([data-state=checked],[data-selected])]:bg-bg-neutral-inverted [&:is([data-state=checked],[data-selected])]:text-fg-neutral-inverted [&:is([data-state=checked],[data-selected])]:shadow-none [&:is([data-state=checked],[data-selected])]:hover:bg-bg-neutral-inverted-pressed [&:is([data-state=checked],[data-selected])]:active:bg-bg-neutral-inverted-pressed",
        ].join(" "),
        // 고르면 옅은 바탕 + 짙은 1px(v113), 글자는 그대로
        outlineWeak: [
          "bg-transparent text-fg-neutral shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)] hover:bg-bg-layer-default-pressed active:bg-bg-layer-default-pressed disabled:bg-bg-disabled",
          "[&:is([data-state=checked],[data-selected])]:bg-bg-neutral-weak [&:is([data-state=checked],[data-selected])]:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-contrast)] [&:is([data-state=checked],[data-selected])]:hover:bg-bg-neutral-weak-pressed [&:is([data-state=checked],[data-selected])]:active:bg-bg-neutral-weak-pressed",
        ].join(" "),
      },
      size: {
        small: "min-h-[32px] [--press-basis:32]",
        medium: "min-h-[36px] [--press-basis:36]",
        large: "min-h-[40px] [--press-basis:40]",
      },
      layout: {
        withText: "",
        iconOnly: "",
      },
    },
    compoundVariants: [
      // 크기 × 모양 — 글이 있는 칩은 위아래 (높이 − 19) ÷ 2(19 = 글 t4 줄 높이)를 px 로 둔다 — 글자 크기 설정이 커지면 줄 높이(rem)만 커져 칩이 글 줄 높이 + (높이 − 19)로 늘고 100% 는 높이 그대로다(앱 small 200% 38 + 13 = 51, chip.md 큰 글자). 최소 폭 · 좌우 여백(SEED 루트 + 글 여백), 아이콘만 있으면 원 + 아이콘 14 · 16 · 16
      {
        size: "small",
        layout: "withText",
        className: "min-w-[44px] px-x3 py-[6.5px]",
      },
      {
        size: "medium",
        layout: "withText",
        className: "min-w-[48px] px-x3_5 py-[8.5px]",
      },
      {
        size: "large",
        layout: "withText",
        className: "min-w-[52px] px-x4 py-[10.5px]",
      },
      {
        size: "small",
        layout: "iconOnly",
        className: "w-[32px] px-0 [&>svg]:size-[14px]",
      },
      {
        size: "medium",
        layout: "iconOnly",
        className: "w-[36px] px-0 [&>svg]:size-[16px]",
      },
      {
        size: "large",
        layout: "iconOnly",
        className: "w-[40px] px-0 [&>svg]:size-[16px]",
      },
    ],
    defaultVariants: {
      variant: "outlineWeak",
      size: "medium",
      layout: "withText",
    },
  },
);

// 글 — 칩이 줄 폭(max-w-full)에 닿을 때만 글 끝을 말줄임한다. 앞 · 뒤 아이콘과 지우기 ×(shrink-0)는 줄지 않고 남는다
export const CHIP_LABEL = "min-w-0 truncate";

// 아이콘 — 앞 14 · 16 · 16, 뒤 14 · 14 · 16(medium 만 앞 ≠ 뒤), 지우기 14 · 14 · 16.
// Tailwind 는 소스의 글자 그대로를 읽으므로 크기마다 다 적는다
export const CHIP_ICONS: Record<
  ChipSize,
  { prefix: string; suffix: string; remove: string }
> = {
  small: {
    prefix: "[&>svg]:size-[14px]",
    suffix: "[&>svg]:size-[14px]",
    remove: "size-[14px]",
  },
  medium: {
    prefix: "[&>svg]:size-[16px]",
    suffix: "[&>svg]:size-[14px]",
    remove: "size-[14px]",
  },
  large: {
    prefix: "[&>svg]:size-[16px]",
    suffix: "[&>svg]:size-[16px]",
    remove: "size-[16px]",
  },
};
export const CHIP_ICON_SLOT = "flex shrink-0 items-center justify-center";

// 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 --press-basis 로(Button · List 와 같은 식) — 긴 글의 칩도 세로 2px 만 준다.
// Space 를 누르는 동안에도 :active 가 걸리므로 Space · Enter 에서도 잰다. Chip Tabs 도 같은 식을 쓴다
export function measurePress(el: HTMLElement) {
  el.style.setProperty(
    "--press-basis",
    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
  );
}

export const isPressKey = (e: React.KeyboardEvent) =>
  e.key === " " || e.key === "Enter";

// 묶음 — wrap 은 칩을 바로 담아 줄바꿈한다(칩 사이 · 줄 사이 8). scroll 은 안쪽 스크롤 칸(CHIP_SCROLL_ROW)을 담고, bleed 면 부모의
// 화면 여백 밖(화면 끝)까지 낸다. 비었을 때만 칩 한 줄(medium 36) 높이를 남긴다 — 입력값을 다 지우면 포커스가 묶음으로 오므로
// 링이 납작한 선이 되지 않게(칩이 있으면 높이를 더하지 않는다)
export const chipGroupVariants = cva("relative", {
  variants: {
    layout: {
      wrap: "flex flex-wrap gap-between-chips empty:min-h-[36px]",
      scroll: "has-[>[data-slot=chip-scroll-row]:empty]:min-h-[36px]",
    },
    bleed: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    { layout: "scroll", bleed: true, className: "-mx-global-gutter" },
  ],
  defaultVariants: { layout: "wrap", bleed: false },
});

// 안쪽 스크롤 칸(chip.yaml scrollRow) — 한 줄 · 칩 사이 8, 안쪽 좌우 화면 여백 · 위아래 6 을 두고 바깥 −6 으로 되돌린다
// (줄 높이 = 칩). −6 이 바깥 묶음의 margin 과 상쇄되는 두 겹이라 부모의 위아래 간격(space-y · gap)이 지워지지 않는다.
// relative — 폼 안에서 Radix 가 칩 옆에 두는 숨은 input 이 칩과 함께 잘리고 함께 스크롤된다
export const CHIP_SCROLL_ROW =
  "relative -my-x1_5 flex flex-nowrap gap-between-chips overflow-x-auto px-global-gutter py-x1_5 scroll-px-global-gutter [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// 묶음의 키보드 링 — 모서리 없이 묶음 둘레(입력값을 다 지운 뒤 포커스를 받는다)
export const CHIP_GROUP_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring";

// 입력값 칩의 알약 — 누르지 않는다(호버 · 누름 없음). Outline Weak 의 고른 모습, 막히면 회색 바탕 + 짙은 1px stroke-neutral-solid
export const inputChipVariants = cva(
  [
    "relative inline-flex max-w-full shrink-0 items-center justify-center gap-x1_5 whitespace-nowrap rounded-full font-sans text-t4 font-medium",
    "bg-bg-neutral-weak text-fg-neutral shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-contrast)]",
    "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),color_var(--motion-duration-color-transition)_var(--motion-ease-easing),box-shadow_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
    "data-[disabled]:bg-bg-disabled data-[disabled]:text-fg-disabled data-[disabled]:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-solid)]",
    // 지우기에 키보드 포커스가 있으면 칩 둘레에 링(바깥 2px · 띄움 2px)
    "has-[[data-slot=input-chip-remove]:focus-visible]:outline-2 has-[[data-slot=input-chip-remove]:focus-visible]:outline-offset-2 has-[[data-slot=input-chip-remove]:focus-visible]:outline-stroke-focus-ring",
  ].join(" "),
  {
    variants: {
      size: {
        small: "min-h-[32px] min-w-[44px] px-x3 py-[6.5px]",
        medium: "min-h-[36px] min-w-[48px] px-x3_5 py-[8.5px]",
        large: "min-h-[40px] min-w-[52px] px-x4 py-[10.5px]",
      },
    },
    defaultVariants: { size: "medium" },
  },
);

// 지우기 — 보이는 아이콘 14 · 14 · 16(글자색 그대로), 누르는 영역은 ::before 로 24. 누르면 자기만 준다(기준 24 — Input Button 의
// 지우기와 같다). 키보드 링은 칩(InputChip)이 그린다
export const CHIP_REMOVE = [
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-current outline-none",
  "[&>svg]:pointer-events-none [&>svg]:size-full",
  "before:absolute before:left-1/2 before:top-1/2 before:size-[24px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
  "[--press-basis:24] [transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "disabled:cursor-not-allowed disabled:[scale:1]",
].join(" ");
