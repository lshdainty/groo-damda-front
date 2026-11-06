import { useGuardedNavigate } from "../lib/use-guarded-navigate";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Search } from "lucide-react";
import {
  TopNavigation,
  TopNavigationActions,
  TopNavigationBackButton,
  TopNavigationIconButton,
  TopNavigationSearch,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import {
  AdvancedFilter,
  SearchField,
  useSearchCondition,
} from "@/widgets/transaction-search";
import { useUnreadCount } from "@/features/notification";
import { useNotificationLabel } from "../lib/use-notification-label";
import { rootActionsFor, screenTitleKey } from "../model/shell";

/**
 * 모바일 root 머리 — 탭 바의 첫 화면(홈 · 가계부 · 캘린더 · 전체)의 큰 제목 + 오른쪽 아이콘.
 * 오른쪽은 홈 = 검색 + 알림, 그 밖 = 검색(model/shell.ts rootActionsFor). 알림 점은 안 읽은 알림이 있을 때만이고
 * 이름에도 "새 알림 있음" 을 넣는다(점만으로 알리지 않는다).
 * 테마 전환은 설정 > 표시 설정, 금액 가리기는 홈 · 자산 순자산 카드의 눈 버튼.
 */
export function MobileHeader() {
  const { pathname } = useLocation();
  // 거래 검색 화면 — standard: ← · 제목 자리 검색칸 · 고급 필터(17-3a C). 하나만 hook 규칙 때문에 컴포넌트를 가른다
  if (pathname === "/desk/search") return <SearchHeader />;
  return <RootHeader />;
}

function SearchHeader() {
  const { condition, update } = useSearchCondition();
  return (
    <TopNavigation type="standard">
      <TopNavigationBackButton fallbackHref="/desk" />
      <TopNavigationSearch>
        <SearchField
          autoFocus
          value={condition.q}
          onValueChange={(q) => update({ q })}
        />
      </TopNavigationSearch>
      <TopNavigationActions>
        <AdvancedFilter
          placement="bar"
          condition={condition}
          onApply={update}
        />
      </TopNavigationActions>
    </TopNavigation>
  );
}

function RootHeader() {
  const { t } = useTranslation("layout");
  const { pathname } = useLocation();
  const navigate = useGuardedNavigate();
  const { data: unreadCount = 0 } = useUnreadCount({ reference: true });
  const actions = rootActionsFor(pathname);
  const hasUnread = unreadCount > 0;
  const notificationLabel = useNotificationLabel(hasUnread);

  return (
    <TopNavigation type="root">
      <TopNavigationTitle>{t(screenTitleKey(pathname))}</TopNavigationTitle>
      <TopNavigationActions>
        {actions.includes("search") && (
          <TopNavigationIconButton
            aria-label={t("search")}
            onClick={() => navigate("/desk/search")}
          >
            <Search />
          </TopNavigationIconButton>
        )}
        {actions.includes("notifications") && (
          <TopNavigationIconButton
            aria-label={notificationLabel}
            notification={hasUnread}
            onClick={() => navigate("/desk/notifications")}
          >
            <Bell />
          </TopNavigationIconButton>
        )}
      </TopNavigationActions>
    </TopNavigation>
  );
}
