import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  const key = labels.join("|");
  return useMemo(
    () => measureTickWidth(labels),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key 가 labels 내용을 대신한다
    [key, fontTick, fontVersion],
  );
}

/** `YAxis` 에 펼치는 값 축 — 그리는 눈금과 폭을 잰 눈금이 같은 목록이다 */
export interface ValueAxisProps {
  domain: [number, number];
  ticks: number[];
  tickFormatter: (v: number) => string;
  width: number;
}

/**
 * 값 축 하나 — `niceAxis` 눈금(앱 `niceChartAxis` 와 같은 셈)을 recharts 에 그대로 주고, 그 눈금 글자 가운데 가장 긴 것으로
 * 폭을 잰다(스펙 chart.md "세로축의 폭은 가장 긴 글자가 잘리지 않게"). `<YAxis {...niceValueAxis(값들, formatAxisWon)} {...chartAxisProps()} />`.
 * 값은 지금 보이는 계열만 넘긴다 — 계열을 끄면 축이 남은 계열에 맞게 다시 잡힌다(recharts 자동 범위와 같다).
 *
 * 글자([format])는 눈금 목록을 함께 받는다 — 한 축은 한 단위라(chart.md "축 · 격자") 눈금 하나의 글자도 축 전체를 보고
 * 정한다. 그리는 글자와 폭을 잰 글자가 같은 목록 · 같은 셈이다.
 */
export function niceValueAxis(
  values: readonly number[],
  format: (v: number, ticks: readonly number[]) => string,
): ValueAxisProps {
  const a = niceAxis(Math.min(0, ...values), Math.max(0, ...values));
  const tickFormatter = (v: number) => format(v, a.ticks);
  return {
    domain: [a.min, a.max],
    ticks: a.ticks,
    tickFormatter,
    width: measureTickWidth(a.ticks.map(tickFormatter)),
  };
}
