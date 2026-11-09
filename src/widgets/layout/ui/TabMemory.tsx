import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getShellScroller } from "@/shared/lib/groo/shell-scroller";
import {
  isRestoring,
  remember,
  rememberScroll,
  restoreScroll,
  takePending,
  tabOf,
} from "../lib/tab-memory";

/**
 * 모바일 탭 셸 안에서 탭마다 마지막 화면 · 스크롤을 적어 두고, 탭 바가 옮겨 온 화면에서 스크롤을 복원한다.
 * 화면은 그리지 않는다. 스크롤 상자는 셸의 본문 스크롤 주체(`getShellScroller`)다.
 */
export function TabMemory() {
  const { pathname, search } = useLocation();
  const tab = tabOf(pathname);
  const path = pathname + search;
  const tabRef = useRef(tab);

  // 그리자마자(브라우저 스크롤 이벤트보다 먼저) 지금 탭 · 화면을 맞춘다
  useLayoutEffect(() => {
    tabRef.current = tab;
    if (tab) remember(tab, path);
  }, [tab, path]);

  // 탭 바를 눌러 도착했으면 기억한 스크롤로
  useEffect(() => {
    const box = getShellScroller();
    const y = takePending(tab);
    if (!box || y === null) return;
    return restoreScroll(box, y);
  }, [tab, path]);

  useEffect(() => {
    const box = getShellScroller();
    if (!box) return;
    const onScroll = () => {
      if (tabRef.current && !isRestoring())
        rememberScroll(tabRef.current, box.getTop());
    };
    box.eventTarget.addEventListener("scroll", onScroll, { passive: true });
    return () => box.eventTarget.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
