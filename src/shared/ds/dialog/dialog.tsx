import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useBeforeUnloadWhile } from "@/shared/lib/before-unload";
import { useHoldReferenceNotice } from "@/shared/api";
import { Button, type ButtonProps } from "@/shared/ds/button";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetTrigger,
} from "@/shared/ds/bottom-sheet";
import {
  focusOpener,
  surfaceTookOver,
  mergeRefs,
  useOpenState,
  useRefocusAfterBusy,
  useWideSurface,
  withButtonSize,
  type OpenChange,
} from "@/shared/ds/overlay";
import { useScrollFog } from "@/shared/ds/scroll-fog";

import {
  DIALOG_BODY,
  DIALOG_BODY_FOG,
  DIALOG_BODY_PLAIN,
  DIALOG_CLOSE,
  DIALOG_CONTENT,
  DIALOG_DESCRIPTION,
  DIALOG_FOOTER,
  DIALOG_HEADER,
  DIALOG_HEADER_WITH_CLOSE,
  DIALOG_HEADER_WITH_ACTION,
  DIALOG_HEADER_WITH_ACTION_CLOSE,
  DIALOG_HEADER_ACTION,
  DIALOG_HEADER_ACTION_CLOSE,
  DIALOG_BACK,
  DIALOG_TITLE_WITH_BACK,
  DIALOG_OVERLAY,
  DIALOG_SIZE,
  DIALOG_TITLE,
} from "./dialog-variants";
import { useBodyScroll } from "./use-body-scroll";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Dialog — 구조는 SEED Dialog · Responsive Dialog(2026-10-02). 수치 원본은 groo-design specs/components/dialog.yaml
 * (값은 src/shared/ds/spec/dialog.json). groo-design recipes/shadcn/components/ui/dialog.tsx 를 첫 판으로 가져왔다.
 *
 *   Dialog                  1280 이상의 가운데 대화상자(Radix Dialog) — open · defaultOpen · onOpenChange · form · dirty
 *   DialogTrigger           여는 버튼 — 닫으면 초점이 여기로 돌아온다
 *   DialogContent           대화상자 — title · description(있을 때만) · size medium 480(기본) | large 800.
 *                           조회 · 안내(form 이 아니면)는 머리 오른쪽에 닫기 버튼, 입력 폼은 두지 않는다(바닥 [취소])
 *   DialogBody              본문 — 이 안에서만 스크롤, 위로 스크롤되면 머리 아래 1px 선. scrollFog 면 끝 흐림(Scroll Fog —
 *                           늘 켜진 위 20 · 아래 80 + 본문 안 여백 위 20 · 아래 80) — 넘칠 수 있는 본문(목록 · 긴 폼)에만 준다
 *   DialogFooter            바닥 — 오른쪽 정렬, 사이 8. Button small 36 을 크기를 주지 않은 바로 아래 자식에 넣는다
 *   DialogCancel            바닥 [취소] — neutralWeak. 닫기를 청한다(바뀐 값이 있으면 먼저 묻는다)
 *
 *   ResponsiveDialog        폼 · 상세는 이것으로 짠다 — 1280 이상 Dialog, 미만 Bottom Sheet(Input Button 과 같은 경계,
 *                           useWideSurface). ResponsiveDialogTrigger · Content · Body · Footer · Cancel 이 같은 자리에 맞는
 *                           표면의 부품을 그린다 — 머리 · 본문 · 바닥은 같고 닫는 자리만 바뀐다.
 *                           form: 대화상자는 바닥 ResponsiveDialogCancel(머리 닫기 없음), 시트는 위 닫기 버튼(Cancel 은 그리지 않는다).
 *                           form 이 아니면(조회 · 안내) 두 표면 모두 위 닫기 버튼이고 Cancel 을 두지 않는다.
 *                           열린 채 창 폭이 1280 을 넘나들면 표면이 바뀐다 — 열림은 ResponsiveDialog 가 들고 있어 이어지지만, 안의 부품은
 *                           새로 그려진다. 입력값은 폼(부모)의 상태로 든다 — 입력칸 안(비제어)에만 두면 바뀔 때 사라진다.
 *
 * 닫는 길(dialog.md Behavior)
 *   - 바닥 [취소] · 닫기 버튼 · Esc 는 닫는다. 바깥(딤) 누르기는 조회 · 안내만 닫고 입력 폼(form)은 무시한다.
 *   - dirty 면 어느 길이든 닫기 전에 "작성한 내용이 사라져요" 를 묻는다(Field 의 이탈 시 안내) — [계속 작성] 이면 그대로.
 *   - 뒤로 가기는 1280 미만(시트)에서만 닫는다 — 1280 이상에서 뒤로 가기는 "이전 페이지" 다(overlay/use-back-close.ts).
 *   - busy(저장 중)면 어느 길도 받지 않는다 — 묻지도 않는다. 머리 ← 도, 본문 입력도 받지 않는다(inert). 닫기 X 는 모양 그대로다.
 *
 * 열면 초점은 대화상자(컨테이너)로 가고 열린 동안 안을 돈다. 닫으면 연 자리(트리거, 없으면 열 때 초점이 있던 곳)로 돌아간다.
 * 뒤 화면은 보조 기술에서 숨기고 스크롤을 잠근다(Radix). role="dialog" + aria-modal, 제목 aria-labelledby · 설명 aria-describedby
 * (설명이 없으면 걷는다). 보이는 제목이 없는 대화상자(명령 팔레트)는 aria-label 을 준다 — 숨은 제목으로 둔다.
 *
 * 모양은 dialog-variants.ts — 화면 정중앙, 폭 480 · 800(좌우 20 은 남긴다), 높이는 내용만큼 화면의 80% 까지(dvh) — 넘치는 만큼
 * 본문만 스크롤한다. 넘쳐 스크롤할 수 있는 본문은 키보드로도 스크롤하도록 Tab 이 선다(안쪽 링).
 * 끝 흐림(scrollFog, dialog.yaml · scroll-fog.yaml overlayBody) — 걸 본문인지는 내용의 종류로 정한다(칸 두셋처럼 늘 들어맞는 본문에는
 * 걸지 않는다). 걸면 넘쳤는지 · 스크롤 위치와 상관없이 늘 켜져 있고, 본문 안 여백이 위 20(머리가 없으면 24 그대로) · 아래 80
 * (바닥이 있어도)이 돼 끝까지 내리면 흐림이 빈 여백 위에 놓인다. 머리 아래 선은 머리의 안쪽 아래 1px 로 그린다 — 본문은 흐림 마스크가
 * 걸려 그 안에 그린 선은 흐려진다.
 * 쌓임: 딤 z-modal 100 · 대화상자 z-modal-content 101(specs/z-index.md L2) — 그 안에서 연 Popover(L3) · Alert Dialog(L5)가 위에 뜬다.
 * 모션: 200ms enter-expressive 로 1.3 배에서 줄며 나타나고 100ms exit 로 줄지 않고 사라진다(딤 100ms). 모션 줄이기면 150ms 서서히.
 *
 * 레시피와 다른 자리
 *   - 띄울 자리 `container`(기본 document.body)와 `modal`(기본 켬)을 더했다 — 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의
 *     다크 판)에서는 body 의 대화상자가 라이트 색을 받는다(help-bubble 의 container 와 같은 까닭). modal={false} 는 카탈로그 · 문서
 *     전용이다 — 초점 가둠 · 바깥 비활성 · 뒤 화면 숨김 · 스크롤 잠금을 끄고 딤은 직접 그린다. 앱 화면은 쓰지 않는다.
 *   - ResponsiveDialogCancel 은 form 이 아니면 그리지 않는다 — 레시피는 경고만 하고 그렸는데 doc 주석("Cancel 을 두지 않는다")과 스펙(닫기 버튼과 취소를 함께 두지 않는다)이 그리지 않는 쪽이다.
 *   - 머리 아래 선 색을 --dialog-divider 에 이름표로 달았다(값은 stroke-neutral-subtle 그대로) — 선이 안쪽 그림자라 검사기가 색을 읽을 자리가 없다.
 *   - 1280 판별은 useWideSurface(overlay 폴더) — Input Button 의 useInputButtonSurface 가 아직 없어 같은 경계(lg)를 직접 읽는다.
 */

type DialogContextValue = {
  form: boolean;
  /** 저장 중 — 닫기 · 머리 뒤로를 받지 않고 본문은 입력을 받지 않는다(inert) */
  busy: boolean;
  /** 닫기를 청한다 — 바로 닫았으면 true, 바뀐 값이 있어 물었으면 false */
  requestClose: () => boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  openRef: React.RefObject<boolean>;
  container: HTMLElement | null | undefined;
  modal: boolean;
};
const DialogContext = React.createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChange;
  /** 입력 폼 — 바깥(딤)을 눌러도 닫히지 않고 머리 닫기 버튼을 두지 않는다(바닥 [취소] [저장]) */
  form?: boolean;
  /** 바뀐 값이 있다 — 닫기 전에 "작성한 내용이 사라져요" 를 묻는다 */
  dirty?: boolean;
  /**
   * 저장하는 중이다(저장 단추가 로딩) — 닫기 X · 취소 · Esc · 바깥 · 뒤로 가기 · 끌기 · 머리 ← 를 받지 않고 본문은 입력을 받지 않는다
   * (state loading). 닫기 X 는 흐리게 하지 않고 모양 그대로 둔다. 응답이 오면 성공은 닫고, 실패는 폼 맨 위 Callout 으로 값을 남긴다
   */
  busy?: boolean;
  /** 띄울 자리 — 기본 document.body. 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의 다크 판)에서 그 안의 요소로 */
  container?: HTMLElement | null;
  /** false 면 모달 부작용(초점 가둠 · 바깥 비활성 · 뒤 화면 숨김 · 스크롤 잠금)을 끈다 — 카탈로그 · 문서 전용 */
  modal?: boolean;
  children?: React.ReactNode;
}

function Dialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  form = false,
  dirty = false,
  busy = false,
  container,
  modal = true,
  children,
}: DialogProps) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const contentRef = React.useRef<HTMLDivElement>(null);
  useRefocusAfterBusy(busy, contentRef);
  // 열린 폼이 바뀐 값을 가졌거나 저장 중이면 새로 고침 · 탭 닫기에 브라우저 기본 확인창(판단 (3))
  useBeforeUnloadWhile(open && (dirty || busy));
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const openRef = React.useRef(open);
  React.useLayoutEffect(() => {
    openRef.current = open;
  });
  const leave = useLeaveConfirm({
    dirty,
    contentRef,
    container,
    modal,
    busy,
    leave: () => setOpen(false),
  });
  const value: DialogContextValue = {
    form,
    busy,
    requestClose: leave.request,
    contentRef,
    triggerRef,
    openRef,
    container,
    modal,
  };
  return (
    <DialogContext.Provider value={value}>
      {/* Radix 가 닫으려 할 때(Esc · 바깥 · 닫기 · 취소) — 바뀐 값이 있으면 묻는다 */}
      <DialogPrimitive.Root
        open={open}
        modal={modal}
        onOpenChange={(next) => (next ? setOpen(true) : leave.request())}
      >
        {children}
      </DialogPrimitive.Root>
      {leave.node}
    </DialogContext.Provider>
  );
}
Dialog.displayName = "Dialog";

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  const ctx = React.useContext(DialogContext);
  return (
    <DialogPrimitive.Trigger
      ref={mergeRefs(ref, ctx?.triggerRef)}
      data-slot="dialog-trigger"
      {...props}
    />
  );
});
DialogTrigger.displayName = "DialogTrigger";

export interface DialogContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  "title"
> {
  /** 제목 — 하는 일("휴가 신청" · "거래 상세"). 없으면 aria-label 로 이름을 단다 */
  title?: React.ReactNode;
  /** 설명 — 덧붙일 말이 있을 때만 한 문장 */
  description?: React.ReactNode;
  /** medium 480(기본) — 일반 입력 폼 · 상세, large 800 — 복잡한 설정 · 많은 조회 */
  size?: keyof typeof DIALOG_SIZE;
  /** 머리 오른쪽 동작 하나 — ghost iconOnly 36 단추(⋮ "{항목 이름} 더보기"). 닫기 단추가 있으면 그 왼쪽 사이 4, 없으면(입력 폼) 오른쪽 끝. 제목은 남은 폭에서 줄을 바꾼다 */
  headerAction?: React.ReactNode;
  /** 머리 왼쪽 뒤로 가기 — 같은 대화상자 안에서 한 단계 되돌아갈 때(← 아이콘 단추 "뒤로", 보이는 40 · 누르는 44). 제목은 그 오른쪽 사이 4 에서 시작한다 */
  onBack?: () => void;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      title,
      description,
      size = "medium",
      className,
      children,
      "aria-label": ariaLabel,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onInteractOutside,
      headerAction,
      onBack,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const ctx = React.useContext(DialogContext);
    const own = React.useRef<HTMLDivElement>(null);
    const openerRef = React.useRef<Element | null>(null);
    const form = ctx?.form ?? false;
    const hasHeader = title != null;
    // 닫기 버튼은 조회 · 안내의 머리에만 — 입력 폼은 바닥 [취소] 가 닫는다(닫기 버튼과 취소를 함께 두지 않는다)
    const showClose = hasHeader && !form;
    return (
      <DialogPrimitive.Portal container={ctx?.container}>
        {ctx?.modal === false ? (
          <div
            data-slot="dialog-overlay"
            data-state="open"
            className={DIALOG_OVERLAY}
          />
        ) : (
          <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={DIALOG_OVERLAY}
          />
        )}
        <DialogPrimitive.Content
          ref={mergeRefs(ref, own, ctx?.contentRef)}
          data-slot="dialog-content"
          data-size={size}
          data-form={form || undefined}
          aria-busy={ctx?.busy || undefined}
          aria-modal="true"
          {...(description == null ? { "aria-describedby": undefined } : null)}
          className={cn(DIALOG_CONTENT, DIALOG_SIZE[size], className)}
          // 처음 초점은 대화상자 — Radix 기본(첫 칸)을 쓰지 않는다
          onOpenAutoFocus={(e) => {
            openerRef.current = document.activeElement;
            // 이름이 없으면 개발 중에 알린다(열릴 때)
            if (import.meta.env.DEV && !hasHeader && !ariaLabel?.trim()) {
              console.warn(
                '[Dialog] 제목이 없으면 aria-label 로 이름을 단다(예: "명령어 검색").',
                own.current,
              );
            }
            onOpenAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            own.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => {
            onCloseAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            // 아직 열려 있다 — 폭이 1280 아래로 내려가 시트로 바뀌어 다시 뜬다(ResponsiveDialog). 초점은 새 표면이 가져간다
            if (surfaceTookOver(ctx?.openRef.current ?? false)) return;
            focusOpener(ctx?.triggerRef.current ?? null, openerRef.current);
          }}
          // 입력 폼은 바깥(딤)을 눌러도 닫히지 않는다 — Radix 는 바깥 누르기 · 바깥 초점 모두 이 자리를 지나 닫을지 정한다
          onInteractOutside={(e) => {
            onInteractOutside?.(e);
            if (form) e.preventDefault();
          }}
          {...props}
        >
          {hasHeader && (
            <div
              data-slot="dialog-header"
              className={cn(
                DIALOG_HEADER,
                showClose && DIALOG_HEADER_WITH_CLOSE,
                headerAction != null &&
                  (showClose
                    ? DIALOG_HEADER_WITH_ACTION_CLOSE
                    : DIALOG_HEADER_WITH_ACTION),
              )}
            >
              {onBack && (
                <button
                  type="button"
                  aria-label={dsT("topNavigation.back")}
                  data-slot="dialog-back"
                  className={DIALOG_BACK}
                  // 저장 중에는 한 단계 뒤로도 가지 않는다 — 실패 Callout 을 그릴 폼이 사라진다
                  onClick={() => {
                    if (!ctx?.busy) onBack();
                  }}
                >
                  <ArrowLeft aria-hidden strokeWidth={2} />
                </button>
              )}
              <DialogPrimitive.Title
                data-slot="dialog-title"
                className={cn(DIALOG_TITLE, onBack && DIALOG_TITLE_WITH_BACK)}
              >
                {title}
              </DialogPrimitive.Title>
              {description != null && (
                <DialogPrimitive.Description
                  data-slot="dialog-description"
                  className={DIALOG_DESCRIPTION}
                >
                  {description}
                </DialogPrimitive.Description>
              )}
              {headerAction != null && (
                <div
                  data-slot="dialog-header-action"
                  className={
                    showClose
                      ? DIALOG_HEADER_ACTION_CLOSE
                      : DIALOG_HEADER_ACTION
                  }
                >
                  {headerAction}
                </div>
              )}
              {showClose && (
                <DialogPrimitive.Close
                  aria-label={dsT("common.close")}
                  data-slot="dialog-close"
                  className={DIALOG_CLOSE}
                >
                  <X aria-hidden strokeWidth={2} />
                </DialogPrimitive.Close>
              )}
            </div>
          )}
          {children}
          {/* 보이는 제목이 없을 때 — aria-label 을 숨은 제목으로(본문이 맨 앞 자식으로 남게 맨 뒤에 둔다) */}
          {!hasHeader && ariaLabel != null && (
            <DialogPrimitive.Title className="sr-only">
              {ariaLabel}
            </DialogPrimitive.Title>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = "DialogContent";

export interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 끝 흐림(Scroll Fog overlayBody — 위 20 · 아래 80, 늘 켜짐) — 넘칠 수 있는 본문(목록 · 긴 폼)에만 */
  scrollFog?: boolean;
}

const DialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ scrollFog = false, className, ...props }, ref) => {
    const own = React.useRef<HTMLDivElement>(null);
    const busy = React.useContext(DialogContext)?.busy ?? false;
    useBodyScroll(own);
    useScrollFog(own, scrollFog ? "overlayBody" : null);
    return (
      <div
        ref={mergeRefs(ref, own)}
        // 저장 중 — 본문은 입력을 받지 않는다(모양은 그대로)
        inert={busy || undefined}
        data-slot="dialog-body"
        data-scroll-fog={scrollFog ? "overlayBody" : undefined}
        className={cn(
          DIALOG_BODY,
          scrollFog ? DIALOG_BODY_FOG : DIALOG_BODY_PLAIN,
          className,
        )}
        {...props}
      />
    );
  },
);
DialogBody.displayName = "DialogBody";

const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="dialog-footer"
    className={cn(DIALOG_FOOTER, className)}
    {...props}
  >
    {withButtonSize(children, "small")}
  </div>
));
DialogFooter.displayName = "DialogFooter";

// 바닥 [취소] — neutralWeak. Radix 의 닫기라 Dialog 가 받아 닫기를 청한다(바뀐 값이 있으면 먼저 묻는다)
const DialogCancel = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant" | "asChild">
>((props, ref) => (
  <DialogPrimitive.Close asChild>
    <Button
      ref={ref}
      variant="neutralWeak"
      data-slot="dialog-cancel"
      {...props}
    />
  </DialogPrimitive.Close>
));
DialogCancel.displayName = "DialogCancel";

// ── Responsive Dialog ────────────────────────────────────────
type ResponsiveContextValue = { wide: boolean; form: boolean };
const ResponsiveContext = React.createContext<ResponsiveContextValue | null>(
  null,
);

function useResponsive(name: string) {
  const ctx = React.useContext(ResponsiveContext);
  if (!ctx) throw new Error(`${name} 는 ResponsiveDialog 안에 둔다.`);
  return ctx;
}

// 1280 이상 Dialog · 미만 Bottom Sheet. 열림은 여기서 든다 — 표면이 바뀌어도 열린 채로 이어진다
function ResponsiveDialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  form = false,
  dirty = false,
  busy = false,
  container,
  modal,
  children,
}: DialogProps) {
  const wide = useWideSurface();
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  // 열려 있는 동안 공용 참조 실패 스낵바는 쉰다 — 안의 폼이 맡는다
  useHoldReferenceNotice(open);
  return (
    <ResponsiveContext.Provider value={{ wide, form }}>
      {wide ? (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          form={form}
          dirty={dirty}
          busy={busy}
          container={container}
          modal={modal}
        >
          {children}
        </Dialog>
      ) : (
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          form={form}
          dirty={dirty}
          busy={busy}
          container={container}
          modal={modal}
        >
          {children}
        </BottomSheet>
      )}
    </ResponsiveContext.Provider>
  );
}
ResponsiveDialog.displayName = "ResponsiveDialog";

const ResponsiveDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  const { wide } = useResponsive("ResponsiveDialogTrigger");
  return wide ? (
    <DialogTrigger ref={ref} {...props} />
  ) : (
    <BottomSheetTrigger ref={ref} {...props} />
  );
});
ResponsiveDialogTrigger.displayName = "ResponsiveDialogTrigger";

export interface ResponsiveDialogContentProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 제목 — 두 표면 모두 늘 둔다 */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 대화상자의 폭 — medium 480(기본) | large 800. 시트는 최대 480 */
  size?: keyof typeof DIALOG_SIZE;
  /** 머리 오른쪽 동작 하나(ghost iconOnly 36) — 시트 · 대화상자 모두 */
  headerAction?: React.ReactNode;
  /** 머리 왼쪽 뒤로 가기(← "뒤로") — 같은 표면 안에서 한 단계 되돌아갈 때, 시트 · 대화상자 모두 */
  onBack?: () => void;
  /** 열릴 때 초점 — 기본은 표면(컨테이너). 폼이 첫 칸에 초점을 줄 때 e.preventDefault() 하고 직접 옮긴다(두 표면 모두 같다) */
  onOpenAutoFocus?: (event: Event) => void;
  /** 시트의 오른쪽 위 닫기 원(기본 켬) — 한 단계 들어간 동안 그 자리를 "완료" 가 쓸 때만 끈다. 입력 폼 대화상자는 원래 닫기 단추가 없다 */
  showCloseButton?: boolean;
}

const ResponsiveDialogContent = React.forwardRef<
  HTMLDivElement,
  ResponsiveDialogContentProps
>(({ size, showCloseButton, ...props }, ref) => {
  const { wide } = useResponsive("ResponsiveDialogContent");
  return wide ? (
    <DialogContent ref={ref} size={size} {...props} />
  ) : (
    <BottomSheetContent
      ref={ref}
      showCloseButton={showCloseButton}
      {...props}
    />
  );
});
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

// 본문 — scrollFog 는 두 표면 모두 같다(위 20 · 아래 80)
const ResponsiveDialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
  (props, ref) => {
    const { wide } = useResponsive("ResponsiveDialogBody");
    return wide ? (
      <DialogBody ref={ref} {...props} />
    ) : (
      <BottomSheetBody ref={ref} {...props} />
    );
  },
);
ResponsiveDialogBody.displayName = "ResponsiveDialogBody";

// 바닥 — 대화상자는 오른쪽 정렬 small 36, 시트는 폭을 나눈 large 48
const ResponsiveDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { wide } = useResponsive("ResponsiveDialogFooter");
  return wide ? (
    <DialogFooter ref={ref} {...props} />
  ) : (
    <BottomSheetFooter ref={ref} {...props} />
  );
});
ResponsiveDialogFooter.displayName = "ResponsiveDialogFooter";

// 바닥 [취소] — 1280 이상(대화상자)에서만 그린다. 시트에서는 위 닫기 버튼이 맡는다. 입력 폼(form)에만 둔다 —
// 조회 · 안내는 머리 닫기 버튼이 닫는다(닫기 버튼과 취소를 함께 두지 않는다) — form 이 아니면 그리지 않고 개발 중에 알린다(레시피는 그렸다)
const ResponsiveDialogCancel = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant" | "asChild">
>((props, ref) => {
  const { wide, form } = useResponsive("ResponsiveDialogCancel");
  React.useEffect(() => {
    if (import.meta.env.DEV && !form) {
      console.warn(
        "[ResponsiveDialog] 조회 · 안내 대화상자에는 바닥 취소를 두지 않는다 — 머리 닫기 버튼이 닫는다(form 이면 취소를 쓴다).",
      );
    }
  }, [form]);
  return wide && form ? <DialogCancel ref={ref} {...props} /> : null;
});
ResponsiveDialogCancel.displayName = "ResponsiveDialogCancel";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogCancel,
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogCancel,
};
