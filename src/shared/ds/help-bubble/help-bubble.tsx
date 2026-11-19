import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import {
  BUBBLE,
  BUBBLE_DESCRIPTION,
  BUBBLE_POSITION,
  BUBBLE_TITLE,
  BUBBLE_CLOSE,
} from "./help-bubble-variants";
import { useBubbleEdgePadding } from "./bubble-edge-padding";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Help Bubble — 구조는 SEED Help Bubble(2026-10-02). 수치 원본은 groo-design
 * specs/components/help-bubble.yaml(값은 src/shared/ds/spec/help-bubble.json — Tooltip 과 한 파일).
 * groo-design recipes/shadcn/components/ui/help-bubble.tsx 를 첫 판으로 가져왔다(앱 적용 1A).
 * Radix Popover(비모달) 위에 짰다.
 *
 *   HelpBubble          눌러서 여는 짙은 도움말 말풍선 — open · defaultOpen · onOpenChange
 *   HelpBubbleTrigger   여는 버튼(ⓘ — Button ghost · iconOnly, 이름 "{무엇} 안내") — aria-haspopup="dialog" · aria-expanded,
 *                       열린 동안 aria-controls. 누르면 열고, 열려 있으면 닫는다
 *   HelpBubbleAnchor    자리만 잡는 기준 — 처음부터 열어 두는 안내(defaultOpen)를 다른 버튼에 붙일 때. 누르면 그 버튼의 원래 동작
 *   HelpBubbleContent   말풍선 — title(늘) · description · showCloseButton · closeOnInteractOutside · side(기본 top) · align ·
 *                       container(띄울 자리 — 기본 document.body)
 *
 * 말풍선의 모양은 Tooltip(tooltip.tsx)과 한 벌이다 — help-bubble-variants.ts 의 BUBBLE · BUBBLE_TITLE · BUBBLE_DESCRIPTION 과
 * 이 파일의 BubbleArrow 를 두 컴포넌트가 함께 쓴다.
 *
 * 띄울 자리(container)는 이 레포에서 더했다(레시피에 없다) — 말풍선은 문서 끝(body)에 뜨는데, 다크가 문서(<html class="dark">)가
 * 아니라 하위 요소에 걸린 곳(카탈로그의 다크 판)에서는 body 의 말풍선이 라이트 색을 받는다. 그런 곳은 그 안의 요소로 띄운다.
 *
 * 초점(비모달 — 뒤 화면을 숨기지 않고 스크롤도 잠그지 않는다. 스크롤하면 트리거를 따라간다)
 *   - 열어도 초점을 옮기지 않는다(트리거에 남는다). 대신 열릴 때 제목 · 설명을 한 번 알린다 — 트리거 옆에 늘 두는 화면 밖 자리
 *     (role="status" · aria-live="polite")에 열린 뒤 글을 넣고 닫히면 비운다. 누르거나 처음부터 열려도 같다(2026-10-15 사용자 결정 Q-004-2).
 *   - 열린 동안 트리거(또는 기준)에서 Tab 은 말풍선으로 — 닫기 버튼이 있으면 그리로, 없으면 말풍선(role="dialog")으로
 *     (말풍선 둘레 바깥 2 에 2px stroke-focus-ring — 키보드 초점에만).
 *     말풍선에서 다시 Tab 으로 나가면 닫히고 초점은 트리거 다음 칸으로 간다. Shift+Tab 은 트리거로.
 *   - Esc 는 닫는다 — 초점이 말풍선 안에 있었으면 트리거로 돌아오고, 밖(다른 칸)에 있었으면 그 자리에 둔다.
 *   - 닫기 버튼은 닫고 초점을 트리거로.
 *   - 바깥 누르기 · 바깥으로 간 초점은 닫는다. closeOnInteractOutside={false} 면 둘 다 닫지 않는다 — 닫기 버튼이 있는 남겨 둘
 *     안내(처음 쓰는 기능의 설명)에만 쓴다. 그때도 Esc · 닫기 버튼 · 말풍선에서 Tab 으로 나가기는 닫는다.
 *
 * 모양: 폭은 내용만큼 최대 280(여백 포함), 위아래 10 · 좌우 12 · 모서리 12 · bg-neutral-inverted(다크는 밝은 말풍선) · 그림자 없음.
 * 제목 t3 13 / 18 · 700, 설명 t3 · 400(사이 2), 글자는 fg-neutral-inverted — 단어 단위로 줄을 바꾸고 줄바꿈 문자는 살린다.
 * 화살표는 12 × 8(끝 모서리 2) — 늘 트리거 가운데를 가리키고 말풍선 모서리와 14 를 남긴다.
 * 화살표 끝 ↔ 트리거 4(말풍선 몸통과는 12), 화면 가장자리와 16 — 모자라면 반대편으로 뒤집고 옆으로 민다.
 * 셋이 부딪히면 화살표(트리거 가운데) → 모서리 14 → 가장자리 16 순서다 — 화면 끝의 트리거면 말풍선이 16 보다 가장자리에 붙는다(하한 없이 0 까지,
 * 2026-10-15 사용자 결정 Q-004-1). Radix 는 화살표를 가운데에 못 두면 숨기므로(cannotCenterArrow) 트리거 쪽 가장자리 여백을
 * min(16, 트리거 가운데 − 20)으로 줄여 말풍선을 그만큼 더 붙인다(useBubbleEdgePadding — bubble-edge-padding.ts). 쌓임은 z-tooltip 210(L4 —
 * 팝오버 · 메뉴 위). 닫기 버튼은 오른쪽 위 모서리에 붙은 38 투명 상자 · 아이콘 14(위 12 · 오른쪽 12 자리) · 누르는 영역 44 ·
 * 글과 4, 누르면 2px 거리 축소만(바탕 없음), 키보드 포커스는 안쪽 2px 링을 말풍선 글자색으로(브랜드 링은 짙은 말풍선 위에서 3:1 에
 * 못 미친다). 이름 "닫기".
 * 모션: 열림 200ms enter 로 화살표 끝에서 0.9 → 1 · 투명도, 닫힘 200ms easing 으로 투명도만(모션 줄이기면 크기는 그대로).
 * ARIA: 말풍선 role="dialog"(aria-modal 없음) + 제목 aria-labelledby · 설명 aria-describedby. 화살표는 장식이다.
 */

// 화살표 — 12 × 8, 끝 모서리 2(SEED getHelpBubbleArrowTipPath). Popover · Tooltip 의 Arrow 에 asChild 로 넣는다 —
// Radix 가 넘기는 viewBox(30 × 10)를 덮어 쓴다. visible — Radix 가 가운데를 못 가리킬 때 감싼 span 에 거는 visibility: hidden 을 받지 않는다
// (화살표를 지우지 않는다 — Q-004-1. 가장자리 여백을 줄여 가운데를 지키므로 보통은 생기지 않는다)
const BubbleArrow = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    aria-hidden
    {...props}
    viewBox="0 0 12 8"
    className={cn("visible block fill-bg-neutral-inverted", className)}
  >
    <path d="M0,0 H12 L8,6 Q6,8 4,6 Z" />
  </svg>
));
BubbleArrow.displayName = "BubbleArrow";

// ── 작은 도구 ─────────────────────────────────────────────────
type OpenChange = (open: boolean) => void;

// 열림 — 같은 값을 거듭 청하면(닫으면서 Radix 도 닫기를 청한다) 한 번만 알린다
function useOpenState(
  prop: boolean | undefined,
  defaultOpen: boolean | undefined,
  onChange: OpenChange | undefined,
) {
  const [inner, setInner] = React.useState(defaultOpen ?? false);
  const controlled = prop !== undefined;
  const value = controlled ? prop : inner;
  const onChangeRef = React.useRef(onChange);
  const lastRef = React.useRef(value);
  React.useLayoutEffect(() => {
    onChangeRef.current = onChange;
    lastRef.current = value;
  });
  const setOpen = (next: boolean) => {
    if (next === lastRef.current) return;
    lastRef.current = next;
    if (!controlled) setInner(next);
    onChangeRef.current?.(next);
  };
  return [value, setOpen] as const;
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

// 말풍선 안에서 Tab 이 서는 칸 — 닫기 버튼뿐이다(링크 · 버튼을 두지 않는다)
const closeButtonOf = (content: HTMLElement | null) =>
  content?.querySelector<HTMLElement>('[data-slot="help-bubble-close"]') ??
  null;

// ── 말풍선 ───────────────────────────────────────────────────
type HelpBubbleContextValue = {
  open: boolean;
  setOpen: OpenChange;
  /** 트리거 · 기준 — 초점이 돌아갈 자리 */
  originRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};
const HelpBubbleContext = React.createContext<HelpBubbleContextValue | null>(
  null,
);

function useHelpBubble(name: string) {
  const ctx = React.useContext(HelpBubbleContext);
  if (!ctx) throw new Error(`${name} 는 HelpBubble 안에 둔다.`);
  return ctx;
}

export interface HelpBubbleProps {
  open?: boolean;
  /** 처음부터 열어 둔다 — 처음 쓰는 사람에게 한 번 보이는 안내(닫기 버튼과 함께) */
  defaultOpen?: boolean;
  onOpenChange?: OpenChange;
  children?: React.ReactNode;
}

// 열림 알림 — 말풍선이 열린 뒤 제목 · 설명 글을 읽어 화면 밖 status 자리에 넣는다(초점은 옮기지 않는다). 자리는 늘 있고 글만 바뀌어야
// 보조 기술이 읽으므로 한 프레임 뒤에 넣고, 닫히면 비워 다시 열 때 또 읽힌다
function useOpenAnnouncement(
  open: boolean,
  contentRef: React.RefObject<HTMLDivElement | null>,
) {
  const [said, setSaid] = React.useState("");
  React.useEffect(() => {
    if (!open) {
      setSaid("");
      return;
    }
    const frame = requestAnimationFrame(() => {
      const content = contentRef.current;
      const text = (slot: string) =>
        content?.querySelector(`[data-slot="${slot}"]`)?.textContent?.trim() ??
        "";
      setSaid(
        [text("help-bubble-title"), text("help-bubble-description")]
          .filter(Boolean)
          .join(" "),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [open, contentRef]);
  return said;
}

function HelpBubble({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
}: HelpBubbleProps) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const originRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const said = useOpenAnnouncement(open, contentRef);
  const value = { open, setOpen, originRef, contentRef };
  return (
    <HelpBubbleContext.Provider value={value}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </PopoverPrimitive.Root>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-slot="help-bubble-status"
        className="sr-only"
      >
        {said}
      </span>
    </HelpBubbleContext.Provider>
  );
}
HelpBubble.displayName = "HelpBubble";

// 열린 동안 트리거 · 기준에서 Tab — 말풍선 안으로(닫기 버튼, 없으면 말풍선). 말풍선은 문서 끝(portal)에 있어 브라우저에 맡기면 건너뛴다
function useEnterOnTab(ctx: HelpBubbleContextValue) {
  return (e: React.KeyboardEvent) => {
    if (
      e.defaultPrevented ||
      !ctx.open ||
      e.key !== "Tab" ||
      e.shiftKey ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey
    )
      return;
    const content = ctx.contentRef.current;
    if (!content) return;
    e.preventDefault();
    (closeButtonOf(content) ?? content).focus({ preventScroll: true });
  };
}

const HelpBubbleTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ onKeyDown, ...props }, ref) => {
  const ctx = useHelpBubble("HelpBubbleTrigger");
  const enter = useEnterOnTab(ctx);
  return (
    <PopoverPrimitive.Trigger
      ref={mergeRefs(ref, ctx.originRef)}
      data-slot="help-bubble-trigger"
      // aria-controls 는 열린 동안만 — 닫혀 있으면 가리킬 말풍선이 문서에 없다
      {...(!ctx.open ? { "aria-controls": undefined } : null)}
      {...props}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        enter(e);
      }}
    />
  );
});
HelpBubbleTrigger.displayName = "HelpBubbleTrigger";

// 기준 — 자리만 잡는다(팝업 ARIA 를 달지 않는다 · 누르면 원래 동작). 자식 하나를 asChild 로
const HelpBubbleAnchor = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Anchor>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Anchor>
>(({ onKeyDown, ...props }, ref) => {
  const ctx = useHelpBubble("HelpBubbleAnchor");
  const enter = useEnterOnTab(ctx);
  return (
    <PopoverPrimitive.Anchor
      ref={mergeRefs(ref, ctx.originRef)}
      data-slot="help-bubble-anchor"
      {...props}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        enter(e);
      }}
    />
  );
});
HelpBubbleAnchor.displayName = "HelpBubbleAnchor";

// 말풍선 자체의 초점 링 — 닫기 버튼이 없는 말풍선에 Tab 으로 들어오면 둘레 바깥 2(모서리 12 를 따라) · 2px stroke-focus-ring.
// 페이지 위에 그려지므로 브랜드 링이다(키보드 초점에만)
const ROOT_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring";

export interface HelpBubbleContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>,
  "title" | "children" | "sideOffset" | "arrowPadding" | "collisionPadding"
> {
  /** 제목 — 무엇의 설명인지("연차 사용 규정"). 한 줄로 끝나면 이것만 */
  title: React.ReactNode;
  /** 설명 — 해요체 문장 2 ~ 3줄 */
  description?: React.ReactNode;
  /** 오른쪽 위 닫기 버튼 — 닫기 전까지 남겨 둘 안내(처음부터 열어 두는 말풍선)에만 */
  showCloseButton?: boolean;
  /** 바깥 누르기 · 바깥으로 간 초점에 닫힌다(기본 켬). 끄면 Esc · 닫기 버튼 · Tab 으로 나가기로만 닫는다 — 닫기 버튼과 함께 */
  closeOnInteractOutside?: boolean;
  /** 띄울 자리 — 기본 document.body. 다크가 문서가 아니라 하위 요소에 걸린 곳(카탈로그의 다크 판)에서 그 안의 요소로 */
  container?: React.ComponentPropsWithoutRef<
    typeof PopoverPrimitive.Portal
  >["container"];
}

const HelpBubbleContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  HelpBubbleContentProps
>(
  (
    {
      title,
      description,
      showCloseButton = false,
      closeOnInteractOutside = true,
      container,
      side = "top",
      align = "center",
      className,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onInteractOutside,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const ctx = useHelpBubble("HelpBubbleContent");
    const collisionPadding = useBubbleEdgePadding(
      ctx.originRef,
      ctx.open,
      side,
    );
    const titleId = React.useId();
    const descriptionId = React.useId();
    return (
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          ref={mergeRefs(ref, ctx.contentRef)}
          data-slot="help-bubble-content"
          side={side}
          align={align}
          {...BUBBLE_POSITION}
          collisionPadding={collisionPadding}
          aria-labelledby={titleId}
          aria-describedby={description != null ? descriptionId : undefined}
          className={cn(
            BUBBLE,
            ROOT_RING,
            showCloseButton && "flex items-start",
            className,
          )}
          // 열어도 초점을 옮기지 않는다
          onOpenAutoFocus={(e) => {
            onOpenAutoFocus?.(e);
            e.preventDefault();
          }}
          // 닫힌 뒤 — 초점이 갈 곳을 잃었으면(말풍선 안에 있었다) 트리거로, 밖의 다른 칸에 있었으면 그 자리에 둔다
          onCloseAutoFocus={(e) => {
            onCloseAutoFocus?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            const active = document.activeElement;
            const origin = ctx.originRef.current;
            if ((!active || active === document.body) && origin?.isConnected)
              origin.focus({ preventScroll: true });
          }}
          onInteractOutside={(e) => {
            onInteractOutside?.(e);
            if (!closeOnInteractOutside) e.preventDefault();
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (
              e.defaultPrevented ||
              e.key !== "Tab" ||
              e.altKey ||
              e.ctrlKey ||
              e.metaKey
            )
              return;
            const origin = ctx.originRef.current;
            if (e.shiftKey) {
              // Shift+Tab — 트리거로(말풍선은 트리거 바로 뒤다)
              e.preventDefault();
              origin?.focus({ preventScroll: true });
              return;
            }
            // 마지막 칸(닫기 버튼, 없으면 말풍선)에서 Tab — 닫고, 초점을 트리거에 두어 브라우저가 트리거 다음 칸으로 보낸다
            const close = closeButtonOf(ctx.contentRef.current);
            if (close && document.activeElement !== close) return;
            origin?.focus({ preventScroll: true });
            ctx.setOpen(false);
          }}
          {...props}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <div
              id={titleId}
              data-slot="help-bubble-title"
              className={BUBBLE_TITLE}
            >
              {title}
            </div>
            {description != null && (
              <div
                id={descriptionId}
                data-slot="help-bubble-description"
                className={BUBBLE_DESCRIPTION}
              >
                {description}
              </div>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              aria-label={dsT("common.close")}
              data-slot="help-bubble-close"
              className={BUBBLE_CLOSE}
              onClick={() => ctx.setOpen(false)}
            >
              <X aria-hidden strokeWidth={2} />
            </button>
          )}
          <PopoverPrimitive.Arrow asChild width={12} height={8}>
            <BubbleArrow data-slot="help-bubble-arrow" />
          </PopoverPrimitive.Arrow>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    );
  },
);
HelpBubbleContent.displayName = "HelpBubbleContent";

export {
  HelpBubble,
  HelpBubbleTrigger,
  HelpBubbleAnchor,
  HelpBubbleContent,
  BubbleArrow,
};
