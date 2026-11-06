import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/shared/ui/button-variants";

import { cn } from "@/shared/lib/index";
import { ProgressCircle } from "@/shared/ds/progress-circle";

/*
 * Groo Button — groo-design SoT(specs/components/button.md) 기반.
 * Phase 2 마이그레이션(2026-05-13): groo 시각 토큰 + desk-front 호환 보존.
 *
 * Groo 시각 (preview-html `.btn` SoT):
 *   - gap-sm + transition-[box-shadow] + focus-visible:ring-2 ring-ring ring-offset-2
 *   - default: bg-primary + shadow-sm/md + brightness hover/active
 *   - destructive: bg-destructive + 동일 패턴
 *   - outline: border-border-default + hover:bg-surface-input
 *   - secondary: bg-secondary + hover:bg-surface-input
 *   - ghost: hover:bg-surface-input (Groo는 hover:bg-surface-input, desk-front token alias 후 동일)
 *
 * desk-front 호환 보존:
 *   - size: default(=md 톤, h-9)/xs(h-6)/sm(h-8)/md(h-10 신규)/lg(h-11)/icon(h-9)
 *   - variant: warm 보존 (사용 1건, --bg-section-warm semantic alias 사용)
 *   - loading prop — groo Spinner(size=sm) 노출. currentColor 상속으로
 *     filled(default/destructive)에선 white, outline/ghost에선 primary 자동 적응.
 *     asChild와 함께 쓰지 말 것 (Slot 단일 child 제약).
 */

/** 같은 버튼의 재클릭을 버리는 창(ms). OS 더블클릭 판정(≈500ms)보다 조금 길게. */
export const DOUBLE_CLICK_GUARD_MS = 600;

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** true면 좌측에 spinner 표시 + disabled 처리. asChild와는 함께 쓰지 말 것 (Slot 단일 child). */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      flush,
      asChild = false,
      loading,
      disabled,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    // 더블클릭 방어 — `loading` 을 넘긴 버튼은 비동기 작업을 거는 버튼이다. isPending 이
    // true 로 바뀌어 disabled 가 되는 건 다음 렌더 뒤라, 따닥 누르면 두 번째 클릭이 그
    // 사이를 뚫고 같은 요청을 한 번 더 보냈다(거래 2건 저장, QA 2026-09-02). 렌더와
    // 무관하게 동기적으로 짧은 창(더블클릭 간격) 안의 재클릭을 버린다. 창이 지나면
    // 부모의 loading/disabled 가 이어받는다.
    //
    // 막아야 하는 창은 딱 "클릭 → 다음 렌더" 사이다. 그래서 **비동기 작업이 실제로
    // 시작된 클릭만** 창을 물려받는다 — 검증에 걸려 onClick 이 아무것도 안 걸고 빠져나온
    // 클릭까지 시각을 들고 있으면, 사용자가 안내를 읽고 고쳐서 다시 누른 진짜 저장이
    // 통째로 버려졌다("제목을 입력해 주세요" 뒤 0.6초 안의 재저장이 무반응, QA #160).
    const lastClickAt = React.useRef(0);
    const isAsyncAction = loading !== undefined;
    // 되돌림 판정은 **최신 loading** 을 봐야 한다. guardedClick 클로저에 잡힌 loading 은
    // 클릭 시점 값이라, 클릭이 걸어 놓은 작업 때문에 true 로 바뀐 걸 못 본다.
    const loadingRef = React.useRef(loading);
    React.useLayoutEffect(() => {
      loadingRef.current = loading;
    });
    const revertTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
    React.useEffect(() => () => clearTimeout(revertTimer.current), []);
    const guardedClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isAsyncAction) {
          const now = Date.now();
          if (now - lastClickAt.current < DOUBLE_CLICK_GUARD_MS) {
            e.preventDefault();
            return;
          }
          lastClickAt.current = now;
          // 이 클릭이 정말 뭔가를 걸었는지는 이벤트가 끝나고 렌더가 반영된 뒤에야 안다.
          // 0ms 타이머는 그 커밋 다음에 돈다 — 같은 프레임 안의 두 번째 클릭보다는 뒤,
          // 사람이 안내를 읽고 다시 누르는 것(실측 최단 57ms)보다는 앞이다.
          clearTimeout(revertTimer.current);
          revertTimer.current = setTimeout(() => {
            if (!loadingRef.current) lastClickAt.current = 0;
          }, 0);
        }
        onClick?.(e);
      },
      [isAsyncAction, onClick],
    );
    if (asChild) {
      // asChild 는 가드를 지나지 않는다 — Slot 은 `loading` 과 함께 쓰지 않는 경로라
      // (단일 child 제약, 위 JSDoc) isAsyncAction 이 늘 false 다. 지금 호출처도 전부
      // 링크(`<a>`/`<Link>`)라 막을 요청이 없다.
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, flush, className }))}
          ref={ref}
          onClick={onClick}
          {...props}
        >
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, flush, className }))}
        ref={ref}
        disabled={disabled || !!loading}
        aria-busy={loading || undefined}
        onClick={guardedClick}
        {...props}
      >
        {loading && (
          // 옛 Spinner sm(16) 자리 — 원 · 트랙은 버튼 글자색과 그 30%(variant 마다 글자색을 따른다)
          <ProgressCircle
            size="inherit"
            tone="inherit"
            aria-hidden
            className="[--progress-size:16px]"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
