import { useTranslation } from "react-i18next";
import {
  TopNavigation,
  TopNavigationActions,
  TopNavigationBackButton,
  TopNavigationTextButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { useExpenseCategories, useExpenseTemplates } from "@/features/expense";
import { useRecurringTransactions } from "@/features/recurring-transaction";
import {
  TEMP_BODY_PADDING,
  type SectionDef,
  type SectionId,
} from "../model/sections";

interface Props {
  activeSection: SectionDef | null;
  /** ← — 들어온 화면으로(History), 앞 화면이 없으면 상위로 고쳐 쓴다 */
  goBack: () => void;
  /** 머리 오른쪽 글 버튼 "추가" 를 눌렀다 */
  onHeadAction: (id: SectionId) => void;
  body: React.ReactNode;
}

/**
 * 머리 오른쪽 글 버튼 "추가" 를 두는 섹션(I-16 11) — 카테고리는 늘, 반복 · 프리셋은 비어 있으면 두지 않는다
 * (I-20 C 13 · D 21 — 앱 `presetsNonEmpty` 와 같은 조건). 계좌는 늘 둔다(I-17 26).
 */
const HEAD_ACTION_SECTIONS: SectionId[] = [
  "categories",
  "accounts",
  "recurring",
  "presets",
];

/** 반복 · 프리셋은 본문이 쓰는 것과 같은 조회(캐시 공유)로 "비어 있지 않은가" 를 본다 — 해당 섹션일 때만 마운트 */
function RecurringGate({ children }: { children: React.ReactNode }) {
  const q = useRecurringTransactions();
  return (q.data?.length ?? 0) > 0 ? <>{children}</> : null;
}
function PresetGate({ children }: { children: React.ReactNode }) {
  // 목록(프리셋 · 카테고리)을 못 받았으면 추가하지 않는다 — 본문이 실패 화면이다(I-20 C 13)
  const q = useExpenseTemplates({ silent: true });
  const cats = useExpenseCategories({ silent: true });
  if (cats.data === undefined) return null;
  return (q.data?.length ?? 0) > 0 ? <>{children}</> : null;
}

/**
 * 폰 하위 화면 껍데기(I-16 10 ~ 13) — 흐름 안 흰 면. 머리는 ds Top Navigation standard,
 * 본문은 머리 바로 아래(틈 0)에서 화면 바닥까지 흰 면이고 여백은 본문이 갖는다.
 */
export const SettingsSubpageMobile = ({
  activeSection,
  goBack,
  onHeadAction,
  body,
}: Props) => {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const id = activeSection?.id;
  const button =
    id && HEAD_ACTION_SECTIONS.includes(id) ? (
      <TopNavigationActions>
        <TopNavigationTextButton onClick={() => onHeadAction(id)}>
          {tCommon("add")}
        </TopNavigationTextButton>
      </TopNavigationActions>
    ) : null;
  return (
    <>
      <TopNavigation type="standard">
        <TopNavigationBackButton
          fallbackHref="/desk/settings"
          onClick={goBack}
        />
        <TopNavigationTitle>
          {activeSection ? t(activeSection.labelKey) : ""}
        </TopNavigationTitle>
        {id === "recurring" ? (
          <RecurringGate>{button}</RecurringGate>
        ) : id === "presets" ? (
          <PresetGate>{button}</PresetGate>
        ) : (
          button
        )}
      </TopNavigation>
      <div className="min-h-0 flex-1 bg-bg-layer-default">
        {/* 임시 24 — TEMP_BODY_PADDING 에 있는 섹션만(없으면 본문이 제 24 를 갖는다) */}
        {id && TEMP_BODY_PADDING.includes(id) ? (
          <div data-temp-body-padding className="p-x6">
            {body}
          </div>
        ) : (
          body
        )}
      </div>
    </>
  );
};
