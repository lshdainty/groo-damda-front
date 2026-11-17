// 로그인 · 로그아웃 단계 자신의 401 은 세션 만료가 아니다(보안 점검 CLI-6) — 인터셉터가 `/login?expired=1` 로 보내지 않고
// 호출처에 그대로 던진다. 교환의 401(AUTH_030)을 세션 만료로 읽으면 로그인 화면이 곧장 그루 계정 로그인으로 다시 보내
// 거절된 로그인이 실패 화면 없이 맴돈다. 그 밖의 요청은 전처럼 로그인으로 간다.
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiClient,
  isAuthenticated,
  setAuthenticated,
  clearAuthenticated,
} from "@/shared/api";
import { LOGIN_REDIRECT_SETTLE_MS } from "@/shared/api/base";
import { isReloginRequiredError } from "../lib/relogin-required-error";
import { captureLocationHref } from "../lib/test-utils";
import { authApi } from "./authApi";

const original = apiClient.defaults.adapter;
let location: ReturnType<typeof captureLocationHref>;

/** 모든 요청이 401 · 그 코드로 떨어진다 */
const reject401 = (code: string) => {
  apiClient.defaults.adapter = async (config) => {
    throw new AxiosError(
      "401",
      "ERR_BAD_REQUEST",
      config as InternalAxiosRequestConfig,
      {},
      {
        status: 401,
        statusText: "",
        data: { success: false, code },
        headers: {},
        config: config as InternalAxiosRequestConfig,
      },
    );
  };
};

beforeEach(() => {
  setAuthenticated();
  location = captureLocationHref();
});

afterEach(() => {
  apiClient.defaults.adapter = original;
  location.restore();
  clearAuthenticated();
});

describe("로그인 · 로그아웃 단계의 401", () => {
  it("교환이 401 · AUTH_030 으로 거절돼도 로그인으로 보내지 않고, 코드를 그대로 호출처에 던진다", async () => {
    reject401("AUTH_030");
    const error = await authApi
      .exchangeCode({ code: "c", codeVerifier: "v", redirectUri: "r" })
      .catch((e: unknown) => e);
    expect(isReloginRequiredError(error)).toBe(true);
    expect(location.sets).toEqual([]);
    // 로그인 표식을 인터셉터가 대신 지우지도 않는다 — 갈 자리는 콜백 화면이 정한다
    expect(isAuthenticated()).toBe(true);
  });

  it("로그아웃의 401(이미 끊긴 세션)도 로그인으로 보내지 않는다 — 로그아웃한 뒤 화면은 useAuth 가 정한다", async () => {
    reject401("AUTH_001");
    await expect(authApi.logout()).rejects.toBeInstanceOf(AxiosError);
    expect(location.sets).toEqual([]);
  });

  it("그 밖의 요청은 전처럼 401 이면 /login?expired=1 로 간다(세션 만료)", async () => {
    vi.useFakeTimers();
    try {
      reject401("AUTH_002");
      await authApi.loginCheck().catch(() => undefined);
      expect(location.sets).toEqual(["/login?expired=1"]);
      expect(isAuthenticated()).toBe(false);
      vi.advanceTimersByTime(LOGIN_REDIRECT_SETTLE_MS);
    } finally {
      vi.useRealTimers();
    }
  });
});
