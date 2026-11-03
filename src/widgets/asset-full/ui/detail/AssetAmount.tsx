import { useTranslation } from "react-i18next";
import { Delta } from "@/shared/ds/card";
import { List } from "@/shared/ds/list";
import { KvRow } from "./KvRow";
import { KRW, MINUS, formatChangeRate } from "@/shared/lib/groo/format";
import { won } from "@/shared/lib/groo/money-text";
import { BigAmount } from "@/shared/ui/groo/band-parts";
import { withCommaBreaks } from "@/shared/ds/i18n";
import type { Asset } from "@/entities/asset";
import { useAssetMask } from "../../lib/asset-groups";
import type { AssetDetailModel } from "./use-asset-detail";

/**
 * 금액 블록(신용카드 밖, I-17 45) — 라벨 R10(t3 · 500 · subtle) + 금액 R13(t9 · 700 · 고정폭 · 원까지 · 빼기 U+2212).
 * 투자는 아래에 List 키-값 줄 둘(예수금 · 평가금액 — 예수금이 0 이 아닐 때만)과 등락 Delta 를 더한다.
 * 이 자산만 가렸으면 금액을 전부 가린다(화면 묶음 가림 `asset.detail` 과 합집합).
 */
export function AssetAmount({
  asset,
  model,
}: {
  asset: Asset;
  model: AssetDetailModel;
}) {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  const { isCard, isInv, isCheckLinked, heroAmount, investVal } = model;
  const label = isCheckLinked
    ? t("assetDetail.valueCheckCard")
    : isCard
      ? t("assetDetail.valueCard")
      : isInv
        ? t("assetDetail.seriesValuation")
        : t("assetDetail.seriesBalance");
  return (
    <section
      data-slot="asset-detail-amount"
      aria-label={label}
      className="px-global-gutter pt-x3"
    >
      <p className="m-0 text-t3 font-medium text-fg-neutral-subtle">{label}</p>
      <BigAmount
        className="mt-x1"
        value={m((heroAmount < 0 ? MINUS : "") + won(Math.abs(heroAmount)))}
      />
      {isInv && (
        <div className="-mx-global-gutter mt-x1">
          {model.investCash !== 0 && (
            <List aria-label={label}>
              <KvRow
                label={t("holdings.cashBalance")}
                value={withCommaBreaks(m(won(model.investCash)))}
              />
              <KvRow
                label={t("holdings.holdingBalance")}
                value={withCommaBreaks(m(won(model.investHolding)))}
              />
            </List>
          )}
          {investVal?.changePct != null && (
            <div className="px-global-gutter pt-x1">
              <Delta
                direction={investVal.changePct >= 0 ? "up" : "down"}
                value={m(
                  `${formatChangeRate(investVal.changePct, { sign: "none" })}${
                    investVal.changeAmt != null
                      ? ` · ${t("holdings.todayChange", {
                          sign: investVal.changeAmt >= 0 ? "+" : MINUS,
                          amount: KRW(Math.abs(investVal.changeAmt)),
                        })}`
                      : ""
                  }`,
                )}
                className="text-t4"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
