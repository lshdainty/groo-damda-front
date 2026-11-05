import { describe, expect, it } from "vitest";
import { cycleOfDuration, pickCyclePlans, yearlySavePct } from "./plan-cycles";

const plan = (
  planCode: string,
  durationMonths: number | null,
  price: number | null,
) => ({ planCode, planName: planCode, durationMonths, price });

describe("pickCyclePlans", () => {
  it("1개월 · 12개월 행을 고른다 — 차례와 상관없다", () => {
    const r = pickCyclePlans([plan("Y", 12, 99_000), plan("M", 1, 9_900)]);
    expect(r.monthly?.planCode).toBe("M");
    expect(r.yearly?.planCode).toBe("Y");
  });

  it("연간 행이 없으면 yearly 는 null — 주기 고르기를 그리지 않는다", () => {
    const r = pickCyclePlans([plan("M", 1, 9_900)]);
    expect(r.monthly).not.toBeNull();
    expect(r.yearly).toBeNull();
  });

  it("가격이 없는 행은 없는 것으로 본다 · 목록이 없어도 안 터진다", () => {
    expect(pickCyclePlans([plan("M", 1, null)]).monthly).toBeNull();
    expect(pickCyclePlans(undefined)).toEqual({ monthly: null, yearly: null });
  });
});

describe("yearlySavePct", () => {
  it("round((1 − 연간 ÷ (월간 × 12)) × 100) — 시드 9,900 / 99,000 은 17", () => {
    expect(yearlySavePct(9_900, 99_000)).toBe(17);
  });
  it("서버 가격이 바뀌면 따라 바뀐다", () => {
    expect(yearlySavePct(10_000, 96_000)).toBe(20);
    expect(yearlySavePct(10_000, 120_000)).toBe(0);
  });
  it("월간 가격이 0 이하면 0 — 0 으로 나누지 않는다", () => {
    expect(yearlySavePct(0, 99_000)).toBe(0);
  });
});

describe("cycleOfDuration", () => {
  it("12개월이면 연간, 그 밖(1개월 · 모름)은 월간", () => {
    expect(cycleOfDuration(12)).toBe("yearly");
    expect(cycleOfDuration(1)).toBe("monthly");
    expect(cycleOfDuration(null)).toBe("monthly");
    expect(cycleOfDuration(undefined)).toBe("monthly");
  });
});
