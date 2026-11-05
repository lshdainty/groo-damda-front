// 금액 가리기 서버 저장 — 성공했을 때만 로컬에 반영하고, 실패하면 로컬 그대로 둔다(다음 동기화가 옛 값으로 덮어 드러내지 않게)
import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/hideCardsApi", () => ({
  hideCardsApi: { put, get: vi.fn() },
}));

import {
  hiddenCardsNow,
  setHiddenCards,
  setHiddenCardsLocal,
} from "./hide-amounts-core";

beforeEach(() => {
  put.mockReset();
  setHiddenCardsLocal([]);
});

describe("setHiddenCards", () => {
  it("서버 저장이 성공하면 로컬에 반영하고 true", async () => {
    put.mockResolvedValue(undefined);
    expect(await setHiddenCards(["home.netWorth"])).toBe(true);
    expect([...hiddenCardsNow()]).toEqual(["home.netWorth"]);
  });

  it("서버 저장이 실패하면 로컬은 그대로이고 false", async () => {
    setHiddenCardsLocal(["kind.expense"]);
    put.mockRejectedValue(new Error("500"));
    expect(await setHiddenCards(["home.netWorth"])).toBe(false);
    expect([...hiddenCardsNow()]).toEqual(["kind.expense"]);
  });
});
