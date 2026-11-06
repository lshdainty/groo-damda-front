import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle } from "@/shared/ds/card";
import { useWideSurface } from "@/shared/ds/overlay/use-wide-surface";
import {
  CompositionBody,
  type CompositionView,
} from "@/features/stock/ui/phone/composition";
import { BandTitle } from "@/features/stock/ui/phone/phone-parts";
import { StockSearchEntry } from "@/features/stock/ui/phone/stock-search";

/* 증권 데스크톱 · 태블릿 카드(I-13 29 · 30) */

/**
 * 종목 카드 — 머리(제목 "종목" + 오른쪽 찾는 칸 입구 폭 240) 아래에 Chip Tabs · 목록.
 * 카드 `body="list"` 라 줄이 가장자리까지 가고 누름 바탕은 좌우 6 들어온다. 입구를 누르면 1280 이상 Popover · 미만 Bottom Sheet.
 */
export function StocksCard({
  onPick,
  children,
}: {
  onPick: (symbol: string) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("stocks");
  return (
    <Card body="list" aria-labelledby="stocks-list-title">
      <CardHeader>
        <CardTitle id="stocks-list-title">{t("list.title")}</CardTitle>
        <StockSearchEntry
          compact
          className="w-60 shrink-0"
          onPick={(item) => onPick(item.symbol)}
        />
      </CardHeader>
      <div className="mt-x2">{children}</div>
    </Card>
  );
}

/**
 * 포트폴리오 구성 카드 — 머리 "포트폴리오 구성" + 도넛 · 범례.
 * 1280 이상(좁은 오른쪽 열)은 도넛 112 위 · 범례 아래, 768 ~ 1279(넓은 한 칸)는 도넛 120 왼쪽 · 범례 오른쪽(사이 24).
 */
export function CompositionCard({
  data,
  loading,
  failed,
  onRetry,
}: {
  data: CompositionView;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation("stocks");
  const wide = useWideSurface();
  return (
    <Card className="p-0" aria-labelledby="stocks-composition-title">
      <BandTitle id="stocks-composition-title">
        {t("portfolio.title")}
      </BandTitle>
      <CompositionBody
        titled
        side={!wide}
        data={data}
        loading={loading}
        failed={failed}
        onRetry={onRetry}
      />
    </Card>
  );
}
