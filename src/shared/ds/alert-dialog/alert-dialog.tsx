import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/shared/lib/cn";
import { Button, ResponsivePair, type ButtonProps } from "@/shared/ds/button";
import {
  captureAnchor,
  focusOpener,
  type FocusAnchor,
  mergeRefs,
  useBackClose,
  useOpenState,
  useWideSurface,
  withButtonSize,
  type OpenChange,
} from "@/shared/ds/overlay";

import {
  ALERT_CONTENT,
  ALERT_DESCRIPTION,
  ALERT_FOOTER,
  ALERT_OVERLAY,
  ALERT_TITLE,
} from "./alert-dialog-variants";

/*
 * Groo Alert Dialog — 구조는 SEED Alert Dialog(2026-10-02). 수치 원본은 groo-design specs/components/alert-dialog.yaml
 * (값은 src/shared/ds/spec/alert-dialog.json). groo-design recipes/shadcn/components/ui/alert-dialog.tsx 를 첫 판으로 가져왔다.
 *
 *   AlertDialog              되돌릴 수 없는 일 앞에서 묻는 확인창 — open · defaultOpen · onOpenChange
 *   AlertDialogTrigger       여는 버튼 — 닫으면 초점이 여기로 돌아온다
 *   AlertDialogContent       확인창 — 딤 위 화면 정중앙, 최대 272 · 좌우 32 를 남긴다. 닫기 버튼이 없다
 *   AlertDialogTitle         묻는 말 — 없어도 된다. 없으면 Content 에 aria-label 로 묻는 말을 단다(둘 다 없으면 개발 중에 경고)
 *   AlertDialogDescription   무엇이 어떻게 되는지 · 되돌릴 수 없다는 사실 — 늘 둔다. 제목 아래 6
 *   AlertDialogFooter        버튼 — [취소] [확정] 을 반씩. 한쪽 글이 반 폭을 넘으면 세로로 쌓고 확정이 위, 하나면 폭 전체
 *   AlertDialogCancel        취소 — neutralWeak. 누르면 닫힌다
 *   AlertDialogAction        확정 — variant criticalSolid(지우기 · 잃기) | neutralSolid(기본). 누르면 닫힌다.
 *                            onClick 에서 e.preventDefault() 하면 닫지 않고, loading 이면 누르기를 막는다(서버 응답을 기다릴 때)
 *
 * 바깥(딤)을 눌러도 닫히지 않는다. Esc · 뒤로 가기(1280 미만)는 취소와 같다 — 요청 중(busy · 확정 버튼 loading)이면 Esc · 뒤로 가기 · [취소] 모두 받지 않는다(뒤로 가기는 칸을 다시 쌓는다). 열면 초점은 확인창(컨테이너)으로 가고
 * 열린 동안 확인창 안을 돌며, 닫으면 연 자리(트리거, 없으면 열 때 초점이 있던 곳)로 돌아간다. role="alertdialog" + aria-modal.
 * 버튼은 1280 미만 medium 40 · 이상 small 36 — Footer 가 크기를 주지 않은 바로 아래 자식에 넣는다. 배치는 CSS 가 정한다(alert-dialog-variants.ts).
 * 딤 z-alert 300 · 확인창 z-alert-content 301(specs/z-index.md L5) — 열린 대화상자 · 시트 위에 뜬다.
 * 모션: 200ms enter-expressive 로 1.3 배에서 줄며 나타나고 100ms exit 로 줄지 않고 사라진다(딤은 100ms). 모션 줄이기면 150ms 서서히 나타난다.
 *
 * 레시피와 다른 자리
 *   - Radix AlertDialog 가 아니라 Dialog 원시 부품에 role="alertdialog" 를 얹었다 — 같은 일을 하되(바깥 무시 · Esc 는 닫기 ·
 *     초점 가둠) `modal` 을 끌 수 있어야 카탈로그가 확인창을 여럿 동시에 펼쳐 놓고 잴 수 있다. Cancel · Action 은 Close 다.
 *   - 띄울 자리 `container`(기본 document.body)와 `modal`(기본 켬)을 더했다. 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의
 *     다크 판)에서는 body 의 확인창이 라이트 색을 받는다 — help-bubble 의 container 와 같은 까닭이다. modal={false} 는 카탈로그 ·
 *     문서 전용이다 — 초점 가둠 · 바깥 비활성 · 뒤 화면 숨김 · 스크롤 잠금을 끄고 딤은 직접 그린다. 앱 화면은 쓰지 않는다.
 */

type AlertContextValue = {
  /** 확정 요청 중 — 확정 버튼의 loading 이 켜면 true(AlertDialog 의 busy 와 함께 본다) */
  busy: boolean;
  setActionBusy: (busy: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  container: HTMLElement | null | undefined;
  modal: boolean;
};
const AlertContext = React.createContext<AlertContextValue | null>(null);

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChange;
  /**
   * 요청 중 — Bottom Sheet 의 busy 와 같은 계약: 어느 길도 받지 않는다(Esc · 뒤로 가기 · [취소] · 바깥). 뒤로 가기는 칸을 다시 쌓아
   * 다음 뒤로 가기도 이 확인창으로 온다. 확정 버튼에 loading 을 걸면 저절로 켜진다 — 확정 말고 다른 일을 기다릴 때만 직접 준다
   */
  busy?: boolean;
  /** 띄울 자리 — 기본 document.body. 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의 다크 판)에서 그 안의 요소로 */
  container?: HTMLElement | null;
  /** false 면 모달 부작용(초점 가둠 · 바깥 비활성 · 뒤 화면 숨김 · 스크롤 잠금)을 끈다 — 카탈로그 · 문서 전용 */
  modal?: boolean;
  children?: React.ReactNode;
}

function AlertDialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  busy: busyProp = false,
  container,
  modal = true,
  children,
}: AlertDialogProps) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const narrow = !useWideSurface();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const busy = busyProp || actionBusy;
  // 뒤로 가기 = 취소(1280 미만). 요청 중이면 받지 않는다 — 칸을 다시 쌓아 다음 뒤로 가기도 이 확인창으로 오게
  // (받아 놓고 닫지 않으면 칸만 사라지고 다음 뒤로 가기가 요청 중인 화면을 떠난다)
  useBackClose(open && narrow && modal, (keep) => {
    if (busy) keep();
    else setOpen(false);
  });
  return (
    <AlertContext.Provider
      value={{ busy, setActionBusy, triggerRef, container, modal }}
    >
      <DialogPrimitive.Root
        open={open}
        // Esc · [취소] 도 요청 중에는 받지 않는다(바깥은 늘 무시)
        onOpenChange={(next) => {
          if (busy && !next) return;
          setOpen(next);
        }}
        modal={modal}
      >
        {children}
      </DialogPrimitive.Root>
    </AlertContext.Provider>
  );
}
AlertDialog.displayName = "AlertDialog";

function useAlert(name: string) {
  const ctx = React.useContext(AlertContext);
  if (!ctx) throw new Error(`${name} 는 AlertDialog 안에 둔다.`);
  return ctx;
}

const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  const ctx = useAlert("AlertDialogTrigger");
  return (
    <DialogPrimitive.Trigger
      ref={mergeRefs(ref, ctx.triggerRef)}
      data-slot="alert-dialog-trigger"
      {...props}
    />
  );
});
AlertDialogTrigger.displayName = "AlertDialogTrigger";

// 제목이 없으면 aria-label 이 이름이다 — 둘 다 없거나 둘 다 있으면 개발 중에 알린다(열릴 때 그려진 확인창을 본다)
function checkName(el: HTMLElement | null, ariaLabel: string | undefined) {
  if (!import.meta.env.DEV || !el) return;
  const titled = el.querySelector('[data-slot="alert-dialog-title"]') != null;
  if (!titled && !ariaLabel?.trim()) {
    console.warn(
      '[AlertDialog] 제목이 없으면 aria-label 로 묻는 말을 단다(예: "거래를 삭제할까요?").',
      el,
    );
  } else if (titled && ariaLabel) {
    console.warn(
      "[AlertDialog] 제목과 aria-label 을 함께 주지 않는다 — 제목이 이름이다.",
      el,
    );
  }
}

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(
  (
    {
      className,
      children,
      "aria-label": ariaLabel,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    ref,
  ) => {
    const ctx = useAlert("AlertDialogContent");
    const own = React.useRef<HTMLDivElement>(null);
    const openerRef = React.useRef<FocusAnchor | null>(null);
    return (
      <DialogPrimitive.Portal container={ctx.container}>
        {ctx.modal ? (
          <DialogPrimitive.Overlay
            data-slot="alert-dialog-overlay"
            className={ALERT_OVERLAY}
          />
        ) : (
          <div
            data-slot="alert-dialog-overlay"
            data-state="open"
            className={ALERT_OVERLAY}
          />
        )}
        <DialogPrimitive.Content
          ref={mergeRefs(ref, own)}
          role="alertdialog"
          data-slot="alert-dialog-content"
          aria-modal="true"
          aria-busy={ctx.busy || undefined}
          className={cn(ALERT_CONTENT, className)}
          // 처음 초점은 확인창 — 첫 버튼이 아니라 확인창(컨테이너)이다
          onOpenAutoFocus={(e) => {
            openerRef.current = captureAnchor(document.activeElement);
            checkName(own.current, ariaLabel);
            onOpenAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            own.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => {
            onCloseAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            focusOpener(ctx.triggerRef.current, openerRef.current);
          }}
          // 바깥(딤)을 눌러도 닫히지 않는다 — 고르지 않고 지나가지 못하게. 바깥으로 간 초점도 닫지 않는다
          onPointerDownOutside={(e) => {
            onPointerDownOutside?.(e);
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            onInteractOutside?.(e);
            e.preventDefault();
          }}
          // 설명은 늘 있다(제목이 없을 때만 aria-label)
          {...props}
        >
          {children}
          {/* 보이는 제목이 없을 때 — aria-label 을 숨은 제목으로 둬 aria-labelledby 가 그 글을 가리킨다 */}
          {ariaLabel != null && (
            <DialogPrimitive.Title className="sr-only">
              {ariaLabel}
            </DialogPrimitive.Title>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="alert-dialog-title"
    className={cn(ALERT_TITLE, className)}
    {...props}
  />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="alert-dialog-description"
    className={cn(ALERT_DESCRIPTION, className)}
    {...props}
  />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const size = useWideSurface() ? "small" : "medium";
  return (
    <ResponsivePair
      ref={ref}
      data-slot="alert-dialog-footer"
      className={cn(ALERT_FOOTER, className)}
      {...props}
    >
      {withButtonSize(children, size)}
    </ResponsivePair>
  );
});
AlertDialogFooter.displayName = "AlertDialogFooter";

// 취소 — neutralWeak(취소를 Critical 로 칠하지 않는다). 크기는 Footer 가 넣는다
const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant" | "asChild">
>((props, ref) => (
  <DialogPrimitive.Close asChild>
    <Button
      ref={ref}
      variant="neutralWeak"
      data-slot="alert-dialog-cancel"
      {...props}
    />
  </DialogPrimitive.Close>
));
AlertDialogCancel.displayName = "AlertDialogCancel";

export interface AlertDialogActionProps extends Omit<
  ButtonProps,
  "variant" | "asChild"
> {
  /** 확정의 무게 — 지우기 · 잃기는 criticalSolid, 그 밖은 neutralSolid(기본) */
  variant?: "criticalSolid" | "neutralSolid";
}

// 확정 — 누르면 닫힌다. onClick 에서 e.preventDefault() 하면 닫지 않는다. loading 이면 Button 이 누르기를 삼켜 닫히지도 않는다
const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  AlertDialogActionProps
>(({ variant = "neutralSolid", onClick, loading, ...props }, ref) => {
  const { setActionBusy } = useAlert("AlertDialogAction");
  // 확정을 기다리는 동안은 확인창이 요청 중이다 — Esc · 뒤로 가기 · [취소] 를 받지 않는다
  React.useEffect(() => {
    if (!loading) return;
    setActionBusy(true);
    return () => setActionBusy(false);
  }, [loading, setActionBusy]);
  return (
    <DialogPrimitive.Close asChild onClick={onClick}>
      <Button
        ref={ref}
        variant={variant}
        loading={loading}
        data-slot="alert-dialog-action"
        {...props}
      />
    </DialogPrimitive.Close>
  );
});
AlertDialogAction.displayName = "AlertDialogAction";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
};
