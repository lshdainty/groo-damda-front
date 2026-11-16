import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";

/*
 * Groo Badge — groo-design specs/components/badge.md SoT 기반.
 *
 * 3 styles × neutral·semantic 매트릭스 (12 variants):
 *   solid:    default(primary) / secondary(surface-input) / destructive(error)
 *   soft:     info / success / warning / error  — color-mix 16% bg
 *   outline:  outline(neutral) / outline-fg-informative / outline-fg-positive / outline-fg-warning / outline-fg-critical
 *
 * 강조 강도: solid > soft > outline. 의미 분기는 색으로, style은 카테고리 안에서 통일.
 */

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-full border",
    // spec badge.md: 11px(t1) · 600 · 줄 높이 1.2 — text-xs(12/1.4)는 spec 일탈이었음 (앱 PBadge 정합)
    "px-[var(--spacing-x2)] py-0.5 text-[length:var(--text-t1)] font-semibold leading-[1.2] tracking-normal",
    "transition-colors duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
  ].join(" "),
  {
    variants: {
      variant: {
        // solid
        default:
          "border-transparent bg-bg-brand-solid text-static-white hover:brightness-105",
        secondary:
          "border-transparent bg-bg-neutral-weak text-fg-neutral hover:bg-stroke-neutral-weak",
        destructive:
          "border-transparent bg-bg-critical-solid text-static-white hover:brightness-105",
        // soft (semantic, color-mix 16% bg) — 텍스트는 status-*-fg (다크에서 light variant, 앱 statusXxxFg 정합)
        info: "border-transparent bg-bg-informative-weak text-[color:var(--status-info-fg)] hover:bg-bg-informative-weak-pressed",
        success:
          "border-transparent bg-bg-positive-weak text-[color:var(--status-success-fg)] hover:bg-bg-positive-weak-pressed",
        warning:
          "border-transparent bg-bg-warning-weak text-[color:var(--status-warning-fg)] hover:bg-bg-warning-weak-pressed",
        error:
          "border-transparent bg-bg-critical-weak text-[color:var(--status-danger-fg)] hover:bg-bg-critical-weak-pressed",
        // outline (neutral + semantic) — 텍스트 status-*-fg / 테두리 base (앱 outline 정합)
        outline:
          "border-stroke-neutral-weak bg-transparent text-fg-neutral hover:bg-bg-neutral-weak",
        "outline-fg-informative":
          "border-stroke-informative-solid text-[color:var(--status-info-fg)] bg-transparent hover:bg-bg-informative-weak",
        "outline-fg-positive":
          "border-stroke-positive-solid text-[color:var(--status-success-fg)] bg-transparent hover:bg-bg-positive-weak",
        "outline-fg-warning":
          "border-stroke-warning-solid text-[color:var(--status-warning-fg)] bg-transparent hover:bg-bg-warning-weak",
        "outline-fg-critical":
          "border-stroke-critical-solid text-[color:var(--status-danger-fg)] bg-transparent hover:bg-bg-critical-weak",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
