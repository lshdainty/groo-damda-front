import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "@/shared/i18n/config";
import { formatDateLong, formatDateSmart, formatMonthDayDow } from "./date";

afterEach(async () => {
  await i18n.changeLanguage("ko");
});

describe("formatDateLong — 표준 날짜(DESIGN.md International Design)", () => {
  it("한국어 '2010년 1월 4일' — 0 을 채우지 않고 2010-01-04 를 그대로 보이지 않는다", () => {
    expect(formatDateLong("2010-01-04")).toBe("2010년 1월 4일");
    expect(formatDateLong("2026-09-30")).toBe("2026년 9월 30일");
  });
  it("영어 'Jan 4, 2010'", async () => {
    await i18n.changeLanguage("en");
    expect(formatDateLong("2010-01-04")).toBe("Jan 4, 2010");
  });
  it("날짜 뒤에 시각이 붙어도 날짜만 · 읽을 수 없는 글은 원문", () => {
    expect(formatDateLong("2010-01-04T09:00:00")).toBe("2010년 1월 4일");
    expect(formatDateLong("미정")).toBe("미정");
  });
});

describe("formatDateSmart — 올해는 줄임, 다른 해는 표준", () => {
  const now = new Date(2026, 9, 29);
  it("올해 → '9월 30일'", () => {
    expect(formatDateSmart("2026-09-30", now)).toBe("9월 30일");
  });
  it("다른 해 → '2025년 9월 30일'", () => {
    expect(formatDateSmart("2025-09-30", now)).toBe("2025년 9월 30일");
  });
});

describe('formatMonthDayDow — 요일 형식(원장 날짜 머리 · DESIGN.desk.md 날짜 표 "요일")', () => {
  const now = new Date(2026, 9, 29);
  it("올해 → '10월 25일 (일)'", () => {
    expect(formatMonthDayDow("2026-10-25", now)).toBe("10월 25일 (일)");
  });
  it("다른 해 → 표준 + 요일 '2025년 10월 25일 (토)'", () => {
    expect(formatMonthDayDow("2025-10-25", now)).toBe("2025년 10월 25일 (토)");
  });
  it("영어 — 'E, MMM d', 다른 해는 연도를 붙인다", async () => {
    await i18n.changeLanguage("en");
    expect(formatMonthDayDow("2026-10-25", now)).toBe("Sun, Oct 25");
    expect(formatMonthDayDow("2025-10-25", now)).toBe("Sat, Oct 25, 2025");
  });
});
