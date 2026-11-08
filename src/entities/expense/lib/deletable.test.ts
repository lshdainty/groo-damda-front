import { describe, expect, it } from "vitest";
import { isExpenseDeletable } from "./deletable";

describe("isExpenseDeletable", () => {
  it("deletable:true 면 자동 생성이어도 true", () => {
    expect(
      isExpenseDeletable({ deletable: true, autoSource: "TRADE_REALIZED" }),
    ).toBe(true);
  });
  it("deletable:false 면 false", () => {
    expect(isExpenseDeletable({ deletable: false, autoSource: null })).toBe(
      false,
    );
  });
  it("필드가 없으면 autoSource 로 폴백한다", () => {
    expect(isExpenseDeletable({ autoSource: null })).toBe(true);
    expect(isExpenseDeletable({ autoSource: "TRADE_REALIZED" })).toBe(false);
  });
});
