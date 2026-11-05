import * as React from "react";
import { useLocation } from "react-router-dom";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/index";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import {
  clampOffset,
  resolveAxis,
  shouldSnapClose,
  shouldSnapOpen,
  swipeSlotWidth,
  swipeTrayWidth,
  SWIPE_BADGE_SIZE,
  SWIPE_GAP_BETWEEN,
  SWIPE_GAP_LEAD,
  SWIPE_LABEL_GAP,
  SWIPE_MIN_HEIGHT,
  type SwipeAxis,
} from "@/shared/ui/swipe-actions-geometry";

/*
 * Groo SwipeActions — groo-design specs/components/swipe-actions.md SoT 미러.
 *
 * 리스트 행을 왼쪽으로 밀면 오른쪽에서 액션이 드러난다. 행을 다시 만들지 않고
 * **감싸기만** 한다 — 행의 시각도 탭 동작도 그대로다. 걷어내면 원래 리스트로 돌아간다.
 *
 * 액션은 고정 목록이 아니다. 항목마다 할 수 있는 일이 달라서 호출처가 1~3개를 조립한다.
 * 넘길 때는 [고정, 수정, 삭제] 처럼 **의미 순서 그대로** 넘긴다 — 그리는 쪽이 뒤집어
 * 파괴적 액션을 가장 안쪽에 놓는다(조금만 밀면 바깥쪽부터 드러나므로).
 *
 * 끝까지 밀어도 액션이 실행되지 않는다. 되돌리기가 없어서, 밀다가 손이 미끄러져
 * 지워지는 것보다 한 번 더 누르게 하는 편이 낫다.
 *
 * **모바일 전용이다**(spec Platform). 데스크톱에서는 `enabled={false}` 로 래핑 자체를
 * 걷어낸다 — 판정은 뷰포트 폭이고, 이 컴포넌트는 판정하지 않고 받기만 한다.
 *
 * 이 파일은 shared/ui 루트에서 유일하게 `ui/groo/` 를 참조한다(ConfirmDialog).
 * spec 이 "파괴적 액션의 확인은 컴포넌트가 소유한다" 로 규정하고, 확인 모양은 상세 화면의
 * 삭제와 **같아야** 하기 때문이다 — 여기서만 다른 다이얼로그를 띄우면 같은 항목의 삭제가
 * 경로에 따라 두 모양이 된다. 확인을 호출처로 올리면 화면마다 같은 배선이 복제되고,
 * 상세 경로와 스와이프 경로가 각자 확인을 띄워 두 번 묻는 구조로 가기 쉽다.
 */

/* ─── 그룹 (한 번에 한 행 · 스크롤하면 닫힘) ─────────────────────────── */

type SwipeEntry = { group: string; close: () => void };

type SwipeGroupApi = {
  register: (rowId: string, entry: SwipeEntry) => void;
  unregister: (rowId: string) => void;
  requestOpen: (group: string, rowId: string) => void;
  closeAll: () => void;
};

const SwipeGroupContext = React.createContext<SwipeGroupApi | null>(null);

/**
 * "한 번에 한 행만 열린다" 와 "리스트 스크롤 시 닫힌다" 를 맡는 조상.
 *
 * <p>AppLayout 의 모바일 셸에 **하나씩만** 둔다. 화면마다 두게 설계하면 리스트를 새로
 * 붙일 때 까먹어서 여러 행이 열린 채 남는다 — 앱이 실제로 그 버그를 겪고 컨테이너를
 * 루트 하나로 옮겼다.
 */
export function SwipeActionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const rows = React.useRef(new Map<string, SwipeEntry>());
  const openRow = React.useRef<string | null>(null);
  const location = useLocation();

  const api = React.useMemo<SwipeGroupApi>(() => {
    const closeAll = () => {
      for (const entry of rows.current.values()) entry.close();
      openRow.current = null;
    };
    return {
      register: (rowId, entry) => {
        rows.current.set(rowId, entry);
      },
      // 행이 사라지는 경로가 많다 — 월·필터·검색어 변경, 고정 토글로 인한 섹션 이동,
      // 삭제 후 목록 갱신. 해제하지 않으면 이미 없는 행의 close() 를 부르게 된다.
      unregister: (rowId) => {
        rows.current.delete(rowId);
        if (openRow.current === rowId) openRow.current = null;
      },
      requestOpen: (group, rowId) => {
        const prev = openRow.current;
        if (prev && prev !== rowId) {
          const entry = rows.current.get(prev);
          if (entry && entry.group === group) entry.close();
        }
        openRow.current = rowId;
      },
      closeAll,
    };
  }, []);

  // 스크롤하면 닫는다. viewport-fit 페이지는 .m-scroll 이 아니라 안쪽 overflow-y-auto 가
  // 스크롤러라, document 캡처 위임으로 셸 안 모든 세로 스크롤러를 듣는다(TabBar 와 같은 방식).
  React.useEffect(() => {
    const onScroll = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.closest(".m-app")) return;
      if (el.scrollHeight - el.clientHeight <= 10) return; // 가로 스크롤러(필터 칩 등) 제외
      api.closeAll();
    };
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener("scroll", onScroll, { capture: true });
  }, [api]);

  // 화면을 옮기면 열린 채로 남지 않게.
  React.useEffect(() => {
    api.closeAll();
  }, [api, location.pathname]);

  return (
    <SwipeGroupContext.Provider value={api}>
      {children}
    </SwipeGroupContext.Provider>
  );
}

/* ─── 액션 ─────────────────────────────────────────────────────────── */

/*
 * 색은 **배지**만 갖는다 — 트레이에 색을 깔면 행 옆에 박스가 하나 더 생긴 것처럼 보이고,
 * 색 덩어리가 화면을 반 갈라 행보다 먼저 눈에 들어온다.
 *
 * destructive 라벨만 다크에서 밝은 변형으로 갈린다(--status-danger-fg 가 그 alias).
 * --color-error 는 다크 surface 대비 3.0:1 로 본문 기준에 미달한다. 배지 **안** 아이콘은
 * 채움 위에 얹히므로 kind 무관 --fg-on-brand(= text-on-accent) 하나다.
 *
 * transform 은 쓰지 않는다(spec States) — 밀어 둔 트레이와 이중으로 움직여 어지럽다.
 */
const swipeActionVariants = cva(
  [
    "flex flex-col items-center justify-center shrink-0 self-stretch bg-transparent border-0",
    "text-caption font-semibold leading-[1.3]",
    "transition-[filter] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-easing)]",
    "hover:brightness-92 active:brightness-88",
    "focus-visible:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stroke-focus-ring",
    "disabled:bg-bg-disabled disabled:text-fg-disabled disabled:cursor-not-allowed disabled:hover:brightness-100",
  ].join(" "),
  {
    variants: {
      kind: {
        neutral:
          "text-[var(--fg-secondary)] [&_.swipe-badge]:bg-[var(--bg-muted)] [&_.swipe-badge]:text-[var(--fg-primary)]",
        primary:
          "text-[var(--fg-secondary)] [&_.swipe-badge]:bg-[var(--status-info)] [&_.swipe-badge]:text-[var(--fg-on-brand)]",
        destructive:
          "text-[var(--status-danger-fg)] [&_.swipe-badge]:bg-[var(--status-danger)] [&_.swipe-badge]:text-[var(--fg-on-brand)]",
      },
    },
    defaultVariants: { kind: "neutral" },
  },
);

/**
 * 확인 다이얼로그의 **제목과 확인 버튼은 액션 라벨을 그대로 쓴다** — 호출부가 정하지
 * 않는다. 정하게 두었더니 화면마다 "거래 삭제"·"할일 삭제"·"계좌 삭제" 로 갈렸고,
 * 앱은 같은 자리에서 전부 "삭제" 였다(앱 `PSwipeActions._run` 이 `action.label` 로
 * 강제해 갈릴 수가 없다). 무엇을 지우는지는 [message] 가 말한다.
 */
export interface SwipeConfirm {
  /**
   * 확인창 제목. **같은 항목을 상세에서 지울 때와 같은 문자열을 넘긴다** —
   * spec `alert-dialog` 의 "같은 동작이면 어디서 불렀든 제목·설명이 같다".
   * 컴포넌트가 감싼 행이 무엇인지 모르므로 그 행을 아는 호출부가 정한다.
   */
  title: string;
  /**
   * ConfirmDialog 는 `white-space` 지정 없는 `<p>` 에 넣는다 — `\n\n` 는 공백 하나로
   * 접히므로 줄을 나누려면 `<br />` 를 쓴다.
   */
  message: React.ReactNode;
  cancelLabel?: string;
  /**
   * 뮤테이션 pending. 기존 삭제 확인 3곳(거래·할일·메모 상세)이 전부 끝날 때까지
   * 다이얼로그를 열어 둔 채 스피너를 돌린다 — 스와이프만 즉시 닫으면 같은 삭제가
   * 두 거동이 되고 연타 시 DELETE 가 중복 발사된다.
   */
  loading?: boolean;
  /**
   * 확인한 일(`onSelect`)이 실패했을 때 — **필수**. 확인창을 닫은 뒤 부른다(호출부가 critical 스낵바 + [다시 시도]).
   * 전역 서버 원문 알림은 없으므로 이걸 빠뜨린 새 호출처는 실패가 아무 말 없이 지나간다.
   */
  onError: () => void;
}

interface SwipeActionBase extends VariantProps<typeof swipeActionVariants> {
  /** 한글 두 글자 권장 — 그보다 길면 48px 슬롯 안에서 줄바꿈된다. */
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Promise 를 돌려주면 컴포넌트가 pending 으로 잡는다. */
  onSelect: () => void | Promise<unknown>;
}

/**
 * `destructive` 는 `confirm` 이 **타입 수준에서 필수**다.
 *
 * spec 이 "파괴적 액션은 확인을 받는다" 를 규정하지만 문서로만 두면 새어 나간다 —
 * 되돌리기가 없어 회복 불가능한 실수다.
 *
 * 예외 하나 — `confirm: false`. 화면이 `onSelect` 에서 직접 ds Alert Dialog 를 띄워 묻는다(예산 · 저축 목표, I-28-3 ⑥).
 * 공용 확인창(옛 ConfirmDialog)을 거치지 않을 뿐 묻지 않는 것이 아니다 — 확인 없이 지우는 자리에 쓰지 않는다.
 */
export type SwipeAction =
  | (SwipeActionBase & { kind?: "neutral" | "primary"; confirm?: never })
  | (SwipeActionBase & {
      kind: "destructive";
      confirm: SwipeConfirm | false;
    });

export interface SwipeActionsProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "ref"
> {
  /**
   * 0~3개. 의미 순서 그대로 넘긴다 — 렌더는 컴포넌트가 뒤집는다.
   * **빈 배열이면 children 을 그대로 통과시킨다** — 행 단위로 액션이 성립하지 않는
   * 경우(시스템 생성 거래 등)는 `enabled` 가 아니라 이쪽이다.
   */
  actions: SwipeAction[];
  /** 리스트 안에서 안정된 행 식별자 — "한 번에 하나" 판정 키다. */
  rowId: string;
  /** 리스트 단위 그룹. 다른 그룹끼리는 서로 닫지 않는다. */
  groupTag?: string;
  /** 액션 접근명에 붙는 행 제목 — "삭제: 스타벅스". */
  rowLabel?: string;
  /**
   * spec Platform 의 **데스크톱 통과 전용** 스위치. 뷰포트 판정만 넣는다 —
   * 행 단위 조건을 여기 겹쳐 담지 않는다.
   */
  enabled?: boolean;
  children: React.ReactNode;
}

export const SwipeActions = React.forwardRef<HTMLDivElement, SwipeActionsProps>(
  function SwipeActions(
    {
      actions,
      rowId,
      groupTag = "default",
      rowLabel,
      enabled = true,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const group = React.useContext(SwipeGroupContext);
    const [open, setOpen] = React.useState(false);
    const [dragging, setDragging] = React.useState(false);
    const [pending, setPending] = React.useState<SwipeAction | null>(null);
    const [running, setRunning] = React.useState(false);

    const rowRef = React.useRef<HTMLDivElement>(null);
    const start = React.useRef<{ x: number; y: number; offset: number } | null>(
      null,
    );
    const axis = React.useRef<SwipeAxis>("none");
    const offset = React.useRef(0);
    /** 드래그였던 제스처의 click 은 삼킨다 — 밀고 손을 뗀 자리에서 상세가 열리면 안 된다. */
    const dragged = React.useRef(false);

    const trayWidth = swipeTrayWidth(actions.length);

    /**
     * 드래그 추종은 리렌더 없이 CSS 변수로만 반영한다. 가상 스크롤이 없어 리스트가
     * 전량 렌더되므로 move 마다 리렌더를 태우면 긴 목록에서 프레임이 죽는다.
     */
    const paint = (next: number) => {
      offset.current = next;
      rowRef.current?.style.setProperty("--swipe-offset", `${next}px`);
    };

    const close = React.useCallback(() => {
      setOpen(false);
      offset.current = 0;
      rowRef.current?.style.setProperty("--swipe-offset", "0px");
    }, []);

    // 그룹 등록/해제 — 해제를 빠뜨리면 이미 사라진 행의 close() 를 부르게 된다.
    React.useEffect(() => {
      if (!group) return;
      group.register(rowId, { group: groupTag, close });
      return () => group.unregister(rowId);
    }, [group, rowId, groupTag, close]);

    React.useEffect(() => {
      if (import.meta.env.DEV && !group) {
        console.warn(
          "[SwipeActions] SwipeActionsProvider 밖이다 — 한 번에 한 행만 열림·스크롤 시 닫힘이 동작하지 않는다.",
        );
      }
    }, [group]);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      start.current = { x: e.clientX, y: e.clientY, offset: offset.current };
      axis.current = "none";
      dragged.current = false;
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (!s) return;

      const rawX = e.clientX - s.x;
      const rawY = e.clientY - s.y;

      if (axis.current === "none") {
        const next = resolveAxis(rawX, rawY);
        if (next === "none") return;
        axis.current = next;
        // 세로로 확정되면 이번 제스처는 포기한다 — 스크롤은 브라우저가 처리 중이다.
        if (next === "y") {
          start.current = null;
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        dragged.current = true;
        setDragging(true);
        group?.requestOpen(groupTag, rowId);
      }

      // RTL 은 미는 방향이 뒤집힌다 — 트레이가 드러나는 거리를 양수로 맞춘다.
      const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
      paint(clampOffset(s.offset + (rtl ? rawX : -rawX), trayWidth));
    };

    const settle = () => {
      const s = start.current;
      start.current = null;
      if (axis.current !== "x") {
        axis.current = "none";
        return;
      }
      axis.current = "none";
      setDragging(false);

      // 열 때와 닫을 때가 다른 값을 쓴다 — 같은 값을 걸면 두 범위가 맞물려 아예 열리지 않는다.
      const wasOpen = (s?.offset ?? 0) > 0;
      const next = wasOpen
        ? !shouldSnapClose(offset.current, trayWidth)
        : shouldSnapOpen(offset.current, trayWidth);

      setOpen(next);
      paint(next ? trayWidth : 0);
      if (next) group?.requestOpen(groupTag, rowId);
    };

    /**
     * 액션 탭 — 트레이를 **먼저 닫고** 나서 실행한다(spec Behavior).
     * 열어 둔 채 다이얼로그를 띄우면 취소하고 돌아왔을 때 그대로 열려 있고,
     * 실행한 경우엔 사라진 행 자리에 트레이만 남는다.
     */
    const select = (action: SwipeAction) => {
      close();
      if (action.confirm) {
        setPending(action);
        return;
      }
      void action.onSelect();
    };

    const runPending = async () => {
      const action = pending;
      if (!action) return;
      setRunning(true);
      try {
        await action.onSelect();
        setPending(null);
      } catch {
        // 확인창을 닫고 호출부가 알리게 한다(onError 는 confirm 이 있는 액션에서 필수다)
        setPending(null);
        if (action.confirm) action.confirm.onError();
      } finally {
        setRunning(false);
      }
    };

    if (!enabled || actions.length === 0) return <>{children}</>;

    return (
      <>
        <div
          ref={ref}
          className={cn(
            "relative overflow-hidden bg-[var(--bg-surface)]",
            // 세로 스크롤은 브라우저에 남긴다 — preventDefault 로 가져오면 관성·바운스가
            // OS 것과 달라진다. 가로로 미는 동안 선택 핸들·콜아웃이 뜨면 제스처가 죽는다.
            "touch-pan-y select-none [-webkit-touch-callout:none]",
            "[--swipe-offset:0px] [--swipe-dir:-1] rtl:[--swipe-dir:1]",
            className,
          )}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              close();
              rowRef.current?.focus();
            }
          }}
          {...props}
        >
          {/* 트레이는 행 뒤에 늘 있다. 접혀 있을 땐 스크린리더에서 감춘다 —
              안 그러면 행마다 "수정 삭제" 를 읽는다. */}
          <div className="absolute inset-y-0 end-0 flex" aria-hidden={!open}>
            {/* 역순 — 조금만 밀면 바깥쪽부터 드러나므로, 순서대로 두면 파괴적 액션이
                제일 먼저 손에 닿는다. 호출처는 의미 순서 그대로 넘긴다. */}
            {[...actions].reverse().map((action, i) => (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                tabIndex={open ? 0 : -1}
                aria-label={
                  rowLabel ? `${action.label}: ${rowLabel}` : action.label
                }
                className={swipeActionVariants({ kind: action.kind })}
                // 간격을 배지 앞에만 둬 마지막 액션이 트레이 끝에 딱 붙는다.
                style={{
                  inlineSize: swipeSlotWidth(i),
                  paddingInlineStart:
                    i === 0 ? SWIPE_GAP_LEAD : SWIPE_GAP_BETWEEN,
                  minBlockSize: SWIPE_MIN_HEIGHT,
                  gap: SWIPE_LABEL_GAP,
                }}
                onClick={() => select(action)}
              >
                <span
                  className="swipe-badge flex items-center justify-center rounded-full [&>svg]:size-[18px]"
                  style={{
                    inlineSize: SWIPE_BADGE_SIZE,
                    blockSize: SWIPE_BADGE_SIZE,
                  }}
                >
                  {action.icon}
                </span>
                {action.label}
              </button>
            ))}
          </div>

          <div
            ref={rowRef}
            // 배경은 바깥 래퍼가 쥔다 — 여기에 불투명 배경을 깔면 호출처가 래퍼에 준
            // 강조 배경(가계부 포커스 하이라이트)이 완전히 가려진다.
            className={cn(
              "relative bg-inherit",
              !dragging &&
                "transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-easing)] motion-reduce:transition-none",
            )}
            style={{
              transform:
                "translateX(calc(var(--swipe-dir) * var(--swipe-offset)))",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={settle}
            onPointerCancel={settle}
            // 열려 있으면 탭은 닫기만 한다 — 열어 둔 걸 못 보고 누르는 경우가 많다.
            // capture 단계라 행 안쪽 버튼(할일 체크 등)의 stopPropagation 보다 먼저 잡는다.
            onClickCapture={(e) => {
              if (!open && !dragged.current) return;
              e.preventDefault();
              e.stopPropagation();
              dragged.current = false;
              close();
            }}
          >
            {children}
          </div>
        </div>

        {/* 확인 다이얼로그는 트레이 밖 형제로 — Radix Portal 이 body 에 붙어
            트레이가 접혀도 살아남는다. */}
        {pending?.confirm && (
          <ConfirmDialog
            // 제목은 호출부가 넘긴다 — 상세 경로와 같은 문구여야 한다(spec alert-dialog).
            // 확인 버튼만 액션 라벨 그대로 — 방금 누른 버튼의 연장이라 경로와 무관하다.
            title={pending.confirm.title}
            message={pending.confirm.message}
            confirmLabel={pending.label}
            cancelLabel={pending.confirm.cancelLabel}
            danger={pending.kind === "destructive"}
            loading={running || pending.confirm.loading}
            onCancel={() => setPending(null)}
            onConfirm={() => void runPending()}
          />
        )}
      </>
    );
  },
);
