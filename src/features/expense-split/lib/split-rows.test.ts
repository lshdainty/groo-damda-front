import { describe, expect, it } from "vitest";
import {
  evenRows,
  largestRows,
  proportionalRows,
  rowsToPayload,
  seedSplitRows,
  settleRemainder,
  sumRows,
  type SplitRow,
} from "./split-rows";

const row = (amount: number, rowId?: number): SplitRow => ({
  uid: `u${amount}`,
  rowId,
  categoryRowId: 7,
  amount: String(amount),
  label: "",
});

describe("split-rows", () => {
  it("처음 값은 반반이고 홀수는 첫 항목이 더 가진다", () => {
    const rows = seedSplitRows(undefined, [], 10001, {
      categoryRowId: 3,
      merchant: "마트",
    });
    expect(rows?.map((r) => r.amount)).toEqual(["5001", "5000"]);
    expect(rows?.[0]?.label).toBe("마트");
  });

  it("저장된 항목은 rowId 를 들고 와서 본문에 싣는다", () => {
    const rows = seedSplitRows(
      undefined,
      [
        {
          rowId: 11,
          expenseRowId: 1,
          categoryRowId: 3,
          categoryName: "식비",
          amount: 700,
          label: null,
          sortOrder: 0,
          createAt: "",
          modifyAt: "",
        },
      ],
      1000,
      { categoryRowId: 3 },
    );
    const payload = rowsToPayload([...(rows ?? []), row(300)]);
    expect(payload[0]).toMatchObject({ rowId: 11, sortOrder: 0 });
    expect(payload[1]).not.toHaveProperty("rowId");
    expect(payload[1]).toMatchObject({ sortOrder: 1 });
  });

  it("균등 분배의 나머지는 첫 항목", () => {
    expect(
      evenRows([row(1), row(1), row(1)], 100).map((r) => r.amount),
    ).toEqual(["34", "33", "33"]);
  });

  it("비례 배분과 큰 항목 반영은 합이 새 총액과 같다", () => {
    const rows = [row(3000, 1), row(1000, 2)];
    expect(sumRows(proportionalRows(rows, 6000))).toBe(6000);
    expect(proportionalRows(rows, 6000)[0]?.rowId).toBe(1);
    expect(sumRows(largestRows(rows, 3000))).toBe(3000);
    expect(settleRemainder([5, 5], 7).reduce((a, b) => a + b, 0)).toBe(7);
  });
});
