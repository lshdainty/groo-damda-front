import { useEffect, useState, useSyncExternalStore } from "react";
import { niceAxis } from "./chartAxis";

/**
 * 세로축(Y) 폭 — 눈금 글자 중 **가장 긴 것**을 실제로 재서 잡는다(스펙 chart.md "세로축의 폭은 가장
 * 긴 글자('−3,000만')가 잘리지 않게", 결함 D6). 고정 폭(44 · 52)은 음수 부호 하나로 첫 글자가 잘렸다.
 *
 * 숨은 span 에 눈금 글자와 같은 글꼴 · 크기(`--text-t1`, rem 이라 글자 크기 200% 도 따라간다)를
 * 주고 `getBoundingClientRect().width` 를 읽는다. 레이아웃이 없는 환경(jsdom)이면 글자 수 추정치로 돌아간다.
 * 웹폰트가 늦게 도착하면 `document.fonts.ready` 뒤에 한 번 더 잰다.
 */
export const AXIS_TICK_FONT_SIZE = "var(--text-t1)";
/**
 * 눈금 글자 옆 여백 — recharts 가 축 폭에서 따로 덜어 가는 것의 합이다. ds 차트 `chartAxisProps` 는 tickMargin 8 을 주고
 * tickLine 만 끌 뿐 tickSize(기본 6)는 그대로라 글자는 축 끝에서 6 + 8 = 14 안쪽에 놓인다. 여기에 올림 오차 2 를 더해 16.
 * 예전 10 은 글자 끝이 4 만큼 잘렸다("1,300만" → "300만", 360 · 390 에서 확인).
 */
const AXIS_PAD = 16;

const estimate = (s: string): number =>
  [...s].reduce((w, c) => w + (c > "ᄀ" ? 11 : 7), 0);

/** 눈금 글자 가운데 가장 긴 것의 폭(여백 없이) — 세로축 폭 · 가로 눈금 솎기가 같이 쓴다 */
export function measureTextWidth(labels: readonly string[]): number {
  if (typeof document === "undefined" || labels.length === 0) {
    return Math.max(0, ...labels.map(estimate));
  }
  const span = document.createElement("span");
  span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0;font-size:${AXIS_TICK_FONT_SIZE};font-weight:400;font-variant-numeric:tabular-nums;`;
  document.body.appendChild(span);
  let max = 0;
  try {
    for (const l of labels) {
      span.textContent = l;
      max = Math.max(max, span.getBoundingClientRect().width);
    }
  } finally {
    span.remove();
  }
  if (max === 0) max = Math.max(0, ...labels.map(estimate));
  return Math.ceil(max);
}

export function measureTickWidth(labels: readonly string[]): number {
  return measureTextWidth(labels) + AXIS_PAD;
}

/*
 * 눈금 글자 크기가 바뀐 것을 알린다 — 글자 크기 설정(rem)은 페이지가 떠 있는 동안에도 바뀐다(브라우저 글자 크기 · html font-size).
 * 바뀐 뒤에도 옛 폭 · 옛 솎기에 머물면 세로축 글이 왼쪽 밖으로 잘리고 가로 글이 맞붙는다(chart.md "큰 글자" — 글자가 커지면 다시 잰다).
 * 눈금 글자와 같은 크기(`AXIS_TICK_FONT_SIZE`)의 숨은 글 하나를 ResizeObserver 로 지켜, 폭이 바뀔 때마다 판(version)을 올린다.
 * 웹폰트가 늦게 도착해 글 폭이 바뀌어도 같이 잡힌다. 지켜보는 쪽이 없으면 숨은 글을 걷는다.
 */
let tickFontVersion = 0;
const tickFontListeners = new Set<() => void>();
let tickFontProbe: { el: HTMLElement; observer: ResizeObserver } | null = null;

function subscribeTickFont(onChange: () => void): () => void {
  tickFontListeners.add(onChange);
  if (
    !tickFontProbe &&
    typeof document !== "undefined" &&
    typeof ResizeObserver !== "undefined"
  ) {
    const el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;left:-9999px;top:0;font-size:${AXIS_TICK_FONT_SIZE};font-variant-numeric:tabular-nums;`;
    el.textContent = "0000";
    document.body.appendChild(el);
    let last = el.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = el.getBoundingClientRect().width;
      if (width === last) return;
      last = width;
      tickFontVersion += 1;
      tickFontListeners.forEach((l) => l());
    });
    observer.observe(el);
    tickFontProbe = { el, observer };
  }
  return () => {
    tickFontListeners.delete(onChange);
    if (tickFontListeners.size === 0 && tickFontProbe) {
      tickFontProbe.observer.disconnect();
      tickFontProbe.el.remove();
      tickFontProbe = null;
    }
  };
}

/** 지금 눈금 글자 크기의 판 — 바뀔 때마다 1 씩 오른다. 잰 값을 기억해 둘 때 열쇠에 넣는다 */
export const readTickFontVersion = (): number => tickFontVersion;

/** 눈금 글자 크기가 바뀌면 다시 그린다 — 판을 돌려준다(ds Chart · useAxisWidth 가 쓴다) */
export function useTickFontVersion(): number {
  return useSyncExternalStore(subscribeTickFont, readTickFontVersion, () => 0);
}

/*
 * 글자 크기 판을 받는 잼 — 판([fontKeys])은 셈에 쓰지 않고 열쇠로만 받는다. 컴포넌트 · 훅이 판을 버리고(`useTickFontVersion();`)
 * 측정만 부르면 React Compiler 가 의존 없는 셈으로 보고 처음 잰 값에 묶는다 — 페이지가 뜬 뒤 글자를 키워도 그대로였다(이음 QA
 * 2026-11-18, `useTickLineHeight`). 판을 인자로 넘기면 판이 바뀔 때 컴파일러도 다시 잰다.
 */
export const measureTextWidthAt = (
  labels: readonly string[],
  ..._fontKeys: number[]
): number => measureTextWidth(labels);
export const measureTickWidthAt = (
  labels: readonly string[],
  ..._fontKeys: number[]
): number => measureTickWidth(labels);

/** 눈금 글 사이 구분 — 눈금 글에 나오지 않는 글자 */
const LABEL_SEPARATOR = "\u0000";

export function useAxisWidth(labels: readonly string[]): number {
  const fontVersion = useTickFontVersion();
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => live && setFontTick((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);
  // 글 목록은 내용(key)으로 넘긴다 — 쓰는 쪽이 렌더마다 새 배열을 줘도 컴파일러가 같은 글이면 다시 재지 않는다.
  // 글자 크기 판 · 웹폰트 도착도 열쇠로 넘긴다(전엔 손 useMemo + eslint-disable 이라 컴파일러가 이 훅을 통째로 건너뛰었다)
  const key = labels.join(LABEL_SEPARATOR);
  return measureTickWidthAt(
    key === "" ? [] : key.split(LABEL_SEPARATOR),
    fontVersion,
    fontTick,
  );
}

/** `YAxis` 에 펼치는 값 축 — 그리는 눈금과 폭을 잰 눈금이 같은 목록이다 */
export interface ValueAxisProps {
  domain: [number, number];
  ticks: number[];
  tickFormatter: (v: number) => string;
  width: number;
  /**
   * 0 — 준 눈금을 하나도 빼지 않고 그린다. recharts 세로축의 기본(`"preserveEnd"`)은 **준 눈금(`ticks`)도** 글 높이 + `minTickGap`(8)
   * 으로 겹침을 재 사이 눈금을 빼고, 그리는 자리 아래 끝에 걸친 0 도 뺀다 — 그래서 "−6만 · −4만 · 0"(−2만 빠짐) · "50조 · 150조"
   * (0 · 100조 빠짐)처럼 고르지 않게 남았다(2026-11-18 QA). 세로 눈금은 1 · 2 · 5 간격 nice 눈금 그대로 그린다(chart.md "축 · 격자",
   * 앱 `p_chart_cartesian` 도 세로 눈금을 칸마다 그린다 — `interval: 1`). 가로축 솎기(끝 글을 지킨다)는 `chartXAxisProps` 몫이다.
   */
  interval: 0;
}

const valueAxisOf = (
  ticks: number[],
  format: (v: number, ticks: readonly number[]) => string,
): ValueAxisProps => {
  const tickFormatter = (v: number) => format(v, ticks);
  return {
    domain: [ticks[0]!, ticks[ticks.length - 1]!],
    ticks,
    tickFormatter,
    width: measureTickWidth(ticks.map(tickFormatter)),
    interval: 0,
  };
};

/** 기본 칸 수 — 앱 `niceChartAxis` 의 intervals 4 와 같다 */
const NICE_STEPS = 4;

/**
 * 1 · 2 · 5 축을 [maxIntervals] 칸 안에 든 것으로 — 기본(네 칸 겨냥)이 들면 그대로, 넘치면 겨냥하는 칸 수를 하나씩 줄여 다시 센다
 * (chart.md "세로 눈금이 겹치면 수를 줄입니다"). 한 칸 겨냥까지 내려도 넘치면 그 축을 쓴다(값 범위가 0 을 사이에 두면 두 칸).
 */
function fittedAxes<T>(
  maxIntervals: number,
  build: (targetSteps: number) => { axes: T; intervals: number },
): T {
  for (let t = NICE_STEPS; t > 1; t--) {
    const r = build(t);
    if (r.intervals <= maxIntervals) return r.axes;
  }
  return build(1).axes;
}

/**
 * 값 축 하나 — `niceAxis` 눈금(앱 `niceChartAxis` 와 같은 셈)을 recharts 에 그대로 주고, 그 눈금 글자 가운데 가장 긴 것으로
 * 폭을 잰다(스펙 chart.md "세로축의 폭은 가장 긴 글자가 잘리지 않게"). `<YAxis {...niceValueAxis(값들, formatAxisWon)} {...chartAxisProps()} />`.
 * 값은 지금 보이는 계열만 넘긴다 — 계열을 끄면 축이 남은 계열에 맞게 다시 잡힌다(recharts 자동 범위와 같다).
 * 값이 모두 0 이면 0 ~ 1만(0 · 0.2만 · … · 1만)이다 — 앱 `niceChartAxis` 와 같다.
 *
 * 글자([format])는 눈금 목록을 함께 받는다 — 한 축은 한 단위라(chart.md "축 · 격자") 눈금 하나의 글자도 축 전체를 보고
 * 정한다. 그리는 글자와 폭을 잰 글자가 같은 목록 · 같은 셈이다.
 *
 * [maxIntervals] — 세로 눈금 글이 겹치지 않고 들어가는 칸 수(`chartValueIntervals` — 화면이 그리는 높이 · 눈금 줄 높이로 잰다).
 * 눈금 사이가 눈금 글 줄 높이보다 좁아지면 칸 수를 줄여 1 · 2 · 5 축을 다시 센다(chart.md "세로 눈금이 겹치면 수를 줄입니다").
 */
export function niceValueAxis(
  values: readonly number[],
  format: (v: number, ticks: readonly number[]) => string,
  maxIntervals = Infinity,
): ValueAxisProps {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const ticks = fittedAxes(maxIntervals, (t) => {
    const a = niceAxis(lo, hi, t);
    return { axes: a.ticks, intervals: a.ticks.length - 1 };
  });
  return valueAxisOf(ticks, format);
}

/**
 * 이중 축(왼쪽 · 오른쪽) — 축마다 `niceAxis` 간격을 따로 잡고, 0 위 · 아래 칸 수를 둘 가운데 많은 쪽에 맞춘다(앱
 * `p_chart_cartesian` 의 `above` · `below` 와 같은 셈). 두 축의 눈금이 같은 높이에 서서 한 축에 건 가로 격자(chart.md "이중 축")에
 * 다른 축 눈금도 맞는다. 칸 수가 적은 축은 위(또는 아래)로 늘어난다 — 수입이 모두 0 이면 왼쪽 0 ~ 1만(다섯 칸), 지출 0 ~ 6만(세 칸)은
 * 0 ~ 10만(다섯 칸)이 된다. 값 · 글자는 [niceValueAxis] 와 같다.
 *
 * [maxIntervals] — 맞춘 뒤의 칸 수(위 + 아래)가 넘치면 두 축을 함께 더 적은 칸으로 다시 센다(겨냥하는 칸 수를 둘 다 같이 줄인다).
 */
export function niceDualValueAxes(
  left: readonly number[],
  right: readonly number[],
  format: (v: number, ticks: readonly number[]) => string,
  maxIntervals = Infinity,
): { left: ValueAxisProps; right: ValueAxisProps } {
  const steps = fittedAxes(maxIntervals, (t) => {
    const axes = [left, right].map((values) => {
      const a = niceAxis(Math.min(0, ...values), Math.max(0, ...values), t);
      const step = a.ticks[1]! - a.ticks[0]!;
      return {
        step,
        above: Math.round(a.max / step),
        below: Math.round(-a.min / step),
      };
    });
    const above = Math.max(...axes.map((a) => a.above));
    const below = Math.max(...axes.map((a) => a.below));
    return {
      axes: { above, below, steps: axes.map((a) => a.step) },
      intervals: above + below,
    };
  });
  const [l, r] = steps.steps.map((step) =>
    valueAxisOf(
      Array.from(
        { length: steps.below + steps.above + 1 },
        // + 0 — 0 칸이 −0 이 되지 않게
        (_, i) => Math.round((i - steps.below) * step) + 0,
      ),
      format,
    ),
  );
  return { left: l!, right: r! };
}

/** 눈금 글과 그리는 자리 사이 — ds `chartAxisProps` 의 tickMargin 8 */
const X_TICK_MARGIN = 8;

/** 가로 눈금 줄 높이 — 눈금 글 줄 높이 + 8(100% 23 · 200% 38). ds Chart 가 시간 가로축(chartXAxisProps)에 준다(앱 같은 셈) */
export const chartXAxisHeight = (lineHeight: number): number =>
  Math.ceil(lineHeight) + X_TICK_MARGIN;
/** 눈금 글 줄 높이(`--text-t1--line-height` = 15 / 16rem) — 잴 수 없을 때(jsdom) 100% 값 */
const TICK_LINE_FALLBACK = 15;

/** 눈금 글 줄 높이(px) — rem 이라 글자 크기 설정을 따른다(100% 15 · 200% 30) */
export function measureTickLineHeight(): number {
  if (typeof document === "undefined") return TICK_LINE_FALLBACK;
  const span = document.createElement("span");
  span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0;display:block;font-size:${AXIS_TICK_FONT_SIZE};line-height:var(--text-t1--line-height);`;
  span.textContent = "0";
  document.body.appendChild(span);
  try {
    return span.getBoundingClientRect().height || TICK_LINE_FALLBACK;
  } finally {
    span.remove();
  }
}

/** 눈금 글 줄 높이 — 글자 크기 판([measureTextWidthAt] 와 같은 까닭으로 판을 열쇠로 받는다) */
export const measureTickLineHeightAt = (..._fontKeys: number[]): number =>
  measureTickLineHeight();

/**
 * 눈금 글 줄 높이 — 글자 크기가 바뀌면 다시 잰다(ds Chart 의 가로 눈금 · 세로축 폭과 같은 판). 판을 버리고 측정만 부르면
 * React Compiler 가 처음 잰 값에 묶어, 페이지가 뜬 뒤 글자를 키워도 세로 눈금 칸 수(chartValueIntervals)가 그대로였다.
 */
export function useTickLineHeight(): number {
  const fontVersion = useTickFontVersion();
  return measureTickLineHeightAt(fontVersion);
}

/**
 * 세로 눈금 글이 겹치지 않고 들어가는 칸 수 — 눈금 사이(그리는 높이 ÷ 칸 수)가 눈금 글 줄 높이 이상이어야 한다
 * (chart.md "세로 눈금이 겹치면 수를 줄입니다").
 *
 *   그리는 높이 = 차트 높이 − 위 여백 − 아래 여백 − (눈금 글 줄 높이 + 8)   — 가로 눈금 줄(chartXAxisHeight)
 *   들어가는 칸 수 = max(1, ⌊그리는 높이 ÷ 눈금 글 줄 높이⌋)
 *
 * 여백은 차트에 준 margin(없으면 recharts 기본 5 · 5 — 앱엔 아래 여백이 없어 웹만 그만큼 더 뺀다). 폰 띠 140(위 8 · 아래 0) ·
 * 글자 200%(줄 30) → 그리는 높이 140 − 8 − 0 − 38 = 94 → ⌊94 ÷ 30⌋ = 3 칸(앱과 같다).
 */
export function chartValueIntervals(
  height: number,
  lineHeight: number,
  { top = 5, bottom = 5 }: { top?: number; bottom?: number } = {},
): number {
  const plot = height - top - bottom - chartXAxisHeight(lineHeight);
  return Math.max(1, Math.floor(plot / Math.max(1, lineHeight)));
}
