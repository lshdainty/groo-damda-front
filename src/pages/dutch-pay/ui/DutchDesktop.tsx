import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Card, CardStat } from "@/shared/ds/card";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { PageHead } from "@/shared/ui/groo/page-head";
import { friendsOf } from "../model/dutch-model";
import { Won } from "./dutch-parts";
import { DutchTabContent, type TabKey } from "./DutchLists";
import type { DutchView } from "./dutch-view";

/** 지표 카드 하나 — ds CardStat small(이름 · 값 t7 700 고정폭) + 아래 글 t3. 불러오는 동안 값 · 글 자리 Skeleton */
function Kpi({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  loading: boolean;
}) {
  return (
    <Card className="min-w-0">
      <CardStat
        size="small"
        label={label}
        value={loading ? <Skeleton text="t7" className="w-24" /> : value}
      />
      <div className="mt-[2px] text-t3 text-fg-neutral-subtle">
        {loading ? <Skeleton text="t3" className="w-16" /> : sub}
      </div>
    </Card>
  );
}

/**
 * 더치페이 넓은 화면(I-15 32 ~ 34, 6-B) — 한 칸(768 ~ 1279 최대 720 · 1280 이상 최대 1040 가운데): 제목 줄(h1 · 설명 · [정산 만들기]
 * neutralOutline small) 아래 24 → 지표 카드 넷(1280 한 줄 · 미만 2 × 2, 사이 8) → 16 → Segmented → 12 → 목록 카드 하나.
 * 오른쪽 "자주 정산하는 친구" · "이번 달 정산 통계" 카드는 걷었다(친구는 탭, 통계는 지표).
 */
export function DutchDesktop({ v }: { v: DutchView }) {
  const { t } = useTranslation("dutchPay");
  return (
    <div
      data-slot="dutch-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead
          title={t("title")}
          description={t("subtitle")}
          actions={
            <Button variant="neutralOutline" size="small" onClick={v.create}>
              <Plus />
              {t("createLabel")}
            </Button>
          }
          style={{ marginBottom: "var(--spacing-x6)" }}
        />
        <div className="grid grid-cols-2 gap-x2 lg:grid-cols-4">
          <Kpi
            loading={v.loading}
            label={t("receivable")}
            value={<Won amount={v.receivable.amount} card="dutchpay.summary" />}
            sub={
              v.receivable.people > 0
                ? t("receivableFrom", { count: v.receivable.people })
                : t("receivableNone")
            }
          />
          <Kpi
            loading={v.loading}
            label={t("payable")}
            value={<Won amount={0} card="dutchpay.summary" />}
            sub={t("payableTo", { count: 0 })}
          />
          <Kpi
            loading={v.loading}
            label={t("monthKpi.created")}
            value={t("monthKpi.count", { count: v.month.count })}
            sub={t("monthKpi.avg", { n: v.month.avg.toFixed(1) })}
          />
          <Kpi
            loading={v.loading}
            label={t("monthKpi.total")}
            value={<Won amount={v.month.totalAmount} />}
            sub={t("monthKpi.sum", { count: v.month.count })}
          />
        </div>
        <SegmentedControl
          aria-label={t("title")}
          value={v.tab}
          onValueChange={(k) => v.setTab(k as TabKey)}
          className="mb-x3 mt-x4"
        >
          <SegmentedControlItem value="active">
            {t("tab.active", { count: v.active.length })}
          </SegmentedControlItem>
          <SegmentedControlItem value="past">
            {t("tab.past", { count: v.past.length })}
          </SegmentedControlItem>
          <SegmentedControlItem value="friends">
            {t("tab.friends", { count: friendsOf(v.list).length })}
          </SegmentedControlItem>
        </SegmentedControl>
        <Card body="list">
          <DutchTabContent
            size="medium"
            tab={v.tab}
            active={v.active}
            past={v.past}
            all={v.list}
            loading={v.loading}
            failed={v.failed}
            onRetry={v.retry}
            onOpen={v.open}
          />
        </Card>
      </div>
    </div>
  );
}
