import { describe, expect, it } from "vitest";
import { loadFailed } from "./query-state";

describe("loadFailed — 처음 불러오기 실패만 실패 자리", () => {
  it("값이 없고 실패면 참", () => {
    expect(loadFailed({ isError: true, data: undefined })).toBe(true);
  });
  it("받아 둔 값이 있으면 다시 받다 실패해도 거짓 — 내용을 그대로 둔다", () => {
    expect(loadFailed({ isError: true, data: [] })).toBe(false);
    expect(loadFailed({ isError: true, data: null })).toBe(false);
    expect(loadFailed({ isError: true, data: 0 })).toBe(false);
  });
  it("실패가 아니면 거짓", () => {
    expect(loadFailed({ isError: false, data: undefined })).toBe(false);
  });
});
