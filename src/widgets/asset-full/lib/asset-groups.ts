import { assetKrw, type Asset, type AssetType } from "@/entities/asset";
import { MASK } from "@/shared/lib/groo/money-text";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";
import { useHideAmounts } from "@/shared/lib/groo/hide-amounts-core";

/*
 * 자산 묶음 · 합계 · 줄 셈 — 자산 화면과 계좌 · 카드 관리가 **한 함수**를 쓴다(I-17 27).
 * 묶음은 계좌·예금 → 투자 → 카드 → 대출, 합계는 총액 포함 자산만 더하고 외화는 원화로 환산해 더한다.
 */

export const ACCOUNT_TYPES: AssetType[] = ["BANK_ACCOUNT", "SAVINGS", "CASH"];
export const CARD_TYPES: AssetType[] = ["CREDIT_CARD", "CHECK_CARD"];
export const INVESTMENT_TYPES: AssetType[] = ["INVESTMENT"];
export const LOAN_TYPES: AssetType[] = ["LOAN"];

/**
 * 줄에서 쓰는 원화 합계 — 서버 `balanceInKrw`(round(예수금 × 환율) + 보유 평가, I-13 길 A)를 읽는다. 라이브 시세가 켜졌으면
 * `useLiveAssets` 가 보유 평가 자리만 라이브로 바꾼 값이 들어 있다. 옛 서버(칸 없음)만 balance × 환율로 폴백.
 */
export const krwOf = (a: Asset) => assetKrw(a);

/**
 * 카드 사용률 — usage = abs(balance)/creditLimit*100. 한도에 가까워져도 색은 바꾸지 않는다(progress.md) —
 * 넘으면 막대가 끝까지 fg-critical + "N원 초과"(ds Progress limit).
 */
export function cardUsageOf(asset: Asset) {
  if (
    asset.assetType !== "CREDIT_CARD" ||
    asset.creditLimit == null ||
    asset.creditLimit <= 0
  ) {
    return null;
  }
  const used = Math.abs(asset.balance);
  return {
    used,
    limit: asset.creditLimit,
    over: Math.max(0, used - asset.creditLimit),
  };
}

/** 이 카드가 가려졌거나 이 자산만 가렸는가 */
export function useAssetHidden(card: HideCardKey, force = false) {
  return useHideAmounts(card) || force;
}

/** 이 카드가 가려졌거나 이 자산만 가렸으면 "••••" — 화면 카드와 자산 하나의 합집합 */
export function useAssetMask(card: HideCardKey, force = false) {
  const hidden = useAssetHidden(card, force);
  return (text: string) => (hidden ? MASK : text);
}

/**
 * 자산 목록 → 묶음 넷과 합계. 순자산 · 구성비 집계에는 '총액 포함' 자산만, 외화는 원화로 환산해 더한다 — 백엔드 summary 와 일치.
 * 카드 · 대출 합계는 크기(절댓값)이고 부호는 부르는 쪽이 붙인다.
 */
export function groupAssets(list: Asset[]) {
  const accounts = list.filter((a) => ACCOUNT_TYPES.includes(a.assetType));
  const cards = list.filter((a) => CARD_TYPES.includes(a.assetType));
  const investments = list.filter((a) =>
    INVESTMENT_TYPES.includes(a.assetType),
  );
  const loans = list.filter((a) => LOAN_TYPES.includes(a.assetType));
  const inTotal = (a: Asset) => a.isIncludedInTotal === "Y";
  const sumIncluded = (arr: Asset[]) =>
    arr.filter(inTotal).reduce((s, a) => s + krwOf(a), 0);
  return {
    accounts,
    cards,
    investments,
    loans,
    accountsTotal: sumIncluded(accounts),
    cardsTotal: Math.abs(sumIncluded(cards)),
    investmentsTotal: sumIncluded(investments),
    loansTotal: Math.abs(sumIncluded(loans)),
  };
}
