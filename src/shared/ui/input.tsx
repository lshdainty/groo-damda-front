import * as React from "react";

import { cn } from "@/shared/lib/index";

/*
 * Groo Input — groo-design specs/components/input.md SoT 기반.
 *
 * - 높이 40px (h-10) 고정 — variant 분리 안 함 (form 안 통일 우선).
 * - 색상: bg-neutral-weak(회색 채움 — 1.4.11 보강) / stroke-neutral-weak / text-fg-neutral / placeholder fg-neutral-subtle
 * - 폰트: t5 (16/400) — 입력값 가독성
 * - focus: stroke-focus-ring + ring-2 ring-ring/30 (다크는 토큰이 자동 swap)
 * - aria-invalid: border-fg-critical + ring-fg-critical/30
 * - disabled: opacity-50 + cursor-not-allowed
 * - file: prop 보존 (file:border-0 file:bg-transparent ...)
 * - 사이즈 예외 필요 시 사용처 className으로 (예: `className="h-12 text-t6"`)
 */

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { search?: boolean }
>(({ className, type, search = false, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex min-h-[40px] w-full min-w-0 rounded-r1 border border-stroke-neutral-weak bg-bg-neutral-weak px-[var(--spacing-x3)] py-[var(--spacing-x2)] font-sans text-t5 text-fg-neutral placeholder:text-fg-neutral-subtle",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg-neutral",
        "transition-[color,box-shadow,border-color] duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
        "aria-invalid:border-stroke-critical-solid",
        "disabled:cursor-not-allowed disabled:bg-bg-disabled disabled:text-fg-disabled disabled:border-stroke-neutral-weak",
        // search variant — 헤더(top__search) 정합: compact·radius-md·테두리 없음·filled·label-sm
        search &&
          "min-h-[36px] rounded-[var(--radius-r2)] border-transparent bg-[var(--bg-muted)] text-t3 focus-visible:bg-[var(--bg-surface)] focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
