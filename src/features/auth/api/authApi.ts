import {
  apiClient,
  AUTH_STEP,
  silentConfig,
  type SilentOpts,
} from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  TokenExchangeResponse,
  LoginCheckResponse,
} from "@/entities/session";

export const authApi = {
  // 교환과 로그아웃은 `AUTH_STEP` 으로 보낸다 — 이 둘의 401 은 세션 만료가 아니라 이 단계의 답이라
  // 인터셉터가 `/login?expired=1` 로 보내지 않는다. 교환 거절(`AUTH_030` 등)은 콜백 화면이, 로그아웃은 useAuth 가 받는다.
  exchangeCode: async (params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<TokenExchangeResponse> => {
    const resp: ApiResponse<TokenExchangeResponse> = await apiClient.post(
      "/v1/auth/exchange-code",
      params,
      AUTH_STEP,
    );
    return resp.data;
  },
  loginCheck: async (opts?: SilentOpts): Promise<LoginCheckResponse> => {
    const resp: ApiResponse<LoginCheckResponse> = await apiClient.get(
      "/v1/auth/check",
      silentConfig(opts),
    );
    return resp.data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post("/v1/auth/logout", undefined, AUTH_STEP);
  },
};
