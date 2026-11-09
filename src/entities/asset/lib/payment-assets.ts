import type { Asset, AssetType } from "../model/types";

/** 결제 수단 → 허용 자산 타입. null이면 전체 허용. 거래 · 반복 · 프리셋 폼이 한 벌을 쓴다. */
export const PAYMENT_ASSET_TYPES: Record<string, AssetType[] | null> = {
  CASH: ["CASH"],
  CARD: ["CREDIT_CARD", "CHECK_CARD"],
  TRANSFER: ["BANK_ACCOUNT", "SAVINGS"],
  OTHER: null,
};

/**
 * 결제 수단 + 거래 종류로 계좌 · 카드를 거른다.
 *
 * 지출에선 예 · 적금(SAVINGS: 청약 · 정기예금 · 정기적금)을 뺀다 — 만기 전까지 묶인 돈이라
 * 거기서 직접 결제나 출금이 나가지 않는다(쓰려면 해지해서 입출금으로 옮긴다). 납입 · 해지는 이체로 처리한다.
 * 수입은 이자가 그 계좌로 직접 들어오므로 남긴다. 결제 수단이 비었으면(없음) 수단으로는 거르지 않는다.
 */
export function allowAssetFor(
  asset: Pick<Asset, "assetType">,
  paymentMethod: string | null | undefined,
  type: string,
): boolean {
  const allowed = paymentMethod ? PAYMENT_ASSET_TYPES[paymentMethod] : null;
  if (allowed && !allowed.includes(asset.assetType)) return false;
  if (type === "EXPENSE" && asset.assetType === "SAVINGS") return false;
  return true;
}
