import { useTranslation } from "react-i18next";
import { ListHeader } from "@/shared/ds/list";
import { useDsText } from "@/shared/ds/i18n";
import { money } from "@/shared/lib/groo/format";
import { BarCaption, MeterBar } from "@/shared/ui/groo/band-parts";
import type { Asset } from "@/entities/asset";
import { useAssetMask } from "../../lib/asset-groups";
import { CardPerfBadge } from "./CardPerfBadge";
import type { CardDetail } from "./use-card-detail";

/**
 * 한도 사용 · 실적(I-17 47) — 목록 제목 "한도 사용" + 오른쪽 "{pct}% 사용" + ds 막대(limit, 넘치면 끝까지 fg-critical + "N원 초과") + 아래 줄
 * "{사용} / 한도 {한도}" · "잔여 {금액}". 80% 경고 색은 없다(한도에 가까워져도 색을 바꾸지 않는다). 실사용률 그대로(2000% 도).
 * 실적이 없는 카드는 줄이 없고, 한도가 없으면 한도 머리 없이 실적 줄만 둔다.
 */
export function CardLimit({ asset, c }: { asset: Asset; c: CardDetail }) {
  const { t } = useTranslation("asset");
  const dsT = useDsText();
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  const { limit, used, limitPct } = c;
  const over = used > limit;
  const titleId = `asset-limit-${asset.rowId}`;
  return (
    <section data-slot="asset-detail-limit">
      {limit > 0 && (
        <>
          <ListHeader as="div" variant="boldSolid" className="mt-x2">
            <h2 id={titleId} className="m-0 tracking-normal [font:inherit]">
              {t("assetDetail.limitUsage")}
            </h2>
            <span className="shrink-0 text-t4 font-bold tabular-nums text-fg-neutral">
              {t("assetDetail.limitPctUsed", { pct: limitPct })}
            </span>
          </ListHeader>
          <div className="px-global-gutter pt-x1 pb-x2">
            <MeterBar
              label={t("cardLimitName", { name: asset.assetName })}
              value={used}
              max={limit}
              formatValue={(n) => m(`${money(n)}`)}
            />
            <BarCaption
              left={m(
                t("assetDetail.limitOf", {
                  used: money(used),
                  limit: money(limit),
                }),
              )}
              right={
                over
                  ? dsT("progress.over", { value: m(money(used - limit)) })
                  : m(
                      t("assetDetail.limitRemain", {
                        amount: money(Math.max(0, limit - used)),
                      }),
                    )
              }
              critical={over}
            />
          </div>
        </>
      )}
      <CardPerfBadge assetRowId={asset.rowId} />
    </section>
  );
}
