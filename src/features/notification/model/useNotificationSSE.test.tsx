import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationKeys } from "@/shared/config";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

class FakeEventSource {
  static all: FakeEventSource[] = [];
  closed = false;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onerror: (() => void) | null = null;
  constructor(
    public url: string,
    public init?: EventSourceInit,
  ) {
    FakeEventSource.all.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data = "{}") {
    this.listeners[type]?.forEach((f) => f({ data } as MessageEvent));
  }
}

const fetchMock = vi.fn();
const { useNotificationSSE, STABLE_MS } = await import("./useNotificationSSE");
const open = () => FakeEventSource.all.filter((s) => !s.closed);
const first = (): FakeEventSource => {
  const s = open()[0];
  if (!s) throw new Error("열린 스트림이 없다");
  return s;
};

const setup = (strict = false) => {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, "invalidateQueries");
  const Probe = () => {
    useNotificationSSE();
    return null;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  const tree = (
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>
  );
  act(() => root.render(strict ? <StrictMode>{tree}</StrictMode> : tree));
  let alive = true;
  const unmount = () => {
    if (!alive) return;
    alive = false;
    act(() => root.unmount());
  };
  mounted.push(unmount);
  return { spy, unmount };
};
/** 시험이 띄운 훅 — 끝나면 모두 내린다. 안 내리면 앞 시험의 훅이 visibilitychange 를 계속 들어 다음 시험에 스트림이 더 생긴다 */
const mounted: (() => void)[] = [];

describe("useNotificationSSE", () => {
  beforeEach(() => {
    FakeEventSource.all = [];
    toast.mockClear();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    mounted.splice(0).forEach((unmount) => unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("쿠키를 실어 스트림 하나를 연다", () => {
    setup();
    expect(open()).toHaveLength(1);
    expect(first().init).toEqual({ withCredentials: true });
    expect(first().url).toMatch(/\/v1\/notifications\/stream$/);
  });

  it("StrictMode 이중 마운트에서도 열려 있는 스트림은 하나다", () => {
    setup(true);
    expect(open()).toHaveLength(1);
  });

  it("알림이 오면 알림 질의를 다시 받고 띠(토스트)는 띄우지 않는다", () => {
    const { spy } = setup();
    act(() => first().emit("NOTIFICATION", '{"title":"t","message":"m"}'));
    expect(spy).toHaveBeenCalledWith({ queryKey: notificationKeys.all });
    expect(toast).not.toHaveBeenCalled();
  });

  it("글이 깨져 와도 점은 갱신한다", () => {
    const { spy } = setup();
    act(() => first().emit("NOTIFICATION", "not json"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("끊기면 늘려 가며 다시 잇고, 이어지면 한 번 맞춘다", async () => {
    const { spy } = setup();
    act(() => first().onerror?.());
    expect(open()).toHaveLength(0);
    // 다시 잇기 전에 세션 확인(fetch)을 기다린다 — 타이머 뒤 약속까지 흘려 보낸다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(open()).toHaveLength(1);
    act(() => first().emit("CONNECT"));
    expect(spy).toHaveBeenCalledTimes(1);
    act(() => first().emit("CONNECT"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("처음 이어질 때는 맞추지 않는다", () => {
    const { spy } = setup();
    act(() => first().emit("CONNECT"));
    expect(spy).not.toHaveBeenCalled();
  });

  it("떠나면(로그아웃 · 계정 전환) 스트림을 닫고 다시 잇지 않는다", () => {
    const { unmount } = setup();
    const es = first();
    act(() => es.onerror?.());
    unmount();
    act(() => void vi.advanceTimersByTime(60000));
    expect(open()).toHaveLength(0);
    expect(FakeEventSource.all).toHaveLength(1);
  });

  // ---- H2 / L6: 재연결 간격과 401 ----
  // 연결이 열리고 곧바로 끊기는 일을 되풀이하며, 다시 열릴 때까지 걸린 시간(ms)을 잰다
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  const failAndWait = async (ms: number) => {
    act(() => first().onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  it("잇자마자 끊기는 연결(탭 경합)은 지연을 처음으로 되돌리지 못한다 — 1·2·4·8·16·30·30초로 늘어난다", async () => {
    setup();
    const waits = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    for (const w of waits) {
      const before = FakeEventSource.all.length;
      act(() => first().emit("CONNECT")); // 연결되자마자
      act(() => void vi.advanceTimersByTime(500)); // STABLE_MS 보다 훨씬 전에
      act(() => first().onerror?.()); // 끊김
      // w-1 에서는 아직 안 열리고
      await act(async () => {
        await vi.advanceTimersByTimeAsync(w - 1);
      });
      expect(FakeEventSource.all.length).toBe(before);
      // w 에서 열린다
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(FakeEventSource.all.length).toBe(before + 1);
    }
  });

  it("옛 동작 회귀: CONNECT 즉시 초기화였다면 항상 1초였을 것이다", async () => {
    setup();
    act(() => first().emit("CONNECT"));
    await failAndWait(1000); // 1초 대기 → 두 번째 연결
    act(() => first().emit("CONNECT"));
    act(() => first().onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(open()).toHaveLength(0); // 2초여야 하므로 1초에는 아직
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(open()).toHaveLength(1);
  });

  it("연결이 STABLE_MS 유지되면 지연이 1초로 돌아온다", async () => {
    setup();
    await failAndWait(1000);
    await failAndWait(2000); // 지연은 이제 4초
    act(() => first().emit("CONNECT"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STABLE_MS);
    });
    act(() => first().onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(open()).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(open()).toHaveLength(1);
  });

  it("STABLE_MS 직전(1ms 모자라게)에 끊기면 초기화되지 않는다", async () => {
    setup();
    await failAndWait(1000); // 지연 2초
    act(() => first().emit("CONNECT"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STABLE_MS - 1);
    });
    act(() => first().onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(open()).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(open()).toHaveLength(1);
  });

  it("끊긴 뒤 세션 확인이 401 이면 다시 잇지 않는다", async () => {
    fetchMock.mockResolvedValue({ status: 401 });
    setup();
    act(() => first().onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /\/v1\/notifications\/unread-count$/,
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ credentials: "include" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(open()).toHaveLength(0);
    expect(FakeEventSource.all).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 더 이상 시도하지 않는다
  });

  it("세션 확인이 네트워크 오류이거나 5xx 면 계속 잇는다", async () => {
    setup();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await failAndWait(1000);
    await flush();
    expect(open()).toHaveLength(1);
    fetchMock.mockResolvedValueOnce({ status: 503 });
    await failAndWait(2000);
    await flush();
    expect(open()).toHaveLength(1);
  });

  it("세션 확인 중에 떠나면(unmount) 확인이 끝나도 새 스트림을 열지 않는다", async () => {
    let resolve!: (v: { status: number }) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = setup();
    act(() => first().onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    unmount();
    resolve({ status: 200 });
    await flush();
    expect(open()).toHaveLength(0);
    expect(FakeEventSource.all).toHaveLength(1);
  });

  it("떠나면 안정 타이머도 정리된다(떠난 뒤 지연 ref 를 건드리지 않는다)", () => {
    const { unmount } = setup();
    act(() => first().emit("CONNECT"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  // ---- M-E: 상한 초과로 밀려나면 다시 잇지 않는다 ----
  const setVisibility = (v: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => v,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  it("REPLACED 를 받으면 스트림을 닫고 다시 잇지 않는다(오래 기다려도)", async () => {
    setup();
    const es = first();
    act(() => es.emit("REPLACED", "replaced"));
    expect(es.closed).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(FakeEventSource.all).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("REPLACED 뒤에 서버가 닫아 생긴 onerror 도 재연결을 만들지 않는다", async () => {
    setup();
    const es = first();
    act(() => es.emit("REPLACED"));
    act(() => es.onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(FakeEventSource.all).toHaveLength(1);
  });

  it("일반 오류는 REPLACED 가 없으면 지금처럼 계속 잇는다(회귀)", async () => {
    setup();
    act(() => first().onerror?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(open()).toHaveLength(1);
  });

  it("REPLACED 뒤 탭이 다시 보이면 한 번 새로 잇고, 이어지면 알림 질의를 맞춘다", async () => {
    const { spy } = setup();
    act(() => first().emit("REPLACED"));
    act(() => setVisibility("hidden"));
    expect(FakeEventSource.all).toHaveLength(1);
    act(() => setVisibility("visible"));
    expect(FakeEventSource.all).toHaveLength(2);
    act(() => first().emit("CONNECT"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("밀려나지 않았다면 보이게 돼도 새 스트림을 열지 않는다", () => {
    setup();
    act(() => setVisibility("visible"));
    expect(FakeEventSource.all).toHaveLength(1);
  });

  it("보이기를 여러 번 반복해도 연결은 하나만 열린다", () => {
    setup();
    act(() => first().emit("REPLACED"));
    act(() => setVisibility("visible"));
    act(() => setVisibility("visible"));
    expect(open()).toHaveLength(1);
  });

  it("다시 이은 뒤 또 밀려나면 또 멈춘다", async () => {
    setup();
    act(() => first().emit("REPLACED"));
    act(() => setVisibility("visible"));
    act(() => first().emit("REPLACED"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(open()).toHaveLength(0);
    expect(FakeEventSource.all).toHaveLength(2);
  });

  it("떠난 뒤(unmount) 보이게 돼도 연결하지 않는다", () => {
    const { unmount } = setup();
    act(() => first().emit("REPLACED"));
    unmount();
    act(() => setVisibility("visible"));
    expect(FakeEventSource.all).toHaveLength(1);
  });
});
