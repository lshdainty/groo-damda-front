import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SCROLL_AUTO_HIDE_SYNC_EVENT } from "@/shared/ds/scroll-auto-hide";
import { scrollHostOf, type ScrollHost } from "@/shared/lib/groo/scroll-host";
import { closestScroller } from "@/shared/lib/groo/shell-scroller";

/*
 * 원장 스크롤 훅 — 컴포넌트 파일(`ledger.tsx`)과 갈라 둔다.
 * 한 파일이 컴포넌트와 그 밖의 것을 함께 export 하면 Fast Refresh 가 그 파일의 상태를
 * 매번 버린다(react-refresh/only-export-components).
 *
 * 머리를 숨기는 일은 ds Scroll Auto Hide(`LedgerPin`)가 맡는다 — 이 훅은 스크롤 스파이 · lock · 날 누름 이동만 한다.
 * 달 이동 줄(`LedgerBar`)과 주 달력(`LedgerKeep`)은 숨지 않으므로, 고른 날은 그 아래 맨 위 날짜 묶음을 따라간다.
 *
 * 펼친 월 달력 — 펼친 채 목록을 아래로 20 이상 내리기 시작하면 고른 날이 든 주로 접는다(onCollapse). 월 달력은 날을 고르는 도구이고,
 * 목록을 내린다는 건 고르기를 마치고 목록을 본다는 뜻이다(펼친 채 고정되면 470 안팎이 남아 목록 자리가 ~200 뿐). 맨 위(0)에서
 * 펼친 채로 있는 건 그대로, 날 누름 이동(lock) 중에는 접지 않는다.
 * 접을 때 목록이 튀지 않게 — 접기 직전 머리 아래 첫 묶음의 화면 y 를 접은 뒤에도 그대로 둔다(접힌 높이만큼 scrollTop 을 당긴다.
 * 펼칠 때 브라우저 스크롤 고정이 목록을 그 자리에 두는 것과 짝). 이 보정은 사람의 스크롤이 아니므로 머리 숨김(Scroll Auto Hide)에
 * 세지 않게 알린다 — 안 그러면 위로 당긴 만큼 총액이 드러나 묶음을 덮는다. 맨 위 근처라 당길 거리가 모자라면 0 에서 멈춘다.
 */
/** 펼친 달력을 접는 아래 스크롤 거리(px) */
export const LEDGER_COLLAPSE_SCROLL = 20;

/**
 * 스크롤 스파이([data-ledger-day] 그룹 → 선택 동기) · lock · 날 누름 이동 공용 훅.
 */
export function useLedgerScroll({
  initialSelected = null,
  expanded = false,
  onCollapse,
}: {
  initialSelected?: string | null;
  /** 월 달력을 펼쳤나 — 펼친 채 내리면 onCollapse 를 부른다 */
  expanded?: boolean;
  onCollapse?: () => void;
} = {}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const selectedRef = useRef<string | null>(initialSelected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const lockRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = (ms: number) => {
    lockRef.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lockRef.current = false;
    }, ms);
  };

  // 원장이 든 스크롤 상자 — 셸 본문이면 셸의 스크롤 주체(문서일 수도 있다), 안쪽 상자면 그 상자
  const scroller = (): ScrollHost | null => {
    const el = closestScroller(rootRef.current);
    return el ? scrollHostOf(el) : null;
  };

  // 펼침 — 펼친 뒤 가장 위로 올라간 자리부터 아래로 내린 거리를 잰다
  const expandedRef = useRef(expanded);
  const onCollapseRef = useRef(onCollapse);
  const lowestRef = useRef(0);
  const pendingRef = useRef<{ el: Element; y: number } | null>(null);
  useEffect(() => {
    onCollapseRef.current = onCollapse;
  });
  useEffect(() => {
    expandedRef.current = expanded;
    if (expanded) lowestRef.current = scroller()?.getTop() ?? 0;
  }, [expanded]);

  // 접은 뒤 — 맨 위 묶음의 화면 y 를 접기 전 그대로(브라우저 스크롤 고정이 이미 옮겼으면 남은 만큼만)
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (expanded || !pending) return;
    pendingRef.current = null;
    const p = scroller();
    if (!p) return;
    const drift = pending.el.getBoundingClientRect().top - pending.y;
    if (drift !== 0) p.setTop(p.getTop() + drift);
    p.eventTarget.dispatchEvent(new Event(SCROLL_AUTO_HIDE_SYNC_EVENT));
  }, [expanded]);

  const collapseFrom = () => {
    const pin = pinRef.current;
    const groups = rootRef.current?.querySelectorAll("[data-ledger-day]");
    if (pin && groups) {
      const bottom = pin.getBoundingClientRect().bottom;
      const top = Array.from(groups).find(
        (g) => g.getBoundingClientRect().bottom > bottom,
      );
      pendingRef.current = top
        ? { el: top, y: top.getBoundingClientRect().top }
        : null;
    }
    expandedRef.current = false;
    onCollapseRef.current?.();
  };

  useEffect(() => {
    const p = scroller();
    if (!p) return;
    const onScroll = () => {
      if (expandedRef.current && onCollapseRef.current) {
        const st = p.getTop();
        // 날 누름 이동(lock) 중 · 위로 올림 — 기준 자리만 옮긴다
        if (lockRef.current || st < lowestRef.current) lowestRef.current = st;
        else if (st - lowestRef.current >= LEDGER_COLLAPSE_SCROLL)
          collapseFrom();
      }
      if (lockRef.current || !pinRef.current || !rootRef.current) return;
      const bottom = pinRef.current.getBoundingClientRect().bottom;
      const groups = rootRef.current.querySelectorAll("[data-ledger-day]");
      if (!groups.length) return;
      let cur = groups[0]!.getAttribute("data-ledger-day");
      for (const g of groups) {
        if (g.getBoundingClientRect().top <= bottom + 28)
          cur = g.getAttribute("data-ledger-day");
        else break;
      }
      if (cur && selectedRef.current !== cur) {
        selectedRef.current = cur;
        setSelected(cur);
      }
    };
    p.eventTarget.addEventListener("scroll", onScroll, { passive: true });
    return () => p.eventTarget.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * 날을 눌러 그 날 묶음으로 옮긴다 — 묶음 윗변이 보이는 머리(고정 덩어리) 아래 끝에 딱 붙는다(틈 0 — 앱과 같다). 머리의 sticky top(상단 바 + 달 이동 줄)은 늘 보이고,
   * 아래로 가면 스크롤 방향 때문에 Keep 위(총액 · 요약)가 숨으니 Keep(주 달력)만 빼고, 위로 가면 머리 전체가 드러나니 전체를 뺀다
   * (Scroll Auto Hide — 내리면 숨고 올리면 드러난다).
   */
  const scrollToDay = (ds: string) => {
    const el = rootRef.current?.querySelector(`[data-ledger-day="${ds}"]`);
    const p = scroller();
    if (!el || !p) return;
    // 문서 좌표 — 상자 안 스크롤 위치 + 요소의 화면 위치 − 상자의 화면 위치(문서 스크롤이면 viewportTop 이 0)
    const top = p.getTop() + el.getBoundingClientRect().top - p.viewportTop();
    const pin = pinRef.current;
    const pinH = pin?.offsetHeight ?? 0;
    const stickyTop = pin
      ? Number.parseFloat(getComputedStyle(pin).top) || 0
      : 0;
    const keep = pin?.querySelector<HTMLElement>("[data-ledger-keep]");
    // 숨는 높이 — Keep 윗변까지(Keep 이 없으면 머리 전체)
    const hideH = keep ? keep.offsetTop : pinH;
    const downTarget = top - (stickyTop + pinH - hideH);
    p.scrollTo({
      top: downTarget > p.getTop() ? downTarget : top - (stickyTop + pinH),
      behavior: "smooth",
    });
  };
  const scrollToTop = () =>
    scroller()?.scrollTo({ top: 0, behavior: "smooth" });

  return {
    rootRef,
    pinRef,
    selected,
    setSelected,
    lock,
    scrollToDay,
    scrollToTop,
  };
}
