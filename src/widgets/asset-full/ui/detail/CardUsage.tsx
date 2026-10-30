import { useTranslation } from "react-i18next";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { BandFailure, ListTitle } from "@/shared/ui/groo/band-parts";

import { type Expense } from "@/entities/expense";
import type { Asset } from "@/entities/asset";
import { LedgerGroups, PlainExpenseRows } from "./LedgerGroups";
import { useViewAll } from "./use-asset-detail";
import type { CardDetail } from "./use-card-detail";

/**
 * 카드 이용 내역(I-17 49) — "이용 내역 · {n}" + 오른쪽 "전체 보기" + ds Segmented Control(최근순 · 고액순 · 카테고리별) + 가계부 공용 줄.
 * 최근순은 날짜 묶음, 고액순 · 카테고리별은 묶음 없이. 줄을 누르면 거래 상세. 조회 범위(고른 회차의 청구 기간)는 그대로.
 */
export function CardUsage({
  asset,
  c,
  onExpense,
  first,
}: {
  asset: Asset;
  c: CardDetail;
  onExpense: (e: Expense) => void;
  first?: boolean;
}) {
  const { t } = useTranslation("asset");
  const viewAll = useViewAll(asset);
  const titleId = `asset-usage-${asset.rowId}`;
  const groups = c.usageGroups.map(
    ([d, items]) =>
      [
        d,
        items.map((expense) => ({
          kind: "expense" as const,
          at: expense.expenseDate,
          expense,
        })),
      ] as [string, { kind: "expense"; at: string; expense: Expense }[]],
  );
  return (
    <section data-slot="asset-detail-usage" aria-labelledby={titleId}>
      <ListTitle
        id={titleId}
        first={first}
        action={{ label: t("assetDetail.viewAll"), onClick: viewAll }}
      >
        {t("assetDetail.usageHistory")}
        {c.sorted.length > 0 ? ` · ${c.sorted.length}` : ""}
      </ListTitle>
      <div className="px-global-gutter py-x1">
        <div className="w-max max-w-full">
          <SegmentedControl
            aria-label={t("assetDetail.sortAria")}
            value={c.sort}
            onValueChange={(v) =>
              c.setSort(v as "recent" | "amount" | "category")
            }
          >
            <SegmentedControlItem value="recent">
              {t("assetDetail.sortRecent")}
            </SegmentedControlItem>
            <SegmentedControlItem value="amount">
              {t("assetDetail.sortAmount")}
            </SegmentedControlItem>
            <SegmentedControlItem value="category">
              {t("assetDetail.sortCategory")}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>
      {c.usageFailed ? (
        <BandFailure
          title={t("assetDetail.txLoadFailed")}
          onRetry={c.retryUsage}
        />
      ) : c.sorted.length === 0 ? (
        <p className="m-0 px-global-gutter py-x6 text-center text-t4 text-fg-neutral-subtle">
          {t("assetDetail.noUsage")}
        </p>
      ) : c.sort === "recent" ? (
        <LedgerGroups
          groups={groups}
          asset={asset}
          onExpense={onExpense}
          onTransfer={() => {}}
        />
      ) : (
        <PlainExpenseRows list={c.sorted} onExpense={onExpense} />
      )}
    </section>
  );
}
