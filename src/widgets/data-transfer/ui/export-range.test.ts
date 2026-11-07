// 내보내기 "올해" = 1월 1일 ~ 12월 31일(서버 PeriodResolver 와 같다, B3 4A) — 범위 글과 파일명이 같은 끝을 쓴다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFilename, resolveRange } from "./export-range";

describe("내보내기 올해", () => {
  afterEach(() => vi.useRealTimers());

  it("끝은 이번 달 말일이 아니라 해당 연도 12월 31일이다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 12));
    expect(resolveRange("THIS_YEAR", "", "")).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
    vi.setSystemTime(new Date(2026, 0, 15, 12));
    expect(resolveRange("THIS_YEAR", "", "").end).toBe("2026-12-31");
  });

  it.each([
    [new Date(2026, 0, 1, 9), "2026"],
    [new Date(2026, 5, 15, 9), "2026"],
    [new Date(2026, 11, 31, 9), "2026"],
  ])("1/1 · 연중 · 12/31 어느 날이든 같은 범위 %s", (now, y) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const r = resolveRange("THIS_YEAR", "", "");
    expect(r).toEqual({ start: `${y}-01-01`, end: `${y}-12-31` });
    expect(buildFilename("CSV", ["EXPENSE"], r)).toContain(
      `${y}-01-01_${y}-12-31`,
    );
  });

  it("파일명도 같은 끝을 쓴다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 12));
    const range = resolveRange("THIS_YEAR", "", "");
    expect(buildFilename("CSV", ["EXPENSE"], range)).toContain(
      "2026-01-01_2026-12-31",
    );
  });

  it("이번 달 · 지난달은 그대로", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 12));
    expect(resolveRange("THIS_MONTH", "", "").end).toBe("2026-11-30");
  });
});
