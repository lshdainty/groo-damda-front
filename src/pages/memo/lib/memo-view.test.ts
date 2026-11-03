import { describe, expect, it } from "vitest";
import { formatMemoStamp } from "./memo-view";

// 올해는 줄임 날짜 + 시각, 다른 해는 표준 날짜(웹 · 앱 한 벌 — I-15 9)
const NOW = new Date(2026, 9, 31, 12, 0, 0);

describe("formatMemoStamp", () => {
  it("올해는 '10월 22일 오후 5:10' 꼴이다(로컬 시각, 12시간)", () => {
    // 서버가 시간대 없이 주는 [UTC] — 08:10Z 는 KST 17:10
    const d = new Date(Date.UTC(2026, 9, 22, 8, 10, 0));
    const expected = `${d.getMonth() + 1}월 ${d.getDate()}일 ${
      d.getHours() >= 12 ? "오후" : "오전"
    } ${d.getHours() % 12 === 0 ? 12 : d.getHours() % 12}:${String(d.getMinutes()).padStart(2, "0")}`;
    expect(formatMemoStamp("2026-10-22T08:10:00", NOW)).toBe(expected);
  });

  it("다른 해는 '2025년 12월 3일' 표준 날짜이고 시각이 없다", () => {
    expect(formatMemoStamp("2025-12-03T12:00:00", NOW)).toBe("2025년 12월 3일");
  });

  it("자정은 '오전 12:00' 이다", () => {
    const d = new Date(2026, 9, 5, 0, 0, 0);
    expect(formatMemoStamp(d.toISOString(), NOW)).toBe("10월 5일 오전 12:00");
  });

  it("못 읽는 값은 빈 글이다 — 틀린 시각을 그리지 않는다", () => {
    expect(formatMemoStamp("", NOW)).toBe("");
    expect(formatMemoStamp(null, NOW)).toBe("");
    expect(formatMemoStamp("2026-10-22", NOW)).toBe("");
  });
});
