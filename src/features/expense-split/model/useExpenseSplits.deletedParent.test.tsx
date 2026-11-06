// 거래를 지우면 **삭제는 되는데 오류 토스트가 떴다** — "가계부 내역을 찾을 수 없어요"
// (QA #153, 분할이 있든 없든 매번).
//
// 우리가 만든 회귀다. #145 에서 삭제 무효화 묶음(`"ledger"`)에 분할 키를 넣었는데,
// 지운 그 순간 상세 대화상자가 아직 떠 있고 `useExpenseSplits(rowId)` 가 살아 있다.
// 무효화가 그 조회를 깨워 **지운 아이디로 다시 묻고**, 서버는 404 로 답하고, 전역
// 인터셉터가 그걸 토스트로 올린다.
//
// 고치는 자리를 고를 때 순서에 기대면 안 된다 — "대화상자를 먼저 닫는다" 는 이 호출처
// 하나만 막는다. 거래를 지우는 길은 여럿이고(자산 삭제·카드 결제 취소·다른 기기),
// 그 아이디를 든 화면도 셋이다(상세·편집 시트·분할 대화상자). 그래서 **부모가 없으면
// 분할도 없다** 는 판단을 조회하는 자리 하나에 두었다(`expenseSplitApi.getSplits`).
//
// 여기서는 진짜 배선으로 잠근다 — 실제 인터셉터 · 실제 QueryClient · 실제 훅. 어댑터만
// 서버 자리에 세운다. 잠그는 것은 **삭제 뒤 `toast.error` 호출 0**.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const spies = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: spies.toastError, success: vi.fn(), message: vi.fn() },
}));

const { apiClient } = await import("@/shared/api");
const { useExpenseSplits } = await import("./useExpenseSplits");
const { useDeleteExpense } =
  await import("@/features/expense/model/useExpenses");

const TX_ID = 77;
const SPLITS_URL = `/v1/expense/${TX_ID}/splits`;

/** 서버가 돌려주는 껍데기 — 인터셉터가 `response.data` 를 벗겨 준다. */
const ok = (config: InternalAxiosRequestConfig, data: unknown) =>
  ({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  }) as AxiosResponse;

const gone = (config: InternalAxiosRequestConfig) =>
  new AxiosError(
    "Request failed with status code 404",
    "ERR_BAD_REQUEST",
    config,
    null,
    {
      data: { message: "가계부 내역을 찾을 수 없어요" },
      status: 404,
      statusText: "Not Found",
      headers: {},
      config,
    } as AxiosResponse,
  );

let calls: string[];
let deleted: boolean;
/** 분할 조회에 서버가 어떻게 답하는가 — 기본은 "부모가 지워졌다". */
let splitsFailure: "gone" | "broken";

const installAdapter = () => {
  apiClient.defaults.adapter = async (config) => {
    const cfg = config as InternalAxiosRequestConfig;
    const url = cfg.url ?? "";
    calls.push(`${(cfg.method ?? "").toUpperCase()} ${url}`);
    if (url === `/v1/expense/${TX_ID}` && cfg.method === "delete") {
      deleted = true;
      return ok(cfg, { data: null });
    }
    if (url === SPLITS_URL && cfg.method === "get") {
      if (!deleted) return ok(cfg, { data: { splits: [{ rowId: 1 }] } });
      if (splitsFailure === "gone") throw gone(cfg);
      throw new AxiosError("Server Error", "ERR_BAD_RESPONSE", cfg, null, {
        data: { message: "서버가 아파요" },
        status: 500,
        statusText: "Server Error",
        headers: {},
        config: cfg,
      } as AxiosResponse);
    }
    throw new Error(`테스트가 예상하지 못한 요청: ${cfg.method} ${url}`);
  };
};

function Harness() {
  const splitsQ = useExpenseSplits(TX_ID);
  const deleteMut = useDeleteExpense();
  return (
    <button
      data-splits={String(splitsQ.data?.length ?? -1)}
      data-failed={String(splitsQ.isError)}
      onClick={() => deleteMut.mutate(TX_ID)}
    >
      delete
    </button>
  );
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  calls = [];
  deleted = false;
  splitsFailure = "gone";
  spies.toastError.mockClear();
  installAdapter();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  client.clear();
});

const btn = () => container.querySelector("button") as HTMLButtonElement;

/** 조회·무효화·재조회가 다 가라앉을 때까지. */
const settle = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

/** 상세가 열린 채 그 거래를 지운다 — 분할 조회는 화면에 살아 있다. */
const openThenDelete = async () => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(btn().dataset.splits, "지우기 전 분할 1건").toBe("1");

  await act(async () => {
    btn().click();
  });
  await settle();
};

describe("지운 거래의 분할 조회", () => {
  it("삭제 뒤 오류 토스트가 뜨지 않는다", async () => {
    await openThenDelete();

    // 무효화는 그대로 둔다 — 지운 아이디로 한 번 더 묻는 건 사실이고, 그게 문제가
    // 아니었다. 문제는 그 답을 사용자에게 오류로 옮긴 것이다.
    expect(calls).toEqual([
      `GET ${SPLITS_URL}`,
      `DELETE /v1/expense/${TX_ID}`,
      `GET ${SPLITS_URL}`,
    ]);
    expect(spies.toastError).not.toHaveBeenCalled();
  });

  it("404 는 오류가 아니라 빈 목록이다 — 화면이 실패 상태로 남지 않는다", async () => {
    await openThenDelete();

    expect(btn().dataset.failed).toBe("false");
    expect(btn().dataset.splits).toBe("0");
  });

  // 전역 서버 원문 토스트는 걷었다(1e149414) — 실패는 호출처가 알린다(상세의 분할 실패 띠 · 나누기 단계의 Result Section).
  // 여기서 잠그는 것은 "500 은 삼키지 않고 실패 상태로 남긴다" 이다 — 404 처럼 빈 목록으로 바꾸지 않는다
  it("404 만 삼킨다 — 서버가 아프면 실패로 남는다(알림은 호출처)", async () => {
    splitsFailure = "broken";

    await openThenDelete();

    expect(spies.toastError).not.toHaveBeenCalled();
    expect(btn().dataset.failed).toBe("true");
    expect(btn().dataset.splits).not.toBe("0");
  });
});
