import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/cn";
import { BandFailure } from "@/shared/ui/groo/band-parts";

/**
 * 시세를 받지 못했다 — 그 섹션 머리 아래 실패 띠 한 줄 "시세를 불러오지 못했어요" + [다시 시도](I-wrap-b2b 단계 4).
 * 받아 둔 숫자가 있으면 숫자는 그대로 두고 이 띠가 "지금 시세가 아니다" 를 말한다. 다음 폴링이 성공하면 부르는 쪽이 걷는다.
 * "마지막으로 받은 시각" 은 두지 않는다(새 모양이 된다 — 이 띠가 같은 일을 한다).
 */
export function PriceFailBand({
  onRetry,
  band = true,
  className,
}: {
  onRetry: () => void;
  /** 좌우 24 를 둔다 — 폰 띠 · 여백 없는 카드(p-0). 여백 있는 카드 안이면 false */
  band?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("stocks");
  // 좌우 여백은 감싸는 상자가 맡는다 — BandFailure 의 band 여백은 카드 안에서 0 으로 덮인다(여백 없는 카드에서도)
  return (
    <div data-slot="price-fail-band" className={cn(band && "px-x6", className)}>
      <BandFailure title={t("detail.priceFail")} onRetry={onRetry} />
    </div>
  );
}
