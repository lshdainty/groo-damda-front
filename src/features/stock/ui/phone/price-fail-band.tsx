import { useTranslation } from "react-i18next";
import { Callout } from "@/shared/ds/callout";
import { cn } from "@/shared/lib/cn";
import { BandFailure } from "@/shared/ui/groo/band-parts";

/*
 * 시세를 받지 못했다(I-wrap-b2b 단계 4) — 두 모양.
 *
 *   PriceStaleCallout  보이는 값이 있는 채 실패(폴링 실패 · 자산 평가가 DB 잔액으로 대체 · 한쪽 통화 빠짐) — 섹션 머리 아래
 *                      Callout critical · actionable(상자 전체가 다시 시도). 이미 보이는 내용이 있으면 실패 Result Section 을
 *                      쓰지 않는다(result-section.md:53) — 그 자리 오류 안내는 Callout(callout.md:3). 다음 받기가 성공하면
 *                      부르는 쪽이 걷는다. 스낵바는 쓰지 않는다(POLL_META). "마지막으로 받은 시각" 은 두지 않는다.
 *   PriceFailBand      값이 하나도 없는 처음 실패 — 그 자리 Result Section + [다시 시도](다시 받는 동안 진행 원, B2a)
 */

/** 보이는 값이 있는 채 시세를 못 받았다 — 제목 "시세를 불러오지 못했어요" + 본문(무엇이 보이는지) */
export function PriceStaleCallout({
  onRetry,
  retrying = false,
  shows = "lastPrice",
  band = true,
  className,
}: {
  onRetry: () => void;
  /** 다시 받는 중 — Callout 은 로딩 모양이 없어 원은 걸지 않고, 그동안 다시 누름만 무시한다 */
  retrying?: boolean;
  /** 보이는 값 — 마지막으로 받은 시세(lastPrice) · 시세가 아닌 마지막 잔액(lastBalance, 자산 평가가 DB 잔액으로 대체된 자리) */
  shows?: "lastPrice" | "lastBalance";
  /** 좌우 24 를 둔다 — 폰 띠 · 여백 없는 카드(p-0). 여백 있는 자리 안이면 false */
  band?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("stocks");
  return (
    <div
      data-slot="price-stale-callout"
      className={cn(band && "px-x6", className)}
    >
      <Callout
        tone="critical"
        interaction="actionable"
        title={t("detail.priceFail")}
        onClick={() => {
          if (!retrying) onRetry();
        }}
      >
        {shows === "lastBalance"
          ? t("detail.priceStaleBalance")
          : t("detail.priceStale")}
      </Callout>
    </div>
  );
}

/** 값이 하나도 없는 처음 실패 — 그 자리 Result Section "시세를 불러오지 못했어요" + [다시 시도] */
export function PriceFailBand({
  onRetry,
  retrying,
  band = true,
  className,
}: {
  onRetry: () => void;
  retrying?: boolean;
  band?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("stocks");
  // 좌우 여백은 감싸는 상자가 맡는다 — BandFailure 의 band 여백은 카드 안에서 0 으로 덮인다(여백 없는 카드에서도)
  return (
    <div data-slot="price-fail-band" className={cn(band && "px-x6", className)}>
      <BandFailure
        title={t("detail.priceFail")}
        onRetry={onRetry}
        retrying={retrying}
      />
    </div>
  );
}
