import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDeviceSize } from "@/shared/lib/groo/responsive";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { focusScreenTitle, useScreenTitle } from "@/shared/ds/top-navigation";
import { BudgetManager } from "@/widgets/budget-manage";
import { CategoryManager } from "@/widgets/category-manage";
import { PresetManager } from "@/widgets/preset-manage";
import { RecurringManager } from "@/widgets/recurring-manage";
import {
  CalendarLabelsSection,
  CalendarShareSection,
  TodoTagManager,
} from "@/widgets/calendar-manage";
import { MemoTagManager } from "@/widgets/memo-manage";
import { NotificationsManager } from "@/widgets/notification-manage";
import { DataExportSection } from "@/widgets/data-transfer";
import {
  AccountSection,
  AppearanceSection,
  DevicesSection,
  HideAmountsSection,
} from "@/widgets/account-settings";
import { AccountManager, SavingGoalManager } from "@/widgets/asset-full";
import { Card, CardContent } from "@/shared/ui/card";
import { oauthKeys } from "@/shared/config";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SECTION_IDS,
  SECTIONS,
  type SectionDef,
  type SectionId,
} from "../model/sections";
import { linkedProviderName } from "../model/oauth-return";
import { useSettingsBack } from "../model/use-settings-back";
import { SettingsDesktopFrame } from "./SettingsDesktopFrame";
import { SettingsMobileMenu } from "./SettingsMobileMenu";
import { SettingsTabletFrame } from "./SettingsTabletFrame";
import { SettingsSubpageMobile } from "./SettingsSubpageMobile";

type OutletCtx = { onAddTx: () => void; mobile: boolean };

export const SettingsPage = () => {
  const { t } = useTranslation("settings");
  const { mobile } = useOutletContext<OutletCtx>();
  // 폰 머리 오른쪽 "추가" 를 누른 횟수 — 카테고리 본문이 이 값이 바뀔 때 추가 폼을 연다.
  const [addRequests, setAddRequests] = useState<
    Partial<Record<SectionId, number>>
  >({});
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const querySection = (() => {
    const q = searchParams.get("section");
    return q && (SECTION_IDS as string[]).includes(q) ? (q as SectionId) : null;
  })();
  // 섹션은 주소에서만 읽는다 — 기록을 남기므로(changeSection) 뒤로 · 앞으로 가기가 주소만 바꾸고,
  // 상태를 따로 들면 화면과 주소가 어긋난다.
  // 섹션 없는 주소: 폰 · 태블릿(768 ~ 1279)은 설정 메뉴, 1280 이상 두 칸은 카테고리(Q3-B · I-16 30 ~ 31)
  const twoColumn = useDeviceSize() === "desktop";
  const section: SectionId | "menu" =
    querySection ?? (mobile || !twoColumn ? "menu" : "categories");

  const activeSection =
    section === "menu"
      ? null
      : (SECTIONS.find((s) => s.id === section) ?? null);

  const goBack = useSettingsBack(activeSection);

  // 문서 제목 "{섹션 이름} - 그루 담다"(메뉴는 "설정") — 셸 ScreenEffects 는 경로만 봐서 ?section= 은 여기서 쓴다.
  useScreenTitle(activeSection ? t(activeSection.labelKey) : t("page.title"));
  // 섹션이 바뀌면(앞으로 · 뒤로 모두) 본문 맨 위 · 새 제목에 초점 — 처음 열 때는 훔치지 않는다.
  const lastFocused = useRef(section);
  useEffect(() => {
    if (lastFocused.current === section) return;
    lastFocused.current = section;
    const frame = requestAnimationFrame(() => focusScreenTitle());
    return () => cancelAnimationFrame(frame);
  }, [section]);

  // 소셜 연동 복귀 처리 — SSO→Google 연동 후 ?linked=<provider>(성공) / ?linkError=<msg>(실패) 를
  // 달고 이 페이지로 돌아온다. 알림 노출 + provider 상태 재조회 + 쿼리 제거.
  //
  // 딱 한 번만 돈다. 예전엔 의존성을 `[]` 로 비워 그걸 표현했는데, 몸통이 실제로 읽는
  // 값들과 어긋나 규칙을 꺼야 했다 — 의존성은 정직하게 적고 "한 번" 은 플래그로 적는다.
  const oauthReturnHandled = useRef(false);
  useEffect(() => {
    if (oauthReturnHandled.current) return;
    const linked = searchParams.get("linked");
    const linkError = searchParams.get("linkError");
    if (!linked && !linkError) return;
    oauthReturnHandled.current = true;

    if (linked) {
      // 표에 있는 값(지금 연결할 수 있는 소셜 = Google)만 알린다 — 주소에 실린 임의 글 · 프로토타입 키(constructor)로는 알림이 없다(앱과 같다)
      const name = linkedProviderName(linked);
      if (name) toast.success(t("account.toast.linked", { name }));
      queryClient.invalidateQueries({ queryKey: oauthKeys.all });
    } else if (linkError) {
      // 그루 계정이 쓴 글(linkError)은 화면에 내지 않는다 — 고정 글만(I-14 10)
      toast.error(t("account.toast.linkError"));
    }

    // 새로고침·뒤로가기 시 알림이 재노출되지 않도록 쿼리스트링 제거 (section 등 나머지는 보존).
    const url = new URL(window.location.href);
    url.searchParams.delete("linked");
    url.searchParams.delete("linkError");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [searchParams, queryClient, t]);

  // 섹션 바꾸기 = 기록을 남긴다(push) — 브라우저 뒤로 가기가 설정 안을 거슬러 간다.
  // 같은 섹션을 다시 누르면 아무것도 하지 않는다.
  const changeSection = (next: SectionId | "menu") => {
    if (next === section) return;
    const p = new URLSearchParams(searchParams);
    if (next === "menu") p.delete("section");
    else p.set("section", next);
    setSearchParams(p);
  };

  /**
   * 메뉴 항목 클릭.
   * 외부 링크 항목(처리방침 등)은 열 내부 화면이 없으므로 새 탭으로 띄운다.
   */
  const openSection = (s: SectionDef) => {
    if (s.externalUrl) {
      window.open(s.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    changeSection(s.id);
  };

  const renderBody = (m: boolean) => {
    if (!activeSection) return null;
    switch (activeSection.id) {
      case "categories":
        return (
          <CategoryManager mobile={m} addRequest={addRequests.categories} />
        );
      case "accounts":
        return <AccountManager mobile={m} addRequest={addRequests.accounts} />;
      case "budget":
        return <BudgetManager mobile={m} />;
      case "goals":
        return <SavingGoalManager mobile={m} />;
      case "recurring":
        return (
          <RecurringManager mobile={m} addRequest={addRequests.recurring} />
        );
      case "presets":
        return <PresetManager mobile={m} addRequest={addRequests.presets} />;
      case "calendar-share":
        return <CalendarShareSection mobile={m} />;
      case "calendar-labels":
        return <CalendarLabelsSection mobile={m} />;
      case "todo-tags":
        return <TodoTagManager mobile={m} />;
      case "memo-tags":
        return <MemoTagManager mobile={m} />;
      case "appearance":
        return <AppearanceSection mobile={m} />;
      case "notifications":
        return <NotificationsManager mobile={m} />;
      case "data":
        return <DataExportSection mobile={m} />;
      case "account":
        return (
          <AccountSection
            mobile={m}
            onOpenHideAmounts={() => changeSection("hide-amounts")}
            onOpenDevices={() => changeSection("devices")}
          />
        );
      case "hide-amounts":
        return (
          <HideAmountsSection
            mobile={m}
            onBack={() => changeSection("account")}
          />
        );
      case "devices":
        return <DevicesSection mobile={m} />;
      default:
        return <PlaceholderSection section={activeSection} />;
    }
  };

  if (mobile) {
    if (section === "menu") {
      return (
        <SettingsMobileMenu
          changeSection={changeSection}
          openSection={openSection}
          goBack={goBack}
        />
      );
    }

    // 금액 가리기는 헤더 액션(모두 선택)과 아래 고정 [저장] 이 있어 공용 서브페이지 셸을
    // 쓰지 않는다 — 앱 화면처럼 자기 셸을 직접 그린다.
    if (section === "hide-amounts") {
      return <HideAmountsSection mobile onBack={goBack} />;
    }

    return (
      <SettingsSubpageMobile
        activeSection={activeSection}
        goBack={goBack}
        onHeadAction={(id) =>
          setAddRequests((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }))
        }
        body={renderBody(true)}
      />
    );
  }

  if (!twoColumn) {
    return (
      <SettingsTabletFrame
        activeSection={activeSection}
        onSelect={changeSection}
        renderBody={renderBody}
      />
    );
  }

  return (
    <SettingsDesktopFrame
      section={section}
      activeSection={activeSection}
      onSelect={changeSection}
      renderBody={renderBody}
    />
  );
};

// ─── PlaceholderSection ────────────────────────────────────────
function PlaceholderSection({ section }: { section: SectionDef }) {
  const { t } = useTranslation("settings");
  const IconComp = section.icon;
  return (
    <Card
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <CardContent style={{ padding: 40, paddingTop: 40, textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-brand-subtle)",
            color: "var(--fg-brand-strong)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <IconComp size={22} strokeWidth={1.9} />
        </div>
        <div
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "700",
            marginBottom: 4,
          }}
        >
          {t(section.labelKey)}
        </div>
        <div
          style={{
            fontSize: "var(--text-label-sm)",
            color: "var(--fg-tertiary)",
          }}
        >
          {t(section.descKey)}
        </div>
        <div
          style={{
            fontSize: "var(--text-badge)",
            color: "var(--fg-tertiary)",
            marginTop: 14,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {t("account.comingSoon")}
        </div>
      </CardContent>
    </Card>
  );
}
