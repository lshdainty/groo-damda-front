import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  chartValueIntervals,
  measureTickWidth,
  niceDualValueAxes,
  niceValueAxis,
  readTickFontVersion,
  useAxisWidth,
} from "./axisWidth";
import { createChartXGroup } from "@/shared/ds/chart";

describe("measureTickWidth (D6)", () => {
  it("가장 긴 눈금 글자에 맞춘다 — 음수 부호가 붙은 쪽이 더 넓다", () => {
    const pos = measureTickWidth(["0", "2,500만"]);
    const neg = measureTickWidth(["0", "−2,500만"]);
    expect(neg).toBeGreaterThan(pos);
  });
  it("눈금이 늘어도 가장 긴 하나가 폭을 정한다", () => {
    const one = measureTickWidth(["−3,000만"]);
    expect(measureTickWidth(["0", "−1억", "−3,000만"])).toBe(one);
  });
});

describe("measureTickWidth 여백 (축 끝 글자)", () => {
  it("글자 폭 + tickSize 6 + tickMargin 8 보다 좁지 않다 — ds 차트 축 끝 글자가 잘리지 않는다", () => {
    // jsdom 은 레이아웃이 없어 글자 수 추정치(한글 11 · 그 밖 7)로 돌아간다: "100만" = 7 × 3 + 11 = 32
    expect(measureTickWidth(["100만"])).toBeGreaterThanOrEqual(32 + 6 + 8);
  });
});

/**
 * QA B5-1 — 홈 "11월 수입 · 지출" 축이 "3만 / 2.3만 / 1.5만 / ,500 / 0" 이었다. 폭은 nice 눈금("3만")으로 재고
 * recharts 는 자기 눈금(7,500 간격)을 그려 가장 긴 "7,500" 의 앞자리가 잘렸다. niceValueAxis 는 그리는 눈금과
 * 잰 눈금을 한 목록으로 묶는다.
 */
describe("niceValueAxis — 그리는 눈금 = 폭을 잰 눈금 (B5-1)", () => {
  it("최대 2.8만(홈 11월) — 눈금 0 · 1만 · 2만 · 3만, 한 체계(만)이고 7,500 같은 자동 눈금이 없다", async () => {
    const { formatAxisWon } = await import("@/shared/ds/chart");
    const a = niceValueAxis([28_000, 12_000, 0], formatAxisWon);
    expect(a.ticks).toEqual([0, 10_000, 20_000, 30_000]);
    expect(a.domain).toEqual([0, 30_000]);
    expect(a.ticks.map(a.tickFormatter)).toEqual(["0", "1만", "2만", "3만"]);
  });

  it.each([7_500, 8_000, 10_000, 15_000, 22_500, 30_000, 150_000_000])(
    "최대 %d — 눈금은 1·2·5 배수라 반올림한 글자(0.25만 → '0.3만')가 나오지 않고, 폭은 그 눈금 글자 가운데 가장 긴 것",
    async (max) => {
      const { formatAxisWon } = await import("@/shared/ds/chart");
      const a = niceValueAxis([0, max], formatAxisWon);
      const labels = a.ticks.map(a.tickFormatter);
      // 글자가 눈금값을 그대로 말한다 — 소수 한 자리로 반올림돼 다른 수가 되지 않는다
      for (const [i, v] of a.ticks.entries()) {
        const l = labels[i]!;
        const back = l.endsWith("억")
          ? Number(l.slice(0, -1)) * 100_000_000
          : l.endsWith("만")
            ? Number(l.slice(0, -1).replace(/,/g, "")) * 10_000
            : Number(l.replace(/,/g, ""));
        expect(back).toBe(v);
      }
      // 한 축은 한 단위 — 0 말고는 모두 억 · 모두 만 · 모두 쉼표 정수 가운데 하나
      const units = new Set(
        labels.filter((l) => l !== "0").map((l) => l.replace(/[^억만]/g, "")),
      );
      expect(units.size).toBe(1);
      expect(a.domain[1]).toBeGreaterThanOrEqual(max);
      expect(a.width).toBe(measureTickWidth(labels));
    },
  );

  it("최대 1.5만 — '5,000 · 1만 · 1.5만' 이 아니라 '0.5만 · 1만 · 1.5만'(한 축은 한 단위), 8,000 이면 모두 쉼표 정수", async () => {
    const { formatAxisWon } = await import("@/shared/ds/chart");
    const man = niceValueAxis([0, 15_000], formatAxisWon);
    expect(man.ticks.map(man.tickFormatter)).toEqual([
      "0",
      "0.5만",
      "1만",
      "1.5만",
    ]);
    // 폭도 그리는 글자("0.5만")로 잰다
    expect(man.width).toBe(measureTickWidth(["0", "0.5만", "1만", "1.5만"]));
    const won = niceValueAxis([0, 7_500], formatAxisWon);
    expect(won.ticks.map(won.tickFormatter)).toEqual([
      "0",
      "2,000",
      "4,000",
      "6,000",
      "8,000",
    ]);
  });

  /** 그 값들의 축 눈금 글 */
  const drawn = async (values: number[]) => {
    const { formatAxisWon } = await import("@/shared/ds/chart");
    const a = niceValueAxis(values, formatAxisWon);
    return a.ticks.map(a.tickFormatter);
  };

  it("눈금 간격은 1 · 2 · 5 × 10ⁿ — 0 ~ 1만은 0.2만 간격(2,500 간격의 '0.3만' · '0.8만' 이 나오지 않는다)", async () => {
    expect(await drawn([0, 10_000])).toEqual([
      "0",
      "0.2만",
      "0.4만",
      "0.6만",
      "0.8만",
      "1만",
    ]);
    expect(await drawn([0, 8_000])).toEqual([
      "0",
      "2,000",
      "4,000",
      "6,000",
      "8,000",
    ]);
    expect(await drawn([0, 30_000])).toEqual(["0", "1만", "2만", "3만"]);
  });

  it("억 축 — 1억 이상이면 모든 눈금이 억(5,000만 · 1억 섞임 없음)", async () => {
    expect(await drawn([0, 150_000_000])).toEqual([
      "0",
      "0.5억",
      "1억",
      "1.5억",
    ]);
    // 5,000만 ~ 1억 이 섞인 값
    expect(await drawn([50_000_000, 80_000_000, 100_000_000])).toEqual([
      "0",
      "0.2억",
      "0.4억",
      "0.6억",
      "0.8억",
      "1억",
    ]);
  });

  it("음수 축 · 모두 0", async () => {
    expect(await drawn([-25_000, 60_000])).toEqual([
      "−4만",
      "−2만",
      "0",
      "2만",
      "4만",
      "6만",
    ]);
    expect(await drawn([-30_000_000, 10_000_000])).toEqual([
      "−3,000만",
      "−2,000만",
      "−1,000만",
      "0",
      "1,000만",
    ]);
    // 모두 0 · 값 없음 — 앱과 같은 0 ~ 1만
    expect(await drawn([0, 0])).toEqual(await drawn([0, 10_000]));
    expect(await drawn([])).toEqual(await drawn([0, 10_000]));
  });

  it("글자 함수는 눈금 목록을 함께 받는다 — 그리는 눈금과 같은 목록", () => {
    const seen: (readonly number[])[] = [];
    const a = niceValueAxis([0, 28_000], (v, ticks) => {
      seen.push(ticks);
      return String(v);
    });
    a.tickFormatter(10_000);
    for (const t of seen) expect(t).toEqual(a.ticks);
  });

  it("음수가 있으면 0 아래 눈금까지 재서 부호가 잘리지 않는다", () => {
    const f = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));
    const a = niceValueAxis([-25_000, 60_000], f);
    expect(a.ticks[0]).toBeLessThan(0);
    expect(a.width).toBe(measureTickWidth(a.ticks.map(f)));
    expect(a.width).toBeGreaterThan(measureTickWidth(["60000"]));
  });

  it("값이 없으면(계열을 모두 껐을 때) 0 하나짜리 축이 아니라 0 ~ 1만으로 잡는다", () => {
    const a = niceValueAxis([], String);
    expect(a.domain[0]).toBe(0);
    expect(a.domain[1]).toBe(10_000);
  });
});

/**
 * 글자 크기가 페이지가 떠 있는 동안 바뀌면 세로축 폭을 다시 잰다 — 이음 QA(2026-11-18): html font-size 를 200% 로 키우자 세로축 폭이
 * 100% 때 값에 머물러 "3일" 이 왼쪽 밖으로 9 잘렸다("8일" 처럼 보임).
 */
describe("useAxisWidth — 글자 크기가 바뀌면 다시 잰다", () => {
  afterEach(() => vi.restoreAllMocks());

  it("눈금 글자 크기의 숨은 글 폭이 바뀌면 판이 오르고 폭이 커진다", () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    let scale = 1;
    const observed: { cb: () => void; el: Element }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: () => void) {}
        observe(el: Element) {
          observed.push({ cb: this.cb, el });
        }
        disconnect() {}
        unobserve() {}
      },
    );
    // 눈금 글자 크기(--text-t1)의 글은 글자 수 어림 × 배율로 잰다(jsdom 은 폭이 없다)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const width = this.style.fontSize.includes("--text-t1")
          ? [...(this.textContent ?? "")].reduce(
              (w, c) => w + (c > "ᄀ" ? 11 : 7),
              0,
            ) * scale
          : 0;
        return { width } as DOMRect;
      },
    );
    const seen: number[] = [];
    const Probe = () => {
      seen.push(useAxisWidth(["0일", "3일"]));
      return null;
    };
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => root.render(createElement(Probe)));
    const small = seen[seen.length - 1]!;
    const version = readTickFontVersion();
    act(() => {
      scale = 2;
      for (const o of observed.filter((x) => x.el.textContent === "0000"))
        o.cb();
    });
    expect(readTickFontVersion()).toBe(version + 1);
    // 글 폭 18 → 36, 여백 16 은 그대로
    expect(small).toBe(18 + 16);
    expect(seen[seen.length - 1]).toBe(36 + 16);
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
});

/**
 * 세로 눈금이 겹치면 수를 줄인다(groo-design #247 — chart.md "세로 눈금이 겹치면 수를 줄입니다"). 앱과 같은 셈:
 *   들어가는 칸 수 = max(1, ⌊(차트 높이 − max(위, ⌈줄 ÷ 2⌉) − 아래 − (max(8, ⌈줄 ÷ 2⌉ + 4) + 줄)) ÷ 줄⌋)(#250 세로축 끝 글 자리)
 *   네 칸 겨냥부터 겨냥하는 칸 수를 하나씩 줄여, 나온 칸 수(이중 축은 맞춘 뒤 위 + 아래)가 들어가는 칸 수 이하인 첫 축
 */
describe("세로 눈금 칸 수 — 눈금 글 줄 높이보다 눈금 사이가 좁으면 줄인다", () => {
  const f = (v: number) => String(v);
  it("들어가는 칸 수 — 폰 띠 140(위 8 · 아래 0) 100% 7 · 200% 2 · 300% 1, 추이 200(기본 5 · 5) 200% 4", () => {
    // 세로축 끝 글 자리(#250) — 위 max(위 여백, ⌈줄 ÷ 2⌉) · 가로 눈금 줄 max(8, ⌈줄 ÷ 2⌉ + 4) + 줄
    // 100% 140 − 8 − 0 − (12 + 15) = 105 → 7 · 200% 140 − 15 − 0 − (19 + 30) = 76 → 2 · 300% 140 − 23 − 0 − (27 + 45) = 45 → 1
    // 소수로 돌려준다 — 내림한 정수가 겹치지 않는 칸 수, 1 보다 작으면 가장 적은 축도 들지 않는다(#253)
    const fit = (...a: Parameters<typeof chartValueIntervals>) =>
      Math.floor(chartValueIntervals(...a));
    expect(fit(140, 15, { top: 8, bottom: 0 })).toBe(7);
    expect(fit(140, 30, { top: 8, bottom: 0 })).toBe(2);
    expect(chartValueIntervals(140, 45, { top: 8, bottom: 0 })).toBe(1);
    // 200 − 15 − 5 − 49 = 131 → 4
    expect(fit(200, 30)).toBe(4);
    // 줄 하나도 안 들어가면 0 — 축은 가장 적은 축(눈금 둘)을 두고 큰 쪽 끝 글만 남긴다(#253)
    expect(chartValueIntervals(40, 30)).toBe(0);
    expect(niceValueAxis([0, 95], f, 0).ticks).toEqual([0, 100]);
  });

  /**
   * 가장 적은 축도 들지 않으면 큰 쪽 끝 글만(chart.md "큰 글자", groo-design #253) — 절댓값이 큰 쪽 끝 글 하나, 0 은 그 끝 글과 줄 높이
   * 이상 떨어질 때만. 나머지 글은 빈 글이고 눈금(격자선)은 그대로다.
   */
  it("가장 적은 축도 들지 않으면 — −1.2만 ~ 47.6만 은 50만 하나, 눈금 −50만 · 0 · 50만 은 그대로", () => {
    const won = (v: number) => (v === 0 ? "0" : `${v / 10_000}만`);
    // 들어가는 칸 1.0(140 · 300%) — 가장 적은 축(두 칸)도 넘친다. 0 은 끝 글과 반 줄 거리라 뺀다
    const a = niceValueAxis([-12_000, 476_000], won, 1);
    expect(a.ticks).toEqual([-500_000, 0, 500_000]);
    expect(a.ticks.map(a.tickFormatter)).toEqual(["", "", "50만"]);
    // 들면(2.53) 모두
    const b = niceValueAxis([-12_000, 476_000], won, 2.53);
    expect(b.ticks.map(b.tickFormatter)).toEqual([won(-500_000), "0", "50만"]);
    // 음수 쪽이 크면 아래 끝 글
    const c = niceValueAxis([-476_000, 12_000], won, 1);
    expect(c.ticks.map(c.tickFormatter)).toEqual([won(-500_000), "", ""]);
  });

  it("양수만 — 0 · 50만 이 들면 둘 다, 한 칸도 들지 않으면(0.6) 50만 하나", () => {
    const won = (v: number) => (v === 0 ? "0" : `${v / 10_000}만`);
    const fits = niceValueAxis([0, 476_000], won, 1);
    expect(fits.ticks.map(fits.tickFormatter)).toEqual(["0", "50만"]);
    const tight = niceValueAxis([0, 476_000], won, 0.6);
    expect(tight.ticks).toEqual([0, 500_000]);
    expect(tight.ticks.map(tight.tickFormatter)).toEqual(["", "50만"]);
  });

  it("이중 축도 축마다 큰 쪽 끝 글만 — 눈금 수는 두 축이 같다", () => {
    const w = niceDualValueAxes([0, 9_000], [-12_000, 476_000], f, 1);
    expect(w.left.ticks).toHaveLength(w.right.ticks.length);
    expect(w.right.ticks.map(w.right.tickFormatter).filter(Boolean)).toEqual([
      "500000",
    ]);
    expect(w.left.ticks.map(w.left.tickFormatter).filter(Boolean)).toHaveLength(
      1,
    );
  });
  it("들면 그대로, 넘치면 1 · 2 · 5 축을 더 적은 칸으로 다시 센다 — 한 축 한 단위", () => {
    // 0 ~ 0.95 → 네 칸 겨냥이면 0.2 간격 다섯 칸
    expect(niceValueAxis([0, 95], f).ticks).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceValueAxis([0, 95], f, 5).ticks).toEqual([
      0, 20, 40, 60, 80, 100,
    ]);
    expect(niceValueAxis([0, 95], f, 3).ticks).toEqual([0, 50, 100]);
    expect(niceValueAxis([0, 95], f, 1).ticks).toEqual([0, 100]);
    // 음수 · 양수가 섞이면 한 칸 겨냥에도 0 을 사이에 둔 두 칸
    expect(niceValueAxis([-30, 60], f, 1).ticks).toEqual([-100, 0, 100]);
  });
  it("이중 축 — 맞춘 뒤 칸 수(위 + 아래)로 견주고, 두 축을 함께 줄인다", () => {
    // 왼쪽 0 ~ 1만(다섯 칸) · 오른쪽 0 ~ 5.8만(세 칸) → 맞추면 다섯 칸
    const wide = niceDualValueAxes([0], [58_000], f);
    expect(wide.left.ticks).toHaveLength(6);
    expect(wide.right.ticks).toEqual([
      0, 20_000, 40_000, 60_000, 80_000, 100_000,
    ]);
    // 세 칸까지 — 세 칸 겨냥: 왼쪽 0 ~ 1만 · 0.5만 간격(두 칸) · 오른쪽 0 ~ 6만 · 2만 간격(세 칸) → 맞추면 세 칸
    const tight = niceDualValueAxes([0], [58_000], f, 3);
    expect(tight.left.ticks).toEqual([0, 5_000, 10_000, 15_000]);
    expect(tight.right.ticks).toEqual([0, 20_000, 40_000, 60_000]);
    // 두 축의 눈금 수는 늘 같다(격자 하나에 둘 다 선다)
    expect(tight.left.ticks.length).toBe(tight.right.ticks.length);
  });
});

describe("같은 기간 차트 묶음 — 가장 큰 간격(= 가장 좁은 차트의 간격)", () => {
  it("알린 간격 가운데 가장 큰 것 · 사라진 차트는 거둔다 · 바뀌면 그린 뒤에 알린다", async () => {
    const g = createChartXGroup();
    const heard = vi.fn();
    g.subscribe(heard);
    expect(g.interval()).toBeUndefined();
    g.report("wide", 4);
    g.report("narrow", 5);
    expect(g.interval()).toBe(5);
    const v = g.version();
    g.report("wide", 4); // 같은 값 — 바뀌지 않는다
    expect(g.version()).toBe(v);
    expect(heard).not.toHaveBeenCalled(); // 그리는 도중에는 부르지 않는다
    await Promise.resolve();
    expect(heard).toHaveBeenCalledTimes(1);
    g.remove("narrow");
    expect(g.interval()).toBe(4);
  });
});
