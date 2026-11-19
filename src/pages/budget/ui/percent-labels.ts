import { CHART_TICK_LINE } from "@/shared/lib/groo/axisWidth";

/**
 * % 라벨(막대 위 값) 글자 — t2-static 12 / 16. 차트 그림 안 글이라 글자 크기 설정을 따르지 않는다(chart.md "글자 크기",
 * groo-design #260 — 값은 툴팁 · 표로 보기에서 크게 읽는다). SVG 글자는 var() 를 속성으로 못 받아 토큰(`--text-t2-static`)과 같은 값을
 * 적는다. 이웃과 겹침 · 바탕 상자는 같은 값(px)으로 센다
 */
export const PERCENT_LABEL_SIZE = "12px";
export const PERCENT_LABEL_PX = 12;
/** 값 글 줄 높이 — `--text-t2-static--line-height` 16px */
export const PERCENT_LABEL_LINE = 16;
const PERCENT_LABEL_GAP = 2;

/**
 * 막대 위 값 자리(px) — 그 글 줄 높이 + 4(chart.md "막대 위 값 자리") = 20. 차트 위 여백으로 잡아 막대 위 글이 차트 안에 선다
 */
export const BAR_VALUE_ROOM = PERCENT_LABEL_LINE + 4;

/**
 * 막대 위 값이 있는 차트의 위 여백 — 바탕 8 + 값 자리(앱 p_chart_cartesian `topPad = max(8 + 막대 위 값 자리, ⌈세로 눈금 줄 ÷ 2⌉)` 와
 * 같다 — 세로축이 없어도 같은 식). 값 자리(20)가 세로 눈금 줄 절반(8)보다 커 앞쪽이 이긴다 — 28. 둘 다 글자 크기 설정을 따르지 않아 고정값이다
 */
export const BAR_CHART_TOP = Math.max(
  8 + BAR_VALUE_ROOM,
  Math.ceil(CHART_TICK_LINE / 2),
);

/** 막대와 값 글 사이 */
export const BAR_VALUE_GAP = 4;

/**
 * 굵은 글 폭(px) — 캔버스로 재고, 못 재면(jsdom) 글자 수 × 0.62em 로 어림한다. [_fontKeys] 는 눈금 글꼴 판(`useTickFontVersion` —
 * 웹폰트 도착)을 열쇠로만 받는다(판을 버리면 React Compiler 가 대체 글꼴로 잰 값에 묶는다, axisWidth.ts `measureTextWidthAt`)
 */
export function textWidth(
  text: string,
  px: number,
  ..._fontKeys: number[]
): number {
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
  ...fontKeys: number[]
): boolean[] {
  const show = new Array<boolean>(texts.length).fill(false);
  let keptIdx = -1;
  let keptW = 0;
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    if (!t) continue;
    const w = textWidth(t, px, ...fontKeys);
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
