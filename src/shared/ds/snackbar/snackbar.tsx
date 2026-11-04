import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import {
  SnackbarContext,
  type SnackbarContextValue,
  type SnackbarOptions,
  type SnackbarTone,
} from "./snackbar-context";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Snackbar — 구조는 SEED Snackbar(2026-10-02). 수치 원본은 groo-design
 * specs/components/snackbar.yaml(값은 src/shared/ds/spec/snackbar.json).
 * groo-design recipes/shadcn/components/ui/snackbar.tsx 를 첫 판으로 가져왔다(앱 적용 1A) — 옵션 타입 · useSnackbar ·
 * 컨텍스트는 snackbar-context.ts 다(컴포넌트 파일은 컴포넌트만 내보낸다 — 빠른 새로 고침).
 * 옛 Sonner(sonner.tsx — 흰 카드 · 위 가운데 · 3장 쌓기)를 대신한다.
 *
 *   SnackbarProvider      앱 맨 위에 한 번 둔다 — 화면 아래 가운데 자리(region)를 body 끝에 그린다
 *   useSnackbar()         show({ message, tone?, action? }) · dismiss() — snackbar-context.ts
 *   SnackbarAvoidOverlap  탭 바 · 바닥 버튼 · 플로팅 버튼처럼 화면 아래에 붙은 것을 감싼다 — 띠가 그 위 8 에 선다
 *   SnackbarView          카탈로그(/dev/ds)가 띠 하나를 제자리에 그릴 때만 쓴다 — 화면은 쓰지 않는다(index.ts 가 내보내지 않는다)
 *
 * 띠는 방금 한 일의 결과 · 뒤에서 끝난 일 · 다시 하면 되는 가벼운 실패만 알린다. 조치가 필요한 오류는 그 자리의
 * Callout · Result Section 이고, 시트 · 대화상자 안에서 한 일은 그 안 Callout 으로 알린다(스낵바는 닫힌 뒤에).
 *
 * 모양 — 짙은 띠(bg-neutral-inverted, 다크는 밝은 띠) · 최소 44 · 여백 10 + 글 좌우 6 · 모서리 8 · 그림자 없음 · 최대 464.
 *   tone neutral(기본)은 아이콘이 없고 positive(체크) · critical(느낌표)만 아이콘 24 를 둔다 — 상자 24 안에 오른쪽 2 를
 *   두어(SEED 와 같은 border-box) 글은 띠 가장자리에서 16, 아이콘이 있으면 40 에서 시작한다. 아이콘 · 액션은 반전 짝 색
 *   (v115 — fg-positive-inverted · fg-critical-inverted · fg-brand-inverted). 글은 t4 · 400 · 단어 단위 줄바꿈이고 줄을
 *   자르지 않는다. 액션은 하나 — t4 · 700, 누르는 영역은 글 + 좌우 8 × 44, 누르면 글만 2px 거리 축소.
 *
 * 시간 — 4초, 액션이 있으면 6초. 마우스를 올리거나 · 손가락으로 누르고 있거나 · 키보드 초점(focus-visible)이 안에
 *   있으면 멈추고, 셋 다 끝나면 처음부터 다시 센다. 한 번에 하나 — 새 show() 는 지금 띠를 바로 내보내고(100ms) 새 띠를
 *   띄운다. 다만 지금 띠에 액션(되돌리기 · 다시 시도)이 있으면 그 띠는 끝날 때까지(시간 · 액션 · 닫기) 지키고 새 띠는 그 뒤에
 *   뜬다(2026-10-22 사용자 결정 1B). 기다리는 띠는 하나 — 내보내는 중이거나 액션 띠를 기다리는 중에 또 오면 마지막 것만 남는다.
 *   액션을 누르면 그 일을 하고 닫는다. Esc · 밀기 · 글 누르기로는 닫히지 않는다 — 닫기 버튼 · 시간 · 액션으로만.
 *
 * 모션 — 나타남 150ms enter(가운데에서 0.8 → 1 + 투명도) · 사라짐 100ms exit(→ 0.8 + 투명도). 모션 줄이기면 투명도만.
 *   애니메이션은 tw-animate-css(animate-in · animate-out)로 그린다 — 없으면 바로 바뀐다.
 *
 * 접근성 — 자리는 role="region"(이름 "알림") + aria-live="polite", 띠는 role="status" + aria-atomic. 띠가 뜰 때 초점을
 *   옮기지 않는다. Tab 은 띠(tabindex 0) → 액션 → 닫기. 닫기는 평소에 보이지 않고(보조 기술은 읽는다) 키보드 초점이
 *   오면 띠 오른쪽 끝에 X 16 · 상자 44 로 보인다. 사라지는 동안은 aria-hidden — 초점이 띠 안에 있었으면 먼저
 *   띠에 들어오기 전 자리로 돌려준다(띠와 함께 body 로 떨어지지 않게).
 *   포커스 링은 띠 글자색(fg-neutral-inverted) 2px — 링이 늘 띠 위에 그려지게 액션은 바깥 2 띄우고, 띠 · 닫기는 안쪽에
 *   2 띄운다(바깥에 그리면 페이지 위라 라이트는 흰 페이지 위 흰 링, 다크는 짙은 페이지 위 짙은 링이 된다).
 *
 * 시트 · 대화상자 위 — 자리는 z L6(z-snackbar 400, specs/z-index.md)이고 body 끝에 둔다. Radix 대화상자 · 시트가 열리면
 *   body 가 pointer-events: none 이 되므로 띠는 pointer-events: auto 로 직접 받는다. 자리는 pointerdown 을 위로 올리지
 *   않는다 — Radix 의 "바깥 누름"(document 의 pointerdown)이 띠 누름을 보지 못해 시트 · 대화상자가 닫히지 않고 액션이
 *   먹는다(dialog.tsx 는 고치지 않는다). 다른 방식으로 바깥 누름을 재는 레이어는 onPointerDownOutside 같은 자리에서
 *   `(e.target as Element).closest("[data-slot=snackbar-region]")` 이면 막는다. 열린 Radix 모달이 aria-hidden 으로
 *   나머지를 가려도 aria-live 자리는 남는다(aria-hidden 패키지가 aria-live 를 건너뛴다).
 *
 * 피할 자리 — SnackbarAvoidOverlap 으로 감싼 요소들 중 가장 위 요소의 윗변 + 8 에 띠가 선다(바닥 안전 영역보다
 *   높을 때). 감싼 요소가 붙고 · 떨어지고 · 크기가 바뀌고 · 창 크기가 바뀌고 · 새 띠가 뜰 때 다시 잰다(스크롤은 재지
 *   않는다 — 스크롤하는 본문 요소는 감싸지 않는다). 자리가 옮겨 갈 때는 200ms easing, 모션 줄이기면 바로.
 *
 * 화면 키보드도 피할 자리다 — 띠는 키보드 바로 위 8 에 선다(2026-10-15 사용자 결정 Q-003-1). 폰 브라우저는 키보드가 올라와도
 *   레이아웃 화면을 줄이지 않아 position: fixed 의 아래가 키보드 뒤에 남는다 — 보이는 화면(visualViewport)의 아래 끝에서 레이아웃 화면
 *   아래까지를 재어 피할 자리와 둘 중 큰 쪽을 쓴다. 보이는 화면이 바뀔 때 다시 잰다(손가락으로 확대한 동안은 세지 않는다).
 *
 * 손 메모이제이션을 두지 않는다 — 레시피가 useCallback · useMemo 로 묶어 두던 것(닫기 · 걷기 · 재기 · 내려 줄 값)은
 *   늘 같은 것(useReducer 의 dispatch, 처음 그릴 때 한 번 만든 값)으로 바꿨다. 테스트는 컴파일하지 않은 코드를 돌므로,
 *   그것을 기다리는 이펙트(시간 · 걷기 · 피할 자리 등록)가 Provider 가 다시 그릴 때마다 다시 돌지 않게 하려는 것이다.
 */

// 시간(snackbar.yaml root.duration) — 액션이 있으면 6초(사용자 결정 2026-10-02)
const DURATION = 4000;
const DURATION_WITH_ACTION = 6000;

// ── 상태 — 떠 있는 띠 하나 + 그 뒤를 기다리는 것 하나 ──────────────
type Entry = { id: number; options: SnackbarOptions; open: boolean };
type State = {
  entry: Entry | null;
  pending: SnackbarOptions | null;
  nextId: number;
};
type Action =
  | { type: "show"; options: SnackbarOptions }
  | { type: "close"; id: number }
  | { type: "dismiss" }
  | { type: "exited"; id: number };

function reducer(state: State, action: Action): State {
  const { entry } = state;
  switch (action.type) {
    case "show":
      if (!entry)
        return {
          entry: { id: state.nextId, options: action.options, open: true },
          pending: null,
          nextId: state.nextId + 1,
        };
      // 액션(되돌리기 · 다시 시도)이 달린 띠는 끝날 때까지(시간 · 액션 · 닫기) 지킨다 — 새 띠는 기다렸다가 그 뒤에 뜬다(마지막 것만).
      // 사용자 결정 1B(2026-10-22) — SEED React strategy "queued" 를 이 경우에만
      if (entry.open && entry.options.action)
        return { ...state, pending: action.options };
      // 지금 띠를 내보내고 새 띠는 기다린다 — 내보내는 중에 또 오면 마지막 것만 남는다
      return {
        ...state,
        entry: entry.open ? { ...entry, open: false } : entry,
        pending: action.options,
      };
    case "close":
      // 그 띠만 닫는다 — 액션이 show() 를 불러 이미 새 띠를 기다리게 했으면 그대로 둔다
      return entry?.id === action.id && entry.open
        ? { ...state, entry: { ...entry, open: false } }
        : state;
    case "dismiss":
      return {
        ...state,
        entry: entry?.open ? { ...entry, open: false } : entry,
        pending: null,
      };
    case "exited":
      if (entry?.id !== action.id || entry.open) return state;
      if (!state.pending) return { ...state, entry: null };
      return {
        entry: { id: state.nextId, options: state.pending, open: true },
        pending: null,
        nextId: state.nextId + 1,
      };
  }
}

const INITIAL_STATE: State = { entry: null, pending: null, nextId: 1 };

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

// ── 모양 ─────────────────────────────────────────────────────
// 자리 — 화면 아래 가운데, 좌우 · 아래 8(+ 안전 영역). 아래는 안전 영역과 피할 자리(--snackbar-avoid) 중 큰 쪽.
// 비어 있을 때 누름을 막지 않게 자리는 pointer-events: none, 띠만 받는다
const REGION = [
  "pointer-events-none fixed inset-x-0 z-(--z-snackbar) flex flex-col items-center pb-x2",
  "pl-[calc(var(--spacing-x2)_+_env(safe-area-inset-left))] pr-[calc(var(--spacing-x2)_+_env(safe-area-inset-right))]",
  "bottom-[max(env(safe-area-inset-bottom),var(--snackbar-avoid,0px))]",
  "[transition:bottom_var(--motion-duration-d4)_var(--motion-ease-easing)] motion-reduce:transition-none",
].join(" ");

// 띠 — 나타남 150ms enter · 사라짐 100ms exit, 가운데에서 0.8 ↔ 1 · 투명도(모션 줄이기면 투명도만).
// 사라지는 동안은 누르지 않고, 끝난 모습(투명)을 지켜 걷기 전에 번쩍이지 않는다. duration-* 은 transition-duration 도
// 주므로(transition-property 기본값 all) 띠는 transition-none — 포커스 링 · 색이 애니메이션 시간만큼 번지지 않는다
const ROOT = [
  "pointer-events-auto relative flex min-h-[44px] w-full max-w-[464px] items-center rounded-r2 bg-bg-neutral-inverted p-x2_5 font-sans text-fg-neutral-inverted transition-none",
  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-fg-neutral-inverted",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-[var(--motion-duration-d3)] data-[state=open]:ease-[var(--motion-ease-enter)] motion-safe:data-[state=open]:zoom-in-80",
  "data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:fill-mode-forwards data-[state=closed]:duration-[var(--motion-duration-d2)] data-[state=closed]:ease-[var(--motion-ease-exit)] motion-safe:data-[state=closed]:zoom-out-80",
].join(" ");

// 아이콘 — 상자 24 안에 오른쪽 2(그림은 22). 장식이다 — 성공 · 실패는 글이 말한다
const ICON = "size-[24px] shrink-0 pr-x0_5";
const TONE_ICON: Record<
  Exclude<SnackbarTone, "neutral">,
  { Icon: typeof CircleCheck; color: string }
> = {
  positive: { Icon: CircleCheck, color: "text-fg-positive-inverted" },
  critical: { Icon: CircleAlert, color: "text-fg-critical-inverted" },
};

// 글과 액션 — 좌우 6, 양 끝(사이 적어도 10)
const CONTENT =
  "flex min-w-0 flex-1 items-center justify-between gap-x2_5 px-x1_5";
const MESSAGE =
  "min-w-0 text-t4 font-normal break-keep [overflow-wrap:break-word]";

// 액션 — 보이는 상자는 글, 누르는 영역은 ::before 로 글 + 좌우 8 × 44. 누르면 글만 2px 거리 축소(기준 max(높이, 폭 ÷ 4, 24))
const ACTION = [
  "relative shrink-0 cursor-pointer whitespace-nowrap rounded-r1 text-t4 font-bold text-fg-brand-inverted",
  "before:absolute before:-inset-x-x2 before:top-1/2 before:h-[44px] before:-translate-y-1/2 before:content-['']",
  "[--press-basis:24] [transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)] active:[scale:calc(1-2/var(--press-basis))] motion-reduce:active:[scale:1]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-neutral-inverted",
].join(" ");

// 닫기 — 평소에는 보이지 않는다(보조 기술용). 키보드 초점이 오면 띠 오른쪽 끝에 상자 44 · X 16 — 위 · 아래 · 오른쪽
// 바깥 여백 −10 으로 띠 높이를 늘리지 않는다
const CLOSE = [
  "absolute -m-px size-px cursor-pointer overflow-hidden [clip-path:inset(50%)] [&>svg]:size-[16px] [&>svg]:shrink-0",
  "focus-visible:static focus-visible:-my-x2_5 focus-visible:-mr-x2_5 focus-visible:ml-0 focus-visible:flex focus-visible:size-[44px] focus-visible:shrink-0 focus-visible:items-center focus-visible:justify-center focus-visible:overflow-visible focus-visible:rounded-r2 focus-visible:[clip-path:none]",
  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-fg-neutral-inverted",
].join(" ");

// 누르는 순간 기준 길이 max(높이, 폭 ÷ 4, 24) 를 --press-basis 로(Button · Chip 과 같은 식). Space · Enter 에서도 잰다
function measurePress(el: HTMLElement) {
  el.style.setProperty(
    "--press-basis",
    String(Math.max(el.offsetHeight, el.offsetWidth / 4, 24)),
  );
}

const isPressKey = (e: React.KeyboardEvent) =>
  e.key === " " || e.key === "Enter";

// "0.1s" · "100ms" → ms(여럿이면 첫째)
function toMs(value: string) {
  const v = value.split(",")[0]?.trim() ?? "";
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith("ms") ? n : n * 1000;
}

// 액션 — 그 일을 하고 닫는다(일이 던져도 닫는다). 컴포넌트 밖에 둔다 — React Compiler 는 catch 없는 try(… finally)를
// 다루지 못해(BuildHIR), 레시피처럼 띠의 onClick 안에 두면 띠 컴포넌트를 통째로 건너뛴다
function runThenClose(run: () => void, close: () => void) {
  try {
    run();
  } finally {
    close();
  }
}

// ── 띠 하나 ──────────────────────────────────────────────────
// 닫기 · 걷기는 Provider 의 dispatch 로 알린다 — dispatch 는 늘 같아, 시간 · 걷기 이펙트가 Provider 가 다시 그릴 때마다
// 다시 돌지 않는다(레시피는 useCallback 으로 묶은 onClose · onExited 를 받았다)
function SnackbarItem({
  entry,
  dispatch,
}: {
  entry: Entry;
  dispatch: React.Dispatch<Action>;
}) {
  const dsT = useDsText();
  const { id, open, options } = entry;
  const { message, tone = "neutral", action } = options;
  const ref = React.useRef<HTMLDivElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [keyboard, setKeyboard] = React.useState(false);
  // 한 번에 여러 show() 가 오면 앞 띠는 닫힌 채로 붙는다 — 그려진 적 없는 띠는 사라지는 모습 없이 바로 걷는다
  const [mountedOpen] = React.useState(open);
  const paused = hovered || pressed || keyboard;
  const duration = action ? DURATION_WITH_ACTION : DURATION;

  // 시간 — 멈춘 동안은 세지 않고, 멈춤이 끝나면 처음부터 다시 센다
  React.useEffect(() => {
    if (!open || paused) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "close", id }),
      duration,
    );
    return () => window.clearTimeout(timer);
  }, [open, paused, duration, id, dispatch]);

  // 누름은 띠 밖에서 떼도 끝난다
  React.useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [pressed]);

  // 사라지기 시작 — 초점이 안에 있으면 먼저 들어오기 전 자리로 돌려주고 aria-hidden 을 단다(초점을 가린 채 두지 않는다).
  // 사라지는 애니메이션이 끝나면 걷는다 — 애니메이션이 없으면 바로
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (open || !el) return;
    if (!mountedOpen) {
      dispatch({ type: "exited", id });
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && el.contains(active)) {
      const back = returnFocus.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
      else active.blur();
    }
    el.setAttribute("aria-hidden", "true");
    const style = getComputedStyle(el);
    if (style.animationName === "none") {
      dispatch({ type: "exited", id });
      return;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "exited", id }),
      toMs(style.animationDuration) + toMs(style.animationDelay) + 50,
    );
    return () => window.clearTimeout(timer);
  }, [open, id, dispatch, mountedOpen]);

  const icon = tone === "neutral" ? null : TONE_ICON[tone];

  return (
    <div
      ref={ref}
      role="status"
      aria-atomic="true"
      tabIndex={open ? 0 : -1}
      data-slot="snackbar"
      data-tone={tone}
      data-state={open ? "open" : "closed"}
      className={ROOT}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={() => setPressed(true)}
      onFocus={(e) => {
        // 띠 밖에서 들어온 초점이면 그 자리를 기억한다 — 띠가 사라질 때 돌려준다
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          returnFocus.current = e.relatedTarget as HTMLElement | null;
        if ((e.target as HTMLElement).matches(":focus-visible"))
          setKeyboard(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setKeyboard(false);
      }}
      onAnimationEnd={(e) => {
        if (!open && e.target === e.currentTarget)
          dispatch({ type: "exited", id });
      }}
    >
      {icon && (
        <icon.Icon
          aria-hidden
          data-slot="snackbar-icon"
          className={cn(ICON, icon.color)}
        />
      )}
      <div data-slot="snackbar-content" className={CONTENT}>
        <span data-slot="snackbar-message" className={MESSAGE}>
          {message}
        </span>
        {action && (
          <button
            type="button"
            data-slot="snackbar-action"
            className={ACTION}
            onPointerDown={(e) => measurePress(e.currentTarget)}
            onKeyDown={(e) => {
              if (isPressKey(e)) measurePress(e.currentTarget);
            }}
            onClick={() =>
              runThenClose(action.onClick, () =>
                dispatch({ type: "close", id }),
              )
            }
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        data-slot="snackbar-close"
        aria-label={dsT("common.close")}
        className={CLOSE}
        onClick={() => dispatch({ type: "close", id })}
      >
        <X aria-hidden />
      </button>
    </div>
  );
}

// ── 자리 ─────────────────────────────────────────────────────
// 피할 자리 — 감싼 요소들 중 가장 위 요소의 윗변에서 화면 아래까지(띠는 그 위 8 — 자리의 아래 여백).
// Provider 하나에 하나 — 처음 그릴 때 한 번 만들고 그대로 쓴다(레시피는 ref · useCallback 으로 같은 일을 했다)
function createAvoidance(setOffset: (offset: number) => void) {
  const avoided = new Set<HTMLElement>();
  let observer: ResizeObserver | null = null;
  const measure = () => {
    if (typeof document === "undefined") return;
    const viewport = document.documentElement.clientHeight;
    let top = viewport;
    for (const el of avoided) {
      // 모달(시트 · 대화상자)이 열려 있으면 Radix 가 그 밖을 aria-hidden 으로 가린다 — 가려진 탭 바 · 플로팅 버튼은
      // 사용자가 누를 수 없는 자리라 피하지 않는다(안 그러면 시트 바닥 버튼 위 8 이 아니라 탭 바 위 8 에 선다)
      if (el.closest('[aria-hidden="true"], [inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) top = Math.min(top, r.top);
    }
    // 화면 키보드 — 보이는 화면(visualViewport)의 아래 끝이 레이아웃 화면 아래보다 위면 그 차이(키보드가 가린 높이).
    // 손가락으로 확대한 동안(scale ≠ 1)은 세지 않는다
    const vv = window.visualViewport;
    const keyboard =
      vv && Math.abs(vv.scale - 1) < 0.01
        ? viewport - (vv.offsetTop + vv.height)
        : 0;
    setOffset(Math.max(0, viewport - top, Math.round(keyboard)));
  };
  const avoid = (el: HTMLElement) => {
    avoided.add(el);
    if (typeof ResizeObserver !== "undefined") {
      observer ??= new ResizeObserver(() => measure());
      observer.observe(el);
    }
    measure();
    return () => {
      avoided.delete(el);
      observer?.unobserve(el);
      measure();
    };
  };
  const disconnect = () => {
    observer?.disconnect();
    observer = null;
  };
  return { measure, avoid, disconnect };
}

function SnackbarProvider({ children }: { children?: React.ReactNode }) {
  const dsT = useDsText();
  const [state, dispatch] = React.useReducer(reducer, INITIAL_STATE);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const [avoidOffset, setAvoidOffset] = React.useState(0);
  // 피할 자리 · 내려 줄 값은 처음 그릴 때 한 번 만든다(useState 초기값) — 늘 같은 것이라 그것을 기다리는 이펙트가
  // Provider 가 다시 그릴 때마다 다시 돌지 않는다
  const [avoidance] = React.useState(() => createAvoidance(setAvoidOffset));
  const [value] = React.useState<SnackbarContextValue>(() => ({
    api: {
      show: (options) => dispatch({ type: "show", options }),
      dismiss: () => dispatch({ type: "dismiss" }),
    },
    avoid: avoidance.avoid,
  }));

  // 자리는 마운트 뒤 body 끝에 그린다(서버 렌더링 대비)
  React.useEffect(() => {
    setContainer(document.body);
    window.addEventListener("resize", avoidance.measure);
    // 화면 키보드가 올라오고 내려갈 때 · 보이는 화면이 밀릴 때
    const vv = window.visualViewport;
    vv?.addEventListener("resize", avoidance.measure);
    vv?.addEventListener("scroll", avoidance.measure);
    return () => {
      window.removeEventListener("resize", avoidance.measure);
      vv?.removeEventListener("resize", avoidance.measure);
      vv?.removeEventListener("scroll", avoidance.measure);
      avoidance.disconnect();
    };
  }, [avoidance]);

  // 새 띠가 뜰 때도 다시 잰다 — 크기는 그대로 자리만 옮긴 바닥 요소가 있을 수 있다
  const shownId = state.entry?.open ? state.entry.id : null;
  React.useEffect(() => {
    if (shownId !== null) avoidance.measure();
  }, [shownId, avoidance]);

  const region = (
    <div
      role="region"
      aria-label={dsT("snackbar.region")}
      aria-live="polite"
      data-slot="snackbar-region"
      className={REGION}
      style={{ "--snackbar-avoid": `${avoidOffset}px` } as React.CSSProperties}
      // 띠 누름을 Radix 의 바깥 누름(document 의 pointerdown)으로 보내지 않는다 — 열린 시트 · 대화상자가 닫히지 않는다
      onPointerDown={(e) => e.stopPropagation()}
    >
      {state.entry && (
        <SnackbarItem
          key={state.entry.id}
          entry={state.entry}
          dispatch={dispatch}
        />
      )}
    </div>
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {container && createPortal(region, container)}
    </SnackbarContext.Provider>
  );
}
SnackbarProvider.displayName = "SnackbarProvider";

// ── 피할 자리 ─────────────────────────────────────────────────
// 자식 하나(ref 를 받는 요소)를 감싼다 — 탭 바 · 바닥 버튼 · 플로팅 버튼. Provider 밖이면 아무것도 하지 않는다
function SnackbarAvoidOverlap({ children }: { children: React.ReactElement }) {
  const ctx = React.useContext(SnackbarContext);
  const ref = React.useRef<HTMLElement>(null);
  const avoid = ctx?.avoid;
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!avoid || !el) return;
    return avoid(el);
  }, [avoid]);
  return <Slot ref={ref}>{children}</Slot>;
}
SnackbarAvoidOverlap.displayName = "SnackbarAvoidOverlap";

// ── 카탈로그용 띠 ──────────────────────────────────────────────
// 카탈로그(/dev/ds)가 띠 하나를 제자리에 그릴 때 — 레시피의 띠(SnackbarItem) 그대로라 모양 · 멈춤 · 초점은 같고,
// 시간 · 닫기 · 액션은 아무것도 걷지 않는다(닫히지 않는다). 화면은 이것을 쓰지 않는다 — useSnackbar().show 로
// 띄운다(자리 · 시간 · 한 번에 하나는 SnackbarProvider 가 맡는다)
const keepOpen: React.Dispatch<Action> = () => {};

function SnackbarView(options: SnackbarOptions) {
  return (
    <SnackbarItem entry={{ id: 0, options, open: true }} dispatch={keepOpen} />
  );
}
SnackbarView.displayName = "SnackbarView";

export { SnackbarProvider, SnackbarAvoidOverlap, SnackbarView };
