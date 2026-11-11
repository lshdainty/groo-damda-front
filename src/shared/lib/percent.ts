/**
 * 진행률 % 표기 규칙 — i18n 에 기대지 않는 순수 모듈이라 ds 와 groo/format 이 함께 쓴다.
 *
 * 규칙(사용자 결정 1A: 진행률은 정수 + 100 경계는 디자인시스템 판단 2026-11-07. 앱 `core/format/percent.dart` 의 `formatProgress` 와 같은 표):
 * 정수 반올림. 단 반올림해서 100 이 되는 값은 100 미만이면 99(99.6 → 99%), 100 초과면 101(100.3 → 101%)
 * — 100% 는 정확히 100 일 때만. 음수는 크기를 같은 식으로 센 뒤 U+2212 를 붙인다(반올림해 0 이면 부호 없음).
 * 유한하지 않은 값은 `—`.
 */
const MINUS = "−";

/** 부호 없는 크기의 진행률 정수. */
function roundMagnitude(pct: number): number {
  const r = Math.round(pct);
  if (r === 100 && pct !== 100) return pct < 100 ? 99 : 101;
  return r;
}

/** 진행률 정수(음수 포함). 유한하지 않으면 NaN. 글자가 아닌 숫자가 필요한 자리용. */
export function progressPercentValue(pct: number): number {
  if (!Number.isFinite(pct)) return NaN;
  if (pct < 0) {
    const m = roundMagnitude(-pct);
    return m === 0 ? 0 : -m;
  }
  return roundMagnitude(pct);
}

/** 정수 천 단위 쉼표 — 금액 · 개수와 같은 규칙(로케일과 상관없이 `,`). 1000% 이상도 `1,234%`. */
export function groupInt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** 진행률 글자 — "76%" · "1,234%"(천 단위 쉼표). 값은 0~100 단위 퍼센트. */
export function progressPercentText(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const v = progressPercentValue(pct);
  return v < 0 ? `${MINUS}${groupInt(-v)}%` : `${groupInt(v)}%`;
}
