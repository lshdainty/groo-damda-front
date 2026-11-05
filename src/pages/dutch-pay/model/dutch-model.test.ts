import { describe, expect, it } from "vitest";
import type { DutchPay, DutchPayParticipant } from "@/entities/dutch-pay";
import {
  dutchDate,
  paidCountOf,
  perPersonOf,
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

  it("1인당 — 균등 · 옛 데이터(나에게 +1 · 결제자 친구) · 2:1:1", () => {
    expect(
      perPersonOf([
        { name: "나", amount: 100 },
        { name: "가", amount: 100 },
      ]),
    ).toEqual({ kind: "equal", amount: 100 });
    // 옛 데이터 — 남는 원이 "나" 에게(결제자는 친구 "가")
    expect(
      perPersonOf([
        { name: "나", amount: 61334 },
        { name: "가", amount: 61333 },
        { name: "다", amount: 61333 },
      ]),
    ).toEqual({ kind: "rest", amount: 61333, extra: 1, name: "나" });
    // 비율 2:1:1 — "1인당" 조각을 뺀다
    expect(
      perPersonOf([
        { name: "나", amount: 200 },
        { name: "가", amount: 100 },
        { name: "다", amount: 100 },
      ]),
    ).toEqual({ kind: "none" });
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
