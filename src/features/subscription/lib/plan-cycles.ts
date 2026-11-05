import type { SubscriptionPlan } from "../api/subscriptionApi";

/** 결제 주기 — 서버 요금제 행의 기간(`durationMonths`)으로 가른다: 1 월간 · 12 연간 */
export type Cycle = "monthly" | "yearly";

export const MONTHLY_MONTHS = 1;
export const YEARLY_MONTHS = 12;

/** 월간 · 연간 요금제 행 — 없으면 null(서버가 그 주기를 주지 않는다) */
export interface CyclePlans {
  monthly: SubscriptionPlan | null;
  yearly: SubscriptionPlan | null;
}

/**
 * 요금제 목록에서 월간(1개월) · 연간(12개월) 행을 고른다. 가격이 없는 행은 그리지 못하므로 없는 것으로 본다.
 * 같은 주기가 여럿이면 목록의 앞(서버 정렬 순)을 쓴다.
 */
export function pickCyclePlans(
  plans: readonly SubscriptionPlan[] | undefined,
): CyclePlans {
  const find = (months: number) =>
    plans?.find((p) => p.durationMonths === months && p.price != null) ?? null;
  return { monthly: find(MONTHLY_MONTHS), yearly: find(YEARLY_MONTHS) };
}

/**
 * 연간 할인율(%) — `round((1 − 연간 ÷ (월간 × 12)) × 100)`. 서버 가격으로 계산한다(화면에 숫자를 박지 않는다).
 */
export function yearlySavePct(monthlyPrice: number, yearlyPrice: number) {
  if (monthlyPrice <= 0) return 0;
  return Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
}

/** 구독 중인 플랜의 주기 — 12개월이면 연간, 아니면(1개월 · 모름) 월간 */
export function cycleOfDuration(durationMonths: number | null | undefined) {
  return durationMonths === YEARLY_MONTHS ? "yearly" : "monthly";
}
