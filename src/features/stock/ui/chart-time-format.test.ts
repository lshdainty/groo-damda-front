import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/shared/i18n/config";
import { fmtCrosshairTime, fmtTick } from "./chart-time-format";

// 로컬 시각 2026-11-05 09:05 / 14:30 (기기 타임존 그대로 — Date 생성자가 로컬로 만든다)
const sec = (y: number, mo: number, d: number, h: number, mi: number) =>
  Math.floor(new Date(y, mo - 1, d, h, mi).getTime() / 1000);
const year = new Date().getFullYear();

afterEach(async () => {
  await i18n.changeLanguage("ko");
});

describe("증권 차트 시각 표기 — 12시간, 0 을 채우지 않는다", () => {
  it("크로스헤어(1분봉) 올해는 '11. 5. 오전 9:05'", async () => {
    await i18n.changeLanguage("ko");
    expect(fmtCrosshairTime(sec(year, 11, 5, 9, 5), "1m")).toBe(
      "11. 5. 오전 9:05",
    );
    expect(fmtCrosshairTime(sec(year, 11, 5, 14, 30), "1m")).toBe(
      "11. 5. 오후 2:30",
    );
  });

  it("다른 해는 연도를 붙인다", async () => {
    await i18n.changeLanguage("ko");
    expect(fmtCrosshairTime(sec(year - 1, 1, 2, 0, 0), "1m")).toBe(
      `${year - 1}. 1. 2. 오전 12:00`,
    );
    expect(fmtCrosshairTime(sec(year - 1, 1, 2, 0, 0), "1d")).toBe(
      `${year - 1}. 1. 2.`,
    );
  });

  it("일봉 크로스헤어 · 축은 날짜만 '11. 5.', 1분봉 축은 '오전 9:00'", async () => {
    await i18n.changeLanguage("ko");
    expect(fmtCrosshairTime(sec(year, 11, 5, 9, 5), "1d")).toBe("11. 5.");
    expect(fmtTick(sec(year, 11, 5, 9, 5), "1d")).toBe("11. 5.");
    expect(fmtTick(sec(year, 11, 5, 9, 0), "1m")).toBe("오전 9:00");
  });

  it("영어는 'Nov 5 9:05 AM'", async () => {
    await i18n.changeLanguage("en");
    expect(fmtCrosshairTime(sec(year, 11, 5, 9, 5), "1m")).toBe(
      "Nov 5 9:05 AM",
    );
    expect(fmtTick(sec(year, 11, 5, 9, 0), "1m")).toBe("9:00 AM");
  });
});
