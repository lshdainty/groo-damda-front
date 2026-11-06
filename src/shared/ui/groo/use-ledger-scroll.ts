import { useEffect, useRef, useState } from "react";

/*
 * 원장 스크롤 훅 — 컴포넌트 파일(`ledger.tsx`)과 갈라 둔다.
 * 한 파일이 컴포넌트와 그 밖의 것을 함께 export 하면 Fast Refresh 가 그 파일의 상태를
 * 매번 버린다(react-refresh/only-export-components).
 *
 * 머리를 숨기는 일은 ds Scroll Auto Hide(`LedgerPin`)가 맡는다 — 이 훅은 스크롤 스파이 · lock · 날 누름 이동만 한다.
 * 달 이동 줄(`LedgerBar`)과 주 달력(`LedgerKeep`)은 숨지 않으므로, 고른 날은 그 아래 맨 위 날짜 묶음을 따라간다.
 */

/**
 * 스크롤 스파이([data-ledger-day] 그룹 → 선택 동기) · lock · 날 누름 이동 공용 훅.
 */
export function useLedgerScroll({
  initialSelected = null,
}: {
  initialSelected?: string | null;
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

  const scroller = () =>
    rootRef.current?.closest(
      ".m-scroll, .overflow-y-auto",
    ) as HTMLElement | null;

  useEffect(() => {
    const p = scroller();
    if (!p) return;
    const onScroll = () => {
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
    p.addEventListener("scroll", onScroll, { passive: true });
    return () => p.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * 날을 눌러 그 날 묶음으로 옮긴다 — 묶음이 보이는 머리 바로 아래에 선다. 머리의 sticky top(상단 바 + 달 이동 줄)은 늘 보이고,
   * 아래로 가면 스크롤 방향 때문에 Keep 위(총액 · 요약)가 숨으니 Keep(주 달력)만 빼고, 위로 가면 머리 전체가 드러나니 전체를 뺀다
   * (Scroll Auto Hide — 내리면 숨고 올리면 드러난다).
   */
  const scrollToDay = (ds: string) => {
    const el = rootRef.current?.querySelector(`[data-ledger-day="${ds}"]`);
    const p = scroller();
    if (!el || !p) return;
    const gap = 6;
    const top =
      p.scrollTop +
      el.getBoundingClientRect().top -
      p.getBoundingClientRect().top;
    const pin = pinRef.current;
    const pinH = pin?.offsetHeight ?? 0;
    const stickyTop = pin
      ? Number.parseFloat(getComputedStyle(pin).top) || 0
      : 0;
    const keep = pin?.querySelector<HTMLElement>("[data-ledger-keep]");
    // 숨는 높이 — Keep 윗변까지(Keep 이 없으면 머리 전체)
    const hideH = keep ? keep.offsetTop : pinH;
    const downTarget = top - (stickyTop + pinH - hideH) - gap;
    p.scrollTo({
      top:
        downTarget > p.scrollTop ? downTarget : top - (stickyTop + pinH) - gap,
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
