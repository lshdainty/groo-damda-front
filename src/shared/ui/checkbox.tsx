import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";

/*
 * Groo Checkbox — groo-design specs/components/checkbox.md SoT 기반.
 *
 * - sizes: sm 16 / md 18 (default) / lg 20
 * - radius: rounded-r1 (4px)
 * - checked/indeterminate: bg-bg-brand-solid(브랜드 채움 — 다크 #1049A4) + 흰 아이콘
 * - unchecked hover: bg-bg-neutral-weak (Toss 톤 미세 affordance)
 * - focus: ring-2 ring-ring + 2px offset (다크는 border-focus-light 자동 alias)
 * - 터치 타겟은 control 단독으론 작음 (16-20) — 반드시 label까지 hit area 44+ 확보 (WCAG 2.5.5)
 */

const checkboxVariants = cva(
  "peer shrink-0 rounded-r1 border border-stroke-neutral-solid bg-bg-layer-default hover:bg-bg-neutral-weak data-[state=checked]:bg-bg-brand-solid data-[state=checked]:border-bg-brand-solid data-[state=checked]:text-static-white data-[state=checked]:hover:bg-bg-brand-solid data-[state=indeterminate]:bg-bg-brand-solid data-[state=indeterminate]:border-bg-brand-solid data-[state=indeterminate]:text-static-white data-[state=indeterminate]:hover:bg-bg-brand-solid aria-invalid:border-stroke-critical-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring disabled:cursor-not-allowed disabled:border-stroke-neutral-weak disabled:bg-bg-disabled disabled:hover:bg-bg-disabled transition-colors motion-safe:duration-[var(--motion-duration-d3)] motion-safe:ease-[var(--motion-ease-easing)]",
  {
    variants: {
      size: {
        sm: "size-4 [&_svg]:size-2.5",
        md: "size-[18px] [&_svg]:size-3",
        lg: "size-5 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface CheckboxProps
  extends
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size, checked, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    checked={checked}
    className={cn(checkboxVariants({ size }), className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {checked === "indeterminate" ? (
        <Minus strokeWidth={3} />
      ) : (
        <Check strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
