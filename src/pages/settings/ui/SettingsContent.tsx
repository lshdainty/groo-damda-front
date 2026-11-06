import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHead } from "@/shared/ui/groo/page-head";
import { SettingsFrameContext } from "@/shared/ui/groo/settings-frame-context";
import { NEEDS_DESKTOP_HEAD, type SectionDef } from "../model/sections";
import { useReportHeadSlot } from "../model/settings-body-host";
import { SettingsBackLink } from "./SettingsBackLink";

interface Props {
  activeSection: SectionDef;
  /** "‹ {부모}" — 1280 이상은 숨은 구역만, 768 ~ 1279 는 모든 하위 페이지 */
  back: { to: string; label: string } | null;
  renderBody: (mobile: boolean) => React.ReactNode;
}

/**
 * 데스크톱 · 태블릿 본문 칸(I-16 27 ~ 29 · 33) — "‹ {부모}" → 4 → 제목 줄 → 24 → 본문.
 * 제목 줄은 틀이 자리를 갖는다: 위젯이 그리는 `ManagerHead` 가 이 자리로 들어오고, 위젯에 머리가 없는 섹션은 틀이 섹션 이름 ·
 * 설명으로 직접 그린다. 어느 쪽이든 화면 제목(h1)은 하나, 제목 줄 ↔ 첫 내용은 같은 간격이다.
 */
export const SettingsContent = ({ activeSection, back, renderBody }: Props) => {
  const { t } = useTranslation("settings");
  const [headSlot, setOwnHeadSlot] = useState<HTMLElement | null>(null);
  // 본문을 페이지가 틀 밖(포털)에서 그릴 때는 제목 줄 자리를 페이지에도 알린다(I-wrap-b1 ε 9)
  // ref 는 안정된 setter 로 받고, 알리기는 자리가 바뀔 때만(렌더마다 새 ref 함수를 주면 null → 자리를 다시 알려 페이지가 한 번 더 그린다 — 검수 L3)
  const report = useReportHeadSlot();
  useLayoutEffect(() => {
    if (!report || !headSlot) return;
    report(headSlot);
    return () => report(null);
  }, [report, headSlot]);
  const frame = useMemo(() => ({ headSlot }), [headSlot]);
  const ownHead = NEEDS_DESKTOP_HEAD.includes(activeSection.id);
  // 제목 줄 ↔ 첫 내용 24(T7). 예산 설정만 그 사이에 도구 줄이 들어 16 — 도구 줄 ↔ 첫 카드도 16(F 36)
  const gap = activeSection.id === "budget" ? "mb-x4" : "mb-x6";
  return (
    <SettingsFrameContext.Provider value={frame}>
      {back && (
        <div className="mb-x1">
          <SettingsBackLink to={back.to} label={back.label} />
        </div>
      )}
      {/* PageHead 자신의 아래 20 은 이 자리가 대신 갖는다(.settings-head-slot — groo.css) */}
      <div ref={setOwnHeadSlot} className={`settings-head-slot ${gap}`}>
        {ownHead && (
          <PageHead
            title={t(activeSection.labelKey)}
            description={
              activeSection.descKey ? t(activeSection.descKey) : undefined
            }
          />
        )}
      </div>
      {renderBody(false)}
    </SettingsFrameContext.Provider>
  );
};
