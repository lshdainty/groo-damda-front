import * as React from "react";
import { Plus } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { NotificationBadge } from "@/shared/ds/notification-badge";

import {
  BottomNavigationContext,
  isAt,
  measurePress,
  prefersReducedMotion,
  resolveRoot,
  useBottomNavigation,
  useKeyboardOpen,
  type ScrollRoot,
} from "./bottom-navigation-context";
import {
  ADD,
  ADD_CIRCLE,
  CELL_COUNT,
  CELL_GAP,
  ADD_CIRCLE_COMPACT,
  ADD_CIRCLE_REGULAR,
  EXPAND_AFTER,
  IGNORED_SCROLL,
  ITEM,
  ITEM_CURRENT,
  ITEM_OTHER,
  LABEL,
  LABEL_SHOWN,
  NARROW_CELL,
  ROOT,
  ROOT_COMPACT,
  ROOT_REGULAR,
  SHRINK_AFTER,
  TOP_ZONE,
} from "./bottom-navigation-variants";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Bottom Navigation — groo 의 떠 있는 알약(2026-10-04 사용자 결정 4B · 5A · 6B · 7A). 규칙은 SEED Bottom Navigation
 * (5칸 · 라벨 5자 · 최대 480 · 배지 2칸 · 글자 크기 설정을 따르지 않음). 수치 원본은 groo-design specs/components/bottom-navigation.yaml
 * (값은 src/shared/ds/spec/bottom-navigation.json). recipes/shadcn/components/ui/bottom-navigation.tsx 를 첫 판으로 가져왔다.
 *
 *   BottomNavigation           바(<nav aria-label="주 메뉴">) — Desk 앱 · Desk 웹 768 미만의 주 메뉴. 칸 다섯(홈 · 가계부 · + · 캘린더 · 전체)이
 *                              어느 화면에서나 같다. compact · defaultCompact · onCompactChange(손으로 다룰 때), scrollRoot(줄어들기를 셀
 *                              스크롤 상자 — 주지 않으면 화면 안의 세로 스크롤 모두). 줄어든 바를 누르면 펴진다
 *   BottomNavigationItem       탭 칸(<a>) — href · icon(lucide) · label(한글 5자 이내) · current(aria-current="page") ·
 *                              notification(알림 점 — 칸 이름 뒤에 "새 소식") · onReselect(지금 탭을 다시 눌렀을 때)
 *   BottomNavigationAddButton  가운데 +(<button type="button">) — 그 화면의 추가. aria-label 필수("거래 추가" · "일정 추가")
 *   BOTTOM_NAVIGATION_INSET    본문 아래 여백 CSS 식(bottom-navigation-variants.ts) — 셸이 본문 스크롤의 padding-bottom 에 쓴다(마지막 줄이 바 위 24 에서 끝난다)
 *
 * 줄어들기 — 아래로 20 이상 스크롤하면 줄어들고(48), 위로 28 이상 스크롤하거나 맨 위 40 안으로 오면 펴진다(스크롤 방향이 바뀌면 다시 센다).
 *   가로 스크롤 · 시트 · 대화상자 · 떠 있는 목록(팝오버) 안의 스크롤은 세지 않는다. 줄어든 바 어디를 눌러도 펴진다 — 칸을 눌렀으면 그 탭으로도 간다.
 *   줄어들어도 칸마다 이름은 남는다(라벨은 보이지 않게만 — sr-only). 라벨은 줄어들기 시작할 때 사라지고 다 펴진 뒤(200ms) 나타난다.
 *   화면 키보드가 열리면 바를 가린다(visualViewport 가 화면보다 150 넘게 작을 때).
 *   보는 화면이 바뀌어도 펴진다 — 셸이 screenKey(주소 · 화면 안 Tabs 로 고른 화면)를 주면 값이 바뀔 때 편다. 같은 화면의 쿼리(?month= 등)만
 *   바뀌면 셸이 같은 값을 주어 그대로 둔다. 새 화면의 스크롤(뒤로 와서 돌려놓는 스크롤 · 짧아진 본문에 깎인 스크롤)은 사용자가 다시 만지기
 *   (휠 · 터치 · 키 · 누르기) 전까지 거리로 세지 않고 위치만 적는다 — 돌려놓은 스크롤이 바를 곧바로 다시 줄이지 않게.
 *   펴질 때(누르기 · 위로 스크롤 · 화면 바뀜)는 스크롤 거리를 처음부터 다시 센다 — 남은 거리 때문에 조금만 내려도 바로 다시 줄지 않게.
 * 좁은 칸 — 칸 폭이 + 원 44 보다 좁으면(320 보다 좁은 화면 — 페이지 확대, Layout "지원 폭") 줄어든 바처럼 라벨을 숨기고(이름은 sr-only 로
 *   남는다) + 원을 36 으로 둔다. 칸 폭은 바를 재서(ResizeObserver) 안쪽 폭 − 칸 사이 ÷ 5 로 낸다 — data-narrow. 320 이상은 걸리지 않는다.
 * 다시 누르기 — 지금 탭(current)을 누르면 링크로 옮기지 않고(같은 주소를 쌓지 않는다) onReselect 를 부른다(그 칸의 onClick 대신).
 *   onReselect 를 주지 않으면: 맨 위로 스크롤하고, 지금 주소가 그 탭의 첫 화면(href)이 아니면 주소를 href 로 고쳐 간다(location.replace).
 *   라우터를 쓰는 셸은 onReselect 에서 navigate(href, { replace: true }) 와 받은 scrollToTop() 을 부른다. 탭마다 스크롤을 기억하는 것은 셸의 몫이다.
 *
 * 바: 떠 있는 알약 — 펼침 66(위아래 6 · 좌우 10) · 화면 끝에서 좌우 14 · 아래 max(14, 아래 안전 영역 − 6), 줄어듦 48(위아래 0 · 좌우 8) ·
 *   좌우 36 · 아래 max(12, 아래 안전 영역 − 8). 좌우 안전 영역을 더한다. 최대 480 으로 가운데. 칸 다섯을 똑같이 나눈다(사이 2).
 *   불투명 bg-layer-floating(흐림 없음) · shadow-s3(다크는 -dark 짝) · 안쪽 1px stroke-neutral-subtle · 모서리 full · z-sticky 50.
 * 칸: 아이콘 24 위 · 라벨 아래(사이 2), 라벨 t1 11 / 15 · 500 고정 크기(text-t1-static — 글자 크기 설정을 따르지 않는다) · 한 줄.
 *   지금 탭은 아이콘 · 라벨 fg-neutral + 선 2.5, 다른 탭은 fg-neutral-subtle + 선 2 — 브랜드 색으로 칠하지 않는다. 굵기 · 크기는 그대로.
 *   알림 점은 Notification Badge small(아이콘 상자 x 17 ~ 23 · y 1 ~ 7) — 2칸까지(SEED — 셋째부터는 달지 않는다).
 * 가운데 +: 칸 전체가 누르는 자리, 브랜드 원 44(bg-brand-solid) + 흰 + 24(선 2.5) · 줄어듦 원 36 + 20. 라벨이 없다.
 * 상태: 호버 모양이 없다. 칸은 누르면 2px 거리 축소만(색은 그대로 — 손을 떼기 전에 고른 것처럼 보이지 않게, 기준 max(높이, 폭 ÷ 4, 24)),
 *   + 는 bg-brand-solid-pressed + 원 2px 거리 축소. 키보드 포커스에만 링 — 칸은 안쪽 2px(모서리 12), + 는 원 바깥 2px.
 * 모션: 펼침 ↔ 줄어듦 200ms easing(높이 · 자리 · 여백) · 누름 150ms pressed-scale. 모션 줄이기면 바로 바뀌고 축소하지 않는다.
 * 스낵바는 바 위 8 에 뜬다 — 바를 SnackbarAvoidOverlap 으로 감싼다(ref 는 바에 닿는다). 바가 있는 화면에 Floating Action Button 을 두지 않는다.
 *
 * 레시피와 다른 자리 — ① 문맥 · 훅 · 도우미는 bottom-navigation-context.ts, 클래스 · 상수는 -variants.ts(컴포넌트 파일은 컴포넌트만).
 * ② 라벨 글자(11 / 15 · 500)는 보이지 않는 라벨(sr-only)에도 그대로 둔다(스펙의 label.typography 가 줄어든 바에서도 같다). ③ 손 메모이제이션(useMemo · useCallback)을 걷었다(React Compiler) — 줄어들기 · 키보드는 ref 에 최신 값을 두고 한 번만 붙인 리스너가 읽는다.
 * ④ 라벨 숨김은 effect 안의 동기 setState 대신 "compact || 아직 다 펴지지 않음" 으로 풀고 기다림은 타이머가 맡는다(lint react-hooks/set-state-in-effect).
 * ⑤ 화면 키보드 감지는 useSyncExternalStore. ⑥ 알림 배지 3칸 이상에 대한 개발 경고(console)는 뺐다.
 */

// ── 바 ───────────────────────────────────────────────────────
export interface BottomNavigationProps extends React.HTMLAttributes<HTMLElement> {
  /** 줄어든 바 — 주면 제어한다(줄어들기 · 펴지기를 onCompactChange 로 알린다) */
  compact?: boolean;
  defaultCompact?: boolean;
  onCompactChange?: (compact: boolean) => void;
  /** 줄어들기를 셀 스크롤 상자 — 주지 않으면 화면 안의 세로 스크롤 모두(시트 · 가로 줄 빼고) */
  scrollRoot?: ScrollRoot;
  /** 보는 화면 — 바뀌면 바를 편다(주소 · 화면 안 Tabs 로 고른 화면). 같은 화면의 쿼리만 바뀌면 같은 값을 준다 */
  screenKey?: string;
}

const BottomNavigation = React.forwardRef<HTMLElement, BottomNavigationProps>(
  (
    {
      compact: compactProp,
      defaultCompact = false,
      onCompactChange,
      scrollRoot,
      screenKey,
      className,
      onClick,
      children,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const navRef = React.useRef<HTMLElement | null>(null);
    const [inner, setInner] = React.useState(defaultCompact);
    const controlled = compactProp !== undefined;
    const compact = controlled ? compactProp : inner;
    const compactRef = React.useRef(compact);
    const onChangeRef = React.useRef(onCompactChange);
    const controlledRef = React.useRef(controlled);
    const scrollRootRef = React.useRef(scrollRoot);
    React.useEffect(() => {
      compactRef.current = compact;
      onChangeRef.current = onCompactChange;
      controlledRef.current = controlled;
      scrollRootRef.current = scrollRoot;
    });
    const setCompact = (next: boolean) => {
      if (next === compactRef.current) return;
      compactRef.current = next;
      if (!controlledRef.current) setInner(next);
      onChangeRef.current?.(next);
    };
    const setCompactRef = React.useRef(setCompact);
    React.useEffect(() => {
      setCompactRef.current = setCompact;
    });

    // 라벨 — 줄어들기 시작하면 바로 숨기고(compact), 펴질 때는 다 펴진 뒤(200ms) 보인다. 모션 줄이기면 바로
    const [labelsShown, setLabelsShown] = React.useState(!compact);
    React.useEffect(() => {
      const duration =
        compact || prefersReducedMotion()
          ? 0
          : parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--motion-duration-d4",
              ),
            ) || 200;
      const timer = window.setTimeout(() => setLabelsShown(!compact), duration);
      return () => window.clearTimeout(timer);
    }, [compact]);

    // 좁은 칸 — 바 안쪽 폭에서 칸 폭을 내어 + 원 44 보다 좁으면 라벨을 숨기고 원을 36 으로(잰 값은 콜백에서만 상태로)
    const [narrow, setNarrow] = React.useState(false);
    React.useLayoutEffect(() => {
      const bar = navRef.current;
      if (!bar || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? bar.clientWidth;
        const cell = (width - CELL_GAP * (CELL_COUNT - 1)) / CELL_COUNT;
        setNarrow(width > 0 && cell < NARROW_CELL);
      });
      observer.observe(bar);
      return () => observer.disconnect();
    }, []);
    const labelsHidden = compact || !labelsShown || narrow;

    // 줄어들기 — 세로 스크롤마다 방향별로 거리를 센다(방향이 바뀌면 다시). 펴질 때 · 화면이 바뀔 때 처음부터 다시 센다.
    // settling — 화면이 바뀐 뒤 사용자가 다시 만지기 전의 스크롤(복원 · 깎임)은 위치만 적고 거리로 세지 않는다
    const countRef = React.useRef({
      direction: 0,
      distance: 0,
      settling: false,
    });
    React.useEffect(() => {
      if (compact) return;
      countRef.current.direction = 0;
      countRef.current.distance = 0;
    }, [compact]);
    // 보는 화면이 바뀌면 편다(처음 그릴 때는 그대로)
    const screenRef = React.useRef(screenKey);
    React.useEffect(() => {
      if (screenRef.current === screenKey) return;
      screenRef.current = screenKey;
      countRef.current = { direction: 0, distance: 0, settling: true };
      setCompactRef.current(false);
    }, [screenKey]);
    const lastScrolledRef = React.useRef<Element | null>(null);
    React.useEffect(() => {
      const lastY = new WeakMap<Element, number>();
      const count = () => countRef.current;
      const doc = document;
      if (doc.scrollingElement)
        lastY.set(doc.scrollingElement, doc.scrollingElement.scrollTop);
      const onScroll = (e: Event) => {
        const target = e.target === doc ? doc.scrollingElement : e.target;
        if (!(target instanceof Element)) return;
        const box = resolveRoot(scrollRootRef.current);
        if (
          box
            ? target !== box
            : target !== doc.scrollingElement && target.closest(IGNORED_SCROLL)
        )
          return;
        const y = target.scrollTop;
        const prev = lastY.get(target);
        lastY.set(target, y);
        // 가로 스크롤 — 세로 위치가 그대로다
        if (prev === undefined || y === prev) {
          if (prev === undefined && y <= TOP_ZONE) setCompactRef.current(false);
          return;
        }
        lastScrolledRef.current = target;
        const c = count();
        if (y <= TOP_ZONE) {
          c.direction = 0;
          c.distance = 0;
          setCompactRef.current(false);
          return;
        }
        // 새 화면의 스크롤 복원 · 깎임 — 위치만 적었다(위)
        if (c.settling) return;
        const next = y > prev ? 1 : -1;
        if (next !== c.direction) {
          c.direction = next;
          c.distance = 0;
        }
        c.distance += Math.abs(y - prev);
        if (c.direction === 1 && c.distance >= SHRINK_AFTER)
          setCompactRef.current(true);
        else if (c.direction === -1 && c.distance >= EXPAND_AFTER)
          setCompactRef.current(false);
      };
      // 사용자가 다시 만지면(휠 · 터치 · 키 · 누르기 — 스크롤바 끌기 포함) 그다음 스크롤부터 센다
      const settle = () => {
        count().settling = false;
      };
      const inputs = ["wheel", "touchstart", "keydown", "pointerdown"];
      doc.addEventListener("scroll", onScroll, {
        capture: true,
        passive: true,
      });
      for (const type of inputs)
        doc.addEventListener(type, settle, { capture: true, passive: true });
      return () => {
        doc.removeEventListener("scroll", onScroll, { capture: true });
        for (const type of inputs)
          doc.removeEventListener(type, settle, { capture: true });
      };
    }, []);

    const keyboardOpen = useKeyboardOpen();

    const scrollToTop = () => {
      const behavior: ScrollBehavior = prefersReducedMotion()
        ? "auto"
        : "smooth";
      const box =
        resolveRoot(scrollRootRef.current) ??
        (lastScrolledRef.current?.isConnected ? lastScrolledRef.current : null);
      if (box && box !== document.scrollingElement)
        box.scrollTo({ top: 0, behavior });
      window.scrollTo({ top: 0, behavior });
    };

    return (
      <BottomNavigationContext.Provider
        value={{ compact, labelsHidden, narrow, scrollToTop }}
      >
        <nav
          ref={(node) => {
            navRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          aria-label={dsT("bottomNavigation.label")}
          data-slot="bottom-navigation"
          data-compact={compact || undefined}
          data-narrow={narrow || undefined}
          className={cn(
            ROOT,
            compact ? ROOT_COMPACT : ROOT_REGULAR,
            keyboardOpen && "invisible",
            className,
          )}
          // 줄어든 바 어디를 눌러도 펴진다 — 칸을 눌렀으면 그 탭으로도 간다
          onClick={(e) => {
            onClick?.(e);
            if (compactRef.current) setCompact(false);
          }}
          {...props}
        >
          {children}
        </nav>
      </BottomNavigationContext.Provider>
    );
  },
);
BottomNavigation.displayName = "BottomNavigation";

// ── 칸 ───────────────────────────────────────────────────────
export interface BottomNavigationItemProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children"
> {
  href: string;
  /** lucide 선 아이콘 — 24, 선 2(지금 탭 2.5) */
  icon: React.ReactNode;
  /** 라벨 — 한글 5자 이내의 명사. 줄어든 바에서도 칸의 이름으로 남는다 */
  label: string;
  /** 지금 탭 — aria-current="page" */
  current?: boolean;
  /** 알림 점 — 칸 이름 뒤에 "새 소식". 2칸까지 */
  notification?: boolean;
  /** 지금 탭을 다시 눌렀을 때(onClick 대신) — 주지 않으면 맨 위로 + 첫 화면(href)이 아니면 주소를 고쳐 간다 */
  onReselect?: (detail: { href: string; scrollToTop: () => void }) => void;
}

const BottomNavigationItem = React.forwardRef<
  HTMLAnchorElement,
  BottomNavigationItemProps
>(
  (
    {
      href,
      icon,
      label,
      current = false,
      notification = false,
      onReselect,
      className,
      onClick,
      onPointerDown,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const dsT = useDsText();
    const ctx = useBottomNavigation("BottomNavigationItem");
    return (
      <a
        ref={ref}
        href={href}
        aria-current={current ? "page" : undefined}
        data-slot="bottom-navigation-item"
        data-current={current || undefined}
        data-notification={notification || undefined}
        className={cn(ITEM, current ? ITEM_CURRENT : ITEM_OTHER, className)}
        onPointerDown={(e) => {
          measurePress(e.currentTarget);
          onPointerDown?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") measurePress(e.currentTarget);
          onKeyDown?.(e);
        }}
        onClick={(e) => {
          if (!current) {
            onClick?.(e);
            return;
          }
          // 지금 탭 — 같은 주소를 쌓지 않는다. 새 탭으로 여는 누르기는 브라우저에 맡긴다
          if (
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
          )
            return;
          e.preventDefault();
          if (onReselect) {
            onReselect({ href, scrollToTop: ctx.scrollToTop });
            return;
          }
          ctx.scrollToTop();
          if (!isAt(href)) window.location.replace(href);
        }}
        {...props}
      >
        <NotificationBadge aria-hidden visible={notification}>
          {icon}
        </NotificationBadge>
        <span
          data-slot="bottom-navigation-label"
          className={cn(LABEL, ctx.labelsHidden ? "sr-only" : LABEL_SHOWN)}
        >
          {label}
        </span>
        {notification && <span className="sr-only">{dsT("common.news")}</span>}
      </a>
    );
  },
);
BottomNavigationItem.displayName = "BottomNavigationItem";

// ── 가운데 + ────────────────────────────────────────────────
export interface BottomNavigationAddButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children" | "aria-label"
> {
  /** 그 화면의 추가 — "거래 추가"(홈 · 가계부 · 전체) · "일정 추가"(캘린더) */
  "aria-label": string;
}

const BottomNavigationAddButton = React.forwardRef<
  HTMLButtonElement,
  BottomNavigationAddButtonProps
>(({ className, ...props }, ref) => {
  const { compact, narrow } = useBottomNavigation("BottomNavigationAddButton");
  return (
    <button
      ref={ref}
      type="button"
      data-slot="bottom-navigation-add"
      className={cn(ADD, className)}
      {...props}
    >
      <span
        aria-hidden
        data-slot="bottom-navigation-add-circle"
        className={cn(
          ADD_CIRCLE,
          compact || narrow ? ADD_CIRCLE_COMPACT : ADD_CIRCLE_REGULAR,
        )}
      >
        <Plus />
      </span>
    </button>
  );
});
BottomNavigationAddButton.displayName = "BottomNavigationAddButton";

export { BottomNavigation, BottomNavigationItem, BottomNavigationAddButton };
