import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { PageHead } from "@/shared/ui/groo/page-head";
import { friendsOf } from "../model/dutch-model";
import { Won } from "./dutch-parts";
import { DutchTabContent, type TabKey } from "./DutchLists";
import type { DutchView } from "./dutch-view";

/** 지표 카드 하나 — 이름 t4 · 값 t7 20/27 · 700(원까지 · 줄바꿈 없음) · 아래 글 t3 */
function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <Card className="min-w-0">
      <div className="flex flex-col gap-[2px]">
        <div className="text-t4 text-fg-neutral-subtle">{label}</div>
        <div className="text-t7 font-bold text-fg-neutral">{value}</div>
        <div className="text-t3 text-fg-neutral-subtle">{sub}</div>
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
            label={t("receivable")}
            value={<Won amount={v.receivable.amount} card="dutchpay.summary" />}
            sub={
              v.receivable.people > 0
                ? t("receivableFrom", { count: v.receivable.people })
                : t("receivableNone")
            }
          />
          <Kpi
            label={t("payable")}
            value={<Won amount={0} card="dutchpay.summary" />}
            sub={t("payableTo", { count: 0 })}
          />
          <Kpi
            label={t("monthKpi.created")}
            value={t("monthKpi.count", { count: v.month.count })}
            sub={t("monthKpi.avg", { n: v.month.avg.toFixed(1) })}
          />
          <Kpi
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
