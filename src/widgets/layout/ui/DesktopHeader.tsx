import { useGuardedNavigate } from "../lib/use-guarded-navigate";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Settings } from "lucide-react";
import {
  TopNavigation,
  TopNavigationActions,
  TopNavigationIconButton,
  TopNavigationPrimaryButton,
  TopNavigationSearch,
} from "@/shared/ds/top-navigation";
import { SearchField, useSearchCondition } from "@/widgets/transaction-search";
import { NotificationsMenu } from "@/widgets/notification-manage";

/**
 * 데스크톱(768 이상) 머리 — 왼쪽은 거래 검색칸 360(제목은 본문 맨 위 ScreenTitle, 사이드바 접기는 사이드바 머리로 갔다)
 * 오른쪽에 "내역 추가" 주 버튼 + 알림 · 설정. 검색칸은 Enter 로 거래 검색 화면에 가고, 그 화면에서는 칸이 지금 검색어다(17-3a C).
 * 테마 토글 · 금액 가리기 눈은 걷었다(17-3c — 폰 카드의 눈은 그대로).
 * 알림은 1280 이상 Popover · 미만 Bottom Sheet(NotificationsMenu). `<header>` 는 `<main>` 밖이다(banner).
 */
export function DesktopHeader({ onOpenAdd }: { onOpenAdd: () => void }) {
  const { t } = useTranslation("layout");
  const navigate = useGuardedNavigate();
  const { pathname } = useLocation();
  const onSearch = pathname === "/desk/search";
  const { condition, update } = useSearchCondition();
  const [draft, setDraft] = useState("");

  return (
    <TopNavigation type="desktop">
      <TopNavigationSearch>
        <SearchField
          value={onSearch ? condition.q : draft}
          onValueChange={(v) => (onSearch ? update({ q: v }) : setDraft(v))}
          onEnter={() => {
            if (onSearch) return;
            const q = draft.trim();
            navigate(
              q ? `/desk/search?q=${encodeURIComponent(q)}` : "/desk/search",
            );
            setDraft("");
          }}
        />
      </TopNavigationSearch>
      <TopNavigationActions>
        <TopNavigationPrimaryButton onClick={onOpenAdd}>
          <Plus />
          {t("addRecord")}
        </TopNavigationPrimaryButton>
        <NotificationsMenu
          onGoSettings={() => navigate("/desk/settings?section=notifications")}
        />
        <TopNavigationIconButton
          aria-label={t("settings")}
          onClick={() => navigate("/desk/settings")}
        >
          <Settings />
        </TopNavigationIconButton>
      </TopNavigationActions>
    </TopNavigation>
  );
}
