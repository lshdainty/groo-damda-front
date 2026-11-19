import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";
import { ProgressCircle } from "@/shared/ds/progress-circle";

import { BUTTON_LABEL, buttonVariants } from "./button-variants";

// 변형 · 크기 · 상태는 button-variants.ts 머리 주석과 groo-design specs/components/button.yaml 이 정한다.

export interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** 누름 색 위 로딩 원 + 누르기 막기 + aria-busy. asChild 와 함께 쓰지 않는다(Slot 은 자식 하나). */
  loading?: boolean;
  /** 누름. Promise 를 돌려주면 그것이 끝날 때(이행 · 거부)까지 다음 누름을 버린다 — 비동기 동작은 Promise 를 돌려준다(mutateAsync). */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
}

// 버리는 누르기(로딩 중 · 누른 동작이 끝나기 전) — 제출도, 부모로 올라가는 것도 막는다
function swallow(e: React.MouseEvent<HTMLButtonElement>) {
  e.preventDefault();
  e.stopPropagation();
}

const isThenable = (v: unknown): v is PromiseLike<unknown> =>
  typeof (v as PromiseLike<unknown> | null)?.then === "function";

// 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 --press-basis 로 — 폭이 넓은 버튼(w-full)도 세로 2px 만 준다.
function setPressBasis(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const basis = Math.max(el.offsetHeight, el.offsetWidth / 4, 24);
  el.style.setProperty("--press-basis", String(basis));
}

/**
 * 라벨 감싸기 — 이어진 글(문자열 · 숫자)을 한 덩어리 span 으로 묶어 한 줄 "…" 로 줄인다. 아이콘 · 요소는 그대로 둔다(아이콘은 px).
 * 글을 나눠 쓴 자식({"총 "}{n}{"개"})도 한 span 이라 한꺼번에 줄어든다.
 */
function wrapLabel(children: React.ReactNode): React.ReactNode {
  const out: React.ReactNode[] = [];
  let text: (string | number)[] = [];
  const flush = () => {
    if (text.length === 0) return;
    out.push(
      <span
        key={`label-${out.length}`}
        data-slot="button-label"
        className={BUTTON_LABEL}
      >
        {text.join("")}
      </span>,
    );
    text = [];
  };
  // toArray — 요소에 열쇠를 달고 빈 값(null · 참거짓)을 걷는다
  for (const c of React.Children.toArray(children)) {
    if (typeof c === "string" || typeof c === "number") text.push(c);
    else {
      flush();
      out.push(c);
    }
  }
  flush();
  return out;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      layout,
      ghostColor,
      flush,
      asChild = false,
      loading = false,
      disabled,
      children,
      onPointerDown,
      onClick,
      ...props
    },
    ref,
  ) => {
    const classes = cn(
      buttonVariants({ variant, size, layout, ghostColor, flush, className }),
    );
    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressBasis(e);
      onPointerDown?.(e);
    };
    // 누른 동작이 끝날 때까지 한 번 — onClick 이 돌려준 Promise 가 끝나기 전의 누름은 버린다. finally 는 거부를 그대로 넘긴다
    // (부르는 쪽이 잡지 않은 오류는 전처럼 한 번 알려진다)
    const inFlight = React.useRef(false);
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (inFlight.current) return swallow(e);
      const result = onClick?.(e);
      if (!isThenable(result)) return;
      inFlight.current = true;
      void Promise.resolve(result).finally(() => {
        inFlight.current = false;
      });
    };
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={classes}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          {...props}
        >
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled}
        aria-busy={loading || undefined}
        onPointerDown={handlePointerDown}
        // 로딩 중엔 포인터뿐 아니라 키보드(Enter · Space) 누르기도 삼킨다 — 두 번 제출 방지(submit 도 막는다)
        onClick={loading ? swallow : handleClick}
        {...props}
      >
        {wrapLabel(children)}
        {loading && (
          <ProgressCircle
            size="inherit"
            tone="inherit"
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
