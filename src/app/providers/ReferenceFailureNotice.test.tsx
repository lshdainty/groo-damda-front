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
// 진짜 useSnackbar 는 늘 같은 값을 돌려준다(snackbar-context.ts) — 렌더마다 새 객체를 주면 이펙트가 다시 돌아 hold 해제를 놓친다
const snackApi = { show, dismiss: vi.fn() };
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => snackApi,
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

describe("6초 창", () => {
  it("창 안에서 새 참조 실패가 났으면 창이 닫힐 때 한 번 다시 판단해 알린다", async () => {
    await act(async () => {
      await fail("first", REFERENCE_META);
      vi.advanceTimersByTime(400);
    });
    expect(show).toHaveBeenCalledTimes(1);
    await act(async () => {
      await fail("second", REFERENCE_META);
      vi.advanceTimersByTime(7000);
    });
    expect(show).toHaveBeenCalledTimes(2);
  });
});

describe("화면의 실패 Result Section 이 떠 있는 동안", () => {
  it("참조 실패 스낵바는 쉬고(겹쳐 말하지 않는다), 실패 자리가 사라지면 한 번 다시 판단해 알린다", async () => {
    const { ResultSection } = await import("@/shared/ds/result-section");
    const render = (failed: boolean) =>
      act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <ReferenceFailureNotice />
            {failed && (
              <ResultSection kind="failure" title="거래를 불러오지 못했어요" />
            )}
          </QueryClientProvider>,
        );
      });
    await render(true);
    await act(async () => {
      await fail("cats-under-failure", REFERENCE_META);
      vi.advanceTimersByTime(400);
    });
    expect(show).not.toHaveBeenCalled();
    await render(false);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("빈 상태(empty) Result Section 은 쉬게 하지 않는다", async () => {
    const { ResultSection } = await import("@/shared/ds/result-section");
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <ReferenceFailureNotice />
          <ResultSection kind="empty" icon={<svg />} title="거래가 없어요" />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await fail("cats-under-empty", REFERENCE_META);
      vi.advanceTimersByTime(400);
    });
    expect(show).toHaveBeenCalledTimes(1);
  });
});
