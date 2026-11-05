import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { FloatingActionButton } from "@/shared/ds/floating-action-button";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { Skeleton } from "@/shared/ds/skeleton";
import { friendsOf } from "../model/dutch-model";
import { Won } from "./dutch-parts";
import { DutchTabContent, type TabKey } from "./DutchLists";
import type { DutchView } from "./dutch-view";

/** 요약 줄 하나 — 왼쪽 이름 + "{n}명에게서" · 오른쪽 금액(t9 24/32 · 700 · 원까지 · 줄바꿈 없음, 넘치면 이름 아래 줄로) */
function SummaryRow({
  label,
  sub,
  amount,
  loading,
}: {
  label: string;
  sub: string;
  amount: number;
  loading: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-x3">
      <div className="min-w-0">
        <div className="text-t4 text-fg-neutral-subtle">{label}</div>
        <div className="text-t3 text-fg-neutral-subtle">
          {loading ? <Skeleton text="t3" className="w-20" /> : sub}
        </div>
      </div>
      <div className="ml-auto text-t9 font-bold text-fg-neutral">
        {loading ? (
          <Skeleton text="t9" className="w-32" />
        ) : (
          <Won amount={amount} card="dutchpay.summary" />
        )}
      </div>
    </div>
  );
}

/**
 * 더치페이 폰 화면(I-15 25 ~ 31, 5-B) — 상단 바 + 띠 둘: 요약 띠(받을 돈 · 보낼 돈 두 줄) | 8 | 목록 띠(Segmented
 * "진행 중 N · 완료 N · 친구 N" + 그 탭의 줄, 화면 끝까지) + 떠 있는 [정산 만들기]. 띠 안에 카드를 두지 않는다.
 */
export function DutchMobile({ v }: { v: DutchView }) {
  const { t } = useTranslation("dutchPay");
  return (
    <>
      <TopNavigation type="standard">
        <TopNavigationBackButton fallbackHref="/desk/more" />
        <TopNavigationTitle>{t("title")}</TopNavigationTitle>
      </TopNavigation>
      <div className="relative flex flex-1 flex-col gap-x2 bg-bg-layer-basement">
        <section className="flex flex-col gap-x3 bg-bg-layer-default px-global-gutter pb-x5 pt-x4">
          <SummaryRow
            label={t("receivable")}
            sub={
              v.receivable.people > 0
                ? t("receivableFrom", { count: v.receivable.people })
                : t("receivableNone")
            }
            amount={v.receivable.amount}
            loading={v.loading}
          />
          <SummaryRow
            label={t("payable")}
            sub={t("payableTo", { count: 0 })}
            amount={0}
            loading={v.loading}
          />
        </section>
        <section className="flex-1 bg-bg-layer-default pb-[96px]">
          <div className="px-global-gutter pb-x1 pt-x3">
            <SegmentedControl
              aria-label={t("title")}
              value={v.tab}
              onValueChange={(k) => v.setTab(k as TabKey)}
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
          </div>
          <DutchTabContent
            tab={v.tab}
            active={v.active}
            past={v.past}
            all={v.list}
            loading={v.loading}
            failed={v.failed}
            onRetry={v.retry}
            onOpen={v.open}
          />
        </section>
        <FloatingActionButton
          icon={<Plus />}
          aria-label={t("createLabel")}
          onClick={v.create}
        />
      </div>
    </>
  );
}
