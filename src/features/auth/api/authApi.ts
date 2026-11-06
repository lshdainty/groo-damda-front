import {
  apiClient,
  NOT_A_SAVE,
  silentConfig,
  type SilentOpts,
} from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  TokenExchangeResponse,
  LoginCheckResponse,
} from "@/entities/session";

export const authApi = {
  exchangeCode: async (params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<TokenExchangeResponse> => {
    const resp: ApiResponse<TokenExchangeResponse> = await apiClient.post(
      "/v1/auth/exchange-code",
      params,
      NOT_A_SAVE,
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
    await apiClient.post("/v1/auth/logout", undefined, NOT_A_SAVE);
  },
};
