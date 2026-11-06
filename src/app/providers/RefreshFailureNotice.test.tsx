// 내용이 있는 채 다시 받다 실패 — 공용 스낵바 "새로 고치지 못했어요." 한 줄(I-wrap-b2b 2-1).
// 앱과 같은 QueryClient 설정(createAppQueryClient — QueryCache onError)으로 돌린다.
import { QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POLL_META } from "@/shared/api/refresh-failure";
import { REFERENCE_META } from "@/shared/api/reference";
import type { QueryClient } from "@tanstack/react-query";

const show = vi.fn();
const snackApi = { show, dismiss: vi.fn() };
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => snackApi,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { createAppQueryClient } from "./query-client";
import { ReferenceFailureNotice } from "./ReferenceFailureNotice";
import { RefreshFailureNotice } from "./RefreshFailureNotice";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
const unsubs: Array<() => void> = [];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  show.mockClear();
  client = createAppQueryClient();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <ReferenceFailureNotice />
        <RefreshFailureNotice />
      </QueryClientProvider>,
    ),
  );
});

afterEach(() => {
  unsubs.splice(0).forEach((u) => u());
  act(() => root.unmount());
  container.remove();
  client.clear();
  vi.useRealTimers();
});

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });

/**
 * 화면이 보고 있는(관찰자 있음) 질의를 만든다. hasData 면 한 번 받아 둔 뒤, 다시 받기를 error 로 실패시킨다.
 * leave 면 다시 받기가 나간 뒤 · 끝나기 전에 화면을 떠난다(관찰자 0).
 */
async function refetchFails(
  key: string,
  o: {
    hasData?: boolean;
    meta?: Record<string, unknown>;
    error?: unknown;
    leave?: boolean;
  } = {},
) {
  // 값 없이 실패시킬 때는 처음부터 실패한다 — 관찰자를 붙이는 순간 첫 받기가 나간다
  let fail = o.hasData === false;
  let rejectNow: ((e: unknown) => void) | undefined;
  const observer = new QueryObserver(client, {
    queryKey: [key],
    queryFn: () =>
      fail
        ? new Promise((_, reject) => {
            if (o.leave) rejectNow = reject;
            else reject(o.error ?? httpError(500));
          })
        : Promise.resolve({ rows: [1, 2] }),
    meta: o.meta,
    retry: false,
  });
  const unsub = observer.subscribe(() => undefined);
  unsubs.push(unsub);
  if (o.hasData !== false) {
    await observer.refetch();
  }
  fail = true;
  const p = observer.refetch().catch(() => undefined);
  if (o.leave) {
    unsub();
    rejectNow?.(o.error ?? httpError(500));
  }
  await p;
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });

describe("RefreshFailureNotice — 내용이 있는 채 다시 받다 실패", () => {
  it("두 질의가 함께 실패해도 스낵바는 하나 — critical · 한 문장 · [다시 시도] 없음", async () => {
    await act(async () => {
      await Promise.all([refetchFails("ledger"), refetchFails("assets")]);
    });
    await flush();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0]?.[0]).toEqual({
      message: "query.refreshFailed",
      tone: "critical",
    });
  });

  it("떠 있는 동안(4초)은 또 실패해도 다시 띄우지 않고, 지나면 다시 알린다", async () => {
    await act(async () => {
      await refetchFails("a");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await refetchFails("b");
    });
    expect(show).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
      await refetchFails("c");
    });
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("값이 없는 처음 불러오기 실패는 알리지 않는다 — 그 화면의 Result Section 이 맡는다", async () => {
    await act(async () => {
      await refetchFails("first", { hasData: false });
    });
    await flush();
    expect(show).not.toHaveBeenCalled();
  });

  it("폴링(POLL_META)은 알리지 않는다 — 그 자리가 말한다", async () => {
    await act(async () => {
      await refetchFails("quotes", { meta: POLL_META });
    });
    await flush();
    expect(show).not.toHaveBeenCalled();
  });

  it("참조(REFERENCE_META)는 이 스낵바를 띄우지 않는다 — 값이 없으면 참조 알림 하나만(둘 다 뜨지 않는다)", async () => {
    await act(async () => {
      await refetchFails("cats", { meta: REFERENCE_META });
    });
    await flush();
    expect(show).not.toHaveBeenCalled();
    await act(async () => {
      await refetchFails("accounts", {
        meta: REFERENCE_META,
        hasData: false,
      });
    });
    await flush();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0]?.[0]).toMatchObject({
      message: "query.referenceFailed",
    });
  });

  it("401 은 알리지 않는다 — 로그인으로 간다", async () => {
    await act(async () => {
      await refetchFails("me", { error: httpError(401) });
    });
    await flush();
    expect(show).not.toHaveBeenCalled();
  });

  it("화면을 떠난 뒤 끝난 질의(관찰자 0)는 알리지 않는다", async () => {
    await act(async () => {
      await refetchFails("gone", { leave: true });
    });
    await flush();
    expect(show).not.toHaveBeenCalled();
  });

  it("403 · 404 는 알린다 — 다른 기기에서 지웠을 수 있어 보는 내용이 낡았다", async () => {
    await act(async () => {
      await refetchFails("forbidden", { error: httpError(403) });
    });
    await flush();
    expect(show).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
      await refetchFails("missing", { error: httpError(404) });
    });
    expect(show).toHaveBeenCalledTimes(2);
  });
});

describe("같은 조회의 연달은 실패 — 첫 실패만, 한 번 성공하면 다시 센다", () => {
  /** 한 조회를 붙여 두고 성공 · 실패를 차례로 낸다 */
  function oneQuery(key: string) {
    let fail = false;
    const observer = new QueryObserver(client, {
      queryKey: [key],
      queryFn: () =>
        fail ? Promise.reject(httpError(500)) : Promise.resolve({ rows: [1] }),
      retry: false,
    });
    unsubs.push(observer.subscribe(() => undefined));
    return {
      ok: async () => {
        fail = false;
        await observer.refetch();
      },
      fail: async () => {
        fail = true;
        await observer.refetch().catch(() => undefined);
      },
    };
  }
  // 스낵바가 떠 있는 4초 창을 넘긴다 — 연속 실패 규칙만 보려고
  const past = () => vi.advanceTimersByTimeAsync(4100);

  it("같은 키가 연달아 실패하면 한 번만 — 홈 요약 60초 폴링이 끊긴 동안 1분마다 뜨지 않는다", async () => {
    const q = oneQuery("dashboard-summary");
    await act(async () => {
      await q.ok();
      await q.fail();
      await past();
      await q.fail();
      await past();
      await q.fail();
    });
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("한 번 성공한 뒤 다시 실패하면 다시 알린다", async () => {
    const q = oneQuery("ledger-again");
    await act(async () => {
      await q.ok();
      await q.fail();
      await past();
      await q.ok();
      await q.fail();
    });
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("다른 키는 따로 센다 — 앞 키가 연달아 실패 중이어도 새 키의 첫 실패는 알린다", async () => {
    const a = oneQuery("key-a");
    const b = oneQuery("key-b");
    await act(async () => {
      await a.ok();
      await b.ok();
      await a.fail();
      await past();
      await a.fail();
      await past();
      await b.fail();
    });
    expect(show).toHaveBeenCalledTimes(2);
  });
});
