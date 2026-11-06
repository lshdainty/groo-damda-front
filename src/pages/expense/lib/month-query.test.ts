import { describe, expect, it } from "vitest";
import { monthFromQuery } from "./month-query";

// 가계부 주소의 `?month=` — 못 읽으면 이번 달이다(QA 24차 9: "NaN년 NaN월").
describe("주소의 달", () => {
  const now = new Date(2026, 8, 21); // 2026-09-21

  it("yyyy-MM 이면 그대로 쓴다", () => {
    expect(monthFromQuery("2026-08", now)).toBe("2026-08");
  });

  it("없으면 이번 달이다", () => {
    expect(monthFromQuery(null, now)).toBe("2026-09");
    expect(monthFromQuery("", now)).toBe("2026-09");
  });

  it("못 읽는 값이면 이번 달이다 — NaN 달을 만들지 않는다", () => {
    for (const raw of [
      "8",
      "2026-8",
      "2026-13",
      "2026-00",
      "abcd-ef",
      "2026-08-01",
    ]) {
      expect(monthFromQuery(raw, now), raw).toBe("2026-09");
    }
  });
});

// 폰 가계부도 고른 달을 주소에 적는다(I-wrap-b1 ε 9) — 손으로 고친 주소 · 오래된 링크가 그대로 화면이 된다.
// 달 고르기 휠의 연 범위(오늘 ± 100년 — month-picker.tsx yearRange 기본)를 벗어난 해는 이번 달로 돌아간다.
describe("주소의 달 — 이상한 값은 이번 달 (I-wrap-b1 ε 9)", () => {
  const now = new Date(2026, 10, 7); // 2026-11-07

  it("abc · 2026-13 · 빈 값 · 공백은 이번 달", () => {
    for (const raw of ["abc", "2026-13", "", " ", "2026-1", "-2026-01"])
      expect(monthFromQuery(raw, now), JSON.stringify(raw)).toBe("2026-11");
  });

  it("아주 먼 해(휠 범위 ± 100년 밖)는 이번 달", () => {
    for (const raw of ["9999-01", "0001-05", "1900-01", "2127-01", "1925-12"])
      expect(monthFromQuery(raw, now), raw).toBe("2026-11");
  });

  it("휠 범위 끝(± 100년)까지는 그대로", () => {
    expect(monthFromQuery("2126-12", now)).toBe("2126-12");
    expect(monthFromQuery("1926-01", now)).toBe("1926-01");
  });
});
