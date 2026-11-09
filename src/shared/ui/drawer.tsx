"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/shared/lib";
import { registerOverlay } from "@/shared/lib/groo/pointer-block";

/*
 * Groo Drawer — groo-design specs/components/drawer.md SoT 기반.
 * Phase 2 마이그레이션: groo overlay/shadow/handle 토큰 + desk-front 구조 보존.
 *
 * 호환 보존:
 *   - vaul shouldScaleBackground=false (desk-front 기본값) — 배경 스케일링 안 함
 *   - DrawerHeader/Body/Footer 3-슬롯 구조
 *   - DrawerTitle 17px/700, DrawerDescription text-xs
 *
 * Groo 시각:
 *   - overlay: var(--overlay-dim-light) light / var(--overlay-dim-dark) dark
 *   - content: bg-[var(--bg-surface)] + rounded-t-[radius-2xl] + shadow-xl inline
 *   - handle: 40×4 + bg-surface-input + rounded-full
 */

const Drawer = ({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    // 문서 스크롤을 0 으로 보내는 vaul 의 iOS 잠금을 끈다 — bottom-sheet.tsx 의 같은 자리 주석
    noBodyStyles
    disablePreventScroll={false}
    {...props}
  />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  // 시트가 사라진 직후 바로 아래 붙어 있는 탭바가 두 번째 탭을 받는 걸 막는다 — QA #37.
  // overlay 에 거는 이유는 dialog.tsx 의 같은 주석을 본다 — vaul 의 Portal 도 Radix
  // Dialog Portal 이라 `open` 일 때만 자식을 마운트하고, 바깥 래퍼는 계속 살아 있다.
  React.useEffect(registerOverlay, []);
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-(--z-modal) bg-[var(--overlay-dim-light)] dark:bg-[var(--overlay-dim-dark)]",
        className,
      )}
      {...props}
    />
  );
});
DrawerOverlay.displayName = "DrawerOverlay";

/** vaul 이 "키보드가 떴다" 로 보는 최소 높이 차. 같은 값을 쓴다. */
const KEYBOARD_MIN_PX = 60;

/**
 * 키보드가 내려갔는데 시트가 그때 높이에 박혀 있는 것을 푼다.
 *
 * vaul 은 키보드가 뜨면 `style.height`·`style.bottom` 을 픽셀로 박고 내려가면 되돌린다.
 * 그 되돌리기가 **레이아웃 뷰포트까지 함께 줄어드는 브라우저**(삼성 인터넷 · 구 크롬)에서는
 * 동작하지 않는다. 그런 브라우저는 `window.innerHeight` 와 `visualViewport.height` 가 늘
 * 같아서 —
 *
 * 1. vaul 이 키보드를 감지하지 못하고(`keyboardIsOpen` 이 false 로 남는다)
 * 2. 되돌릴 기준 높이(`initialDrawerHeight`)마저 **이미 줄어든 값**으로 잡는다
 *    (첫 resize 콜백에서 재는데, 그때는 뷰포트가 이미 작다)
 *
 * 그래서 키보드가 사라진 뒤에도 시트가 반쪽으로 남고, 입력칸을 다시 건드리기 전엔
 * 영영 안 돌아온다(2026-09-18 사용자 제보 · 재현 743px → 370px 고착).
 *
 * 규칙은 하나다 — **키보드가 없으면 키보드 때문에 박힌 값도 없어야 한다.** 판정만 하고
 * 제 값을 쓰지는 않는다. 지우고 나면 클래스(`max-h-[88%]`)와 내용이 높이를 정한다.
 *
 * 다음 프레임에 지우는 이유 — vaul 도 같은 `resize` 를 듣고 그 안에서 높이를 다시 박는다.
 * 같은 이벤트 안에서 지우면 vaul 이 그 뒤에 다시 박아 아무 일도 안 한 것이 된다.
 */
function useClearKeyboardSizing(
  targetRef: React.RefObject<HTMLElement | null>,
) {
  React.useEffect(() => {
    // 구독은 마운트 시점의 객체에 건다. 높이는 **부를 때마다 다시 읽는다** —
    // 브라우저에선 같은 객체의 값만 바뀌지만, 그 가정을 코드가 안 지고 있는 편이 낫다.
    const vvAtMount = window.visualViewport;
    let raf = 0;
    const clear = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = targetRef.current;
        if (!el) return;
        // 키보드가 떠 있으면 vaul 이 관리 중이다 — 건드리지 않는다.
        const vv = window.visualViewport;
        const keyboard = vv ? window.innerHeight - vv.height : 0;
        if (keyboard > KEYBOARD_MIN_PX) return;
        el.style.removeProperty("height");
        el.style.removeProperty("bottom");
      });
    };
    vvAtMount?.addEventListener("resize", clear);
    window.addEventListener("resize", clear);
    return () => {
      cancelAnimationFrame(raf);
      vvAtMount?.removeEventListener("resize", clear);
      window.removeEventListener("resize", clear);
    };
  }, [targetRef]);
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, style, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  useClearKeyboardSizing(contentRef);
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-(--z-modal-content) flex h-auto max-h-[88%] flex-col rounded-t-[var(--radius-2xl)] bg-[var(--bg-surface)] outline-none",
          className,
        )}
        style={{ boxShadow: "var(--shadow-xl)", ...style }}
        // 열면 초점이 시트 표면으로(03F-008a) — vaul 기본은 열기 버튼에 남는다
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.target as HTMLElement | null)?.focus({ preventScroll: true });
        }}
        {...props}
      >
        {/* handle — preview `.drw-handle` SoT (40×4 + surface-input + rounded-full) */}
        <div className="mx-auto mt-1.5 mb-2 h-1 w-10 shrink-0 rounded-full bg-surface-input" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex items-center gap-3 px-xl pb-4 pt-2", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  // 세로 스크롤바는 숨기지 않는다(scroll-area.md · 03G-016) — 전역 6px 알약이 그대로 그려진다
  <div className={cn("flex-1 overflow-y-auto px-xl", className)} {...props} />
);
DrawerBody.displayName = "DrawerBody";

// 데스크탑 다이얼로그 footer 와 동일한 패턴: 우측 정렬 가로 배치.
// 삭제 등 좌측 배치할 버튼은 className="mr-auto" 로 밀어내기.
const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Drawer 는 모바일 전용이라 footer 는 언제나 균등 분배다
      // (spec drawer.md Migration notes — `.drw-actions` SoT `[&>*]:flex-1`).
      // 우측 정렬 compact 로 두면 화면 구석의 작은 알약이 돼 한 손으로 누를 폭이 안 나온다.
      // 삭제처럼 좌측에 붙일 버튼은 className="mr-auto flex-none" 로 균등분배에서 뺀다.
      "mt-auto flex items-center gap-2 px-xl py-3 [&>button]:flex-1",
      className,
    )}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-title-md font-semibold tracking-[-0.01em] text-[var(--fg-primary)]",
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-xs text-[var(--fg-tertiary)] mt-0.5", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
