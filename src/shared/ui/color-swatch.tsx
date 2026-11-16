import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/index";

/*
 * ColorSwatch — groo-design spec color-swatch.md SoT 정합.
 * single-select 색 grid: aspect-square + radius-tile + border 2px transparent (active=currentColor) + ✓ check.
 * 사용처: 카테고리/라벨/태그 색 선택.
 */

type ColorSwatchOption = {
  value: string;
  bg: string;
  fg: string;
  label?: string;
};

type ColorSwatchGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
  "children"
> & {
  options: ColorSwatchOption[];
  columns?: number;
};

const ColorSwatchGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  ColorSwatchGroupProps
>(({ options, columns = 5, className, style, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("grid gap-[var(--spacing-x2)]", className)}
    style={{
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      ...style,
    }}
    {...props}
  >
    {options.map((opt) => (
      <ColorSwatchItem key={opt.value} option={opt} />
    ))}
  </RadioGroupPrimitive.Root>
));
ColorSwatchGroup.displayName = "ColorSwatchGroup";

const ColorSwatchItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  { option: ColorSwatchOption }
>(({ option, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    value={option.value}
    aria-label={option.label ?? option.value}
    className={cn(
      "relative aspect-square w-full rounded-[var(--radius-tile)]",
      "border-2 border-transparent transition-transform duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
      "hover:scale-[1.05]",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
      "data-[state=checked]:border-[currentColor]",
      // 막혀도 칸의 색은 그대로 — 색이 곧 값이다(스펙 color-swatch.yaml disabled). 불투명도로 흐리게 하지 않고(01-029),
      // 고른 채 막히면 고리만 회색(stroke-neutral-solid)으로 남긴다
      "disabled:cursor-not-allowed disabled:hover:scale-100 disabled:data-[state=checked]:border-stroke-neutral-solid",
    )}
    style={{ background: option.bg, color: option.fg }}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
      <Check size={14} strokeWidth={2.6} />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
ColorSwatchItem.displayName = "ColorSwatchItem";

export { ColorSwatchGroup, ColorSwatchItem };
export type { ColorSwatchOption };
