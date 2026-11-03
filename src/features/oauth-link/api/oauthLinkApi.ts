/**
 * 소셜 계정 연동(OAuth link) API. 설정 '연결된 계정'에서 사용.
 * desk-back(/api) 이 SSO 로 연동 티켓을 받아 startUrl 을 돌려주고, 브라우저가 거기로 이동해
 * SSO→Google→연동 후 다시 설정 페이지로 ?linked=<provider> / ?linkError=<msg> 를 달고 복귀한다.
 * 전부 desk 쿠키 인증(apiClient withCredentials).
 */
import { apiClient } from "@/shared/api";
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

  startLink: async (
    provider: string,
    returnUrl: string,
  ): Promise<{ startUrl: string }> => {
    const resp: ApiResponse<{ startUrl: string }> = await apiClient.post(
      `/v1/oauth/link/${provider}`,
      { returnUrl },
      QUIET,
    );
    return resp.data;
  },

  unlink: async (provider: string): Promise<void> => {
    await apiClient.delete(`/v1/oauth/link/${provider}`, QUIET);
  },
};
