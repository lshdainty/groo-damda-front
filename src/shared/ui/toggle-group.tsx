import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";
import { toggleVariants } from "@/shared/ui/toggle-variants";

/*
 * Groo ToggleGroup — groo-design specs/components/toggle-group.md SoT 기반.
 * Phase 2 마이그레이션: groo 토큰 + desk-front segmented wrapper 보존.
 *
 * variant:
 *   default — flex gap-1 (개별 toggle 시각이 자체 border/bg)
 *   segmented (= solid) — 그루 .p-seg sunken bar wrapper + active=primary 채움 강조 톤
 *   segmented-subtle — 같은 sunken bar wrapper + active=surface-input 채움 토스 절제 톤
 */

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => {
  // 그루 .p-seg — sunken bar for segmented control. solid / subtle 둘 다 동일 wrapper.
  // 트랙은 앱 PSegmented 정합으로 어두운 page 톤(--bg-canvas) + gap 0. 웹 --bg-sunken 은
  // 다크에서 surface 보다 밝아 앱(어두운 sunken)과 반대라, 트랙만 page 톤으로 맞춤.
  const wrapper =
    variant === "segmented" || variant === "segmented-subtle"
      ? "inline-flex w-full gap-0 rounded-[var(--radius-r2)] border border-stroke-neutral-weak bg-[var(--bg-canvas)] p-0.5"
      : "flex items-center justify-center gap-1";
  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn(wrapper, className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
});

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
