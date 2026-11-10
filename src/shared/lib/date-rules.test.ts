import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "@/shared/i18n/config";
import {
  formatDailyTick,
  formatDateDowTime,
  formatDateRange,
  formatDateRangeParts,
  formatDateRangeShortYear,
  formatServerDateDowTime,
  formatMonthDay,
  formatMonthShort,
  formatMonthTicks,
  formatYearMonthDot,
} from "./date";

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
  it("기간 줄 영어 — 같은 달이면 'Nov 2–8'(en dash 붙임), 달이 다르면 양끝, 다른 해면 양끝 연도", async () => {
    await i18n.changeLanguage("en");
    expect(formatDateRange("2026-11-02", "2026-11-08", now)).toBe("Nov 2–8");
    expect(formatDateRange("2026-10-29", "2026-11-04", now)).toBe(
      "Oct 29–Nov 4",
    );
    expect(formatDateRange("2025-12-29", "2026-01-04", now)).toBe(
      "Dec 29, 2025–Jan 4, 2026",
    );
  });
  it("0 을 채운 날짜가 나오지 않는다 — 7월 8일 · 5월", () => {
    expect(formatMonthDay("2026-07-08")).toBe("7월 8일");
    expect(formatMonthShort(5)).toBe("5월");
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

  it("일별 눈금 — '11. 5.'(0 안 채움) · 해가 바뀌는 눈금만 '2026. 1. 1.' · 영어 'Nov 5'", async () => {
    expect(formatDailyTick("2026-11-05")).toBe("11. 5.");
    expect(formatDailyTick("2026-01-01", true)).toBe("2026. 1. 1.");
    await i18n.changeLanguage("en");
    expect(formatDailyTick("2026-11-05")).toBe("Nov 5");
    expect(formatDailyTick("2026-01-01", true)).toBe("Jan 1, 2026");
  });

  it("요일 · 시각 — '11월 7일 (토) 오전 9:05' · 다른 해 연도 · 영어 'Sat, Nov 7 at 9:05 AM'", async () => {
    const t = new Date(2026, 10, 7, 9, 5);
    expect(formatDateDowTime(t, now)).toBe("11월 7일 (토) 오전 9:05");
    expect(formatDateDowTime(new Date(2025, 10, 7, 21, 5), now)).toBe(
      "2025년 11월 7일 (금) 오후 9:05",
    );
    await i18n.changeLanguage("en");
    expect(formatDateDowTime(t, now)).toBe("Sat, Nov 7 at 9:05 AM");
    expect(formatDateDowTime(new Date(2025, 10, 7, 21, 5), now)).toBe(
      "Fri, Nov 7, 2025 at 9:05 PM",
    );
  });

  it("서버 UTC 시각은 로컬로 바꿔 쓰고, 못 읽으면 null", () => {
    expect(formatServerDateDowTime("not-a-date")).toBeNull();
    expect(formatServerDateDowTime(null)).toBeNull();
    expect(formatServerDateDowTime("2026-11-07T00:05:00")).toMatch(
      /^\d+월 \d+일 \([일월화수목금토]\) (오전|오후) \d+:05$/,
    );
  });

  it("기간 세 조각 — 구간 기호 앞 · 기호 · 뒤(통계 버튼이 기호 뒤에서만 줄을 바꾼다)", () => {
    expect(formatDateRangeParts("2025-12-29", "2026-01-04", now)).toEqual({
      start: "2025년 12월 29일",
      separator: "~",
      end: "2026년 1월 4일",
    });
  });
  it("해가 다른 직접 기간 한 줄 — 두 자리 연도(7C) · 구간 기호는 로케일 문구", async () => {
    // NBSP(날짜 안) · ZWSP(기호 뒤 줄바꿈 자리) 를 걷으면 스펙 문자열 그대로다
    const plain = (s: string) =>
      s.replace(/\u00a0/g, " ").replace(/\u200b/g, "");
    expect(plain(formatDateRangeShortYear("2025-11-10", "2026-11-10"))).toBe(
      "25. 11. 10.~26. 11. 10.",
    );
    await i18n.changeLanguage("en");
    expect(plain(formatDateRangeShortYear("2025-11-10", "2026-11-10"))).toBe(
      "Nov 10, '25–Nov 10, '26",
    );
  });
  it("월 눈금 영어 — 'Jan' · 해가 섞이면 'Dec 2025'", async () => {
    await i18n.changeLanguage("en");
    expect(formatMonthTicks([{ year: 2026, month: 1 }])).toEqual(["Jan"]);
    expect(
      formatMonthTicks([
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
      ]),
    ).toEqual(["Dec 2025", "Jan 2026"]);
  });
});
