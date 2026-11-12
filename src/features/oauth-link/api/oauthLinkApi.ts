/**
 * 소셜 계정 연동(OAuth link) API. 설정 '연결된 계정'에서 사용.
 * desk-back(/api) 이 SSO 로 연동 티켓을 받아 startUrl 을 돌려주고, 브라우저가 거기로 이동해
 * SSO→Google→연동 후 다시 설정 페이지로 ?linked=<provider> / ?linkError=<msg> 를 달고 복귀한다.
 * 전부 desk 쿠키 인증(apiClient withCredentials).
 */
import { apiClient, NOT_A_SAVE } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type { AxiosRequestConfig } from "axios";

/**
 * 세 요청 모두 전역 오류 알림 대신 화면이 고정 글로 알린다(I-14 10) — 그루 계정이 쓴 글("Cannot unlink the only authentication method")이
 * 화면에 닿지 않게 한다. 전역 핸들러의 `silent` 확장은 base.ts 의 QuietRequestConfig 다.
 */
const QUIET = { silent: true } as AxiosRequestConfig & { silent: boolean };

export interface ProviderInfo {
  /** 대문자 provider 타입 (예: "GOOGLE") */
  type: string;
  /** 표시 이름 (예: "Google") */
  name: string;
  /** SSO 인가 URL */
  authUrl: string;
  /** 현재 사용자와 연동됨 여부 */
  linked: boolean;
}

export const oauthLinkApi = {
  getProviders: async (): Promise<ProviderInfo[]> => {
    const resp: ApiResponse<ProviderInfo[]> = await apiClient.get(
      "/v1/oauth/providers",
      QUIET,
    );
    return resp.data;
  },

  /**
   * 연동 시작 — 서버가 SSO 시작 주소를 돌려준다.
   *
   * `reauthToken` 은 `purpose: "oauth-link"` 로 방금 받은 10분 · 단회 재인증 티켓이다(보안 점검 S-2 —
   * 로그인 쿠키만 훔친 사람이 자기 구글을 붙여 계정을 가로채지 못하게). 저장하지 말고 곧장 싣는다.
   * 이 호출이 실패하면 티켓은 이미 쓰였을 수 있다 — 다시 본인 확인부터 받는다.
   */
  startLink: async (
    provider: string,
    returnUrl: string,
    reauthToken: string,
  ): Promise<{ startUrl: string }> => {
    const resp: ApiResponse<{ startUrl: string }> = await apiClient.post(
      `/v1/oauth/link/${provider}`,
      { returnUrl },
      // 연결 시작 주소를 받을 뿐 저장이 아니다 — 확인 처리에서 뺀다(판단 (2) 예외)
      {
        ...QUIET,
        ...NOT_A_SAVE,
        headers: { "X-Reauth-Token": reauthToken },
      },
    );
    return resp.data;
  },

  /**
   * 연결 해제 — 연결 시작과 같은 `oauth-link` 재인증 티켓을 헤더로 싣는다(보안 점검 S-2 잔여). 로그인 쿠키만 쥔
   * 사람이 본인의 구글 연결을 끊어 복구 수단을 없애지 못하게. 저장하지 말고 곧장 싣는다.
   */
  unlink: async (provider: string, reauthToken: string): Promise<void> => {
    await apiClient.delete(`/v1/oauth/link/${provider}`, {
      ...QUIET,
      headers: { "X-Reauth-Token": reauthToken },
    });
  },
};
