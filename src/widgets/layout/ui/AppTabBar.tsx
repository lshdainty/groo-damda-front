import { useLeaveGuard } from "@/shared/ui/groo/leave-guard-context";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Calendar1, Home, Menu, ReceiptText } from "lucide-react";
import {
  BottomNavigation,
  BottomNavigationAddButton,
  BottomNavigationItem,
} from "@/shared/ds/bottom-navigation";
import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";
import { useLinkClick } from "../lib/use-link-click";
import { expectRestore, forget, recall, type TabId } from "../lib/tab-memory";
import {
  isAllTab,
  isCalendarTab,
  isExpenseTab,
  isHomeTab,
} from "../model/shell";

/**
 * 모바일 하단 탭 바 — 홈 · 가계부 · + · 캘린더 · 전체. 다섯 칸이 어느 화면에서나 같다(옛 money 모드는 없다 —
 * 가계부 · 자산 · 통계 · 예산은 모두 "가계부" 가 현재이고 화면 위 Line Tabs 가 넷을 나눈다).
 *
 * 칸은 `<a href>` 라 라우터로 옮기도록 onClick 을 넘기고(다른 탭에서 오면 그 탭의 마지막 화면 · 스크롤 — lib/tab-memory), 지금 탭을 다시 누르면(onReselect) 그 탭의 첫 화면으로
 * replace 하며 맨 위로 스크롤한다(같은 주소를 쌓지 않는다).
 */
export function AppTabBar({
  onAdd,
  addLabel,
}: {
  onAdd: () => void;
  /**
   * `+` 의 접근성 라벨 — **부모가 `onAdd` 와 짝지어 넘긴다**(`fabFor`).
   *
   * 여기서 `t("addTransaction")` 로 박아 두면 캘린더처럼 다른 것을 여는 화면에서
   * 낭독기·자동화가 속는다(QA #159). 무엇을 여는지 아는 쪽이 이름도 짓는다.
   */
  addLabel: string;
}) {
  const { t } = useTranslation("layout");
  const { pathname } = useLocation();
  // 다시 누름(첫 화면으로)도 떠나기 가드를 먼저 — [계속 작성] 이면 기억도 지우지 않는다
  const leaveGuard = useLeaveGuard();
  const rawNavigate = useNavigate();
  const link = useLinkClick();

  const tab = (
    id: TabId,
    href: string,
    label: string,
    icon: React.ReactNode,
    current: boolean,
  ) => (
    <BottomNavigationItem
      href={href}
      label={label}
      icon={icon}
      current={current}
      // 다른 탭에서 오면 그 탭의 마지막 화면 · 스크롤로(tab-memory)
      onClick={link(href, {
        to: recall(id)?.path ?? href,
        before: () => expectRestore(id, recall(id)?.scroll ?? 0),
      })}
      onReselect={({ scrollToTop }) =>
        leaveGuard(() => {
          forget(id, href);
          rawNavigate(href, { replace: true });
          scrollToTop();
        })
      }
    />
  );

  return (
    <SnackbarAvoidOverlap>
      <BottomNavigation>
        {tab("home", "/desk", t("home"), <Home />, isHomeTab(pathname))}
        {tab(
          "expense",
          "/desk/expense",
          t("expense"),
          <ReceiptText />,
          isExpenseTab(pathname),
        )}
        <BottomNavigationAddButton aria-label={addLabel} onClick={onAdd} />
        {tab(
          "calendar",
          "/desk/calendar",
          t("calendar"),
          <Calendar1 />,
          isCalendarTab(pathname),
        )}
        {tab("all", "/desk/more", t("all"), <Menu />, isAllTab(pathname))}
      </BottomNavigation>
    </SnackbarAvoidOverlap>
  );
}
