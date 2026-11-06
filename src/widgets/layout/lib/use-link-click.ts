import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLeaveGuard } from "@/shared/ui/groo/leave-guard-context";

/**
 * DS 의 BackButton · BottomNavigationItem · SideNavigationItem 은 진짜 `<a href>` 다 — 라우터 없이 누르면 전체 새로고침이 된다.
 * 일반 왼쪽 클릭만 가로채 navigate 로 옮기고, 새 탭 · 가운데 클릭 · 수정 키는 브라우저에 맡긴다.
 * `to` 는 href 와 다른 곳으로 보낼 때(탭의 마지막 화면), `before` 는 옮기기 직전에 할 일.
 * 옮기기 전에 공용 떠나기 가드를 부른다(단계 5) — [계속 작성] 이면 `before` 도 하지 않는다.
 */
export function useLinkClick() {
  const navigate = useNavigate();
  const leaveGuard = useLeaveGuard();
  return (href: string, opts: { to?: string; before?: () => void } = {}) =>
    (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      e.preventDefault();
      leaveGuard(() => {
        opts.before?.();
        navigate(opts.to ?? href);
      });
    };
}
