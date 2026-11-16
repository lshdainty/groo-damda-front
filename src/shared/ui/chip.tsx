import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";

/*
 * Groo Chip — 눌러서 켜고 끄는 선택 칩 (다중선택 목록·필터).
 *
 * groo-design 에는 chip 전용 spec 이 없다 — toggle-group spec 은 2~5개 segmented
 * 한정이라 37장짜리 그리드에 쓸 수 없다. 앱(`porest-desk-app`)도 같은 이유로
 * `lib/shared/widgets/p_chip.dart` 를 두고 있어, 그 시각을 그대로 미러한다:
 *
 * - off = bg-muted 옅은 채움. 테두리를 두르면 칩이 여럿 모였을 때 선이 격자처럼 겹친다.
 * - on  = --bg-brand 채움 + fg-on-brand. 다크에서도 primary 고정 — Tabs pills 와 같은 규칙
 *         (bg-brand 는 다크에서 밝아지지 않는다).
 *
 * 앱 PChip 의 subtle·neutral variant 와 icon/dot/trailing 슬롯은 웹에 쓸 자리가 아직
 * 없어 포팅하지 않았다. 필요해지는 시점에 앱 위젯을 그대로 따라 추가할 것.
 */

const chipVariants = cva(
  [
    "inline-flex items-center gap-[var(--spacing-x1)] font-sans leading-tight",
    "transition-colors duration-[var(--motion-duration-d3)] ease-[var(--motion-ease-easing)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring",
    "disabled:pointer-events-none disabled:bg-bg-disabled disabled:text-fg-disabled",
  ].join(" "),
  {
    variants: {
      shape: {
        pill: "rounded-full",
        rounded: "rounded-r2",
      },
      size: {
        sm: "px-2.5 py-[5px] text-t2",
        md: "px-3 py-1.5 text-t4",
      },
      selected: {
        true: "bg-[var(--bg-brand)] text-[var(--fg-on-brand)] font-semibold",
        false:
          "bg-bg-neutral-weak text-fg-neutral-muted font-medium hover:text-fg-neutral",
      },
      /** 그리드 셀용 — 주어진 칸을 꽉 채우고 라벨을 좌측 정렬한다. */
      fullWidth: {
        true: "w-full h-full justify-start text-left",
        false: "justify-center",
      },
    },
    defaultVariants: {
      shape: "pill",
      size: "md",
      selected: false,
      fullWidth: false,
    },
  },
);

export interface ChipProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof chipVariants> {
  children: React.ReactNode;
}

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    { className, shape, size, selected, fullWidth, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected ?? false}
      className={cn(
        chipVariants({ shape, size, selected, fullWidth }),
        className,
      )}
      {...props}
    >
      {/* 폭을 채울 땐 라벨이 남는 자리를 먹고, 길면 두 줄까지 쓴 뒤 말줄임(앱 PChip 정합). */}
      {fullWidth ? (
        <span className="min-w-0 flex-1 line-clamp-2">{children}</span>
      ) : (
        children
      )}
    </button>
  ),
);
Chip.displayName = "Chip";

export { Chip };
