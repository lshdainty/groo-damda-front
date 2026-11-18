import { money } from "@/shared/lib/groo/format";

/**
 * 지난달 대비 차액이 이보다 작으면 금액을 말하지 않고 "비슷하게 쓰고 있어요" 로 넘긴다.
 *
 * 예전엔 `Math.abs(Math.round(diff / 10000)) < 1` 이 이 문턱이었다 — 만원 반올림의
 * 부산물이라 값이 코드에 안 적혀 있었다. 반올림을 걷어내면서 같은 5,000 원을
 * 이름 있는 상수로 남긴다(문턱 자체는 그대로다).
 */
export const INSIGHT_SAME_MAX = 5_000;

/**
 * "지난달보다 {{amount}} 덜/더 쓰는 중" 문장에 넣을 금액.
 *
 * 문장 속 돈도 줄이지 않는다 — `money`("11,881원" · "₩11,881", International Design "돈", groo-design #252).
 * 예전엔 `KRW(Math.round(diff / 10000))만원` 으로 만원 반올림을 해 11,881 원 차이가 `1만원` 이 되었고(QA #38),
 * 그 뒤로는 `formatChartAxis` 로 `1.2만원` 처럼 줄였다.
 */
export const insightDiffAmount = (diff: number): string =>
  money(Math.abs(diff));
