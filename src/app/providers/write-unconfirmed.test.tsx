// 돈이 움직이는 쓰기의 응답을 못 읽었을 때(PARSE) — 실제 apiClient(axios silentJSONParsing)와 실제 훅으로 돌린다.
//
// 예전: 2xx 에 깨진 JSON 이 오면 axios 가 던지지 않고 문자열로 넘겨 성공으로 처리됐다(거래 추가는 닫힘 · 결제는 닫힘).
// 지금: confirmWrite 를 단 쓰기는 본문이 { success: true } 모양이 아니면 WriteUnconfirmedError(PARSE) — 실패도 성공도 아니다.
// 훅은 성공 때와 같은 범위를 다시 받고(invalidate), 화면은 "…확인하지 못했어요" 를 말하며 폼을 닫지 않는다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const { apiClient, isWriteUnconfirmed } = await import("@/shared/api");
const { useCreateExpense, useUpdateExpense, useReplaceExpense } =
  await import("@/features/expense/model/useExpenses");
const { useCreateTransfer, useUpdateTransfer, usePayCard } =
  await import("@/features/asset/model/useAssets");
const { useCreateMemo } = await import("@/features/memo/model/useMemos");
const { createAppQueryClient } = await import("./query-client");
const { useCommitSms } = await import("@/features/sms");

let body: unknown;
const reply = (config: InternalAxiosRequestConfig) =>
  ({
    data: body,
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    config,
  }) as AxiosResponse;
const originalAdapter = apiClient.defaults.adapter;

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  apiClient.defaults.adapter = async (config) =>
    reply(config as InternalAxiosRequestConfig);
  // 앱과 같은 설정 — 확인 못 한 쓰기의 다시 받기는 MutationCache 가 맡는다
  client = createAppQueryClient();
  invalidate = vi.spyOn(client, "invalidateQueries");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  apiClient.defaults.adapter = originalAdapter;
});

type AnyMutation = { mutateAsync: (vars: never) => Promise<unknown> };
/** 훅 하나를 그려 두고 mutateAsync 결과(던졌으면 그 오류)를 돌려준다 */
async function run(useHook: () => AnyMutation, vars: unknown) {
  const box: { mut?: AnyMutation } = {};
  function Probe() {
    const m = useHook();
    useEffect(() => {
      box.mut = m;
    });
    return null;
  }
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  let result: { ok: true; data: unknown } | { ok: false; error: unknown };
  await act(async () => {
    try {
      result = { ok: true, data: await box.mut!.mutateAsync(vars as never) };
    } catch (error) {
      result = { ok: false, error };
    }
  });
  return result!;
}

const BROKEN = '{"success":true,"code":"OK","data":{"rowId":9'; // 잘린 JSON
const cases: Array<[string, () => AnyMutation, unknown]> = [
  [
    "거래 만들기",
    () => useCreateExpense({ silent: true }) as AnyMutation,
    { amount: 1000 },
  ],
  [
    "거래 고치기",
    () => useUpdateExpense({ silent: true }) as AnyMutation,
    { id: 1, data: { amount: 1000 } },
  ],
  [
    "거래 고쳐 쓰기",
    () => useReplaceExpense({ silent: true }) as AnyMutation,
    { id: 1, data: { amount: 1000 } },
  ],
  [
    "이체 만들기",
    () => useCreateTransfer({ silent: true }) as AnyMutation,
    { amount: 1000 },
  ],
  [
    "이체 고치기",
    () => useUpdateTransfer({ silent: true }) as AnyMutation,
    { id: 1, data: { amount: 1000 } },
  ],
  [
    "카드 지금 결제",
    () => usePayCard() as AnyMutation,
    { id: 3, amount: 1000 },
  ],
  [
    "결제 문자로 만들기",
    () => useCommitSms({ silent: true }) as AnyMutation,
    { raw: "x" },
  ],
];

describe("쓰기 응답을 못 읽었다(PARSE) — 실패도 성공도 아니다", () => {
  for (const [name, hook, vars] of cases) {
    it(`${name}: 깨진 본문 → WriteUnconfirmedError + 성공 때와 같은 다시 받기`, async () => {
      body = BROKEN;
      const r = await run(hook, vars);
      expect(r.ok).toBe(false);
      expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(true);
      expect(invalidate).toHaveBeenCalled();
    });
  }

  it("2xx 인데 껍데기 모양이 아니면(success 없음) 같은 PARSE", async () => {
    body = { rowId: 9 };
    const r = await run(cases[0]![1], cases[0]![2]);
    expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(true);
  });

  it("정상 본문은 그대로 성공 — 값이 넘어오고 다시 받기도 한다", async () => {
    body = { success: true, code: "OK", message: "", data: { rowId: 9 } };
    const r = await run(cases[0]![1], cases[0]![2]);
    expect(r).toEqual({ ok: true, data: { rowId: 9 } });
    expect(invalidate).toHaveBeenCalled();
  });

  it("모든 쓰기에 같은 규칙 — 돈이 아닌 쓰기(메모)도 깨진 본문이면 확인 못 함 + 다시 받기(앱 저장 실패 규칙과 같은 범위)", async () => {
    body = BROKEN;
    const r = await run(() => useCreateMemo({ silent: true }) as AnyMutation, {
      title: "x",
      content: "",
    });
    expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(true);
    expect(invalidate).toHaveBeenCalled();
  });

  it("읽기(GET) · 빈 본문(204) · confirmWrite: false 는 확인하지 않는다", async () => {
    body = BROKEN;
    await act(async () => {
      expect(await apiClient.get("/v1/expenses")).toBe(BROKEN);
      expect(
        await apiClient.post("/v1/x", undefined, {
          confirmWrite: false,
        } as never),
      ).toBe(BROKEN);
      body = "";
      expect(await apiClient.post("/v1/notification/1/read")).toBe("");
    });
  });

  it("요청은 나갔는데 응답 전에 끊긴 쓰기(request 있음 · response 없음) → 확인하지 못했어요 + 다시 받기", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError(
        "Network Error",
        "ERR_NETWORK",
        config as InternalAxiosRequestConfig,
        {},
      );
    };
    for (const [, hook, vars] of [cases[0]!, cases[5]!]) {
      invalidate.mockClear();
      const r = await run(hook, vars);
      expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(true);
      expect(invalidate).toHaveBeenCalled();
    }
  });

  it("요청을 만들지도 못했거나(request 없음) 시간 초과면 그대로 실패 — 다시 받기도 하지 않는다", async () => {
    for (const make of [
      (c: InternalAxiosRequestConfig) =>
        new AxiosError("connect failed", "ERR_NETWORK", c),
      (c: InternalAxiosRequestConfig) =>
        new AxiosError("timeout", "ECONNABORTED", c, {}),
    ]) {
      apiClient.defaults.adapter = async (config) => {
        throw make(config as InternalAxiosRequestConfig);
      };
      invalidate.mockClear();
      const r = await run(cases[0]![1], cases[0]![2]);
      expect(r.ok).toBe(false);
      expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(false);
      expect(invalidate).not.toHaveBeenCalled();
    }
  });

  it("보낼 때 이미 오프라인이었으면(보내지도 못했다) 응답 없이 끊겨도 그대로 실패", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError(
        "Network Error",
        "ERR_NETWORK",
        config as InternalAxiosRequestConfig,
        {},
      );
    };
    invalidate.mockClear();
    const r = await run(cases[0]![1], cases[0]![2]);
    expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
    online.mockRestore();
  });

  it("보낼 땐 온라인이었는데 응답 전에 망이 끊겼으면(오류 때 오프라인) 확인 못 함 + 다시 받기 — 서버에 닿았을 수 있다(검수 3차 M1)", async () => {
    let offline = false;
    const online = vi
      .spyOn(navigator, "onLine", "get")
      .mockImplementation(() => !offline);
    apiClient.defaults.adapter = async (config) => {
      // 보낸 뒤 망이 끊긴다
      offline = true;
      throw new AxiosError(
        "Network Error",
        "ERR_INTERNET_DISCONNECTED",
        config as InternalAxiosRequestConfig,
        {},
      );
    };
    invalidate.mockClear();
    const r = await run(cases[0]![1], cases[0]![2]);
    expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(true);
    expect(invalidate).toHaveBeenCalled();
    online.mockRestore();
  });

  it("쓰기의 502 · 504 는 확인하지 못함(게이트웨이 뒤에서 처리됐을 수 있다), 503 · 500 은 실패(검수 2차 M3)", async () => {
    const answer = (status: number) => {
      apiClient.defaults.adapter = async (config) => {
        const c = config as InternalAxiosRequestConfig;
        throw new AxiosError("x", "ERR_BAD_RESPONSE", c, {}, {
          data: "",
          status,
          statusText: "",
          headers: {},
          config: c,
        } as AxiosResponse);
      };
    };
    for (const [status, unconfirmed] of [
      [502, true],
      [504, true],
      [503, false],
      [500, false],
    ] as const) {
      answer(status);
      const r = await run(cases[5]![1], cases[5]![2]);
      expect(isWriteUnconfirmed(r.ok ? null : r.error), String(status)).toBe(
        unconfirmed,
      );
    }
  });

  it("저장이 아닌 POST(로그인 · 로그아웃 · 본인 확인 · 파일 올리기 · 미리보기 · 문자 해석 · 건수 · 연결 시작)는 깨진 본문 · 끊긴 응답 · 502 에도 확인 못 함으로 가지 않는다 — 같은 조건의 일반 쓰기는 간다(판단 (2) 예외)", async () => {
    const { authApi } = await import("@/features/auth/api/authApi");
    const { userApi } = await import("@/features/user/api/userApi");
    const { analyzeImport, executeImport } =
      await import("@/features/import/api/importApi");
    const { parseSms } = await import("@/features/sms/api/smsApi");
    const { fetchExportCounts, fetchExportPreview } =
      await import("@/features/export/api/exportApi");
    const { assetApi } = await import("@/features/asset/api/assetApi");
    const { oauthLinkApi } =
      await import("@/features/oauth-link/api/oauthLinkApi");
    const { memoApi } = await import("@/features/memo/api/memoApi");
    const file = new File(["a"], "a.csv");
    const notSaves: [string, () => Promise<unknown>][] = [
      [
        "login",
        () =>
          authApi.exchangeCode({
            code: "c",
            codeVerifier: "v",
            redirectUri: "r",
          }),
      ],
      ["logout", () => authApi.logout()],
      ["verifyPassword", () => userApi.verifyPassword("p")],
      ["reauth code send", () => userApi.sendReauthEmailCode()],
      ["reauth code verify", () => userApi.verifyReauthEmailCode("123456")],
      ["reauth password", () => userApi.verifyReauthPassword("p")],
      ["import analyze", () => analyzeImport(file, "BANKSALAD" as never)],
      [
        "import execute",
        () =>
          executeImport(file, {
            source: "BANKSALAD" as never,
            mapping: {} as never,
            dupSkip: true,
            autoCat: true,
          }),
      ],
      ["sms parse", () => parseSms("x")],
      ["export counts", () => fetchExportCounts({} as never)],
      ["export preview", () => fetchExportPreview({} as never)],
      ["trade preview", () => assetApi.previewTrade({} as never)],
      ["oauth link start", () => oauthLinkApi.startLink("google", "http://x")],
    ];
    const outcomes: Record<string, () => void> = {
      깨진본문: () => {
        body = "{not json";
        apiClient.defaults.adapter = async (config) =>
          reply(config as InternalAxiosRequestConfig);
      },
      끊긴응답: () => {
        apiClient.defaults.adapter = async (config) => {
          throw new AxiosError(
            "Network Error",
            "ERR_NETWORK",
            config as InternalAxiosRequestConfig,
            {},
          );
        };
      },
      게이트웨이502: () => {
        apiClient.defaults.adapter = async (config) => {
          const c = config as InternalAxiosRequestConfig;
          throw new AxiosError("x", "ERR_BAD_RESPONSE", c, {}, {
            data: "",
            status: 502,
            statusText: "",
            headers: {},
            config: c,
          } as AxiosResponse);
        };
      },
    };
    for (const [outcome, arrange] of Object.entries(outcomes)) {
      arrange();
      for (const [name, call] of notSaves) {
        const error = await call().then(
          () => null,
          (e: unknown) => e,
        );
        expect(isWriteUnconfirmed(error), `${outcome} · ${name}`).toBe(false);
      }
      // 같은 조건의 일반 쓰기는 확인 못 함
      const error = await memoApi
        .createMemo({ title: "t", content: "c" } as never)
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(isWriteUnconfirmed(error), `${outcome} · memo`).toBe(true);
    }
  });

  it("확인 못 함의 종류는 요청 방식으로 — DELETE 는 delete, 그 밖은 save(스낵바 글을 고르는 한 곳의 기본값, 판단 ①)", async () => {
    const { memoApi } = await import("@/features/memo/api/memoApi");
    body = "{not json";
    const del = await memoApi.deleteMemo(1).then(
      () => null,
      (e: unknown) => e,
    );
    const create = await memoApi
      .createMemo({ title: "t", content: "c" } as never)
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(isWriteUnconfirmed(del) && del.kind).toBe("delete");
    expect(isWriteUnconfirmed(create) && create.kind).toBe("save");
  });

  it("성공 · 끝 처리기가 없는 쓰기(알림 지우기 등)도 확인 못 함이면 화면이 보는 것을 모두 다시 받는다", async () => {
    const { useDeleteNotification } =
      await import("@/features/notification/model/useNotifications");
    body = "{not json";
    const r = await run(useDeleteNotification, 1);
    expect(isWriteUnconfirmed(r.ok ? null : r.error)).toBe(true);
    expect(invalidate).toHaveBeenCalledWith();
  });

  it("다시 해도 같은 쓰기(알림 읽음 · 모두 읽음 · 연결 끊기 · 기본 증권사 · 토큰 폐기)는 확인 못 함으로 바꾸지 않는다 — 그대로 실패 + [다시 시도](판단 ⑤)", async () => {
    const { notificationApi } =
      await import("@/features/notification/api/notificationApi");
    const { subscriptionApi } =
      await import("@/features/subscription/api/subscriptionApi");
    body = "{not json";
    for (const call of [
      () => notificationApi.markRead(1),
      () => notificationApi.markAllRead(),
      () => subscriptionApi.disconnectBrokerCredential("NAMU"),
      () => subscriptionApi.setPrimaryBroker("NAMU"),
      () => subscriptionApi.revokeApiToken(1),
    ]) {
      const e = await call().then(
        () => null,
        (x: unknown) => x,
      );
      expect(isWriteUnconfirmed(e)).toBe(false);
    }
  });
});
