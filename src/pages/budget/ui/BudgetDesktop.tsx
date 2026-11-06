import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/shared/ds/card";
import { Button } from "@/shared/ds/button";
import { PageHead } from "@/shared/ui/groo/page-head";
import { MonthControls } from "@/shared/ui/groo/month-bar";
import { useBudgetModel, type BudgetMonth } from "./budget-model";
import {
  CategorySection,
  ComplianceSection,
  EmptyMonth,
  PaceSection,
  StatusSection,
  TotalSection,
} from "./budget-parts";

/**
 * 데스크톱 예산(768 이상) — 카드 그대로, 구조 그대로(I-08 16). 격자 minmax(0,1fr) minmax(0,1.5fr), 칸 사이 24, 쌓은 카드 사이 8.
 * 768 ~ 1279 는 한 칸 720 가운데(왼쪽 칸 다음 오른쪽 칸 차례), 1280 이상 최대 1040(Q4-A). 폰과 같은 부품 · 값 · 글이다.
 */
export function BudgetDesktop({ month }: { month?: BudgetMonth } = {}) {
  const { t } = useTranslation("budget");
  const navigate = useNavigate();
  const m = useBudgetModel(month);
  const goToSettings = () => navigate("/desk/settings?section=budget");
  return (
    <div
      data-slot="budget-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead
          title={t("pageTitle")}
          description={t("subtitle")}
          actions={
            <>
              <MonthControls monthKey={m.monthKey} onChange={m.setMonthKey} />
              <Button
                type="button"
                variant="ghost"
                ghostColor="neutralMuted"
                size="small"
                onClick={goToSettings}
              >
                {t("settings")}
              </Button>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-x2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-[var(--layout-gutter)]">
          <div className="flex min-w-0 flex-col gap-x2">
            {m.noBudgets ? (
              <Card>
                <EmptyMonth m={m} onSettings={goToSettings} />
              </Card>
            ) : (
              <>
                <Card>
                  <TotalSection m={m} place="card" />
                </Card>
                <Card>
                  <PaceSection m={m} place="card" />
                </Card>
                <Card body="list">
                  <StatusSection m={m} place="card" />
                </Card>
              </>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-x2">
            {!m.noBudgets && (
              <Card body="list">
                <CategorySection m={m} place="card" onSettings={goToSettings} />
              </Card>
            )}
            {(!m.noBudgets || m.complianceHasData) && (
              <Card>
                <ComplianceSection m={m} place="card" />
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
