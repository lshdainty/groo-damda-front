// 이 화면의 요청은 실패를 제 자리에서 고정 글로 말한다 — 서버 원문 전역 알림은 끈다(silent). 지우면 알림이 둘로 겹친다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/shared/api", () => ({
  apiClient: {
    get: (...a: unknown[]) => calls.get(...a),
    post: (...a: unknown[]) => calls.post(...a),
    delete: (...a: unknown[]) => calls.delete(...a),
  },
}));

const { subscriptionApi } = await import("./subscriptionApi");

beforeEach(() => {
  for (const f of Object.values(calls))
    f.mockReset().mockResolvedValue({ data: null });
});

describe("subscriptionApi silent", () => {
  it("기능 · 요금제 · 내 구독 조회 셋은 silent", async () => {
    await subscriptionApi.getMyFeatures();
    await subscriptionApi.getPlans();
    await subscriptionApi.getMySubscription();
    expect(calls.get).toHaveBeenCalledTimes(3);
    for (const c of calls.get.mock.calls)
      expect(c[1]).toMatchObject({ silent: true });
  });

  it("구독 · 해지 요청은 silent", async () => {
    await subscriptionApi.subscribe("SECURITIES_YEARLY");
    await subscriptionApi.cancelSubscription();
    expect(calls.post.mock.calls[0]![1]).toEqual({
      planCode: "SECURITIES_YEARLY",
    });
    expect(calls.post.mock.calls[0]![2]).toMatchObject({ silent: true });
    expect(calls.delete.mock.calls[0]![1]).toMatchObject({ silent: true });
  });
});
