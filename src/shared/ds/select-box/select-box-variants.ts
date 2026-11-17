import { cva } from "class-variance-authority";

/*
 * Groo Select Box 의 모양 — 수치 원본은 groo-design specs/components/select-box.yaml(값은
 * src/shared/ds/spec/select-box.json). groo-design recipes/shadcn/components/ui/select-box.tsx 를 첫 판으로 가져왔다.
 * 이 파일은 모양 정의(cva · 클래스 상수), 컴포넌트는 select-box.tsx 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 *
 * 상자(div)는 테두리 · 바탕만 맡고, 그 안의 누르는 자리(label)가 콘텐츠 + 컨트롤을 담아 펼침(footer)을 뺀 상자 전체가 누르는 영역이
 * 된다. 고른 테두리는 ::after 로 안쪽 2px 에 덧그린다 — 1px → 2px 로 바뀌어도 내용이 밀리지 않는다(SEED). 바탕은 바꾸지 않는다.
 * 상태는 안쪽의 누르는 자리(label · data-select-box-action) · 컨트롤(data-select-box-control)에서 :has 로 읽는다.
 */

// 묶음 — 1 ~ 3열 격자. 2열 이상은 상자 높이를 가장 긴 상자에 맞춘다(모든 줄이 같은 높이 — SEED grid-auto-rows 1fr)
export const selectBoxGroupVariants = cva(
  "grid w-full gap-x-x3 gap-y-component-default",
  {
    variants: {
      columns: {
        1: "grid-cols-1",
        2: "auto-rows-fr grid-cols-2",
        3: "auto-rows-fr grid-cols-3",
      },
    },
    defaultVariants: { columns: 1 },
  },
);

// 상자 — 테두리 1px(안쪽) · 모서리 12. 고른 테두리 2px 는 ::after(100ms). 호버(마우스만) · 누름은 누름 바탕, 키보드 포커스는 바깥 링 — 직전 입력이 포인터면 그리지 않는다(index.css focus-visible 과 같은 조건)
export const selectBoxVariants = cva(
  [
    "group/select-box relative flex h-full flex-col rounded-r3 bg-transparent shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
    "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
    "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border-2 after:border-solid after:border-transparent after:content-[''] after:[transition:border-color_var(--motion-duration-d2)_var(--motion-ease-easing)]",
    "has-[[data-select-box-control][data-state=checked]:not([data-disabled])]:after:border-stroke-neutral-contrast",
    "has-[[data-select-box-control][data-state=checked][data-disabled]]:after:border-stroke-neutral-weak",
    "[@media(hover:hover)]:has-[[data-select-box-action]:not([data-disabled]):hover]:bg-bg-layer-default-pressed has-[[data-select-box-action]:not([data-disabled]):active]:bg-bg-layer-default-pressed",
    "has-[[data-select-box-control]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-2 has-[[data-select-box-control]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-offset-2 has-[[data-select-box-control]:focus-visible:not(:where(:root[data-input=pointer]_*))]:outline-stroke-focus-ring",
  ].join(" "),
);

// 누르는 자리(label) — 콘텐츠 + 컨트롤. 누르면 이 자리만 준다. 상자가 같은 높이로 늘면 남는 자리까지 채운다(grow — SEED) —
// 그래야 내용이 짧은 상자의 빈 아래쪽도 눌린다. 하나 고르기 상자는 group/radio 도 달아 라디오가 상자의 호버 · 누름을 자기 누름 색으로 받는다
export const selectBoxTriggerVariants = cva(
  [
    "relative flex w-full grow cursor-pointer select-none justify-between gap-x1_5",
    "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
    "group-has-[[data-select-box-action]:not([data-disabled]):active]/select-box:[scale:calc(1-2/var(--press-basis))] motion-reduce:group-has-[[data-select-box-action]:not([data-disabled]):active]/select-box:[scale:1]",
    "data-[disabled]:cursor-not-allowed",
  ].join(" "),
  {
    variants: {
      layout: {
        horizontal: "items-center py-x4 pl-x5 pr-x4",
        vertical: "items-start px-x4",
      },
      mark: { radio: "group/radio", check: "", none: "" },
      // compact(세로형만) — 위아래 20 → 12 (17-1 Q5 = B). 가로형은 그대로
      density: { default: "", compact: "" },
    },
    compoundVariants: [
      { layout: "vertical", density: "default", className: "py-x5" },
      { layout: "vertical", density: "compact", className: "py-x3" },
    ],
    defaultVariants: { layout: "horizontal", mark: "none", density: "default" },
  },
);

// 콘텐츠 — 앞 · 본문. 가로형은 한 줄(사이 12), 세로형은 앞이 위(사이 10)
export const selectBoxContentVariants = cva("flex min-w-0 flex-1", {
  variants: {
    layout: {
      horizontal: "flex-row items-center gap-x3",
      vertical: "flex-col",
    },
    density: { default: "", compact: "" },
  },
  compoundVariants: [
    { layout: "vertical", density: "default", className: "gap-x2_5" },
    { layout: "vertical", density: "compact", className: "gap-x1" },
  ],
  defaultVariants: { layout: "horizontal", density: "default" },
});

export const selectBoxPrefixVariants = cva(
  "flex shrink-0 text-fg-neutral [&>svg]:size-[22px]",
  {
    variants: { disabled: { true: "text-fg-disabled", false: "" } },
    defaultVariants: { disabled: false },
  },
);

export const selectBoxBodyVariants = cva(
  "mr-auto flex min-w-0 flex-col items-start gap-x0_5 pr-x1 text-left",
);

export const selectBoxLabelVariants = cva(
  "flex items-center gap-x1 font-sans text-t5 font-medium text-fg-neutral",
  {
    variants: { disabled: { true: "text-fg-disabled", false: "" } },
    defaultVariants: { disabled: false },
  },
);

export const selectBoxDescriptionVariants = cva(
  "font-sans text-t3 text-fg-neutral-muted",
  {
    variants: { disabled: { true: "text-fg-disabled", false: "" } },
    defaultVariants: { disabled: false },
  },
);

// 펼침 — 고른 상자 아래로 열린다. 높이는 grid-template-rows 0fr → 1fr(열 때 400ms · 닫을 때 300ms), 투명도는 열 때 300ms · 닫을 때 400ms
// (내용이 높이보다 먼저 사라지지 않게). 닫히면 보이지 않는다(visibility — Tab 도 안 닿는다). 모션 줄이기면 높이는 바로 바뀌고 투명도만 150ms.
// Tailwind 는 소스의 글자 그대로를 읽으므로 두 경우의 클래스를 다 적는다(조합해 만들면 CSS 가 생기지 않는다)
const FOOTER_BASE = [
  "grid invisible opacity-0 [grid-template-rows:0fr]",
  "[transition:grid-template-rows_var(--motion-duration-d6)_var(--motion-ease-easing),opacity_400ms_var(--motion-ease-easing),visibility_0s_linear_400ms]",
  "motion-reduce:[transition:opacity_150ms_linear,visibility_0s_linear_150ms]",
].join(" ");
const FOOTER_OPEN = {
  "when-selected": [
    "group-has-[[data-select-box-control][data-state=checked]]/select-box:visible group-has-[[data-select-box-control][data-state=checked]]/select-box:opacity-100 group-has-[[data-select-box-control][data-state=checked]]/select-box:[grid-template-rows:1fr]",
    "group-has-[[data-select-box-control][data-state=checked]]/select-box:[transition:grid-template-rows_400ms_var(--motion-ease-easing),opacity_var(--motion-duration-d6)_var(--motion-ease-easing),visibility_0s]",
    "motion-reduce:group-has-[[data-select-box-control][data-state=checked]]/select-box:[transition:opacity_150ms_linear,visibility_0s]",
  ].join(" "),
  "when-not-selected": [
    "group-has-[[data-select-box-control][data-state=unchecked]]/select-box:visible group-has-[[data-select-box-control][data-state=unchecked]]/select-box:opacity-100 group-has-[[data-select-box-control][data-state=unchecked]]/select-box:[grid-template-rows:1fr]",
    "group-has-[[data-select-box-control][data-state=unchecked]]/select-box:[transition:grid-template-rows_400ms_var(--motion-ease-easing),opacity_var(--motion-duration-d6)_var(--motion-ease-easing),visibility_0s]",
    "motion-reduce:group-has-[[data-select-box-control][data-state=unchecked]]/select-box:[transition:opacity_150ms_linear,visibility_0s]",
  ].join(" "),
} as const;
export const footerClasses = (
  visibility: "when-selected" | "when-not-selected",
) => `${FOOTER_BASE} ${FOOTER_OPEN[visibility]}`;
// 펼침 안쪽 여백 — 좌우 20 · 아래 16(컴포넌트가 정한다)
export const selectBoxFooterInnerVariants = cva("px-x5 pb-x4");

// 컨트롤은 따로 줄지 않는다 — 누르는 자리가 함께 준다(v104). label 의 누름이 컨트롤로 넘어오므로 축소만 끈다
// (라디오는 상자의 호버 · 누름을 group/radio 로도 받으므로 그 축소도 끈다).
// 포커스 링도 상자가 그리므로 컨트롤 자기 링은 끈다(SEED 도 trigger 에서 --seed-focus-ring: none — 링이 두 겹이 되지 않는다).
// 체크(Ghost)는 상자가 누름 · 호버를 맡으므로 자기 바탕을 끈다
export const SELECT_BOX_MARK =
  "active:[scale:1] focus-visible:outline-none group-active/radio:[scale:1]";
export const SELECT_BOX_GHOST_NO_BG =
  "hover:bg-transparent active:bg-transparent data-[state=checked]:hover:bg-transparent data-[state=checked]:active:bg-transparent";
