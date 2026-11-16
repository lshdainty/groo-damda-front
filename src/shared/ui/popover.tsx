import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/shared/lib/index";

/*
 * Groo Popover — groo-design specs/components/popover.md SoT 기반.
 *
 * - Radix Popover 베이스. 트리거 클릭 시 떠오르는 패널.
 * - composition: Popover > PopoverTrigger / PopoverAnchor + PopoverContent
 * - preview `.pop` SoT: radius-md + padding-md + shadow-s2(inline) + flex-col gap-x2.
 * - border-default + bg-bg-layer-default + text-fg-neutral.
 * - box-shadow inline — Tailwind v4 `--tw-shadow-*` 분해가 다크모드 토큰 swap 우회 fix.
 */

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-(--z-floating) w-72 flex flex-col gap-[var(--spacing-x2)] rounded-r2 border border-stroke-neutral-weak bg-bg-layer-default p-[var(--spacing-x3)] text-fg-neutral outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      style={{ boxShadow: "var(--shadow-s2)", ...style }}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
