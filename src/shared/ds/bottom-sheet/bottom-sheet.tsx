import { ResponsivePair } from "@/shared/ds/button";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer as DrawerPrimitive } from "vaul";
import { ArrowLeft, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useBeforeUnloadWhile } from "@/shared/lib/before-unload";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import {
  focusOpener,
  surfaceTookOver,
  mergeRefs,
  useBackClose,
  useOpenState,
  useRefocusAfterBusy,
  useWideSurface,
  withButtonSize,
  type OpenChange,
} from "@/shared/ds/overlay";
import { useScrollFog } from "@/shared/ds/scroll-fog";
import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";

import {
  SHEET_BODY,
  SHEET_BODY_FOG,
  SHEET_BODY_PLAIN,
  SHEET_CLOSE,
  SHEET_CONTENT,
  SHEET_DESCRIPTION,
  SHEET_FOOTER,
  SHEET_HANDLE,
  SHEET_HEADER,
  SHEET_NESTED_CONTENT,
  SHEET_NESTED_OVERLAY,
  SHEET_OVERLAY,
  SHEET_TITLE,
  SHEET_TITLE_WITH_CLOSE,
  SHEET_TITLE_WITH_ACTION,
  SHEET_TITLE_WITH_BACK,
  SHEET_BACK,
  SHEET_HEADER_ACTION,
} from "./bottom-sheet-variants";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Bottom Sheet — 구조는 SEED Bottom Sheet(2026-10-02). 수치 원본은 groo-design specs/components/bottom-sheet.yaml
 * (값은 src/shared/ds/spec/bottom-sheet.json). groo-design recipes/shadcn/components/ui/bottom-sheet.tsx 를 첫 판으로 가져왔다. vaul 위에 짰다.
 *
 *   BottomSheet          화면 아래에서 올라오는 모달 — open · defaultOpen · onOpenChange · form · dirty · snapPoints
 *   BottomSheetTrigger   여는 버튼 — 닫으면 초점이 여기로 돌아온다
 *   BottomSheetContent   시트 — title(늘) · description(덧붙일 말이 있을 때만). 오른쪽 위 닫기 버튼(showCloseButton, 기본 켬)
 *   BottomSheetBody      본문 — 좌우 화면 여백 24, 넘치면 이 안에서 스크롤. scrollFog 면 끝 흐림(Scroll Fog — 늘 켜진
 *                        위 20 · 아래 80 + 본문 안 여백 위 20 · 아래 80) — 넘칠 수 있는 본문(목록 · 긴 폼)에만 준다
 *   BottomSheetFooter    바닥 — 버튼 하나면 폭 전체, 둘이면 반씩(사이 8). Button large 48 을 크기를 주지 않은 바로 아래 자식에 넣는다.
 *                        스낵바는 이 바닥 버튼의 윗변 위 8 에 뜬다(버튼마다 SnackbarAvoidOverlap 으로 감싸 있다)
 *   BottomSheetSurface   바탕 — 딤 · 시트 · 손잡이와 닫는 길(Esc · 바깥 · 끌기 · 초점)만. 머리가 다른 시트(Menu Sheet)가 이 위에 짠다.
 *                        BottomSheetContent 도 이것 위에 머리 · 닫기 버튼을 얹은 것이다. handle="always" 면 스냅 높이가 없어도 손잡이를 단다
 *
 * 폼 · 상세는 1280 에서 Dialog 와 바뀌는 ResponsiveDialog(dialog 폴더)로 짠다 — 늘 시트인 자리(Input Button 의 고르기)만 바로 쓴다.
 *
 * 닫는 길(bottom-sheet.md Behavior)
 *   - 닫기 버튼 · Esc · 뒤로 가기(1280 미만)는 늘 닫는다.
 *   - 바깥(딤) 누르기 · 아래로 끌기는 조회 · 고르기 시트만 닫는다. form(입력 폼)이면 둘 다 아무 일도 하지 않는다 — 손잡이도 없다.
 *   - 끌기는 vaul 의 기준 그대로다 — 놓을 때 0.4px/ms 보다 빠르거나 높이의 25% 이상 내려왔으면 닫고 아니면 200ms exit 로 제자리.
 *     열린 뒤 0.5초는 끌리지 않고, 본문이 스크롤돼 있으면(맨 위가 아니면) 끌지 않고 스크롤한다.
 *   - dirty 면 어느 길이든 닫기 전에 "작성한 내용이 사라져요" 를 묻는다 — [계속 작성] 이면 그대로(끌던 시트는 제자리로).
 *   - busy(저장 중)면 어느 길도 받지 않는다 — 묻지도 않는다(뒤로 가기는 칸을 다시 쌓고, 끌던 시트는 제자리로). 머리 ← 도,
 *     본문 입력도 받지 않는다(inert). 닫기 X 는 흐리게 하지 않고 모양 그대로다 — 저장 단추의 로딩이 "기다려라" 를 말한다.
 *
 * 열면 초점은 시트(컨테이너)로 가고 열린 동안 시트 안을 돈다. 닫으면 연 자리(트리거, 없으면 열 때 초점이 있던 곳)로 돌아간다.
 * 뒤 화면은 보조 기술에서 숨기고 스크롤을 잠근다(Radix Dialog). role="dialog" + aria-modal, 제목 aria-labelledby · 설명 aria-describedby.
 *
 * 모양은 bottom-sheet-variants.ts — 최대 480 으로 가운데, 위 두 모서리 r6 24, 그림자 없이 딤(overlay-dim)과 표면 색으로 뜬다.
 * 높이는 내용만큼이고 화면 높이의 90% 를 넘지 않는다(넘을 내용은 페이지로). 바닥 버튼 아래에 안전 영역을 더한다.
 * 끝 흐림(scrollFog, bottom-sheet.yaml · scroll-fog.yaml overlayBody) — 걸 본문인지는 내용의 종류로 정한다(칸 두셋처럼 늘 들어맞는
 * 본문에는 걸지 않는다). 걸면 늘 켜져 있고 본문 안 여백이 위 20(머리 아래 16 은 그대로) · 아래 80(바닥이 있어도 — 바닥이 없으면 그
 * 아래 안전 영역)이 돼 끝까지 내리면 흐림이 빈 여백 위에 놓인다. 1280 이상의 Dialog 와 같다.
 * 쌓임: 딤 z-modal 100 · 시트 z-modal-content 101(specs/z-index.md L2) — 그 위에 Popover(L3) · Alert Dialog(L5).
 * 모션: 300ms enter-expressive 로 올라오고(딤 300ms enter) 200ms exit 로 내려간다(딤 200ms exit). 모션 줄이기면 150ms 서서히 나타남 · 사라짐.
 *
 * 스냅 높이(snapPoints — vaul 그대로, 화면 높이 비율 0 ~ 1 또는 "300px")를 주면 시트를 화면의 90% 높이로 두고 손잡이를 단다
 * (36 × 4 · stroke-neutral-weak · 위 6, 누르는 영역 44, 보조 기술에는 숨긴다). 손잡이를 누르면 다음(더 높은) 스냅 높이로 올라가고,
 * 가장 높은 높이에서 누르면 닫는다(SEED · vaul 의 Handle 과 같다). form 이면 스냅 높이를 쓰지 않는다.
 *
 * 레시피와 다른 자리
 *   - 띄울 자리 `container`(기본 document.body)와 `modal`(기본 켬)을 더했다 — 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의
 *     다크 판)에서는 body 의 시트가 라이트 색을 받는다(help-bubble 의 container 와 같은 까닭). modal={false} 는 카탈로그 · 문서 전용이다 —
 *     초점 가둠 · 바깥 비활성 · 뒤 화면 숨김 · 스크롤 잠금을 끄고 딤은 직접 그린다. 앱 화면은 쓰지 않는다. vaul 은 Radix Dialog 를
 *     늘 모달로 열어(modal 을 넘기지 않는다 — vaul 의 modal 은 딤 · 끌기만 가른다) 여럿을 동시에 펼칠 수 없으므로, 이때는 vaul 을
 *     거치지 않고 Radix Dialog(비모달)로 같은 모양을 그린다 — 끌기 · 스냅 이동은 없다.
 *   - 1280 판별은 useWideSurface(overlay 폴더) — Input Button 의 useInputButtonSurface 가 아직 없어 같은 경계(lg)를 직접 읽는다.
 */

type SnapPoint = number | string;

// 문맥을 둘로 가른다 — 그리는 값(SheetContext)과 DOM 참조(SheetRefsContext). 참조를 같은 객체에 담으면 React Compiler 가
// 그리는 동안 참조를 읽는다고 보고 이 부품을 건너뛴다
type SheetRefs = {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  openRef: React.RefObject<boolean>;
};
const SheetRefsContext = React.createContext<SheetRefs | null>(null);

function useSheetRefs(name: string) {
  const ctx = React.useContext(SheetRefsContext);
  if (!ctx) throw new Error(`${name} 는 BottomSheet 안에 둔다.`);
  return ctx;
}

type SheetContextValue = {
  form: boolean;
  /** 저장 중 — 닫기 · 머리 뒤로를 받지 않고 본문은 입력을 받지 않는다(inert) */
  busy: boolean;
  /** 닫기를 청한다 — 바로 닫았으면 true, 바뀐 값이 있어 물었으면 false */
  requestClose: () => boolean;
  /** 시트 · 딤 요소를 받아 둔다 — 초점을 옮기고 끌던 자리를 지울 때 쓴다 */
  setContent: (node: HTMLDivElement | null) => void;
  setOverlay: (node: HTMLDivElement | null) => void;
  container: HTMLElement | null | undefined;
  modal: boolean;
  /** 다른 시트 안에서 열린 시트(폼 시트 위의 고르기 시트) — 딤이 아래 시트 위에, 시트가 그 딤 위에 선다 */
  nested: boolean;
  snapPoints: SnapPoint[] | undefined;
  snap: SnapPoint | null;
  setSnap: (point: SnapPoint | null) => void;
};
const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(name: string) {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error(`${name} 는 BottomSheet 안에 둔다.`);
  return ctx;
}

export interface BottomSheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChange;
  /** 입력 폼 — 바깥 누르기 · 끌어내리기로 닫지 않는다(손잡이 없음). 위 닫기 버튼 · Esc · 뒤로 가기로 닫는다 */
  form?: boolean;
  /** 바뀐 값이 있다 — 닫기 전에 "작성한 내용이 사라져요" 를 묻는다 */
  dirty?: boolean;
  /**
   * 저장하는 중이다(저장 단추가 로딩) — 닫기 X · Esc · 바깥 · 뒤로 가기 · 끌기 · 머리 ← 를 받지 않고 본문은 입력을 받지 않는다
   * (state loading). 닫기 X 는 흐리게 하지 않고 모양 그대로 둔다. 뒤로 가기는 칸을 다시 쌓아 다음 뒤로 가기도 이 시트로 온다
   */
  busy?: boolean;
  /** 스냅 높이(vaul — 화면 높이 비율 0 ~ 1 또는 "300px", 낮은 것부터) — 주면 손잡이를 단다. form 이면 쓰지 않는다 */
  snapPoints?: SnapPoint[];
  /** 지금 스냅 높이 — 주면 제어한다(기본은 가장 낮은 높이에서 연다) */
  activeSnapPoint?: SnapPoint | null;
  onActiveSnapPointChange?: (point: SnapPoint | null) => void;
  /** 띄울 자리 — 기본 document.body. 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의 다크 판)에서 그 안의 요소로 */
  container?: HTMLElement | null;
  /** false 면 모달 부작용(초점 가둠 · 바깥 비활성 · 뒤 화면 숨김 · 스크롤 잠금)을 끈다 — 카탈로그 · 문서 전용 */
  modal?: boolean;
  children?: React.ReactNode;
}

function BottomSheet({
  open: openProp,
  defaultOpen,
  onOpenChange,
  form = false,
  dirty = false,
  busy = false,
  snapPoints,
  activeSnapPoint,
  onActiveSnapPointChange,
  container,
  modal = true,
  children,
}: BottomSheetProps) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const nested = React.useContext(SheetContext) != null;
  const narrow = !useWideSurface();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
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
  useRefocusAfterBusy(busy, contentRef);
  // 열린 폼이 바뀐 값을 가졌거나 저장 중이면 새로 고침 · 탭 닫기에 브라우저 기본 확인창(판단 (3))
  useBeforeUnloadWhile(open && (dirty || busy));
  // 뒤로 가기(1280 미만) — 바뀐 값이 있어 물었으면 칸을 다시 쌓는다
  useBackClose(open && narrow && modal, (keep) => {
    if (!leave.request()) keep();
  });

  const snaps = form ? undefined : snapPoints;
  const [snapInner, setSnapInner] = React.useState<SnapPoint | null>(
    snaps?.[0] ?? null,
  );
  const controlledSnap = activeSnapPoint !== undefined;
  const snap = controlledSnap ? activeSnapPoint : snapInner;
  const snapChangeRef = React.useRef(onActiveSnapPointChange);
  React.useEffect(() => {
    snapChangeRef.current = onActiveSnapPointChange;
  });
  const setSnap = (point: SnapPoint | null) => {
    if (!controlledSnap) setSnapInner(point);
    snapChangeRef.current?.(point);
  };

  // vaul 이 끌어 닫으려 했는데 닫지 않았을 때(물었을 때) — 끌던 자리(인라인 transform · 딤 투명도)를 지워 제자리로 돌린다.
  // 되돌아가는 시간 · 곡선은 클래스가 정한다(200ms exit)
  const snapBack = () => {
    contentRef.current?.style.removeProperty("transform");
    overlayRef.current?.style.removeProperty("opacity");
  };

  const value: SheetContextValue = {
    form,
    busy,
    requestClose: leave.request,
    setContent: (node) => {
      contentRef.current = node;
    },
    setOverlay: (node) => {
      overlayRef.current = node;
    },
    container,
    modal,
    nested,
    snapPoints: snaps,
    snap,
    setSnap,
  };

  const refs: SheetRefs = { triggerRef, openRef };

  return (
    <SheetRefsContext.Provider value={refs}>
      <SheetContext.Provider value={value}>
        {modal ? (
          <DrawerPrimitive.Root
            open={open}
            container={container}
            // vaul 이 닫으려 할 때(끌어내리기 · 손잡이) — 바뀐 값이 있으면 묻고 시트는 제자리로
            onOpenChange={(next) => {
              if (next) setOpen(true);
              else if (!leave.request()) snapBack();
            }}
            // 입력 폼은 끌리지 않는다 — 손잡이가 없으므로 어디서도 끌 수 없다
            handleOnly={form}
            snapPoints={snaps}
            activeSnapPoint={snaps ? snap : undefined}
            setActiveSnapPoint={snaps ? setSnap : undefined}
          >
            {children}
          </DrawerPrimitive.Root>
        ) : (
          // 카탈로그 · 문서 전용 — vaul 은 Radix Dialog 를 늘 모달로 열어(modal 을 넘기지 않는다) 여럿을 동시에 펼칠 수 없다.
          // 끌기 · 스냅 이동이 없는 Radix Dialog(비모달)로 같은 모양을 그린다
          <DialogPrimitive.Root
            open={open}
            modal={false}
            onOpenChange={(next) => {
              if (next) setOpen(true);
              else leave.request();
            }}
          >
            {children}
          </DialogPrimitive.Root>
        )}
        {leave.node}
      </SheetContext.Provider>
    </SheetRefsContext.Provider>
  );
}
BottomSheet.displayName = "BottomSheet";

const BottomSheetTrigger = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Trigger>
>((props, ref) => {
  const refs = useSheetRefs("BottomSheetTrigger");
  return (
    <DrawerPrimitive.Trigger
      ref={mergeRefs(ref, refs.triggerRef)}
      data-slot="bottom-sheet-trigger"
      {...props}
    />
  );
});
BottomSheetTrigger.displayName = "BottomSheetTrigger";

// 손잡이를 누르면 다음(더 높은) 스냅 높이로, 가장 높은 높이에서는 닫는다(SEED · vaul 의 Handle 과 같다).
// 스냅 높이가 없으면 손잡이를 달지 않는다 — always(Menu Sheet)면 달고, 누르면 닫는다(가장 높은 높이와 같다)
function SheetHandle({ always = false }: { always?: boolean }) {
  const { snapPoints, snap, setSnap, requestClose } =
    useSheetContext("BottomSheetContent");
  if (!snapPoints?.length) {
    if (!always) return null;
    return (
      <div
        aria-hidden
        data-slot="bottom-sheet-handle"
        className={SHEET_HANDLE}
        onClick={() => requestClose()}
      />
    );
  }
  const index = snap == null ? 0 : Math.max(snapPoints.indexOf(snap), 0);
  return (
    <div
      aria-hidden
      data-slot="bottom-sheet-handle"
      className={SHEET_HANDLE}
      onClick={() => {
        const higher = snapPoints[index + 1];
        if (higher === undefined) requestClose();
        else setSnap(higher);
      }}
    />
  );
}

export interface BottomSheetSurfaceProps extends React.ComponentPropsWithoutRef<
  typeof DrawerPrimitive.Content
> {
  /** 손잡이 — snap(스냅 높이가 있을 때만, 기본) · always(늘 — Menu Sheet. 스냅 높이가 없으면 누를 때 닫는다) */
  handle?: "snap" | "always";
}

// 바탕 — 딤 · 시트(최대 480 · 위 모서리 · 모션 · 안전 영역) · 손잡이와 닫는 길. 머리 · 본문은 쓰는 쪽이 children 으로 넣는다
const BottomSheetSurface = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  BottomSheetSurfaceProps
>(
  (
    {
      handle = "snap",
      className,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onPointerDownOutside,
      ...props
    },
    ref,
  ) => {
    const ctx = React.useContext(SheetContext);
    const refs = useSheetRefs("BottomSheetContent");
    if (!ctx) throw new Error("BottomSheetSurface 는 BottomSheet 안에 둔다.");
    const {
      container,
      modal,
      snapPoints,
      form,
      requestClose,
      setContent,
      setOverlay,
      nested,
    } = ctx;
    const own = React.useRef<HTMLDivElement>(null);
    const openerRef = React.useRef<Element | null>(null);
    // 모달이 아니면(카탈로그 · 문서 전용) vaul 문맥이 없어 Radix 부품을 바로 쓴다
    const SheetContentPrimitive = modal
      ? DrawerPrimitive.Content
      : DialogPrimitive.Content;
    return (
      <DialogPrimitive.Portal container={container}>
        {modal ? (
          <DrawerPrimitive.Overlay
            ref={setOverlay}
            data-slot="bottom-sheet-overlay"
            className={cn(SHEET_OVERLAY, nested && SHEET_NESTED_OVERLAY)}
          />
        ) : (
          <div
            data-slot="bottom-sheet-overlay"
            data-state="open"
            className={cn(SHEET_OVERLAY, nested && SHEET_NESTED_OVERLAY)}
          />
        )}
        <SheetContentPrimitive
          ref={mergeRefs(ref, own, setContent)}
          data-slot="bottom-sheet-content"
          aria-busy={ctx.busy || undefined}
          aria-modal="true"
          className={cn(
            SHEET_CONTENT,
            nested && SHEET_NESTED_CONTENT,
            snapPoints?.length && "h-[90dvh]",
            className,
          )}
          // 처음 초점은 시트(본문 위) — vaul 은 기본으로 아무 데도 두지 않는다
          onOpenAutoFocus={(e) => {
            openerRef.current = document.activeElement;
            onOpenAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            own.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => {
            onCloseAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            // 폭이 1280 을 넘나들어 다른 표면이 대신 떴으면 초점은 새 표면이 가져간다. 부모가 표면을 지워 닫은 것이면 연 자리로(surfaceTookOver)
            if (surfaceTookOver(refs.openRef.current)) return;
            focusOpener(refs.triggerRef.current, openerRef.current);
          }}
          // Esc 는 늘 닫는다(바뀐 값이 있으면 먼저 묻는다) — vaul 을 거치지 않고 직접 청한다
          onEscapeKeyDown={(e) => {
            onEscapeKeyDown?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            requestClose();
          }}
          // 바깥(딤) 누르기 — 입력 폼은 무시하고, 조회 · 고르기는 닫는다. 오른쪽 클릭은 닫지 않는다(Radix 와 같다)
          onPointerDownOutside={(e) => {
            onPointerDownOutside?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            const pointer = e.detail.originalEvent;
            const secondary =
              pointer.button === 2 || (pointer.button === 0 && pointer.ctrlKey);
            if (!form && !secondary) requestClose();
          }}
          {...props}
        >
          <SheetHandle always={handle === "always"} />
          {children}
        </SheetContentPrimitive>
      </DialogPrimitive.Portal>
    );
  },
);
BottomSheetSurface.displayName = "BottomSheetSurface";

export interface BottomSheetContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>,
  "title"
> {
  /** 제목 — 무엇을 하는 시트인지("거래 추가" · "기간"). 늘 둔다 */
  title: React.ReactNode;
  /** 설명 — 덧붙일 말이 있을 때만 한 문장 */
  description?: React.ReactNode;
  /** 오른쪽 위 닫기 버튼(기본 켬) — 조회 · 고르기 · 시트의 입력 폼 모두에 둔다 */
  showCloseButton?: boolean;
  /** 머리 오른쪽 동작 하나 — ghost iconOnly 36 단추(⋮ "{항목 이름} 더보기"). 닫기 단추 왼쪽 사이 4, 제목은 남은 폭에서 줄을 바꾼다. 초점 차례: 제목 → 동작 → 닫기 */
  headerAction?: React.ReactNode;
  /** 머리 왼쪽 뒤로 가기 — 같은 시트 안에서 한 단계 되돌아갈 때(← 아이콘 단추 "뒤로", 보이는 40 · 누르는 44). 제목은 그 오른쪽 사이 4 에서 시작한다 */
  onBack?: () => void;
}

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  BottomSheetContentProps
>(
  (
    {
      title,
      description,
      showCloseButton = true,
      headerAction,
      onBack,
      children,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const ctx = useSheetContext("BottomSheetContent");
    return (
      <BottomSheetSurface
        ref={ref}
        data-form={ctx.form || undefined}
        // 설명이 없으면 aria-describedby 를 걷는다(가리킬 곳이 없다)
        {...(description == null ? { "aria-describedby": undefined } : null)}
        {...props}
      >
        {/* 뒤로 가기 — DOM 맨 앞이라 초점 차례도 맨 앞: 뒤로 → 제목 → 동작 → 닫기 */}
        {onBack && (
          <button
            type="button"
            aria-label={dsT("topNavigation.back")}
            data-slot="bottom-sheet-back"
            className={SHEET_BACK}
            // 저장 중에는 한 단계 뒤로도 가지 않는다 — 실패 Callout 을 그릴 폼이 사라진다
            onClick={() => {
              if (!ctx.busy) onBack();
            }}
          >
            <ArrowLeft aria-hidden strokeWidth={2} />
          </button>
        )}
        <div data-slot="bottom-sheet-header" className={SHEET_HEADER}>
          <DrawerPrimitive.Title
            data-slot="bottom-sheet-title"
            className={cn(
              SHEET_TITLE,
              showCloseButton && SHEET_TITLE_WITH_CLOSE,
              headerAction != null && SHEET_TITLE_WITH_ACTION,
              onBack && SHEET_TITLE_WITH_BACK,
            )}
          >
            {title}
          </DrawerPrimitive.Title>
          {description != null && (
            <DrawerPrimitive.Description
              data-slot="bottom-sheet-description"
              className={SHEET_DESCRIPTION}
            >
              {description}
            </DrawerPrimitive.Description>
          )}
        </div>
        {/* 머리 오른쪽 동작 — DOM 차례가 초점 차례: 제목 → 동작 → 닫기 */}
        {headerAction != null && (
          <div
            data-slot="bottom-sheet-header-action"
            className={SHEET_HEADER_ACTION}
          >
            {headerAction}
          </div>
        )}
        {showCloseButton && (
          <button
            type="button"
            aria-label={dsT("common.close")}
            data-slot="bottom-sheet-close"
            className={SHEET_CLOSE}
            onClick={() => ctx.requestClose()}
          >
            <X aria-hidden strokeWidth={2} />
          </button>
        )}
        {children}
      </BottomSheetSurface>
    );
  },
);
BottomSheetContent.displayName = "BottomSheetContent";

export interface BottomSheetBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 끝 흐림(Scroll Fog overlayBody — 위 20 · 아래 80, 늘 켜짐) — 넘칠 수 있는 본문(목록 · 긴 폼)에만 */
  scrollFog?: boolean;
}

const BottomSheetBody = React.forwardRef<HTMLDivElement, BottomSheetBodyProps>(
  ({ scrollFog = false, className, ...props }, ref) => {
    const own = React.useRef<HTMLDivElement>(null);
    const busy = React.useContext(SheetContext)?.busy ?? false;
    useScrollFog(own, scrollFog ? "overlayBody" : null);
    return (
      <div
        ref={mergeRefs(ref, own)}
        // 저장 중 — 본문은 입력을 받지 않는다(모양은 그대로)
        inert={busy || undefined}
        data-slot="bottom-sheet-body"
        data-scroll-fog={scrollFog ? "overlayBody" : undefined}
        className={cn(
          SHEET_BODY,
          scrollFog ? SHEET_BODY_FOG : SHEET_BODY_PLAIN,
          className,
        )}
        {...props}
      />
    );
  },
);
BottomSheetBody.displayName = "BottomSheetBody";

const BottomSheetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <ResponsivePair
    ref={ref}
    data-slot="bottom-sheet-footer"
    className={cn(SHEET_FOOTER, className)}
    {...props}
  >
    {/* 스낵바가 피할 자리는 바닥 영역(위 여백 12 포함)이 아니라 버튼이다 — snackbar.md "바닥 버튼 위 8".
        버튼마다 감싸면 세로로 쌓여도 가장 위 버튼의 윗변 위 8 에 선다 */}
    {React.Children.map(withButtonSize(children, "large"), (child) =>
      React.isValidElement(child) ? (
        <SnackbarAvoidOverlap>{child}</SnackbarAvoidOverlap>
      ) : (
        child
      ),
    )}
  </ResponsivePair>
));
BottomSheetFooter.displayName = "BottomSheetFooter";

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
  BottomSheetSurface,
};
