// 돈이 움직이는 쓰기의 응답을 못 읽었을 때(PARSE) — 실제 apiClient(axios silentJSONParsing)와 실제 훅으로 돌린다.
//
// 예전: 2xx 에 깨진 JSON 이 오면 axios 가 던지지 않고 문자열로 넘겨 성공으로 처리됐다(거래 추가는 닫힘 · 결제는 닫힘).
// 지금: confirmWrite 를 단 쓰기는 본문이 { success: true } 모양이 아니면 WriteUnconfirmedError(PARSE) — 실패도 성공도 아니다.
// 훅은 성공 때와 같은 범위를 다시 받고(invalidate), 화면은 "…확인하지 못했어요" 를 말하며 폼을 닫지 않는다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const { apiClient, isWriteUnconfirmed } = await import("@/shared/api");
const { useCreateExpense, useUpdateExpense, useReplaceExpense } =
  await import("@/features/expense/model/useExpenses");
const { useCreateTransfer, useUpdateTransfer, usePayCard } =
  await import("./useAssets");
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
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
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

  it("표식이 없는 쓰기는 예전 그대로 — 깨진 본문도 성공으로 넘긴다(돈이 움직이는 쓰기만 확인한다)", async () => {
    body = BROKEN;
    await act(async () => {
      const data = await apiClient.post("/v1/notification/1/read");
      expect(data).toBe(BROKEN);
    });
  });
});
