// 불러오기 요청 제한 10초 · 다시 시도는 그 안에서 — skeleton.md "요청 제한 10초" (03E-021)
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginAttempt,
  endChain,
  resetBudget,
  retryDelay,
} from "./request-budget";
import { retryOnlyServerErrors } from "./retry";

const config = (
  extra: Partial<InternalAxiosRequestConfig> = {},
): InternalAxiosRequestConfig => ({
  method: "get",
  baseURL: "/api",
  url: "/v1/expense",
  params: { month: "2026-10" },
  headers: new AxiosHeaders(),
  ...extra,
});

const failure = (cfg: InternalAxiosRequestConfig, status?: number) =>
  new AxiosError(
    status ? "http" : "Network Error",
    status ? String(status) : "ERR_NETWORK",
    cfg,
    {},
    status
      ? { status, statusText: "", data: {}, headers: {}, config: cfg }
      : undefined,
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
  resetBudget();
});
afterEach(() => vi.useRealTimers());

describe("읽기 요청 제한 10초", () => {
  it("읽기는 첫 시도에 10초를 받는다", () => {
    const cfg = config();
    beginAttempt(cfg);
    expect(cfg.timeout).toBe(10_000);
  });

  it("다시 시도는 처음부터 이어 센다 — 1초 뒤 시도는 남은 9초(1초 실패 + 1초 간격 뒤 8초)", () => {
    const first = config();
    beginAttempt(first);
    vi.advanceTimersByTime(1_000);
    expect(retryOnlyServerErrors(0, failure(first, 503))).toBe(true);
    expect(retryDelay(0)).toBe(1_000);
    vi.advanceTimersByTime(1_000); // 1초 기다린 뒤 두 번째 시도
    const second = config();
    beginAttempt(second);
    expect(second.timeout).toBe(8_000);
    // 두 번째도 실패 → 2초 뒤 세 번째(마지막)
    expect(retryOnlyServerErrors(1, failure(second, 503))).toBe(true);
    expect(retryDelay(1)).toBe(2_000);
    vi.advanceTimersByTime(2_000);
    const third = config();
    beginAttempt(third);
    expect(third.timeout).toBe(6_000);
    // 다시 시도는 2번까지
    expect(retryOnlyServerErrors(2, failure(third, 503))).toBe(false);
  });

  it("간격까지 더해 10초를 넘기게 되면 다시 하지 않는다", () => {
    const cfg = config();
    beginAttempt(cfg);
    vi.advanceTimersByTime(8_500);
    // 8.5초 + 1초 간격 = 9.5초 → 한 번 더 할 수 있다
    expect(retryOnlyServerErrors(0, failure(cfg))).toBe(true);
    vi.advanceTimersByTime(500);
    // 9초 + 1초 간격 = 10초 → 넘겼다
    expect(retryOnlyServerErrors(0, failure(cfg))).toBe(false);
  });

  it("10초에 끊긴 요청(timeout)은 다시 하지 않는다", () => {
    const cfg = config();
    beginAttempt(cfg);
    vi.advanceTimersByTime(10_000);
    expect(retryOnlyServerErrors(0, failure(cfg))).toBe(false);
  });

  it("4xx 는 바로 실패, 5xx 는 다시 시도", () => {
    const cfg = config();
    beginAttempt(cfg);
    expect(retryOnlyServerErrors(0, failure(cfg, 404))).toBe(false);
    expect(retryOnlyServerErrors(0, failure(cfg, 500))).toBe(true);
  });

  it("쓰기 · 파일 받기 · 직접 준 timeout 은 제한을 걸지 않는다", () => {
    for (const extra of [
      { method: "post" },
      { method: "delete" },
      { responseType: "blob" as const },
      { timeout: 60_000 },
    ]) {
      const cfg = config(extra);
      const before = cfg.timeout;
      beginAttempt(cfg);
      expect(cfg.timeout, JSON.stringify(extra)).toBe(before);
    }
    // 제한이 없는 요청은 종전처럼 한 번만 다시
    const download = config({ responseType: "blob" });
    beginAttempt(download);
    expect(retryOnlyServerErrors(0, failure(download, 500))).toBe(true);
    expect(retryOnlyServerErrors(1, failure(download, 500))).toBe(false);
  });

  it("끝난 불러오기는 잊는다 — 곧바로 다시 불러와도 새로 10초", () => {
    const first = config();
    beginAttempt(first);
    vi.advanceTimersByTime(3_000);
    endChain(first);
    const again = config();
    beginAttempt(again);
    expect(again.timeout).toBe(10_000);
  });

  it("실패 뒤 한참 지나 사용자가 다시 부르면 새 불러오기다", () => {
    const first = config();
    beginAttempt(first);
    vi.advanceTimersByTime(4_000);
    vi.advanceTimersByTime(60_000);
    const again = config();
    beginAttempt(again);
    expect(again.timeout).toBe(10_000);
  });
});

describe("증권 읽기도 10초 한도를 받는다(앱과 같다)", () => {
  it("/v1/securities · toss · namu GET 도 첫 시도 10초", () => {
    for (const url of [
      "/v1/securities/quote",
      "/v1/toss/accounts",
      "/v1/namu/x",
    ]) {
      const cfg = config({ url });
      beginAttempt(cfg);
      expect(cfg.timeout, url).toBe(10_000);
    }
  });
});

describe("실제 경로(apiClient + 가짜 adapter) — axios 가 합쳐 넘기는 기본 timeout 0 에서도 걸린다", () => {
  it("GET 은 10000 을 받고, 4xx 로 끝나면 기억을 지운다", async () => {
    const { apiClient } = await import("./base");
    const seen: (number | undefined)[] = [];
    let status = 503;
    const original = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async (cfg) => {
      seen.push(cfg.timeout);
      const response = {
        status,
        statusText: "",
        // 서버 껍데기 — 쓰기는 껍데기가 아니면 "확인하지 못함" 으로 바뀐다
        data: status >= 400 ? {} : { success: true, data: null },
        headers: {},
        config: cfg,
      };
      if (status >= 400)
        throw new AxiosError("http", String(status), cfg, {}, response);
      return response;
    };
    try {
      // 기본값이 합쳐진 config 의 timeout 은 0 — 그래도 10000 이 걸린다
      const firstError = await apiClient.get("/v1/real").catch((e) => e);
      expect(seen[0]).toBe(10_000);
      // 전역 retry 가 "다시 한다" 고 답한 다음 시도만 이어 센다
      expect(retryOnlyServerErrors(0, firstError)).toBe(true);
      // 1.5초 뒤 다시 시도 — 남은 시간
      vi.advanceTimersByTime(1_500);
      await expect(apiClient.get("/v1/real")).rejects.toBeTruthy();
      expect(seen[1]).toBe(8_500);
      // 쓰기 · 파일 받기는 제한 없음(기본값 0 그대로)
      status = 200;
      await apiClient.post("/v1/real", {});
      await apiClient.get("/v1/file", { responseType: "blob" });
      expect(seen[2]).toBeFalsy();
      expect(seen[3]).toBeFalsy();
      // 4xx 로 끝난 요청은 잊는다 — 곧 다시 불러와도 새로 10초
      status = 404;
      await expect(apiClient.get("/v1/gone")).rejects.toBeTruthy();
      const err = new AxiosError(
        "http",
        "404",
        { ...config({ url: "/v1/gone" }), baseURL: apiClient.defaults.baseURL },
        {},
        {
          status: 404,
          statusText: "",
          data: {},
          headers: {},
          config: config({ url: "/v1/gone" }),
        },
      );
      expect(retryOnlyServerErrors(0, err)).toBe(false);
      status = 200;
      await apiClient.get("/v1/gone");
      expect(seen[seen.length - 1]).toBe(10_000);
    } finally {
      apiClient.defaults.adapter = original;
    }
  });
});

describe("이어 세기는 다시 시도하는 시도에만(실제 경로)", () => {
  const install = async () => {
    const { apiClient } = await import("./base");
    const seen: number[] = [];
    const original = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async (cfg) => {
      seen.push(cfg.timeout ?? 0);
      // 요청이 한도만큼 걸린 뒤 실패한다
      vi.advanceTimersByTime(cfg.timeout ?? 0);
      const response = {
        status: 503,
        statusText: "",
        data: {},
        headers: {},
        config: cfg,
      };
      throw new AxiosError("http", "503", cfg, {}, response);
    };
    return {
      apiClient,
      seen,
      restore: () => (apiClient.defaults.adapter = original),
    };
  };

  it("retry:false 쿼리(증권 폴링 등)가 실패하고 곧바로 다시 불러와도 새로 10초", async () => {
    const { apiClient, seen, restore } = await install();
    try {
      await apiClient.get("/v1/securities/quote").catch(() => {}); // 전역 retry 를 거치지 않는다
      // 10초 timeout 으로 끝난 직후(2.5초 안) 같은 요청이 다시 온다
      await apiClient.get("/v1/securities/quote").catch(() => {});
      expect(seen).toEqual([10_000, 10_000]);
    } finally {
      restore();
    }
  });

  it("사용자가 '다시 시도' 를 눌러 다시 부르면 처음부터 센다", async () => {
    const { apiClient, seen, restore } = await install();
    try {
      const err = await apiClient.get("/v1/real").catch((e) => e);
      // 10초가 지났으니 자동 다시 시도는 포기한다
      expect(retryOnlyServerErrors(0, err)).toBe(false);
      await apiClient.get("/v1/real").catch(() => {});
      expect(seen).toEqual([10_000, 10_000]);
    } finally {
      restore();
    }
  });
});
