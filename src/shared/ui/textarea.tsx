import * as React from "react";

import { cn } from "@/shared/lib/index";

/*
 * Groo Textarea — groo-design specs/components/textarea.md SoT 기반.
 *
 * - min-height 80px — 3줄 이상 본문 입력
 * - body-md typography (15/400/1.6) 한국어 본문 가독성
 * - bg-bg-neutral-weak(input 정합) + border-default + text-fg-neutral
 * - focus: border-focus + ring-2 ring-ring/30, aria-invalid: error 톤
 * - resize: y(데스크 본문 편의 — 사용자가 늘려 적기 가능). 고정 필요 시 className="resize-none"
 */

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full rounded-r1 border border-stroke-neutral-weak bg-bg-neutral-weak px-[var(--spacing-x3)] py-[var(--spacing-x2)] font-sans text-t5 text-fg-neutral placeholder:text-fg-neutral-subtle resize-y",
        "transition-[color,box-shadow,border-color] duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
        "aria-invalid:border-stroke-critical-solid",
        "disabled:cursor-not-allowed disabled:bg-bg-disabled disabled:text-fg-disabled disabled:border-stroke-neutral-weak",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
