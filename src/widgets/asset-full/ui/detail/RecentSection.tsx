import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/ds/skeleton";
import { BandFailure, ListTitle } from "@/shared/ui/groo/band-parts";
import type { Expense } from "@/entities/expense";
import type { Asset, AssetTransfer } from "@/entities/asset";
import { LedgerGroups } from "./LedgerGroups";
import { useViewAll, type AssetDetailModel } from "./use-asset-detail";

/**
 * 최근 거래 · 이번 달 내역(I-17 49) — 계좌 "최근 거래 · {n}"(최근 12건) · 연결형 체크카드 "이번 달 내역 · {n}" + 오른쪽 글 버튼 "전체 보기".
 * 날짜 묶음 + 가계부 공용 줄, 줄을 누르면 거래 상세. 빈 글 · 불러오는 중 · 실패는 L 표(실패가 빈 글로 보이지 않는다).
 */
export function RecentSection({
  asset,
  model,
  onExpense,
  onTransfer,
  first,
}: {
  asset: Asset;
  model: AssetDetailModel;
  onExpense: (e: Expense) => void;
  onTransfer: (t: AssetTransfer) => void;
  first?: boolean;
}) {
  const { t } = useTranslation("asset");
  const viewAll = useViewAll(asset);
  const { relatedItems, relatedGroups, relatedLoading, relatedFailed } = model;
  const titleId = `asset-recent-${asset.rowId}`;
  const title = model.isCheckLinked
    ? t("assetDetail.monthTx")
    : t("assetDetail.recentTx");
  let body;
  if (relatedLoading) {
    body = (
      <div aria-hidden>
        {[0, 1].map((g) => (
          <div key={g}>
            <div className="px-global-gutter py-x2">
              <Skeleton text="t4" className="w-1/3" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
                <Skeleton radius="12" className="size-x10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
                  <Skeleton text="t5" className="w-1/2" />
                  <Skeleton text="t3" className="w-1/3" />
                </div>
                <Skeleton text="t5" className="w-x10 shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  } else if (relatedFailed) {
    body = (
      <BandFailure
        title={t("assetDetail.txLoadFailed")}
        onRetry={model.retryRelated}
      />
    );
  } else if (relatedItems.length === 0) {
    body = (
      <p className="m-0 px-global-gutter py-x6 text-center text-t4 text-fg-neutral-subtle">
        {t("assetDetail.noLinkedTx")}
      </p>
    );
  } else {
    body = (
      <LedgerGroups
        groups={relatedGroups}
        asset={asset}
        onExpense={onExpense}
        onTransfer={onTransfer}
      />
    );
  }
  return (
    <section data-slot="asset-detail-recent" aria-labelledby={titleId}>
      <ListTitle
        id={titleId}
        first={first}
        action={{ label: t("assetDetail.viewAll"), onClick: viewAll }}
      >
        {title}
        {relatedItems.length > 0 ? ` · ${relatedItems.length}` : ""}
      </ListTitle>
      {body}
    </section>
  );
}
