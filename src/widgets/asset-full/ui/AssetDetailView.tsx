import type { ReactNode } from "react";
import { Card } from "@/shared/ds/card";
import { cn } from "@/shared/lib/cn";
import { HideForce } from "@/shared/lib/groo/hide-amounts";
import type { Asset } from "@/entities/asset";
import { AssetAmount } from "./detail/AssetAmount";
import { AssetHead } from "./detail/AssetHead";
import { CardBilling } from "./detail/CardBilling";
import { CardLimit } from "./detail/CardLimit";
import { CardOverlays } from "./detail/CardOverlays";
import { CardPerfBadge } from "./detail/CardPerfBadge";
import { CardUsage } from "./detail/CardUsage";
import { HoldingsSection, TradeHistory } from "./detail/HoldingsSection";
import { RecentSection } from "./detail/RecentSection";
import { TrendSection } from "./detail/TrendSection";
import { useCardDetail } from "./detail/use-card-detail";
import { useAssetDetailModel } from "./detail/use-asset-detail";
import { useTxDetail } from "./detail/use-tx-detail";

/**
 * 자산 상세 본문(I-17 J) — 폰은 흰 면 하나(구역은 목록 제목 + 위 여백, 띠 · 카드 · 구분선 없음), 데스크톱 · 태블릿은 같은 구역을 카드에 나눠 담는다.
 *  신용카드 : 머리 → 결제 예정 · 키-값 · 이번 회차 구성 · 동작 → 한도 · 실적 → 이용 내역
 *             (1280 이상 왼쪽 청구 카드 → 8 → 한도 · 실적 카드 / 오른쪽 이용 내역 카드)
 *  그 밖    : 머리 → 금액 → (투자 보유 종목) → 추이 → (투자 거래 기록) → 최근 거래
 *             (1280 이상 왼쪽 금액 카드 → 8 → 추이 카드 / 오른쪽 최근 거래 카드, 연결형 체크카드는 왼쪽 금액 · 실적 하나)
 * 768 ~ 1279 는 한 칸 720 — 왼쪽 칸 차례 → 오른쪽 칸 차례로 위아래. 이 자산만 가렸으면 상세 안 금액을 전부 가린다(`HideForce`).
 */
export function AssetDetailView({
  asset,
  desk,
  mobile,
  onEdit,
}: {
  asset: Asset;
  /** 768 이상 — 같은 구역을 카드에 나눠 담는다. 폰이면 흰 면 하나 */
  desk: boolean;
  mobile: boolean;
  onEdit: () => void;
}) {
  const assetHidden = asset.isAmountHidden === "Y";
  const model = useAssetDetailModel(asset);
  const tx = useTxDetail(mobile);
  const credit = model.isCredit ? (
    <CreditBody
      asset={asset}
      desk={desk}
      onEdit={onEdit}
      onExpense={tx.openExpense}
    />
  ) : null;
  const other = !model.isCredit ? (
    <OtherBody
      asset={asset}
      model={model}
      desk={desk}
      mobile={mobile}
      onExpense={tx.openExpense}
      onTransfer={tx.openTransfer}
    />
  ) : null;
  return (
    <HideForce value={assetHidden}>
      {!desk && <AssetHead asset={asset} />}
      {credit}
      {other}
      {tx.node}
    </HideForce>
  );
}

/** 폰 끝 여백 24(흰 면 안) · 데스크톱은 카드 쌓기 */
function Stack({ desk, children }: { desk: boolean; children: ReactNode }) {
  return desk ? (
    <div className="flex flex-col gap-x2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-[var(--layout-gutter)]">
      {children}
    </div>
  ) : (
    <div className="pb-x6">{children}</div>
  );
}

/** 데스크톱 한 칸의 카드 묶음 — 한 칸일 때는 칸 상자가 사라져(contents) 카드가 차례로 쌓인다(8) */
function Col({ children }: { children: ReactNode }) {
  return (
    <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-x2">
      {children}
    </div>
  );
}

function DeskCard({
  children,
  amountFirst,
  slot,
}: {
  children: ReactNode;
  /** 금액 블록으로 시작하는 카드는 위 24(card.md:48), 목록으로 시작하면 위 12 */
  amountFirst?: boolean;
  slot: string;
}) {
  return (
    <Card body="list" data-slot={slot} className={cn(amountFirst && "pt-x3")}>
      {children}
    </Card>
  );
}

function CreditBody({
  asset,
  desk,
  onEdit,
  onExpense,
}: {
  asset: Asset;
  desk: boolean;
  onEdit: () => void;
  onExpense: (e: import("@/entities/expense").Expense) => void;
}) {
  const c = useCardDetail(asset);
  const billing = <CardBilling asset={asset} c={c} onEdit={onEdit} />;
  const limit = <CardLimit asset={asset} c={c} />;
  const usage = (
    <CardUsage asset={asset} c={c} onExpense={onExpense} first={desk} />
  );
  return (
    <>
      <Stack desk={desk}>
        {desk ? (
          <>
            <Col>
              <DeskCard amountFirst slot="asset-card-billing">
                {billing}
              </DeskCard>
              <DeskCard slot="asset-card-limit">{limit}</DeskCard>
            </Col>
            <Col>
              <DeskCard slot="asset-card-usage">{usage}</DeskCard>
            </Col>
          </>
        ) : (
          <>
            {billing}
            {limit}
            {usage}
          </>
        )}
      </Stack>
      <CardOverlays asset={asset} c={c} />
    </>
  );
}

function OtherBody({
  asset,
  model,
  desk,
  mobile,
  onExpense,
  onTransfer,
}: {
  asset: Asset;
  model: ReturnType<typeof useAssetDetailModel>;
  desk: boolean;
  mobile: boolean;
  onExpense: (e: import("@/entities/expense").Expense) => void;
  onTransfer: (t: import("@/entities/asset").AssetTransfer) => void;
}) {
  const amount = <AssetAmount asset={asset} model={model} />;
  const holdings = model.isInv ? (
    <HoldingsSection asset={asset} mobile={mobile} />
  ) : null;
  const trades = model.isInv ? <TradeHistory asset={asset} /> : null;
  const perf =
    model.isCard && !model.isCredit ? (
      <CardPerfBadge
        assetRowId={asset.rowId}
        masked={asset.isAmountHidden === "Y"}
      />
    ) : null;
  const trend = !model.isCheckLinked ? (
    <TrendSection asset={asset} model={model} desk={desk} first={desk} />
  ) : null;
  const recent = (
    <RecentSection
      asset={asset}
      model={model}
      onExpense={onExpense}
      onTransfer={onTransfer}
      first={desk}
    />
  );
  return (
    <Stack desk={desk}>
      {desk ? (
        <>
          <Col>
            <DeskCard amountFirst slot="asset-card-amount">
              {amount}
              {perf}
              {holdings}
              {trades}
            </DeskCard>
            {trend && <DeskCard slot="asset-card-trend">{trend}</DeskCard>}
          </Col>
          <Col>
            <DeskCard slot="asset-card-recent">{recent}</DeskCard>
          </Col>
        </>
      ) : (
        <>
          {amount}
          {perf}
          {holdings}
          {trend}
          {trades}
          {recent}
        </>
      )}
    </Stack>
  );
}
