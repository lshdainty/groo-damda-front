import { describe, expect, it } from "vitest";

import { progressPercentText, progressPercentValue } from "./percent";

// 앱 test/core/format/percent_test.dart 의 formatProgress 표 — 같은 입력은 같은 글자여야 한다.
const APP_TABLE: Array<[number, string]> = [
  [0, "0%"],
  [76.4, "76%"],
  [76.43, "76%"],
  [76.6, "77%"],
  [99.4, "99%"],
  [99.6, "99%"],
  [99.95, "99%"],
  [100, "100%"],
  [100.3, "101%"],
  [100.6, "101%"],
  [112.5, "113%"],
  [-2.5, "−3%"],
  [-76.6, "−77%"],
  [-0.2, "0%"],
];

describe("progressPercentText", () => {
  it.each(APP_TABLE)("앱과 같다 — %s → %s", (v, want) => {
    expect(progressPercentText(v)).toBe(want);
  });

  it("지시 경계값", () => {
    const table: Array<[number, string]> = [
      [33.4, "33%"],
      [33.6, "34%"],
      [99.5, "99%"],
      [99.99, "99%"],
      [100.2, "101%"],
      [100.4, "101%"],
      [110, "110%"],
    ];
    for (const [v, want] of table) expect(progressPercentText(v)).toBe(want);
  });

  it("천 단위 쉼표 — 999 · 1000 · 1234.4 · 음수", () => {
    expect(progressPercentText(999)).toBe("999%");
    expect(progressPercentText(1000)).toBe("1,000%");
    expect(progressPercentText(1234.4)).toBe("1,234%");
    expect(progressPercentText(12345.67)).toBe("12,346%");
    expect(progressPercentText(-1234.5)).toBe("−1,235%");
    expect(progressPercentText(-0.2)).toBe("0%");
  });

  it("유한하지 않은 값은 —", () => {
    expect(progressPercentText(NaN)).toBe("—");
    expect(progressPercentText(Infinity)).toBe("—");
    expect(progressPercentText(-Infinity)).toBe("—");
  });

  it("progressPercentValue — 숫자 그대로, 비유한은 NaN", () => {
    expect(progressPercentValue(99.6)).toBe(99);
    expect(progressPercentValue(100.3)).toBe(101);
    expect(progressPercentValue(-0.2)).toBe(0);
    expect(progressPercentValue(NaN)).toBeNaN();
  });
});
