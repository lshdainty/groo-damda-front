import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";
import { registerOverlay } from "@/shared/lib/groo/pointer-block";
import { buttonVariants } from "@/shared/ui/button-variants";
import { ProgressCircle } from "@/shared/ds/progress-circle";

/**
 * footer 버튼 크기 — 데스크탑·태블릿 `default`(36 · 좌우 **양쪽 16** · 14px), 모바일만
 * 호출처가 `lg`(48)을 넘긴다. dialog.md footer 규칙이고 alert-dialog.md 가 같은 값을 가리킨다.
 *
 * 기기 판정을 CSS 브레이크포인트(`sm:` 640)로 하지 않는 이유 — desk 의 모바일 경계는
 * `useDeviceSize` 의 768 이라, 그 사이 폭에서 확인창의 두 버튼이 서로 다른 크기가 된다.
 */
type FooterButtonSize = "default" | "lg";

/*
 * Groo AlertDialog — groo-design specs/components/alert-dialog.md SoT 기반.
 * Phase 2 마이그레이션: 비가역 액션 확정용 modal. Dialog와 시각 동일.
 *
 * 호환 보존:
 *   - sizes 추가(sm/md/lg) — desk-front 기존 max-w-lg는 default md(480)와 유사
 *   - AlertDialogAction: buttonVariants() default(primary) 유지 + loading prop 보존
 *     (사용처에서 destructive 필요 시 className 또는 variant override)
 *   - Loader2 → groo Spinner → ds ProgressCircle(inherit) 교체
 *
 * 동작 차이(Dialog 대비):
 *   - overlay click 무시 / close button(X) 없음 / default focus = Cancel
 */

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  // 확인창이 닫힌 직후 그 자리로 올라온 다른 행이 두 번째 탭을 받는 걸 막는다 — QA #57.
  // overlay 에 거는 이유는 dialog.tsx 의 같은 주석을 본다 — 확인창은 대부분
  // `open={deletingId !== null}` 로 쓰여 바깥 래퍼가 닫힌 뒤에도 살아 있다.
  React.useEffect(registerOverlay, []);
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-(--z-alert) bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
});
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const alertDialogContentVariants = cva(
  [
    "fixed left-[50%] top-[50%] z-(--z-alert-content) flex w-[min(90%,var(--dialog-max-w))] translate-x-[-50%] translate-y-[-50%]",
    // Dialog 와 같은 껍데기 — 여백은 컨테이너가 아니라 헤더·본문·footer 가 갖고,
    // 본문만 스크롤한다(dialog.md Layout). 상한도 같은 86vh.
    "max-h-[86vh] overflow-hidden",
    "flex-col bg-[var(--bg-surface)] duration-200",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  ].join(" "),
  {
    variants: {
      size: {
        // 폭은 Dialog 와 같은 값이다 — 같은 화면에서 확인창만 좁으면 다른 컴포넌트로
        // 보인다(2026-09-16 결정: 420/520/720 로 통일).
        sm: "[--dialog-max-w:420px] rounded-lg",
        // popup 은 세 사이즈 모두 radius-lg(12) — dialog.md. 시트/드로어(20)와 갈라 둔다.
        md: "[--dialog-max-w:520px] rounded-lg",
        lg: "[--dialog-max-w:720px] rounded-lg",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface AlertDialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>,
    VariantProps<typeof alertDialogContentVariants> {}

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, size, style, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(alertDialogContentVariants({ size }), className)}
      style={{ boxShadow: "var(--shadow-xl)", ...style }}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

// Dialog 의 세 구역과 같은 여백을 쓴다 — 같은 화면에 함께 뜨므로 확인창만 다르면
// 다른 컴포넌트로 보인다. 헤더 18 22 · 본문 22 · footer 18 22(dialog.md Layout).
const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 items-center gap-3 px-[22px] py-[18px]",
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

/** 본문 — 스크롤은 여기서만 인다. 헤더·footer 는 shrink-0 이라 밀리지 않는다. */
const AlertDialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 min-h-0 overflow-y-auto p-[22px]", className)}
    {...props}
  />
);
AlertDialogBody.displayName = "AlertDialogBody";

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // spec alert-dialog.md "ⓔ footer (모바일 < 640px)": 각 button flex-1 균등 분배.
      // 데스크탑(≥640px)은 preview .modal-actions 그대로 우측 정렬.
      //
      // 모바일에서 우측 정렬 compact 로 두면 화면 구석의 작은 알약이 돼 한 손으로
      // 누를 폭이 안 나온다 — dialog.md 114-116 · drawer.md footer 와 같은 규칙.
      // footer 18 22 — 헤더 위와 같은 값이다(dialog.md Layout).
      "flex shrink-0 items-center gap-[var(--spacing-sm)] px-[22px] py-[18px]",
      "[&>button]:flex-1 sm:justify-end sm:[&>button]:flex-none",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-title-md font-semibold leading-[var(--text-title-md--line-height)] text-text-primary tracking-[-0.01em]",
      className,
    )}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-body-md leading-[1.6] text-text-secondary", className)}
    {...props}
  />
));
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    /** true면 좌측에 spinner 표시 + disabled 처리. */
    loading?: boolean;
    /** 파괴적 확정은 `destructive`. 기본은 primary. */
    variant?: "default" | "destructive";
    /** 모바일만 `lg`(48). 기본 `default`(36·좌우 16·14px). */
    size?: FooterButtonSize;
  }
>(
  (
    {
      className,
      loading = false,
      disabled,
      variant = "default",
      size = "default",
      children,
      ...props
    },
    ref,
  ) => (
    <AlertDialogPrimitive.Action
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
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
    </AlertDialogPrimitive.Action>
  ),
);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel> & {
    /** 모바일만 `lg`(48). 기본 `default`(36·좌우 16·14px). */
    size?: FooterButtonSize;
  }
>(({ className, size = "default", ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      // 모달 footer 취소 통일 — 테두리 없는 회색 채움(spec alert-dialog.md).
      // ghost 는 배경이 없어 전체 폭 두 버튼 중 한쪽이 빈자리처럼 보인다
      // (spec button.md Migration notes 2026-08).
      buttonVariants({ variant: "secondary", size }),
      className,
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
