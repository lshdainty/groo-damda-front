import { cva } from "class-variance-authority";

/*
 * Toggle cva — toggle.tsx 에서 분리(Fast Refresh: 컴포넌트 파일은 컴포넌트만 export).
 * 시각 spec 주석은 toggle.tsx 상단 참조.
 */
export const toggleVariants = cva(
  [
    "inline-flex items-center justify-center gap-[var(--spacing-x1)] rounded-r2 text-t2 font-semibold",
    "ring-offset-bg-layer-basement transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
    "disabled:pointer-events-none disabled:bg-bg-disabled disabled:text-fg-disabled",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // spec toggle.md — base가 caption 600 고정(off/on 동일 weight, WCAG 1.4.11).
        // on: surface-input 채움 + text-fg-neutral 변화로 식별.
        default:
          "bg-transparent text-fg-neutral-muted hover:bg-bg-neutral-weak hover:text-fg-neutral data-[state=on]:bg-bg-neutral-weak data-[state=on]:text-fg-neutral",
        outline:
          "border border-stroke-neutral-weak bg-transparent text-fg-neutral-muted hover:bg-bg-neutral-weak hover:text-fg-neutral data-[state=on]:bg-bg-neutral-weak data-[state=on]:text-fg-neutral data-[state=on]:border-border-default-strong",
        // 그루 .p-seg__btn (solid) — segmented item, active 강조 톤.
        // spec toggle-group.md visual=solid 정합 — primary 채움 + 흰글씨 + bold + shadow.
        // 앱 PSegmented 정합 — active 는 primary 채움 + 흰글씨 + semi(600), shadow 없음.
        // (spec toggle-group.md solid 은 700+shadow 였으나 desk 구독 세그먼트 기준 앱 룩 채택)
        segmented: [
          "flex-1 gap-0 rounded-[var(--radius-r1)] bg-transparent px-3 py-1 whitespace-nowrap",
          "text-[length:var(--text-t2)] font-semibold leading-none text-fg-neutral-muted",
          "hover:bg-transparent hover:text-fg-neutral-muted",
          "data-[state=on]:bg-bg-brand-solid data-[state=on]:text-static-white",
        ].join(" "),
        // 그루 .p-seg__btn--subtle — segmented item, 토스 절제 톤.
        // spec toggle-group.md visual=subtle 정합 — surface-input 채움 + 검정 + semi.
        "segmented-subtle": [
          "flex-1 gap-0 rounded-[var(--radius-r1)] bg-transparent px-3 py-1 whitespace-nowrap",
          "text-[length:var(--text-t2)] font-semibold leading-none text-fg-neutral-muted",
          "hover:bg-bg-neutral-weak hover:text-fg-neutral",
          "data-[state=on]:bg-bg-neutral-weak data-[state=on]:text-fg-neutral data-[state=on]:font-semibold",
        ].join(" "),
      },
      size: {
        // spec toggle.md Sizes — token padding + min-height, font은 base(caption 600).
        default: "px-[var(--spacing-x3)] py-[var(--spacing-x1)] min-h-8",
        sm: "px-[var(--spacing-x2)] py-[var(--spacing-x1)] min-h-7",
        lg: "px-[var(--spacing-x4)] py-[var(--spacing-x2)] min-h-10",
      },
    },
    compoundVariants: [
      // segmented는 size.default의 h-10을 무력화 — padding으로 높이 결정
      {
        variant: "segmented",
        size: "default",
        class: "h-7 min-h-0 min-w-0 px-3",
      },
      { variant: "segmented", size: "sm", class: "h-7 min-h-0 min-w-0 px-3" },
      { variant: "segmented", size: "lg", class: "h-8 min-h-0 min-w-0 px-3" },
      // segmented-subtle 도 동일 — variant 시각 변경, 사이즈 메트릭은 segmented 와 1:1
      {
        variant: "segmented-subtle",
        size: "default",
        class: "h-7 min-h-0 min-w-0 px-3",
      },
      {
        variant: "segmented-subtle",
        size: "sm",
        class: "h-7 min-h-0 min-w-0 px-3",
      },
      {
        variant: "segmented-subtle",
        size: "lg",
        class: "h-8 min-h-0 min-w-0 px-3",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
