import type { TFunction } from "i18next";
import { decodeHtml } from "@/shared/lib";
import type { CardBenefitType, CardCatalogSummary } from "@/entities/card";

/** 천 단위 쉼표 */
export function formatKRW(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

/** 글 속 네 자리 이상 숫자에 쉼표 — 서버 라벨 원문 "국내 5000원" 을 "국내 5,000원" 으로 보이기만 한다 */
export function commaDigits(text: string) {
  return text.replace(/\d{4,}/g, (m) => formatKRW(Number(m)));
}

/**
 * 줄의 연회비 글(I-20 E 32) — 금액 > 0 "연회비 {n}원" · 라벨만 "연회비 {라벨}" · 무료 "연회비 없음" · 모름 "연회비 정보 없음".
 * annualFee 가 null 이면 백엔드가 "연회비 정보를 모른다" 고 알린 것이고, amount 0 · 라벨 없음은 안 받는 카드다.
 */
export function annualFeeRowText(s: CardCatalogSummary, t: TFunction) {
  if (!s.annualFee) return t("benefit.annualFeeUnknown");
  if (s.annualFee.amount > 0)
    return t("benefit.annualFeeAmount", {
      amount: formatKRW(s.annualFee.amount),
    });
  if (s.annualFee.label)
    return t("benefit.annualFeeLabel", {
      label: commaDigits(decodeHtml(s.annualFee.label)),
    });
  return t("benefit.annualFeeNone");
}

/** 줄의 실적 글 — "실적 {n}원" · "실적 없음" */
export function performanceRowText(s: CardCatalogSummary, t: TFunction) {
  if (s.performance.isRequired === "Y" && s.performance.requiredAmount > 0) {
    return t("benefit.performanceAmount", {
      amount: formatKRW(s.performance.requiredAmount),
    });
  }
  if (s.performance.isRequired === "Y" && s.performance.requiredText) {
    return decodeHtml(s.performance.requiredText);
  }
  return t("benefit.performanceNone");
}

/** 상세 키-값의 연회비 — 라벨 그대로, 4자리 이상 숫자에 쉼표 */
export function annualFeeDetailText(s: CardCatalogSummary, t: TFunction) {
  if (!s.annualFee) return t("benefit.feeUnknown");
  if (s.annualFee.amount > 0)
    return t("benefit.annualFeeDomestic", {
      amount: formatKRW(s.annualFee.amount),
    });
  return s.annualFee.label
    ? commaDigits(decodeHtml(s.annualFee.label))
    : t("benefit.feeFree");
}

/** 상세 키-값의 전월 실적 — "{n}원 이상" · "실적 없음" */
export function performanceDetailText(s: CardCatalogSummary, t: TFunction) {
  if (s.performance.isRequired === "Y") {
    if (s.performance.requiredAmount > 0) {
      return t("benefit.performanceAtLeast", {
        amount: formatKRW(s.performance.requiredAmount),
      });
    }
    return (
      (s.performance.requiredText && decodeHtml(s.performance.requiredText)) ||
      t("benefit.performanceNone")
    );
  }
  return t("benefit.performanceNone");
}

const BENEFIT_TYPE_KEY: Record<CardBenefitType, string> = {
  DISCOUNT: "benefitType.discount",
  POINT: "benefitType.point",
  MILEAGE: "benefitType.mileage",
};

/** 혜택 유형 글 — 할인 · 적립 · 마일리지 (서버 값은 셋뿐이다) */
export function benefitTypeText(type: CardBenefitType, t: TFunction) {
  return t(BENEFIT_TYPE_KEY[type]);
}

/** "{카드사} · {신용|체크} · {혜택 유형}" 세 조각(빈 카드사는 뺀다) */
export function cardMetaParts(
  s: CardCatalogSummary,
  companyName: string,
  t: TFunction,
  tAsset: TFunction,
): string[] {
  return [
    companyName,
    s.cardType === "CREDIT"
      ? tAsset("cardTypeShort.credit")
      : tAsset("cardTypeShort.check"),
    benefitTypeText(s.benefitType, t),
  ].filter((x) => x.trim() !== "");
}

/** 혜택 거르기 값 — 서버는 DISCOUNT · MILEAGE · POINT 셋뿐이다("캐시백" 칩은 걷었다 — E 31) */
export type BenefitFilterKey = "all" | "DISCOUNT" | "POINT" | "MILEAGE";
export type TypeFilterKey = "all" | "CREDIT" | "CHECK";

export const BENEFIT_FILTER_KEYS: BenefitFilterKey[] = [
  "all",
  "DISCOUNT",
  "POINT",
  "MILEAGE",
];
export const TYPE_FILTER_KEYS: TypeFilterKey[] = ["all", "CREDIT", "CHECK"];

/** 쪽당 장수 — 폰 끝없이 불러오기(지금 값 그대로) · 데스크톱 쪽 넘김(Q8 8-B 20장) */
export const PHONE_PAGE_SIZE = 60;
export const DESKTOP_PAGE_SIZE = 20;
