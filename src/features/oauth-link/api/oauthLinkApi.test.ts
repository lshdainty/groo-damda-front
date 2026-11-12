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
    await oauthLinkApi.startLink("google", "http://x", "ticket-1");
    await oauthLinkApi.unlink("google", "ticket-u");
    expect(calls.get.mock.calls[0]![1]).toMatchObject({ silent: true });
    // 연결 시작은 주소를 받을 뿐 저장이 아니다 — 쓰기 확인 처리에서 뺀다(판단 (2) 예외)
    expect(calls.post.mock.calls[0]![2]).toMatchObject({
      silent: true,
      confirmWrite: false,
    });
    expect(calls.delete.mock.calls[0]![1]).toMatchObject({ silent: true });
  });

  // S-2 잔여 — 해제도 같은 티켓을 헤더로 싣는다. 빠지면 서버가 막는다.
  it("해제는 재인증 티켓을 X-Reauth-Token 헤더로 싣는다", async () => {
    calls.delete.mockClear();
    await oauthLinkApi.unlink("google", "ticket-u");
    const [url, config] = calls.delete.mock.calls[0]!;
    expect(url).toBe("/v1/oauth/link/google");
    expect(config).toMatchObject({
      silent: true,
      headers: { "X-Reauth-Token": "ticket-u" },
    });
  });

  // S-2 — 연동 시작은 방금 받은 재인증 티켓을 헤더로 싣는다. 빠지면 서버가 OAUTH_LINK_FAILED 로 막는다.
  it("연결 시작은 재인증 티켓을 X-Reauth-Token 헤더로 싣고, 본문은 returnUrl 그대로다", async () => {
    calls.post.mockClear();
    await oauthLinkApi.startLink("google", "http://x", "ticket-1");
    const [url, body, config] = calls.post.mock.calls[0]!;
    expect(url).toBe("/v1/oauth/link/google");
    expect(body).toEqual({ returnUrl: "http://x" });
    expect(config).toMatchObject({
      headers: { "X-Reauth-Token": "ticket-1" },
    });
  });
});
