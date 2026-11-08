import { describe, expect, it } from "vitest";
import { isTransferDeletable } from "./deletable";

describe("isTransferDeletable", () => {
  it("deletable:true 면 자동 생성이어도 true", () => {
    expect(
      isTransferDeletable({ deletable: true, autoSource: "TRADE_SETTLEMENT" }),
    ).toBe(true);
  });
  it("deletable:false 면 false", () => {
    expect(isTransferDeletable({ deletable: false, autoSource: null })).toBe(
      false,
    );
  });
  it("필드가 없으면 autoSource 로 폴백한다", () => {
    expect(isTransferDeletable({ autoSource: null })).toBe(true);
    expect(isTransferDeletable({ autoSource: "TRADE_SETTLEMENT" })).toBe(false);
  });
});
