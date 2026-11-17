import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/shared/lib/cn";
import { isKeyboardFocus } from "@/shared/lib/input-modality";
import {
  BUBBLE,
  BUBBLE_POSITION,
  BUBBLE_TITLE,
  BubbleArrow,
  useBubbleEdgePadding,
} from "@/shared/ds/help-bubble";
import { mergeRefs, useOpenState, type OpenChange } from "@/shared/ds/overlay";

import {
  CLOSE_DELAY,
  OPEN_DELAY,
  SKIP_DELAY,
  TOOLTIP_CUT,
} from "./tooltip-variants";

/*
 * Groo Tooltip — 구조는 SEED Help Bubble Tooltip(2026-10-02). 수치 원본은 groo-design specs/components/help-bubble.yaml 의
 * opens: hover(값은 src/shared/ds/spec/help-bubble.json). groo-design recipes/shadcn/components/ui/tooltip.tsx 를 첫 판으로 가져왔다.
 * Radix Tooltip 위에 짰고, 말풍선의 모양은 Help Bubble 의 것(BUBBLE · BubbleArrow)을 그대로 쓴다 — 한 벌이다.
 *
 *   TooltipProvider   화면에 한 번 둔다 — 하나가 열린 뒤 옆 트리거로 옮기면 기다리지 않는다. 지연 값은 고정이다(바꾸지 않는다)
 *   Tooltip           open · defaultOpen · onOpenChange · disabled(열지 않는다 — 접힌 사이드바처럼 상태에 따라 필요 없을 때).
 *                     Provider 밖에 두면 혼자 쓴다(이어 열기만 없다)
 *   TooltipTrigger    트리거 — 이름은 aria-label · 보이는 글이다(툴팁은 그 이름을 보여 줄 뿐 대신하지 않는다). 열린 동안 aria-describedby
 *   TooltipContent    글 하나 — 굵게(Help Bubble 의 제목 자리). side(기본 top) · align · container. 누를 것을 두지 않는다
 *
 * 여는 방식 — 툴팁은 마우스 · 키보드의 보조다. 손가락으로는 열지 않는다(이름 · 막힌 이유는 툴팁에만 두지 않는다).
 *   - 마우스를 올리면 200ms 뒤 연다. 하나가 열려 있거나 닫힌 지 300ms 안이면 옆 트리거는 기다리지 않고 모션 없이 바로 연다 —
 *     앞의 툴팁은 그때 바로(모션 없이) 닫는다. 이미 흐려지며 닫히던 중이어도(초점이 떠남 · 마우스가 떠난 뒤 100ms) 그 자리에서
 *     걷는다(data-cut — 보이지 않게 두고 남은 사라짐이 끝나면 Radix 가 지운다). 한 번에 하나만 보인다.
 *   - 트리거와 말풍선을 모두 벗어나면 100ms 뒤 닫는다 — 말풍선 위로 옮기는 동안은 열어 둔다(WCAG 1.4.13). 키보드로 연 툴팁은
 *     포인터가 지나가도 닫지 않는다(초점이 떠나면 닫는다).
 *   - 키보드 초점(focus-visible)이 오면 바로 연다. 손가락 · 마우스로 눌러 생긴 초점에는 열지 않는다.
 *   - Esc 는 닫고 초점은 트리거에 그대로. 트리거를 눌러도 열거나 닫지 않는다(누름은 트리거의 동작) — 마우스를 올려 기다리던 열기는
 *     거둔다(누른 채 200ms 를 넘겨도 열지 않는다). 트리거를 떠났다가 다시 올리면 다시 기다린다. 스크롤하면 트리거를 따라간다.
 *   기다림(200ms · 이어 열기 300ms)은 이 파일이 잰다 — Radix 의 기다림은 0 으로 두고 그 여는 요청을 위 규칙대로 받는다.
 *   Radix 는 포인터가 떠나는 순간 · 누를 때 · 스크롤할 때 · 다른 툴팁이 열릴 때 닫으려 한다 — 그 요청은 받지 않고 위 규칙대로 닫는다
 *   (Esc · 초점 떠남만 받는다).
 *
 * 모양 · 쌓임 · 모션은 Help Bubble 과 같다 — 최대 280 · 위아래 10 · 좌우 12 · 모서리 12 · bg-neutral-inverted · 글 t3 13 / 18 · 700 ·
 * fg-neutral-inverted, 화살표 12 × 8(늘 트리거 가운데) · 화살표 끝 ↔ 트리거 4 · 화면 가장자리 16, z 210(팝오버 · 메뉴 위).
 * 열림 200ms enter 로 화살표 끝에서 0.9 → 1 · 투명도, 닫힘 200ms easing 으로 투명도만 — 이어서 열 때는 모션 없이.
 * ARIA: 말풍선 role="tooltip"(Radix 가 숨은 사본에 단다) — 트리거의 aria-describedby 가 가리킨다.
 *
 * 툴팁은 이름을 대신하지 않는다 — 트리거에 aria-label · aria-labelledby · title 을 달지 않고, 닫혀 있는 동안 말풍선은 문서에 없다.
 * 이름은 쓰는 쪽이 aria-label 로, 막힌 이유는 버튼 가까이 보이는 글로 둔다(막힌 버튼은 초점을 못 받아 키보드로 못 연다).
 *
 * 레시피와 다른 자리 — ① 기다림 값은 tooltip-variants.ts. ② TooltipContent 에 container(띄울 자리) — 다크가 문서가 아니라 하위
 * 요소에 걸린 곳(카탈로그의 다크 판)에서 body 의 말풍선이 라이트 색을 받는다(Help Bubble 과 같은 까닭). ③ 손 메모이제이션 제거 —
 * 모듈 상태(shown)의 소유자 이름표는 state 로 만든 빈 객체이고, 닫기 · 걷기 함수는 WeakMap 에 둔다.
 */

// 지금 열린 툴팁 — 하나가 열리면 앞의 것을 바로(모션 없이) 닫는다. 마지막으로 닫힌 시각은 이어 여는 툴팁이 모션을 건너뛸지 정한다.
// fading 은 흐려지며 닫히는 중인 툴팁 — 다른 툴팁이 열리면 남은 사라짐을 걷는다(cut — 둘이 함께 보이지 않게)
type Owner = object;
type OwnerHandlers = { close: () => void; cut: () => void };
const HANDLERS = new WeakMap<Owner, OwnerHandlers>();
const shown: {
  owner: Owner | null;
  closedAt: number;
  fading: Owner | null;
} = { owner: null, closedAt: Number.NEGATIVE_INFINITY, fading: null };

// ── Provider ─────────────────────────────────────────────────
const ProviderContext = React.createContext(false);

// Radix 의 기다림은 0 으로 두고 이 파일이 잰다(200ms · 이어 열기 300ms) — Radix 의 이어 열기는 Radix 가 닫는 것만 세어서,
// 이 파일이 닫거나 받지 않은 열기(막힌 툴팁 · 누름)가 있으면 그 뒤로 모든 툴팁이 기다리지 않고 열린다
function TooltipProvider({ children }: { children?: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      <ProviderContext.Provider value={true}>
        {children}
      </ProviderContext.Provider>
    </TooltipPrimitive.Provider>
  );
}
TooltipProvider.displayName = "TooltipProvider";

// ── 툴팁 ─────────────────────────────────────────────────────
type CloseReason = "escape" | "blur" | "press";

type TooltipContextValue = {
  /** 열려 있다 — 화면 끝 가장자리 여백을 재는 동안 */
  open: boolean;
  /** 트리거 — 가운데를 재어 화살표가 가운데에 남게 말풍선을 민다 */
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  /** 이어서 열렸다 · 바로 닫힌다 — 모션 없이 */
  instant: boolean;
  /** 흐려지며 닫히던 중에 다른 툴팁이 열렸다 — 남은 사라짐 없이 보이지 않게 */
  cut: boolean;
  /** 포인터가 트리거 · 말풍선에 들어왔다 · 나갔다 */
  hover: (part: "trigger" | "content", inside: boolean) => void;
  /** 다음 닫기 요청의 까닭 — 같은 처리 안에서 Radix 가 부르는 닫기에만 붙는다 */
  flag: (reason: CloseReason) => void;
  /** 키보드 초점으로 열었다 · 초점이 떠났다 */
  setFocused: (focused: boolean) => void;
  /** 트리거를 눌렀다 — 아직 열리지 않았으면 기다리던 열기를 거둔다 */
  press: () => void;
};
const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltip(name: string) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error(`${name} 는 Tooltip 안에 둔다.`);
  return ctx;
}

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChange;
  /** 열지 않는다 — 트리거는 그대로 두고 툴팁만 끈다(펼친 사이드바처럼 이름이 이미 보일 때) */
  disabled?: boolean;
  children?: React.ReactNode;
}

function Tooltip({
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled = false,
  children,
}: TooltipProps) {
  const inProvider = React.useContext(ProviderContext);
  const [open, setOpenState] = useOpenState(
    openProp,
    defaultOpen,
    onOpenChange,
  );
  const [instant, setInstant] = React.useState(false);
  const [cut, setCut] = React.useState(false);
  const openRef = React.useRef(open);
  React.useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);
  const reasonRef = React.useRef<CloseReason | null>(null);
  // 열리기 전에 트리거를 눌렀다 — 이번에 올린 마우스의 열기를 거둔다(트리거를 떠나면 풀린다)
  const pressedRef = React.useRef(false);
  const hoverRef = React.useRef({ trigger: false, content: false });
  const focusedRef = React.useRef(false);
  // 이번 열기 요청이 키보드 초점에서 왔다 — 기다리지 않는다
  const focusRequestRef = React.useRef(false);
  const openTimerRef = React.useRef<number | undefined>(undefined);
  const timerRef = React.useRef<number | undefined>(undefined);
  // 모듈 상태(shown)에서 이 툴팁을 가리키는 이름표
  const [owner] = React.useState<Owner>(() => ({}));
  const disabledRef = React.useRef(disabled);
  React.useLayoutEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const hide = (jump: boolean) => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(openTimerRef.current);
    if (!openRef.current) return;
    openRef.current = false;
    if (shown.owner === owner) {
      shown.owner = null;
      shown.closedAt = Date.now();
    }
    // 흐려지며 닫힌다 — 그동안 다른 툴팁이 열리면 걷힌다. 바로 닫으면(jump) 걷을 것이 없다
    if (!jump) shown.fading = owner;
    else if (shown.fading === owner) shown.fading = null;
    setInstant(jump);
    setOpenState(false);
  };
  React.useLayoutEffect(() => {
    HANDLERS.set(owner, {
      close: () => hide(true),
      cut: () => setCut(true),
    });
  });

  const show = () => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(openTimerRef.current);
    if (disabledRef.current || openRef.current) return;
    const other = shown.owner && shown.owner !== owner ? shown.owner : null;
    const jump = other !== null || Date.now() - shown.closedAt < SKIP_DELAY;
    if (other) HANDLERS.get(other)?.close();
    // 흐려지며 닫히던 툴팁(초점이 떠남 · 마우스가 떠난 뒤)은 남은 사라짐 없이 걷는다 — 열린 것과 함께 보이지 않게
    const fading = shown.fading && shown.fading !== owner ? shown.fading : null;
    shown.fading = null;
    if (fading) HANDLERS.get(fading)?.cut();
    shown.owner = owner;
    openRef.current = true;
    setCut(false);
    setInstant(jump);
    setOpenState(true);
  };

  // 하나가 열려 있거나 닫힌 지 300ms 안이다 — 옆 트리거는 기다리지 않는다
  const warm = () =>
    (shown.owner !== null && shown.owner !== owner) ||
    Date.now() - shown.closedAt < SKIP_DELAY;

  // Radix 의 열고 닫기 요청 — 여는 것은 키보드 초점이면 바로, 마우스면 200ms 뒤(이어 열기면 바로 · 눌렀으면 거둔다).
  // 닫는 것은 Esc · 초점 떠남만 받는다(머리 주석)
  const onRadixOpenChange = (next: boolean) => {
    const reason = reasonRef.current;
    reasonRef.current = null;
    if (!next) {
      if (reason === "escape" || reason === "blur") hide(false);
      return;
    }
    if (disabledRef.current) return;
    if (focusRequestRef.current) {
      focusRequestRef.current = false;
      show();
      return;
    }
    if (pressedRef.current || !hoverRef.current.trigger) return;
    if (warm()) {
      show();
      return;
    }
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => {
      if (hoverRef.current.trigger && !pressedRef.current) show();
    }, OPEN_DELAY);
  };

  // 걷힘은 닫혀 있는 동안만 — 부르는 쪽이 open 으로 다시 열어도 보인다
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const value: TooltipContextValue = {
    open,
    triggerRef,
    instant,
    cut: cut && !open,
    hover: (part, inside) => {
      hoverRef.current[part] = inside;
      // 트리거에 새로 올렸다 · 떠났다 — 누름으로 거둔 열기를 푼다. 떠나면 기다리던 열기도 거둔다
      if (part === "trigger") {
        pressedRef.current = false;
        if (!inside) window.clearTimeout(openTimerRef.current);
      }
      window.clearTimeout(timerRef.current);
      if (inside || !openRef.current) return;
      timerRef.current = window.setTimeout(() => {
        if (
          !hoverRef.current.trigger &&
          !hoverRef.current.content &&
          !focusedRef.current
        )
          hide(false);
      }, CLOSE_DELAY);
    },
    flag: (reason) => {
      reasonRef.current = reason;
      queueMicrotask(() => {
        if (reasonRef.current === reason) reasonRef.current = null;
      });
    },
    setFocused: (focused) => {
      focusedRef.current = focused;
      if (!focused) return;
      // 키보드 초점은 늘 바로 연다 — 앞서 마우스로 눌러 거둔 열기와 상관없다. Radix 가 같은 처리 안에서 여는 요청을 보낸다
      pressedRef.current = false;
      focusRequestRef.current = true;
      queueMicrotask(() => {
        focusRequestRef.current = false;
      });
    },
    press: () => {
      if (openRef.current) return;
      pressedRef.current = true;
      window.clearTimeout(openTimerRef.current);
    },
  };

  // 막히면 바로 닫는다 · 사라지면 지운다
  React.useEffect(() => {
    if (disabled) hide(true);
  });
  React.useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      window.clearTimeout(openTimerRef.current);
      if (shown.owner === owner) shown.owner = null;
      if (shown.fading === owner) shown.fading = null;
    },
    [owner],
  );

  const root = (
    <TooltipContext.Provider value={value}>
      <TooltipPrimitive.Root open={open} onOpenChange={onRadixOpenChange}>
        {children}
      </TooltipPrimitive.Root>
    </TooltipContext.Provider>
  );
  return inProvider ? (
    root
  ) : (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      {root}
    </TooltipPrimitive.Provider>
  );
}
Tooltip.displayName = "Tooltip";

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(
  (
    {
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onClick,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const ctx = useTooltip("TooltipTrigger");
    return (
      <TooltipPrimitive.Trigger
        ref={mergeRefs(ref, ctx.triggerRef)}
        data-slot="tooltip-trigger"
        onPointerEnter={(e) => {
          onPointerEnter?.(e);
          if (e.pointerType !== "touch") ctx.hover("trigger", true);
        }}
        onPointerLeave={(e) => {
          onPointerLeave?.(e);
          if (e.pointerType !== "touch") ctx.hover("trigger", false);
        }}
        // 누름은 트리거의 동작 — Radix 가 누를 때 닫으려는 요청을 받지 않고, 아직 열리지 않았으면 기다리던 열기를 거둔다
        onPointerDown={(e) => {
          onPointerDown?.(e);
          ctx.flag("press");
          ctx.press();
        }}
        onClick={(e) => {
          onClick?.(e);
          ctx.flag("press");
        }}
        // 키보드 초점에만 연다 — 손가락 · 마우스로 눌러 생긴 초점에는 열지 않는다(Radix 의 열기를 건너뛴다).
        // 누른 뒤 스크립트가 옮긴 초점도 키보드 초점이 아니다(:focus-visible 을 이어받아도 직전 입력이 포인터면 — isKeyboardFocus)
        onFocus={(e) => {
          onFocus?.(e);
          if (e.defaultPrevented) return;
          if (isKeyboardFocus(e.currentTarget)) ctx.setFocused(true);
          else e.preventDefault();
        }}
        onBlur={(e) => {
          onBlur?.(e);
          ctx.setFocused(false);
          ctx.flag("blur");
        }}
        {...props}
      />
    );
  },
);
TooltipTrigger.displayName = "TooltipTrigger";

export interface TooltipContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
  "sideOffset" | "arrowPadding" | "collisionPadding"
> {
  /** 띄울 자리 — 기본 document.body. 다크가 하위 요소에 걸린 곳(카탈로그의 다크 판)에서 그 안의 요소로 */
  container?: HTMLElement | null;
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(
  (
    {
      className,
      children,
      container,
      side = "top",
      align = "center",
      onPointerEnter,
      onPointerLeave,
      onEscapeKeyDown,
      ...props
    },
    ref,
  ) => {
    const ctx = useTooltip("TooltipContent");
    const collisionPadding = useBubbleEdgePadding(
      ctx.triggerRef,
      ctx.open,
      side,
    );
    return (
      <TooltipPrimitive.Portal container={container}>
        <TooltipPrimitive.Content
          ref={ref}
          data-slot="tooltip-content"
          data-instant={ctx.instant ? "" : undefined}
          data-cut={ctx.cut ? "" : undefined}
          side={side}
          align={align}
          {...BUBBLE_POSITION}
          collisionPadding={collisionPadding}
          className={cn(BUBBLE, BUBBLE_TITLE, TOOLTIP_CUT, className)}
          onPointerEnter={(e) => {
            onPointerEnter?.(e);
            if (e.pointerType !== "touch") ctx.hover("content", true);
          }}
          onPointerLeave={(e) => {
            onPointerLeave?.(e);
            if (e.pointerType !== "touch") ctx.hover("content", false);
          }}
          onEscapeKeyDown={(e) => {
            onEscapeKeyDown?.(e);
            ctx.flag("escape");
          }}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow asChild width={12} height={8}>
            <BubbleArrow data-slot="tooltip-arrow" />
          </TooltipPrimitive.Arrow>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    );
  },
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
