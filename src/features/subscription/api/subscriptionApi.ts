/**
 * 구독·기능권한·증권사 크리덴셜 API. 증권 기능 게이트(메뉴 노출)와 설정(증권사 연결)의 백엔드 연동.
 */
import {
  apiClient,
  SAFE_TO_RETRY,
  type QuietRequestConfig,
} from "@/shared/api";
import type { ApiResponse } from "@/shared/types";

export interface MyFeatures {
  /** 활성 기능권한 코드 (예: ["SECURITIES"]) */
  features: string[];
  /** 연결된 증권사 코드. 증권사가 늘어도 이 배열만 늘어난다 */
  connectedBrokers: string[];
  /** 가계부 자산 평가에 쓰는 증권사. 연결이 없으면 null */
  primaryBroker: string | null;
  /** @deprecated 구버전 호환용 파생값 — 새 코드는 connectedBrokers 를 봐라 */
  tossConnected: boolean;
}

export interface SubscriptionInfo {
  planCode: string;
  planName: string;
  status: string;
  startedAt: string;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  /** 이 구독 플랜의 가격(원). 서버가 안 주면 null — 화면이 값 없이 그린다 */
  price: number | null;
  /** 이 구독 플랜의 기간(개월) — 1 월간 · 12 연간. 안 주면 null */
  durationMonths: number | null;
}

/**
 * 증권사 한 곳의 연결 상태 + 입력 폼 라벨.
 *
 * 표시명·발급처·라벨을 **서버가 준다.** 증권사가 늘어도 프론트 배포 없이 목록에 나타나고,
 * 같은 자리를 회사마다 다르게 부르는 문제(토스 Client ID / 나무 App Key)도 여기서 풀린다.
 */
export interface BrokerConnection {
  broker: string;
  displayName: string;
  issueUrl: string;
  keyLabel: string;
  secretLabel: string;
  connected: boolean;
  verified: boolean;
  primary: boolean;
  verifiedAt: string | null;
}

export interface SubscriptionPlan {
  planCode: string;
  planName: string;
  /** 1 월간 · 12 연간 */
  durationMonths: number | null;
  /** 가격(원) — 화면에 박지 않고 서버 값을 그린다. 없으면 null */
  price: number | null;
}

/**
 * 프로그램용 API 토큰 목록의 한 줄.
 *
 * **원문은 없다** — 서버에도 해시만 남는다. `tokenPrefix` 는 어느 토큰인지 알아보기 위한
 * 앞부분(`pdk_` + 8자)이고, 그것만으로는 호출할 수 없다.
 */
export interface ApiToken {
  rowId: number;
  name: string;
  tokenPrefix: string;
  /** 서버 `[UTC]` */
  createAt: string;
  /** 서버 `[UTC]`. 분 단위로 묶어 기록한다. 안 썼으면 null */
  lastUsedAt: string | null;
}

/** 방금 발급한 토큰. `token` 원문은 이 응답에서만 볼 수 있다. */
export interface IssuedApiToken {
  rowId: number;
  name: string;
  token: string;
  tokenPrefix: string;
  createAt: string;
}

// 이 화면은 실패를 제 자리에서 고정 글로 알린다 — 서버 원문 알림은 끈다
const QUIET: QuietRequestConfig = { silent: true };

export const subscriptionApi = {
  getMyFeatures: async (): Promise<MyFeatures> => {
    // 실패는 호출처가 그린다(구독 페이지 Result Section · 게이트는 닫힘) — 서버 글 알림을 끈다
    const resp: ApiResponse<MyFeatures> = await apiClient.get(
      "/v1/users/me/features",
      QUIET,
    );
    return resp.data;
  },

  getPlans: async (): Promise<SubscriptionPlan[]> => {
    const resp: ApiResponse<SubscriptionPlan[]> = await apiClient.get(
      "/v1/subscriptions/plans",
      QUIET,
    );
    return resp.data;
  },

  getMySubscription: async (): Promise<SubscriptionInfo | null> => {
    const resp: ApiResponse<SubscriptionInfo | null> = await apiClient.get(
      "/v1/subscriptions/me",
      QUIET,
    );
    return resp.data;
  },

  subscribe: async (planCode: string): Promise<SubscriptionInfo> => {
    // 실패 글은 화면이 정한 고정 글로 알린다 — 서버 원문 알림을 끈다(I-14 32)
    const resp: ApiResponse<SubscriptionInfo> = await apiClient.post(
      "/v1/subscriptions",
      { planCode },
      QUIET,
    );
    return resp.data;
  },

  cancelSubscription: async (reason?: string): Promise<void> => {
    // 확인창 뒤 요청 — 실패는 useConfirmFail 의 Snackbar 가 말한다(서버 원문 알림을 끈다)
    await apiClient.delete("/v1/subscriptions/me", {
      data: { reason },
      ...QUIET,
    });
  },

  /** 전 증권사 연결 상태 — 미연결 증권사도 포함해 화면이 목록을 그린다. */
  getBrokerConnections: async (opts?: {
    silent?: boolean;
  }): Promise<BrokerConnection[]> => {
    const resp: ApiResponse<BrokerConnection[]> = await apiClient.get(
      "/v1/users/me/securities-credentials",
      opts?.silent ? QUIET : undefined,
    );
    return resp.data ?? [];
  },

  registerBrokerCredential: async (
    broker: string,
    apiKey: string,
    apiSecret: string,
  ): Promise<void> => {
    // 실패는 카드가 고정 글로 알린다 — 서버 원문 알림을 끈다
    await apiClient.post(
      `/v1/users/me/securities-credentials/${broker}`,
      { apiKey, apiSecret },
      QUIET,
    );
  },

  disconnectBrokerCredential: async (broker: string): Promise<void> => {
    await apiClient.delete(
      `/v1/users/me/securities-credentials/${broker}`,
      // 연결 끊기는 다시 해도 같은 결과 — 확인 못 함 없이 그대로 실패 + [다시 시도](판단 ⑤)
      { ...QUIET, ...SAFE_TO_RETRY },
    );
  },

  /** 가계부 자산 평가에 쓸 증권사를 지정한다. */
  setPrimaryBroker: async (broker: string): Promise<void> => {
    await apiClient.put(
      `/v1/users/me/securities-credentials/${broker}/primary`,
      undefined,
      // 기본 증권사 정하기는 다시 해도 같은 결과
      { ...QUIET, ...SAFE_TO_RETRY },
    );
  },

  getApiTokens: async (): Promise<ApiToken[]> => {
    const resp: ApiResponse<ApiToken[]> = await apiClient.get(
      "/v1/users/me/api-tokens",
    );
    return resp.data ?? [];
  },

  issueApiToken: async (name: string): Promise<IssuedApiToken> => {
    const resp: ApiResponse<IssuedApiToken> = await apiClient.post(
      "/v1/users/me/api-tokens",
      { name },
      QUIET,
    );
    return resp.data;
  },

  revokeApiToken: async (rowId: number): Promise<void> => {
    // 토큰 폐기는 다시 해도 같은 결과
    await apiClient.delete(`/v1/users/me/api-tokens/${rowId}`, {
      ...QUIET,
      ...SAFE_TO_RETRY,
    });
  },
};
