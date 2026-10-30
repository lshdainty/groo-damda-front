import { useTranslation } from "react-i18next";
import { Check, Target } from "lucide-react";
import { useCardPerformance } from "@/features/card-performance";
import { KRW, money } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { Skeleton as SkeletonBase } from "@/shared/ui/skeleton";
import { currentYearMonth } from "./detail-shared";

// 카드 월 실적 배지 — design card-detail.jsx 신판(달성/잔여 요약). 실적 무관 카드면 숨김.
// 달성: cat-green 10% tint 배경(다크 스왑) / 미달: sunken. 아이콘 30 원(surface).
/** 자산 상세의 한 행. 이체는 지출/수입이 아니라 자산 간 이동이라 별도 종류로 둔다. */
export function CardPerfBadge({ assetRowId }: { assetRowId: number }) {
  const { t } = useTranslation("asset");
  const ym = currentYearMonth();
  const { data: p, isLoading } = useCardPerformance(assetRowId, ym);
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 14,
          padding: "12px 13px",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-sunken)",
        }}
      >
        <SkeletonBase className="h-[30px] w-[30px] rounded-full shrink-0" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <SkeletonBase className="h-4 w-32 mb-1" />
          <SkeletonBase className="h-3 w-40" />
        </div>
      </div>
    );
  }
  if (!p || !p.isRequired || p.requiredAmount == null) return null;
  const done = p.isAchieved;
  const pct = Math.trunc(Math.min(Math.max(p.achievementRate, 0), 1.5) * 100);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 14,
        padding: "12px 13px",
        borderRadius: "var(--radius-lg)",
        background: done
          ? "var(--color-chart-green-subtle)"
          : "var(--bg-sunken)",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: "var(--radius-pill)",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-surface)",
          color: done ? "var(--color-chart-green)" : "var(--fg-secondary)",
        }}
      >
        {done ? (
          <Check size={15} strokeWidth={3} />
        ) : (
          <Target size={15} strokeWidth={1.9} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-label-sm)",
            fontWeight: "700",
            color: "var(--fg-primary)",
          }}
        >
          {done
            ? t("assetDetail.perfDone")
            : t("assetDetail.perfRemain", {
                amount: money(p.remainingAmount ?? 0),
              })}
        </div>
        <div
          className="num"
          style={{
            fontSize: "var(--text-caption)",
            color: "var(--fg-tertiary)",
            marginTop: 2,
          }}
        >
          <MaskAmount card="asset.detail" mask="•••">
            {wonPre()}
            {KRW(p.currentAmount)}
          </MaskAmount>
          {" / "}
          <MaskAmount card="asset.detail" mask="•••">
            {wonPre()}
            {KRW(p.requiredAmount)}
          </MaskAmount>
          <WonUnit card="asset.detail" /> · {pct}%
        </div>
      </div>
    </div>
  );
}
