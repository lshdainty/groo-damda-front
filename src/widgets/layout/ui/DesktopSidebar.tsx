import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SideNavigation,
  SideNavigationContent,
  SideNavigationGroup,
  SideNavigationHeader,
  SideNavigationItem,
  SideNavigationSubItem,
} from "@/shared/ds/side-navigation";
import {
  useHasSecurities,
  useMyFeatures,
} from "@/features/subscription/model/useSubscription";
import { brokerPath, useBrokerLabel } from "@/features/stock/lib/broker";
import { GrooTree } from "@/shared/ui/groo/groo-tree";
import { useLinkClick } from "../lib/use-link-click";
import { NAV, type NavItem } from "../model/nav";

/**
 * 데스크톱(768 이상) 주 메뉴 — Side Navigation. 768 ~ 1279 는 아이콘만(56), 1280 이상은 펼침(240) — 폭 규칙 ·
 * 손으로 접은 기억(localStorage)은 DS 가 맡는다.
 *
 * 증권(model/shell.ts 임시 선택 4): 연결한 증권사가 둘 이상이면 부모는 펼치기 전용이고 하위가 증권사다(하위가 지금이면
 * 저절로 펼친다). 아니면 /desk/stocks 로 가는 링크다. 구독(SECURITIES)이 없으면 항목이 없다.
 */
export function DesktopSidebar() {
  const { t } = useTranslation("layout");
  const { t: tc } = useTranslation("common");
  const { pathname } = useLocation();
  const link = useLinkClick();
  const hasSecurities = useHasSecurities();
  const { data: features } = useMyFeatures({ reference: true });
  const brokerLabelOf = useBrokerLabel(hasSecurities);

  // **연결한 증권사만 하위에 둔다.** 미연결 증권사를 넣으면 누를 때마다 "연결해 주세요" 로 되돌아오는 막다른 길이 된다.
  // 연결이 하나뿐이면 하위를 접는다 — 고를 게 없는 트리는 정보를 주지 않는다.
  const connectedBrokers = hasSecurities
    ? (features?.connectedBrokers ?? [])
    : [];
  const brokerChildren = connectedBrokers.length > 1 ? connectedBrokers : [];

  const gate = (items: NavItem[]) =>
    hasSecurities ? items : items.filter((n) => n.id !== "stocks");
  const isActive = (path: string) =>
    path === "/desk" ? pathname === path : pathname.startsWith(path);

  const renderItem = (it: NavItem) => {
    const Icon = it.icon;
    const label = t(it.labelKey);
    if (it.id === "stocks" && brokerChildren.length > 0) {
      // 부모 — 펼치기만 한다. 현재 표시는 하위가 맡는다(aria-current 가 둘이 되지 않게)
      return (
        <SideNavigationItem key={it.id} icon={<Icon />} label={label}>
          {brokerChildren.map((b) => (
            <SideNavigationSubItem
              key={b}
              href={brokerPath(b)}
              label={brokerLabelOf(b)}
              current={
                pathname === brokerPath(b) ||
                pathname.startsWith(`${brokerPath(b)}/`)
              }
              onClick={link(brokerPath(b))}
            />
          ))}
        </SideNavigationItem>
      );
    }
    return (
      <SideNavigationItem
        key={it.id}
        href={it.path}
        icon={<Icon />}
        label={label}
        current={isActive(it.path)}
        onClick={link(it.path)}
      />
    );
  };

  return (
    <SideNavigation>
      <SideNavigationHeader
        logo={
          <>
            {/* 나무 24(폭 22.3) — span 으로 감싸 로고 슬롯의 직계 svg 24×24 고정 규칙은 걸리지 않는다(나무가 제 크기 22.3×24 로 그려진다). 사이 8 · 이름은 슬롯의 t5 · 700 */}
            <span className="flex shrink-0">
              <GrooTree size={24} />
            </span>
            {tc("app.title")}
          </>
        }
      />
      <SideNavigationContent>
        <SideNavigationGroup label={t("workspace")}>
          {gate(NAV.slice(0, 6)).map(renderItem)}
        </SideNavigationGroup>
        <SideNavigationGroup label={t("records")}>
          {gate(NAV.slice(6)).map(renderItem)}
        </SideNavigationGroup>
      </SideNavigationContent>
    </SideNavigation>
  );
}
