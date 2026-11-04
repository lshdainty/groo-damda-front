import { describe, expect, it } from "vitest";
import { computeShares, type ShareInput } from "./shares";

const p = (isPayer: boolean, ratio = 1, custom = 0): ShareInput => ({
  isPayer,
  ratio,
  custom,
});

describe("computeShares", () => {
  it("N분의 1 — 남는 원은 결제자", () => {
    const s = computeShares(
      "EQUAL",
      10,
      [p(true), p(false), p(false), p(false)],
      true,
    );
    expect(s.amounts).toEqual([4, 2, 2, 2]);
    expect(s.perPerson).toBe(2);
    expect(s.amounts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("비율 1:1:1 이어도 합이 총액과 같다(결제자가 남는 원)", () => {
    const s = computeShares(
      "RATIO",
      10000,
      [p(true), p(false), p(false)],
      true,
    );
    expect(s.amounts).toEqual([3334, 3333, 3333]);
  });

  it("나 포함을 끄면 남는 원은 내 몫", () => {
    const s = computeShares("EQUAL", 10, [p(false), p(false), p(false)], false);
    expect(s.amounts).toEqual([3, 3, 3]);
    expect(s.mine).toBe(1);
  });

  it("개별 금액 — 결제자는 총액 − 다른 사람 합, 어긋나면 gap", () => {
    const ok = computeShares(
      "CUSTOM",
      10000,
      [p(true), p(false, 1, 3000)],
      true,
    );
    expect(ok.amounts).toEqual([7000, 3000]);
    expect(ok.gap).toBe(0);
    const bad = computeShares("CUSTOM", 10000, [p(false, 1, 3000)], false);
    expect(bad.gap).toBe(7000);
  });
});
