/** % 라벨 글자 크기 — rem(글자 크기 설정을 따른다). 이웃과 겹침 계산은 같은 값을 px 로 푼다 */
export const PERCENT_LABEL_SIZE = "0.75rem";
const PERCENT_LABEL_GAP = 2;

/** 루트 글자 크기(px) — 글자 크기 설정이 바꾸는 값 */
export function rootFontPx(): number {
  if (typeof document === "undefined") return 16;
  const v = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(v) && v > 0 ? v : 16;
}

/**
 * 루트 글자 크기 — 글자 크기 판(`useTickFontVersion`)을 열쇠로 받는다. 판을 버리고 부르면 React Compiler 가 처음 잰 값에 묶어
 * 페이지가 뜬 뒤 글자를 키워도 그대로였다(axisWidth.ts `measureTextWidthAt` 와 같은 까닭)
 */
export const rootFontPxAt = (..._fontKeys: number[]): number => rootFontPx();

/**
 * 막대 위 값 자리(px) — 그 글 줄 높이 + 4(chart.md "막대 위 값 자리도 글을 따릅니다", #250). 값 글은 12 / 16(`--text-t2` ·
 * 줄 1rem)이라 줄 높이 = 루트 글자 크기. 100% 20 · 200% 36 · 300% 52 — 차트 위 여백으로 잡아 100% 막대 위 글이 차트 안에 선다
 */
export const barValueRoom = (rootPx: number): number => Math.ceil(rootPx) + 4;

/**
 * 막대 위 값이 있는 차트의 위 여백 — 바탕 8 + 값 자리(앱 p_chart_cartesian `topPad = max(8 + 막대 위 값 자리, ⌈세로 눈금 줄 ÷ 2⌉)` 와
 * 같다 — 세로축이 없어도 같은 식). 값 자리가 늘 세로 눈금 줄 절반보다 커 앞쪽이 이긴다(100% 28 · 200% 44 · 300% 60)
 */
export const barChartTop = (rootPx: number, tickLine: number): number =>
  Math.max(8 + barValueRoom(rootPx), Math.ceil(tickLine / 2));

/** 막대와 값 글 사이 */
export const BAR_VALUE_GAP = 4;

/** 굵은 글 폭(px) — 캔버스로 재고, 못 재면(jsdom) 글자 수 × 0.62em 로 어림한다 */
export function textWidth(text: string, px: number): number {
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
