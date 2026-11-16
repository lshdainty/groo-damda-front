"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { type VariantProps } from "class-variance-authority";

import { toggleVariants } from "@/shared/ui/toggle-variants";

import { cn } from "@/shared/lib/index";

/*
 * Groo Toggle — groo-design specs/components/toggle.md SoT 기반.
 * Phase 2 마이그레이션: groo 토큰 + desk-front variants(default/outline/segmented*) +
 * sizes(default/sm/lg) 보존.
 *
 * variants:
 *   default (borderless toolbar): bg-transparent + hover:bg-bg-neutral-weak + on:bg-bg-neutral-weak
 *   outline (독립 toggle): border-default + on:border-strong
 *   segmented (= solid): ToggleGroup variant="segmented" 와 — active = primary 채움 + 흰글씨 + bold + shadow (강조 톤)
 *   segmented-subtle: ToggleGroup variant="segmented-subtle" 와 — active = surface-input 채움 + 검정 + semi (토스 절제 톤)
 */

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle };
