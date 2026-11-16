import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/shared/lib/index";

/*
 * Groo Tooltip — groo-design specs/components/tooltip.md SoT 기반.
 *
 * - Radix Tooltip 베이스. composition: TooltipProvider > Tooltip > Trigger + Content.
 * - True inverted tooltip — light 모드는 dark 배경, dark 모드는 light 배경.
 *   페이지 surface와 항상 반대 톤이라 즉시 식별.
 * - bg: var(--color-fg-neutral) — light(#1A1F2E dark) / dark(#F5F6FA light) 자동 swap.
 * - text: var(--color-bg-layer-default) — bg와 정확히 반대로 swap, 두 모드 모두 충분한 대비.
 * - box-shadow inline — Tailwind v4 `--tw-shadow-*` 분해가 다크모드 토큰 override 우회 fix.
 * - border 불필요 — 페이지와 강한 대비(16:1+)로 시각 식별 충분.
 */

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, style, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-(--z-tooltip) overflow-hidden rounded-r0_5 px-[var(--spacing-x3)] py-[var(--spacing-x1)] text-t3 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    style={{
      backgroundColor: "var(--color-fg-neutral)",
      color: "var(--color-bg-layer-default)",
      boxShadow: "var(--shadow-s1)",
      ...style,
    }}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
