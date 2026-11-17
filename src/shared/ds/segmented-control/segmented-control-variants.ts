import { cva } from "class-variance-authority";

/*
 * Groo Segmented Control 의 클래스 — 트랙 · 칸 · 글 · 고른 알약 · 알림 점. 수치 원본은 groo-design
 * specs/components/segmented-control.yaml(값은 src/shared/ds/spec/segmented-control.json).
 * 무엇이 언제 바뀌는지는 segmented-control.tsx 머리 주석이다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 */

// 트랙 — 놓인 자리 폭을 채우는 알약. 칸이 칸 수로 똑같이 나눈다(최소 폭 없음) · 모든 칸이 가장 높은 칸에 맞춘다
export const segmentedControlVariants = cva(
  "relative grid w-full grid-flow-col auto-cols-fr rounded-full bg-bg-neutral-weak-alpha p-x1 font-sans",
);

// 320 보다 좁은 화면(페이지 확대 — Layout "지원 폭") — 칸이 글보다 좁아지면 낱말 안에서 꺾지 않고 줄 전체를 가로로 스크롤한다.
// 칸은 가장 긴 낱말 + 좌우 12 아래로 줄지 않고(min-content), 트랙이 스크롤 칸이 된다(스크롤바는 숨긴다). 칸 폭이 고르지 않을 수 있어
// 미끄러지는 알약은 숨기고 고른 칸에 알약의 바탕 · 짙은 테두리를 칠한다(320 미만은 모양이 덜 다듬어져도 된다). 320 이상에서는 붙지 않는다
export const SEGMENTED_TRACK_NARROW =
  "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
export const SEGMENTED_ITEM_NARROW =
  "min-w-min data-[state=checked]:bg-bg-layer-default data-[state=checked]:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-contrast)]";
export const SEGMENTED_LABEL_NARROW = "[overflow-wrap:normal]";

// 고른 알약 — 칸 뒤(트랙의 첫 자식 · 칸은 relative 라 그 위에 그려진다). 폭 (트랙 − 8) ÷ 칸 수, 고른 칸 번호만큼 옮긴다.
// --segmented-count · --segmented-index 는 그린 칸을 세어 넣는다
export const SEGMENTED_INDICATOR = [
  "pointer-events-none absolute inset-y-x1 left-x1 rounded-full bg-bg-layer-default shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-contrast)]",
  "w-[calc((100%_-_2_*_var(--spacing-x1))_/_var(--segmented-count,1))] [transform:translateX(calc(var(--segmented-index,0)_*_100%))]",
  "[transition:transform_var(--motion-duration-d4)_var(--motion-ease-easing)]",
].join(" ");

// 칸 — 바탕 · 글자 · 테두리는 color-transition. 호버는 마우스 있는 기기에서만(누름과 같은 바탕, 축소 없음).
// 막힌 칸은 호버 · 누름이 없다(enabled 에서만 칠한다)
export const segmentedControlItemVariants = cva(
  [
    "group/segmented-item relative flex min-h-[34px] min-w-0 cursor-pointer select-none items-center justify-center rounded-full px-x3 py-x1_5 font-sans text-t5-static font-bold text-fg-neutral-subtle dark:text-fg-neutral-muted [--press-basis:34]",
    "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),color_var(--motion-duration-color-transition)_var(--motion-ease-easing),box-shadow_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
    // 안 고른 칸 — 올리거나 누르면 바탕 + 안쪽 1px + 한 단계 짙은 글
    "data-[state=unchecked]:enabled:hover:bg-bg-neutral-weak-pressed data-[state=unchecked]:enabled:hover:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)] data-[state=unchecked]:enabled:hover:text-fg-neutral-muted",
    "data-[state=unchecked]:enabled:active:bg-bg-neutral-weak-pressed data-[state=unchecked]:enabled:active:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)] data-[state=unchecked]:enabled:active:text-fg-neutral-muted",
    // 고른 칸 — 글자색만 바뀐다. 올리거나 누르면 칸에 칠해 알약을 덮는다(짙은 테두리는 그대로)
    "enabled:data-[state=checked]:text-fg-neutral",
    "data-[state=checked]:enabled:hover:bg-bg-layer-default-pressed data-[state=checked]:enabled:hover:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-contrast)]",
    "data-[state=checked]:enabled:active:bg-bg-layer-default-pressed data-[state=checked]:enabled:active:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-contrast)]",
    // 막힘 — 흐리게 하지 않는다. 고른 채 막히면 칸에 회색 바탕 + 짙은 1px 를 칠해 알약을 덮는다
    "disabled:cursor-not-allowed disabled:text-fg-disabled dark:disabled:text-fg-disabled",
    "data-[state=checked]:disabled:bg-bg-disabled data-[state=checked]:disabled:shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-solid)]",
  ].join(" "),
);

// 글 — 가운데 · 단어 단위 줄바꿈(v114). 누르는 동안 글만 준다(칸이 잰 --press-basis). 막힌 칸은 줄지 않는다
export const SEGMENTED_LABEL = [
  "relative min-w-0 text-center break-keep [overflow-wrap:break-word]",
  "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
  "group-active/segmented-item:[scale:calc(1-2/var(--press-basis))] group-disabled/segmented-item:[scale:1] motion-reduce:group-active/segmented-item:[scale:1]",
].join(" ");

// 알림 점 — 브랜드 글자색, 글 끝에서 2 · 글 위쪽. 띄워 두므로 칸 폭이 바뀌지 않는다. 고른 칸에는 그리지 않는다
export const SEGMENTED_NOTIFICATION =
  "pointer-events-none absolute left-[calc(100%_+_2px)] top-0 size-[6px] rounded-full bg-fg-brand";
