import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

import {
  SWIPE_BADGE_SIZE,
  SWIPE_GAP_BETWEEN,
  SWIPE_GAP_LEAD,
  SWIPE_MIN_HEIGHT,
  clampOffset,
  resolveAxis,
  settleOpen,
  swipeActionVariants,
  swipeBadgeVariants,
  swipeSlotWidth,
  swipeTrayWidth,
  type SwipeAxis,
} from "./swipe-actions-variants";

/*
 * Groo Swipe Actions — groo 에만 있는 패턴(SEED 에는 줄 밀기가 없다). 수치 원본은 groo-design specs/components/swipe-actions.yaml
 * (값은 src/shared/ds/spec/swipe-actions.json). groo-design recipes/shadcn/components/ui/swipe-actions.tsx 를 첫 판으로 가져왔다.
 *
 *   SwipeActions          폰(768 미만) 목록 줄을 감싼다 — 왼쪽으로 밀면 오른쪽에서 동작 칸이 드러난다. actions(1 ~ 3개 —
 *                         { kind, label, icon, disabled, onSelect }, 뜻의 차례로) · enabled(폰일 때만 true — 768 이상이면 false 로 넘겨
 *                         줄만 그린다. 데스크톱 통과 전용 — 줄에서 동작이 성립하지 않으면 actions={[]}) · rowLabel("삭제: 스타벅스").
 *                         동작을 누르면 트레이를 닫은 뒤 onSelect. 감싼 줄은 tabIndex -1 로 초점을 받을 수 있고, 열린 트레이를 Esc 로
 *                         닫으면 초점을 줄로 옮긴다
 *   SwipeActionsProvider  목록의 조상 — 한 번에 한 줄만 열리고(다른 줄을 끌면 열린 줄이 닫힌다), 스크롤하면 닫힌다. 줄 하나는
 *                         다른 줄의 상태를 모른다. 폰 셸마다 하나(화면마다 새로 두지 않는다)
 *   SwipeActionCell       동작 한 칸(원형 배지 + 라벨) — 트레이가 쓴다. 카탈로그 견본이 칸 하나를 직접 보일 수 있게 내보낸다
 *
 * 줄을 다시 만들지 않는다 — 기존 줄을 감싸기만 한다. 끝까지 밀어도 실행하지 않는다(되돌리기가 없다). 열린 채 줄을 누르면 닫기만 한다.
 * 닫힌 트레이는 aria-hidden · 버튼 tabindex -1(줄마다 "수정 삭제" 를 읽지 않게). 동작 이름은 "라벨: 줄 제목".
 * 제스처: 데드존 8 · 축 1.5배 · 세로는 브라우저에 남긴다(touch-action: pan-y) · 미는 동안 글 고르기 · 길게 누름 메뉴를 막는다 ·
 *   열기 40% · 닫기 25%. 끄는 동안은 손가락을 1:1 로 따라가고, 놓은 뒤 자리를 잡는 것만 150ms 감속(모션 줄이기면 바로).
 *   RTL 은 미는 방향이 뒤집힌다(--swipe-dir). 미는 동안 놓은 뒤의 click 은 삼킨다(밀고 나서 상세로 들어가지 않게).
 *
 * 레시피와 다른 자리 — ① 열림 상태를 조상(Provider)이 들면 그 값 하나로 읽는다(옛 상태가 남아 다른 줄이 열릴 때 되살아나지 않게).
 *   ② 끄는 위치를 상태로 둔다(다시 그려도 children 은 같은 요소라 줄 안은 건드리지 않는다) — 명령형 style 은 React 의 값과 어긋난다.
 *   ③ 동작 칸을 SwipeActionCell 로 나눴다(칸 하나를 견본으로 재려고). ④ 손 메모이제이션 · useCallback 없음.
 */

export interface SwipeAction extends VariantProps<typeof swipeActionVariants> {
  /** 라벨 — 한글 두 글자 동사("수정" · "삭제" · "고정"). 그보다 길면 줄바꿈된다 */
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /**
   * destructive 는 여기서 바로 지우지 말고 확인 창(Alert Dialog)부터 — 제목 · 설명은 상세에서 지울 때와 같은 문구를 부르는 쪽이 넘긴다.
   * 트레이는 먼저 닫히고 나서 부른다 — 열어 둔 채 띄우면 취소하고 돌아왔을 때 그대로 열려 있다.
   */
  onSelect: () => void;
}

// ── 한 번에 한 줄 ─────────────────────────────────────────────
type SwipeActionsContextValue = {
  openId: string | null;
  setOpenId: React.Dispatch<React.SetStateAction<string | null>>;
};

const SwipeActionsContext =
  React.createContext<SwipeActionsContextValue | null>(null);

/**
 * 목록의 조상 — 한 번에 한 줄만 열리고, 목록(또는 화면)을 스크롤하면 열린 줄이 닫힌다.
 * closeKey: 바뀌면 열린 줄을 닫는다 — 셸이 화면(경로)을 넘길 때 쓴다(옛 줄은 사라져도 열림 표식이 남지 않게)
 */
function SwipeActionsProvider({
  children,
  closeKey,
}: {
  children?: React.ReactNode;
  closeKey?: string;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [seenKey, setSeenKey] = React.useState(closeKey);
  // 렌더 중 상태 맞추기 — 키가 바뀐 그 렌더에서 바로 닫는다(효과로 미루면 한 프레임 열린 채 그려진다)
  if (seenKey !== closeKey) {
    setSeenKey(closeKey);
    setOpenId(null);
  }
  React.useEffect(() => {
    if (openId == null) return;
    const close = () => setOpenId(null);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [openId]);
  return (
    <SwipeActionsContext.Provider value={{ openId, setOpenId }}>
      {children}
    </SwipeActionsContext.Provider>
  );
}
SwipeActionsProvider.displayName = "SwipeActionsProvider";

// ── 동작 칸 ───────────────────────────────────────────────────
export interface SwipeActionCellProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onSelect"
> {
  action: SwipeAction;
  /** 트레이 안 자리 — 0 이 가장 안쪽(화면에서 가장 왼쪽): 앞 간격 20, 다음부터 12 */
  index?: number;
  /** 동작 이름에 붙는 줄 제목 — "삭제: 스타벅스" */
  rowLabel?: string;
}

const SwipeActionCell = React.forwardRef<
  HTMLButtonElement,
  SwipeActionCellProps
>(({ action, index = 0, rowLabel, className, style, ...props }, ref) => {
  const kind = action.kind ?? "neutral";
  return (
    <button
      ref={ref}
      type="button"
      disabled={action.disabled}
      aria-label={rowLabel ? `${action.label}: ${rowLabel}` : action.label}
      data-slot="swipe-action"
      data-kind={kind}
      className={cn(swipeActionVariants({ kind }), className)}
      // 간격을 배지 앞에만 둬 마지막 동작이 트레이 끝에 딱 붙는다 — 칸 폭 첫 56 · 다음부터 48
      style={{
        inlineSize: swipeSlotWidth(index, action.label),
        paddingInlineStart: index === 0 ? SWIPE_GAP_LEAD : SWIPE_GAP_BETWEEN,
        minBlockSize: SWIPE_MIN_HEIGHT,
        ...style,
      }}
      {...props}
    >
      <span
        aria-hidden
        data-slot="swipe-action-badge"
        className={swipeBadgeVariants({
          kind,
          disabled: !!action.disabled,
        })}
        style={{ inlineSize: SWIPE_BADGE_SIZE, blockSize: SWIPE_BADGE_SIZE }}
      >
        {action.icon}
      </span>
      <span data-slot="swipe-action-label">{action.label}</span>
    </button>
  );
});
SwipeActionCell.displayName = "SwipeActionCell";

// ── 줄 감싸기 ─────────────────────────────────────────────────
export interface SwipeActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 1 ~ 3개 — 뜻의 차례로(그리는 쪽이 뒤집어 destructive 를 가장 안쪽에 둔다). 비면 줄만 그린다 */
  actions: SwipeAction[];
  /** 폰(768 미만)일 때만 true — false 면 트레이 없이 줄만 그린다(데스크톱 통과 전용) */
  enabled?: boolean;
  /** 동작 이름에 붙는 줄 제목 — "삭제: 스타벅스". 열린 트레이를 훑을 때 어느 줄인지 알 수 있게 */
  rowLabel?: string;
  children: React.ReactNode;
}

type Gesture = { x: number; y: number; from: number; pointerId: number };

const SwipeActions = React.forwardRef<HTMLDivElement, SwipeActionsProps>(
  (
    {
      actions,
      enabled = true,
      rowLabel,
      className,
      children,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const group = React.useContext(SwipeActionsContext);
    const id = React.useId();
    const [localOpen, setLocalOpen] = React.useState(false);
    /** 끄는 동안의 위치(px) — 끄지 않을 땐 null */
    const [drag, setDrag] = React.useState<number | null>(null);
    const rowRef = React.useRef<HTMLDivElement>(null);
    const gesture = React.useRef<Gesture | null>(null);
    const axis = React.useRef<SwipeAxis>("none");
    /** 가장 최근 끄는 위치 — 놓는 순간 판정에 쓴다(상태는 아직 다시 그려지기 전일 수 있다) */
    const last = React.useRef(0);
    /** 끌고 난 뒤의 click 은 삼킨다 — 밀었다가 놓는 자리가 줄 위라 click 이 따라온다 */
    const swallowClick = React.useRef(false);

    // 칸은 안쪽(뒤 동작)부터 놓이므로 뒤집은 차례로 글 폭을 본다
    const tray = swipeTrayWidth([...actions].reverse().map((a) => a.label));
    const open = group ? group.openId === id : localOpen;
    const offset = drag ?? (open ? tray : 0);

    const commit = (next: boolean) => {
      if (group) {
        // 함수로 갱신한다 — 같은 틱에 다른 줄이 열렸을 수 있다
        if (next) group.setOpenId(id);
        else group.setOpenId((current) => (current === id ? null : current));
      } else {
        setLocalOpen(next);
      }
    };

    if (!enabled || actions.length === 0) return <>{children}</>;

    const finish = (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      gesture.current = null;
      if (axis.current !== "x") {
        axis.current = "none";
        return;
      }
      axis.current = "none";
      if (e.currentTarget.hasPointerCapture?.(g?.pointerId ?? e.pointerId)) {
        e.currentTarget.releasePointerCapture(g?.pointerId ?? e.pointerId);
      }
      setDrag(null);
      swallowClick.current = true;
      // 열 때와 닫을 때가 다른 문턱 — 같은 값을 걸면 두 범위가 맞물려 아예 열리지 않는다
      commit(settleOpen((g?.from ?? 0) > 0, last.current, tray));
    };

    return (
      <div
        ref={ref}
        data-slot="swipe-actions"
        data-state={open ? "open" : "closed"}
        className={cn(
          // 트랙은 칠하지 않는다 — 놓인 면이 그대로 보인다. 세로 스크롤은 브라우저에 남긴다(pan-y)
          // 줄과 트레이는 같은 칸에 겹쳐 쌓는다(grid) — 높이는 둘 중 큰 쪽이라 큰 글자로 트레이 칸이 더 높아도 잘리지 않는다
          "relative grid touch-pan-y overflow-hidden select-none [-webkit-touch-callout:none]",
          // RTL 은 미는 방향이 뒤집힌다 — 줄이 움직이는 쪽의 부호
          "[--swipe-dir:-1] rtl:[--swipe-dir:1]",
          className,
        )}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          // 열린 트레이를 Esc 로 닫고 초점을 줄로 — 숨긴 트레이 버튼에 초점이 남지 않게
          if (e.key === "Escape" && open) {
            commit(false);
            rowRef.current?.focus({ preventScroll: true });
          }
        }}
        {...props}
      >
        {/* 트레이는 줄 뒤에 늘 있다. 닫혀 있을 땐 보조 기술에서 감춘다 — 안 그러면 줄마다 "수정 삭제" 를 읽는다. */}
        <div
          data-slot="swipe-actions-tray"
          className="col-start-1 row-start-1 flex justify-self-end"
          aria-hidden={!open}
        >
          {/* 뒤집어 그린다 — 조금만 밀면 바깥쪽부터 드러나므로, 차례대로 두면 파괴적 동작이 제일 먼저 손에 닿는다 */}
          {[...actions].reverse().map((action, i) => (
            <SwipeActionCell
              key={action.label}
              action={action}
              index={i}
              rowLabel={rowLabel}
              tabIndex={open ? 0 : -1}
              // 트레이를 먼저 닫고 실행한다 — 열어 둔 채 확인 창을 띄우면 취소하고 돌아왔을 때 그대로 열려 있다
              onClick={() => {
                commit(false);
                action.onSelect();
              }}
            />
          ))}
        </div>

        <div
          ref={rowRef}
          tabIndex={-1}
          data-slot="swipe-actions-row"
          className={cn(
            // 줄은 원래 높이 — 56 보다 낮으면 56(트레이가 더 높으면 그만큼). 남는 높이에는 내용을 가운데에 둔다
            "relative col-start-1 row-start-1 flex min-h-[56px] flex-col justify-center bg-bg-layer-default",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
            // 끄는 동안에는 손가락을 1:1 로 따라간다 — 손을 뗀 뒤 자리를 잡을 때만 전환을 쓴다(모션 줄이기면 바로)
            drag == null &&
              "[transition:transform_var(--motion-duration-d3)_var(--motion-ease-enter)] motion-reduce:[transition:none]",
          )}
          style={{
            transform: `translateX(calc(var(--swipe-dir) * ${offset}px))`,
          }}
          onPointerDown={(e) => {
            swallowClick.current = false;
            gesture.current = {
              x: e.clientX,
              y: e.clientY,
              from: open ? tray : 0,
              pointerId: e.pointerId,
            };
            last.current = open ? tray : 0;
            axis.current = "none";
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (!g) return;
            const dx = e.clientX - g.x;
            const dy = e.clientY - g.y;
            if (axis.current === "none") {
              const next = resolveAxis(dx, dy);
              if (next === "none") return;
              axis.current = next;
              // 세로로 확정되면 이번 제스처는 포기한다 — 스크롤은 브라우저가 맡고, 손을 뗄 때까지 가로로 되돌리지 않는다
              if (next === "y") return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              // 이 줄을 끌기 시작했다 — 열려 있던 다른 줄은 닫힌다
              group?.setOpenId(id);
            }
            if (axis.current !== "x") return;
            // RTL 은 미는 방향이 뒤집힌다 — 트레이가 드러나는 거리를 양수로 맞춘다
            const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
            last.current = clampOffset(g.from + (rtl ? dx : -dx), tray);
            setDrag(last.current);
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          // 열려 있으면 누르기는 닫기만 한다(열어 둔 걸 못 보고 누르는 일이 많다). 밀고 난 뒤의 click 은 삼킨다
          onClickCapture={(e) => {
            // 다른 줄이 열려 있으면 이 누름은 그 줄을 닫기만 한다(시트 · 이동을 열지 않는다) — 호출처가 따로 알 필요가 없다
            if (
              !open &&
              !swallowClick.current &&
              group?.openId != null &&
              group.openId !== id
            ) {
              e.preventDefault();
              e.stopPropagation();
              group.setOpenId(null);
              return;
            }
            if (!open && !swallowClick.current) return;
            const wasSwipe = swallowClick.current;
            swallowClick.current = false;
            e.preventDefault();
            e.stopPropagation();
            if (!wasSwipe) commit(false);
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);
SwipeActions.displayName = "SwipeActions";

export { SwipeActions, SwipeActionCell, SwipeActionsProvider };
