// 참조 조회 실패 공용 알림 — 여러 훅이 함께 실패해도 한 번, 값이 있으면 알리지 않음, [다시 시도] 는 실패한 것만 다시 받음
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFERENCE_META } from "@/shared/api/reference";

const show = vi.fn();
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show, dismiss: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { ReferenceFailureNotice } from "./ReferenceFailureNotice";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  show.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <ReferenceFailureNotice />
      </QueryClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

// 화면이 보고 있는(active) 조회가 실패한 것으로 만든다 — 관찰자를 붙여 둔다
const fail = async (key: string, meta?: Record<string, unknown>) => {
  const observer = new QueryObserver(client, {
    queryKey: [key],
    queryFn: () => Promise.reject(new Error("x")),
    meta,
    retry: false,
  });
  observer.subscribe(() => undefined);
  await observer.refetch().catch(() => undefined);
};

describe("ReferenceFailureNotice", () => {
  it("참조 조회가 둘 실패해도 스낵바는 한 번", async () => {
    await act(async () => {
      await fail("a", REFERENCE_META);
      await fail("b", REFERENCE_META);
      vi.advanceTimersByTime(400);
    });
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0]?.[0]).toMatchObject({
      message: "query.referenceFailed",
      tone: "critical",
    });
  });

  it("참조가 아닌 조회 실패는 알리지 않는다", async () => {
    await act(async () => {
      await fail("main");
      vi.advanceTimersByTime(400);
    });
    expect(show).not.toHaveBeenCalled();
  });
});

describe("hold", () => {
  it("폼이 열려 있는 동안(useHoldReferenceNotice)에는 알리지 않는다", async () => {
    const { useHoldReferenceNotice } = await import("@/shared/api/reference");
    function Holder() {
      useHoldReferenceNotice(true);
      return null;
    }
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <ReferenceFailureNotice />
          <Holder />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await fail("held", REFERENCE_META);
      vi.advanceTimersByTime(400);
    });
    expect(show).not.toHaveBeenCalled();
  });
});

describe("hold 해제", () => {
  it("열린 동안 쉰 실패가 닫힌 뒤에도 값 없이 남았으면 한 번 알린다", async () => {
    const { useHoldReferenceNotice } = await import("@/shared/api/reference");
    function Holder() {
      useHoldReferenceNotice(true);
      return null;
    }
    const render = (open: boolean) =>
      act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <ReferenceFailureNotice />
            {open && <Holder />}
          </QueryClientProvider>,
        );
      });
    await render(true);
    await act(async () => {
      await fail("held2", REFERENCE_META);
      vi.advanceTimersByTime(400);
    });
    expect(show).not.toHaveBeenCalled();
    await render(false);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(show).toHaveBeenCalledTimes(1);
  });
});
