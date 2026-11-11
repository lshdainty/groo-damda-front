/** % 라벨 글자 크기 — rem(글자 크기 설정을 따른다). 이웃과 겹침 계산은 같은 값을 px 로 푼다 */
export const PERCENT_LABEL_SIZE = "0.75rem";
const PERCENT_LABEL_GAP = 2;

/** 루트 글자 크기(px) — 글자 크기 설정이 바꾸는 값 */
export function rootFontPx(): number {
  if (typeof document === "undefined") return 16;
  const v = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(v) && v > 0 ? v : 16;
}

/** 굵은 글 폭(px) — 캔버스로 재고, 못 재면(jsdom) 글자 수 × 0.62em 로 어림한다 */
function textWidth(text: string, px: number): number {
  try {
    if (/jsdom/i.test(navigator.userAgent)) throw new Error("no canvas");
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `700 ${px}px ${getComputedStyle(document.body).fontFamily}`;
      const w = ctx.measureText(text).width;
      if (w > 0) return w;
    }
  } catch {
    /* 어림값으로 */
  }
  return text.length * px * 0.62;
}

/**
 * 겹치는 % 라벨은 끝(가장 최근 달)을 지키고 앞에서부터 건너뛴다 — 차트 눈금 규칙(preserveEnd)과 같다.
 * step = 막대 한 칸의 폭(막대 중심 간격)
 */
export function visiblePercentLabels(
  texts: (string | null)[],
  step: number,
  px: number,
): boolean[] {
  const show = new Array<boolean>(texts.length).fill(false);
  let keptIdx = -1;
  let keptW = 0;
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    if (!t) continue;
    const w = textWidth(t, px);
    if (
      keptIdx < 0 ||
      (keptIdx - i) * step >= (keptW + w) / 2 + PERCENT_LABEL_GAP
    ) {
      show[i] = true;
      keptIdx = i;
      keptW = w;
    }
  }
  return show;
}
