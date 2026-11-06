import { useTranslation } from "react-i18next";
import { Card } from "@/shared/ds/card";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ds/tabs";
import { PageHead } from "@/shared/ui/groo/page-head";
import {
  CompareCategorySection,
  CompareMetricsSection,
  CompareSummarySection,
  CompareWeekdaySection,
} from "./stats-compare-parts";
import {
  FixedCategorySection,
  FixedOverviewSection,
  FixedTrendSection,
} from "./fixed-parts";
import {
  DonutSection,
  HeatmapSection,
  HighlightsSection,
  MerchantsSection,
} from "./stats-parts";
import {
  CatTrendSection,
  SavingsBarsSection,
  SavingsRateSection,
  TrendSection,
} from "./stats-trend-parts";
import { useStatsModel, type StatsState } from "./stats-model";
import type { TabKey } from "./stats-range";

/**
 * 데스크톱 통계(768 이상) — 카드 그대로, 구조 그대로(I-08 40). 카테고리 탭 두 칸은 minmax(0,1.4fr) minmax(0,1fr) · 칸 사이 24 · 쌓은 카드 사이 8.
 * 768 ~ 1279 는 한 칸 720 가운데(왼쪽 칸 다음 오른쪽 칸 차례), 1280 이상 최대 1040(Q4-A). 폰과 같은 부품 · 값 · 글이다.
 */
export function StatsDesktop({ state }: { state?: StatsState } = {}) {
  const { t } = useTranslation("stats");
  const m = useStatsModel(state);
  const TAB_ITEMS: { v: TabKey; l: string }[] = [
    { v: "cat", l: t("tab.category") },
    { v: "trend", l: t("tab.trend") },
    { v: "compare", l: t("tab.compare") },
    { v: "fixed", l: t("tab.fixed") },
  ];
  return (
    <div
      data-slot="stats-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead title={t("page.title")} description={t("page.subtitle")} />
        <Tabs
          value={m.tab}
          onValueChange={(v) => m.setTab(v as TabKey)}
          className="mb-x5"
        >
          <TabsList layout="hug" aria-label={t("tab.aria")}>
            {TAB_ITEMS.map(({ v, l }) => (
              <TabsTrigger key={v} value={v}>
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div role="tabpanel" className="flex flex-col gap-x2">
          {m.tab === "cat" && (
            <>
              <div className="grid grid-cols-1 gap-x2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-[var(--layout-gutter)]">
                <Card className="min-w-0">
                  <DonutSection m={m} place="card" />
                </Card>
                <Card body="list" className="min-w-0">
                  <MerchantsSection m={m} place="card" />
                </Card>
              </div>
              <Card>
                <HeatmapSection m={m} place="card" />
              </Card>
              <HighlightsSection m={m} place="card" />
            </>
          )}
          {m.tab === "trend" && (
            <>
              <Card>
                <TrendSection m={m} place="card" />
              </Card>
              <Card>
                <SavingsRateSection m={m} place="card" />
              </Card>
              <Card>
                <SavingsBarsSection m={m} place="card" />
              </Card>
              {m.showCatTrend && (
                <Card>
                  <CatTrendSection m={m} place="card" />
                </Card>
              )}
            </>
          )}
          {m.tab === "compare" && (
            <>
              <Card>
                <CompareSummarySection m={m} place="card" />
              </Card>
              <CompareMetricsSection m={m} place="card" />
              <Card body="list">
                <CompareCategorySection m={m} place="card" />
              </Card>
              <Card>
                <CompareWeekdaySection m={m} place="card" />
              </Card>
            </>
          )}
          {m.tab === "fixed" && (
            <>
              <Card>
                <FixedOverviewSection m={m} kind="expense" place="card" />
              </Card>
              <Card>
                <FixedOverviewSection m={m} kind="income" place="card" />
              </Card>
              <Card>
                <FixedTrendSection m={m} place="card" />
              </Card>
              <Card>
                <FixedCategorySection m={m} place="card" />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
