import { describe, expect, it } from "vitest";
import type { DutchPay, DutchPayParticipant } from "@/entities/dutch-pay";
import {
  dutchDate,
  paidCountOf,
  perPersonInfo,
  receivableOf,
  sortByDateDesc,
} from "./dutch-model";

const p = (
  rowId: number,
  name: string,
  amount: number,
  o: Partial<DutchPayParticipant> = {},
): DutchPayParticipant => ({
  rowId,
  userRowId: null,
  participantName: name,
  amount,
  isPayer: false,
  isPaid: false,
  paidAt: null,
  ...o,
});
const dp = (
  rowId: number,
  date: string,
  ps: DutchPayParticipant[],
  o: Partial<DutchPay> = {},
): DutchPay => ({
  rowId,
  userRowId: 1,
  sourceExpenseRowId: null,
  title: `정산 ${rowId}`,
  description: null,
  totalAmount: ps.reduce((s, x) => s + x.amount, 0),
  currency: "KRW",
  splitMethod: "EQUAL",
  dutchPayDate: date,
  isSettled: false,
  participants: ps,
  createAt: "",
  modifyAt: "",
  ...o,
});

describe("dutch-model (I-15 28 · 40)", () => {
  it("낸 수 = 결제자 + 낸 사람 — 결제자만 낸 정산도 1/N 이다", () => {
    const d = dp(1, "2026-10-14", [
      p(1, "나", 61334, { isPayer: true }),
      p(2, "가", 61333),
      p(3, "나다", 61333, { isPaid: true }),
    ]);
    expect(paidCountOf(d)).toBe(2);
  });

  it("몫이 모두 같으면 1인당만, 나눠 떨어지지 않으면 남는 원을 진 사람이 함께 나온다", () => {
    const even = dp(1, "2026-10-14", [
      p(1, "나", 100, { isPayer: true }),
      p(2, "가", 100),
    ]);
    expect(perPersonInfo(even)).toEqual({
      amount: 100,
      restName: null,
      restExtra: 0,
    });
    const odd = dp(2, "2026-10-14", [
      p(1, "나", 61334, { isPayer: true }),
      p(2, "가", 61333),
      p(3, "나다", 61333),
    ]);
    expect(perPersonInfo(odd)).toEqual({
      amount: 61333,
      restName: "나",
      restExtra: 1,
    });
  });

  it("정산 날짜 내림 · 같으면 나중에 만든 것 먼저", () => {
    const a = dp(1, "2026-10-14", [p(1, "나", 1, { isPayer: true })]);
    const b = dp(2, "2026-10-20", [p(2, "나", 1, { isPayer: true })]);
    const c = dp(3, "2026-10-20", [p(3, "나", 1, { isPayer: true })]);
    expect(sortByDateDesc([a, b, c]).map((x) => x.rowId)).toEqual([3, 2, 1]);
  });

  it("날짜는 올해 줄임 · 다른 해 표준(해를 버리지 않는다)", () => {
    const now = new Date(2026, 9, 29);
    expect(dutchDate("2026-10-14", now)).toBe("10월 14일");
    expect(dutchDate("2025-10-14", now)).toBe("2025년 10월 14일");
  });

  it("받을 돈은 안 낸 참여자(결제자 제외) 몫 합", () => {
    const d = dp(1, "2026-10-14", [
      p(1, "나", 50, { isPayer: true }),
      p(2, "가", 30),
      p(3, "나다", 20, { isPaid: true }),
    ]);
    expect(receivableOf([d])).toEqual({ amount: 30, people: 1 });
  });
});
