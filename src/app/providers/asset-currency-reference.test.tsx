// 통화 폴백용 자산 목록 읽기(useAssetCurrencyOf)도 참조로 읽는다 — 가계부가 같은 목록을 참조(reference)로 읽는 동안
// 표시 없는 관찰자가 하나 끼면 "모두 참조" 판정이 깨져 재조회 실패 알림이 엉뚱하게 가거나 아예 사라진다(I-wrap-b6 후속).
import { QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppQueryClient } from "@/app/providers/query-client";
import { assetApi, useAssetCurrencyOf, useAssets } from "@/features/asset";
import { onRefreshFailure } from "@/shared/api/refresh-failure";

const show = vi.fn();
const snackApi = { show, dismiss: vi.fn() };
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => snackApi,
}));

import { ReferenceFailureNotice } from "./ReferenceFailureNotice";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let mode: "ok" | "fail" = "ok";

// 가계부 화면: 자산 목록을 참조로 읽고(ExpensePage), 줄은 통화 폴백으로 같은 목록을 읽는다(ListCard · ExpenseMobile)
const Ledger = () => {
  useAssets({ reference: true });
  useAssetCurrencyOf();
  return null;
};

const mkClient = () => {
  const qc = createAppQueryClient();
  qc.setDefaultOptions({ queries: { staleTime: 0, retry: false } });
  return qc;
};
const mount = (qc: ReturnType<typeof mkClient>, ui: ReactNode) => {
  const root = createRoot(document.createElement("div"));
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <ReferenceFailureNotice />
        {ui}
      </QueryClientProvider>,
    ),
  );
  return () => act(() => root.unmount());
};
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  show.mockClear();
  mode = "ok";
  vi.spyOn(assetApi, "getAssets").mockImplementation(async () => {
    if (mode === "fail") throw new Error("boom");
    return { assets: [] } as never;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("가계부의 통화 폴백 읽기", () => {
  it("값 없이 실패하면 참조 알림이 한 번 뜬다", async () => {
    mode = "fail";
    const unmount = mount(mkClient(), <Ledger />);
    await wait(500);
    unmount();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0]?.[0]).toMatchObject({ tone: "critical" });
  });

  it("받아 둔 값이 있는 채 재조회가 실패하면 어떤 알림도 없다(값 유지)", async () => {
    const qc = mkClient();
    let refreshNotices = 0;
    const off = onRefreshFailure(() => {
      refreshNotices += 1;
    });
    const unmount = mount(qc, <Ledger />);
    await wait(500);
    mode = "fail";
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["assets"] }).catch(() => undefined);
    });
    await wait(500);
    off();
    unmount();
    expect(refreshNotices).toBe(0);
    expect(show).not.toHaveBeenCalled();
  });
});
