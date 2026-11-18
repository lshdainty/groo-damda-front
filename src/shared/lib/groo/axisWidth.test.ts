import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  measureTickWidth,
  niceValueAxis,
  readTickFontVersion,
  useAxisWidth,
} from "./axisWidth";

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
