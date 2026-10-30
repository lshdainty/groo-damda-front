import { useTranslation } from "react-i18next";
import { Check, Target } from "lucide-react";
import { Badge } from "@/shared/ds/badge";
import { List, ListItem, ListTile } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { money } from "@/shared/lib/groo/format";
import { useAssetMask } from "../../lib/asset-groups";
import { useCardPerformance } from "@/features/card-performance";
import { currentYearMonth } from "./detail-shared";

/**
 * 카드 월 실적(I-17 47) — 회색 · 초록 상자를 걷고 List 줄: 앞 타일 40(미달 chart-gray-weak + target · 달성 chart-green-weak + check) ·
 * 제목 "{M}월 실적" · 설명 "{현재}원 / {기준}원 · {pct}%" · 뒤 Badge(미달 neutral "실적까지 {금액}" · 달성 positive "실적 달성").
 * 실적 무관 카드면 줄을 그리지 않는다. 실패도 줄을 그리지 않는다(실적은 덧붙임 — 오류 원문 없음).
 */
export function CardPerfBadge({
  assetRowId,
  masked = false,
}: {
  assetRowId: number;
  masked?: boolean;
}) {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.detail", masked);
  const ym = currentYearMonth();
  const { data: p, isLoading } = useCardPerformance(assetRowId, ym);
  if (isLoading) {
    return (
      <div aria-hidden className="flex items-center gap-x3 px-x6 py-x3">
        <Skeleton radius="12" className="size-x10 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
          <Skeleton text="t5" className="w-1/3" />
          <Skeleton text="t3" className="w-1/2" />
        </div>
      </div>
    );
  }
  if (!p || !p.isRequired || p.requiredAmount == null) return null;
  const done = p.isAchieved;
  const pct = Math.trunc(Math.min(Math.max(p.achievementRate, 0), 1.5) * 100);
  const month = Number(ym.slice(5, 7));
  return (
    <List aria-label={t("assetDetail.perfTitle", { month })}>
      <ListItem
        prefix={
          <ListTile
            className={
              done
                ? "bg-chart-green-weak text-chart-green"
                : "bg-chart-gray-weak text-chart-gray"
            }
            aria-hidden
          >
            {done ? <Check size={20} /> : <Target size={20} />}
          </ListTile>
        }
        title={t("assetDetail.perfTitle", { month })}
        detail={m(
          `${money(p.currentAmount)} / ${money(p.requiredAmount)} · ${pct}%`,
        )}
        suffix={
          <Badge
            variant="weak"
            tone={done ? "positive" : "neutral"}
            size="large"
          >
            {done
              ? t("assetDetail.perfAchieved")
              : t("assetDetail.perfRemain", {
                  amount: m(money(p.remainingAmount ?? 0)),
                })}
          </Badge>
        }
      />
    </List>
  );
}
