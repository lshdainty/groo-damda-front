import { useTranslation } from "react-i18next";
import { Tabs, ChipTabsList, ChipTabsTrigger } from "@/shared/ds/tabs";
import { ScreenBands } from "@/shared/ui/groo/screen-bands";
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
 * 폰 통계(I-08 29 ~ 31) — 가계부 묶음 Line 탭 아래 칩 탭(Chip Tabs solid large 40, 위아래 틈 0), 그 아래 구역마다 흰 띠(사이 8).
 * 칩 탭은 눌러서만 바뀐다(2차 탭은 밀어 넘기지 않는다 — Tabs 7A). 기간 버튼은 첫 띠 머리 오른쪽에 있다(따로 띠를 두지 않는다). 머리 없는 띠(요약 · 지표 · 저축률)는 위 24 에서 첫 글이 시작한다.
 * 네 탭 모두 같은 규칙이고 앱 `stats_screen.dart` 와 같은 구조 · 같은 값이다(짝 1).
 */
export function StatsMobile({ state }: { state?: StatsState } = {}) {
  const { t } = useTranslation("stats");
  const m = useStatsModel(state);
  const TAB_ITEMS: { v: TabKey; l: string }[] = [
    { v: "cat", l: t("tab.category") },
    { v: "trend", l: t("tab.trend") },
    { v: "compare", l: t("tab.compare") },
    { v: "fixed", l: t("tab.fixed") },
  ];
  const band = (name: string, node: React.ReactNode) => (
    <div data-band="flush" data-section={name}>
      {node}
    </div>
  );
  return (
    <div className="flex flex-1 flex-col">
      {/* 칩 탭은 가계부 탭 아래에 붙어 있는다(문서가 스크롤 — sticky), 패널은 따로 스크롤하지 않는다 */}
      <Tabs
        value={m.tab}
        onValueChange={(v) => m.setTab(v as TabKey)}
        className="sticky top-(--shell-top) z-3 shrink-0 bg-bg-layer-default"
      >
        <ChipTabsList variant="solid" size="large" aria-label={t("tab.aria")}>
          {TAB_ITEMS.map(({ v, l }) => (
            <ChipTabsTrigger key={v} value={v}>
              {l}
            </ChipTabsTrigger>
          ))}
        </ChipTabsList>
      </Tabs>
      <div role="tabpanel" className="flex-1">
        <ScreenBands>
          {m.tab === "cat" && (
            <>
              {band("donut", <DonutSection m={m} place="band" />)}
              {band("merchants", <MerchantsSection m={m} place="band" />)}
              {band("heatmap", <HeatmapSection m={m} place="band" />)}
              {band("highlights", <HighlightsSection m={m} place="band" />)}
            </>
          )}
          {m.tab === "trend" && (
            <>
              {band("trend", <TrendSection m={m} place="band" />)}
              {band("rate", <SavingsRateSection m={m} place="band" />)}
              {band("savings", <SavingsBarsSection m={m} place="band" />)}
              {m.showCatTrend &&
                band("catTrend", <CatTrendSection m={m} place="band" />)}
            </>
          )}
          {m.tab === "compare" && (
            <>
              {band("summary", <CompareSummarySection m={m} place="band" />)}
              {band("metrics", <CompareMetricsSection m={m} place="band" />)}
              {band("delta", <CompareCategorySection m={m} place="band" />)}
              {band("weekday", <CompareWeekdaySection m={m} place="band" />)}
            </>
          )}
          {m.tab === "fixed" && (
            <>
              {band(
                "expense",
                <FixedOverviewSection m={m} kind="expense" place="band" />,
              )}
              {band(
                "income",
                <FixedOverviewSection m={m} kind="income" place="band" />,
              )}
              {band("trend", <FixedTrendSection m={m} place="band" />)}
              {band("categories", <FixedCategorySection m={m} place="band" />)}
            </>
          )}
        </ScreenBands>
      </div>
    </div>
  );
}
