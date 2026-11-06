// 연동 세 요청은 모두 silent — 실패 글은 화면이 고정 글로 알린다(I-14 10). 그루 계정의 영어 글이 전역 알림으로 뜨지 않는다.
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  get: vi.fn(async (..._a: unknown[]) => ({ data: [] })),
  post: vi.fn(async (..._a: unknown[]) => ({ data: { startUrl: "x" } })),
  delete: vi.fn(async (..._a: unknown[]) => ({})),
}));
vi.mock("@/shared/api", () => ({
  apiClient: calls,
  NOT_A_SAVE: { confirmWrite: false },
}));

const { oauthLinkApi } = await import("./oauthLinkApi");

describe("oauthLinkApi silent", () => {
  it("목록 · 연결 · 해제 모두 silent", async () => {
    await oauthLinkApi.getProviders();
    await oauthLinkApi.startLink("google", "http://x");
    await oauthLinkApi.unlink("google");
    expect(calls.get.mock.calls[0]![1]).toMatchObject({ silent: true });
    // 연결 시작은 주소를 받을 뿐 저장이 아니다 — 쓰기 확인 처리에서 뺀다(판단 (2) 예외)
    expect(calls.post.mock.calls[0]![2]).toMatchObject({
      silent: true,
      confirmWrite: false,
    });
    expect(calls.delete.mock.calls[0]![1]).toMatchObject({ silent: true });
  });
});
