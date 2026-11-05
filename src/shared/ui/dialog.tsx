import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/index";
import { registerOverlay } from "@/shared/lib/groo/pointer-block";

/*
 * Groo Dialog — groo-design specs/components/dialog.md SoT 기반.
 * Phase 2 마이그레이션: groo overlay/shadow 토큰 + desk-front 구조 보존.
 *
 * 호환 보존:
 *   - sizes: sm 420 / md 520 (default) / lg 720 (desk-front 사용처 정합)
 *   - composition: DialogHeader > DialogTitle / DialogDescription / + DialogBody + DialogFooter
 *   - hideClose prop — 호출자가 직접 close 그리는 패턴(기본 true)
 *
 * Groo 시각:
 *   - overlay: var(--overlay-dim-light) light / var(--overlay-dim-dark) dark
 *   - bg-[var(--bg-surface)]: Phase 1 alias로 자동 Cobalt 톤 surface-default
 *   - shadow-[var(--shadow-xl)]: Tailwind arbitrary(분해 회피, dark token swap 안전)
 *   - radius-xl + rounded
 */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  // 닫힌 직후 그 자리 밑의 요소가 두 번째 클릭을 받는 걸 막는다 — QA #14 #36 #57.
  // 등록을 여기 두는 이유: overlay 는 `DialogPortal` 의 자식이라 Radix `Presence` 가
  // `open` 일 때만 마운트한다. 바깥의 `DialogContent` 래퍼는 `open={false}` 여도 계속
  // 살아 있어(CalendarContainer 처럼 controlled 로 쓰는 곳),
  // 거기에 걸면 "열린 오버레이 수" 가 영원히 0 으로 안 떨어져 차단이 아예 안 걸린다.
  React.useEffect(registerOverlay, []);
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-(--z-modal) bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "duration-200",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const dialogContentVariants = cva(
  [
    "fixed left-1/2 top-1/2 z-(--z-modal-content) -translate-x-1/2 -translate-y-1/2",
    "max-h-[86vh] max-w-[calc(100%-40px)]",
    // 여백은 컨테이너가 아니라 헤더·본문·footer 가 각자 갖는다 — 본문만 스크롤해야 해서
    // 셋을 한 덩어리로 묶을 수 없다(dialog.md Layout). 컨테이너는 padding 0.
    "flex flex-col overflow-hidden",
    // popup 은 radius-lg(12) — dialog.md. 안에 놓이는 버튼(radius-md 8)과 맞물린다.
    "bg-[var(--bg-surface)] rounded-lg",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
    "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
    "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-1",
    "duration-200",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "w-[420px]",
        md: "w-[520px]",
        lg: "w-[720px]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> &
  VariantProps<typeof dialogContentVariants> & {
    /** true면 우상단 자동 X 버튼 표시. 기본 false — 호출자가 직접 close 그림. */
    hideClose?: boolean;
  };

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size, hideClose = true, children, style, ...props }, ref) => {
  const { t } = useTranslation("common");
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(dialogContentVariants({ size }), className)}
        style={{ boxShadow: "var(--shadow-xl)", ...style }}
        // 열면 초점이 표면(대화상자 자체)으로 — 첫 칸이 아니다. Tab 은 안을 돈다(Radix 가 가둔다), 닫으면 연 자리로(03F-006)
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.target as HTMLElement | null)?.focus({
            preventScroll: true,
          });
        }}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">{t("close")}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

// .modal__head — padding 18 22. **footer 아래와 같은 값**이다(dialog.md Layout).
const DialogHeader = ({
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
DialogHeader.displayName = "DialogHeader";

// .modal__body — padding 22 + flex-1 + min-h-0 + scroll. 스크롤은 여기서만 인다.
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 min-h-0 overflow-y-auto p-[22px]", className)}
    {...props}
  />
);
DialogBody.displayName = "DialogBody";

// .modal__foot — padding 18 22 + flex justify-end + gap 8. 헤더 위와 같은 18 이다 —
// 예전엔 14 라 위아래가 4px 어긋나 보였다(2026-09-16 실측).
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // spec dialog.md 114-116 — 모바일(<640px)은 각 button flex-1 균등 분배,
      // 데스크탑(≥640px)은 우측 정렬. 모바일에서 우측 정렬 compact 로 두면
      // 화면 구석의 작은 알약이 돼 한 손으로 누를 폭이 안 나온다.
      "flex shrink-0 items-center gap-2 px-[22px] py-[18px]",
      "[&>button]:flex-1 sm:justify-end sm:[&>button]:flex-none",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

// .modal__head h3 — 17px / 700 / flex-1
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "flex-1 text-title-md font-semibold leading-snug tracking-tight text-text-primary",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-text-secondary", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
