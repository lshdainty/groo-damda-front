import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "@/shared/i18n/config";
import { formatDateRange, formatMonthTicks, formatYearMonthDot } from "./date";

afterEach(async () => {
  await i18n.changeLanguage("ko");
});

describe("날짜 규칙 — 기간 줄 · 월 눈금 · 점 연월 (웹 B3 가.5)", () => {
  const now = new Date(2026, 10, 7);

  it("기간 줄 — 올해는 줄임, 물결표는 앞뒤를 붙인다", () => {
    expect(formatDateRange("2026-11-02", "2026-11-08", now)).toBe(
      "11월 2일~11월 8일",
    );
  });
  it("기간 줄 — 다른 해가 끼면 두 끝 모두 연도", () => {
    expect(formatDateRange("2025-12-29", "2026-01-04", now)).toBe(
      "2025년 12월 29일~2026년 1월 4일",
    );
    expect(formatDateRange("2025-03-01", "2025-03-05", now)).toBe(
      "2025년 3월 1일~2025년 3월 5일",
    );
  });
  it("월 눈금 — 한 해 안이면 '1월'(0 을 채우지 않는다), 섞이면 '2026. 1.'", () => {
    expect(
      formatMonthTicks([
        { year: 2026, month: 1 },
        { year: 2026, month: 12 },
      ]),
    ).toEqual(["1월", "12월"]);
    expect(
      formatMonthTicks([
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
      ]),
    ).toEqual(["2025. 12.", "2026. 1."]);
    expect(formatMonthTicks([])).toEqual([]);
  });
  it("점 연월 — 저축 목표 마감 '2026. 1.' · 영어는 'Jan 2026'", async () => {
    expect(formatYearMonthDot("2026-01-15")).toBe("2026. 1.");
    await i18n.changeLanguage("en");
    expect(formatYearMonthDot("2026-01-15")).toBe("Jan 2026");
  });
});
