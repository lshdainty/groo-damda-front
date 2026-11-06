import { useGuardedNavigate } from "../lib/use-guarded-navigate";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ds/tabs";
import { MONEY_TABS, isMoneyPath } from "../model/shell";

/**
 * 가계부 묶음(가계부 · 자산 · 통계 · 예산)의 위 Line Tabs — 탭 바는 그대로 "가계부" 가 현재다.
 * 경로는 그대로라 칸을 고르면 그 경로로 옮긴다(Radix 탭이 버튼이라 navigate 로 — 새 탭 열기는 안 된다).
 * 묶음 밖에서는 그리지 않는다.
 */
export function MoneyTabs() {
  const { t } = useTranslation("layout");
  const { pathname } = useLocation();
  const navigate = useGuardedNavigate();
  if (!isMoneyPath(pathname)) return null;
  const current = MONEY_TABS.find(
    (m) => pathname === m.path || pathname.startsWith(`${m.path}/`),
  );
  return (
    <Tabs
      value={current?.path}
      onValueChange={(path) => navigate(path, { replace: true })}
      className="shrink-0"
    >
      <TabsList size="medium" aria-label={t("expense")}>
        {MONEY_TABS.map((m) => (
          <TabsTrigger key={m.path} value={m.path}>
            {t(m.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
