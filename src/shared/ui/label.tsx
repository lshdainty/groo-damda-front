"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";

/*
 * Groo Label — groo-design specs/components/label.md SoT 기반.
 * label-md typography (14/500/1.4) + text-fg-neutral 색 명시.
 * peer-disabled: 짝지어진 input이 disabled면 함께 흐림.
 */

const labelVariants = cva(
  "text-t4 font-medium text-fg-neutral leading-none peer-disabled:cursor-not-allowed peer-disabled:text-fg-disabled",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
