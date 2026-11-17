import { act, lazy, Suspense, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

import "@/shared/i18n";

/*
 * QA 2026-11-17 — 배포 dfe45d5e 직후 시트 [×] → 자산 탭에서 #root 가 통째로 비었다(web_dt_after_close3). 경계가 없어 React 가
 * 잡히지 않은 오류에 루트를 내린 모습이다. 화면 경계는 실패 결과를 그리고, 옛 조각 404 는 먼저 한 번 새로 고친다.
 */

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const nav: { go: ((to: string) => void) | null } = { go: null };

beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  offPreload?.();
  offPreload = null;
  vi.doUnmock("../chunk-reload");
  vi.restoreAllMocks();
});

let offPreload: (() => void) | null = null;

function Nav() {
  const navigate = useNavigate();
  useEffect(() => {
    nav.go = navigate;
  });
  return null;
}

function Boom(): never {
  throw new TypeError("Cannot read properties of undefined (reading 'x')");
}

/**
 * reload 를 주면 새로 고침을 그 함수로 센다(jsdom 의 location.reload 는 바꿀 수 없다). 앱처럼 vite:preloadError 듣기도 건다 —
 * 경계와 같은 모듈이라 고침 표식 · 걸어 둔 참을 함께 쓴다.
 */
async function mount(asset: React.ReactNode, reload?: () => void) {
  // chunk-reload 의 모듈 상태(고침을 걸어 둔 참)가 시험마다 새로 시작하게 다시 불러온다
  vi.resetModules();
  if (reload) {
    vi.doMock("../chunk-reload", async (importOriginal) => {
      const m = await importOriginal<typeof import("../chunk-reload")>();
      return {
        ...m,
        reloadOnceForStaleChunk: () => m.reloadOnceForStaleChunk(reload),
      };
    });
    const chunk = await import("../chunk-reload");
    offPreload = chunk.installChunkReload(reload);
  }
  const { RouteErrorBoundary } = await import("./RouteErrorBoundary");
  // 잡은 오류를 React 가 콘솔에 남긴다 — 시험 출력만 조용히
  vi.spyOn(console, "error").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.appendChild(host);
  const r = createRoot(host);
  root = r;
  await act(async () => {
    r.render(
      <MemoryRouter initialEntries={["/desk/asset"]}>
        <Nav />
        <RouteErrorBoundary>
          <Suspense fallback={<div data-slot="route-loading" />}>
            <Routes>
              <Route path="/desk" element={<h1>home</h1>} />
              <Route path="/desk/asset" element={asset} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
  });
  // lazy 의 거절이 경계까지 오게 한 번 더 흘린다
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const text = () => host?.textContent ?? "";
const failure = () => host?.querySelector('[data-slot="route-error"]');

describe("화면 경계", () => {
  it("화면이 그리다 멈추면 빈 화면 대신 '문제가 생겼어요' + 다시 시도", async () => {
    await mount(<Boom />);
    expect(failure()).toBeTruthy();
    expect(host?.querySelector("h1")?.textContent).toBe("문제가 생겼어요");
    expect(text()).toContain("다시 시도");
  });

  it("다른 주소로 옮기면 경계를 풀고 그 화면을 그린다", async () => {
    await mount(<Boom />);
    expect(failure()).toBeTruthy();
    await act(async () => nav.go?.("/desk"));
    expect(failure()).toBeNull();
    expect(host?.querySelector("h1")?.textContent).toBe("home");
  });

  it("옛 조각 404(새 배포)는 한 번 새로 고치고, 그동안 실패 대신 빈 틀을 둔다", async () => {
    const Stale = lazy(() =>
      Promise.reject(new TypeError("Importing a module script failed.")),
    );
    await mount(<Stale />);
    // 새로 고침을 걸었다(jsdom 은 이동을 하지 않는다) — 고친 시각이 남는다
    expect(
      window.sessionStorage.getItem("groo:chunk-reload-at"),
    ).not.toBeNull();
    expect(failure()).toBeNull();
    expect(host?.querySelector('[data-slot="route-loading"]')).toBeTruthy();
  });

  it("방금 고쳤는데 또 조각을 못 받으면 되풀이하지 않고 실패를 보인다", async () => {
    window.sessionStorage.setItem("groo:chunk-reload-at", String(Date.now()));
    const Stale = lazy(() =>
      Promise.reject(
        new TypeError("Failed to fetch dynamically imported module: /a.js"),
      ),
    );
    await mount(<Stale />);
    expect(failure()).toBeTruthy();
    expect(host?.querySelector("h1")?.textContent).toBe("문제가 생겼어요");
  });
});

/*
 * QA(iPhone 17 Pro · Safari 26, dev f70e3f87) — 배포 전에 연 탭에서 "통계" 로 옮기자 TypeError: Importing a module script failed.
 * 로 #root 가 비었다. 그 탭은 #621 이전 코드(복구 장치 없음)였다. 지금 코드는 두 길로 받는다 — Vite 가 감싼 import() 는
 * vite:preloadError 를 먼저 쏘고(vite 8 의 __vitePreload: baseModule().catch(handlePreloadError)), 감싸지 않은 import() 는
 * 거절만 온다. 어느 길이든, 어느 엔진의 글이든 새로 고침은 한 번이고 10초 안에는 되풀이하지 않는다.
 */

/** Vite 8 빌드가 화면 import() 를 감싸는 모양 그대로(dist/node/chunks/node.js 의 preload 끝부분) */
function vitePreload<T>(baseModule: () => Promise<T>): Promise<T> {
  return baseModule().catch((err: unknown) => {
    const e = new Event("vite:preloadError", { cancelable: true });
    (e as Event & { payload?: unknown }).payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) throw err;
    return undefined as T;
  });
}

const chunkErrors: [string, Error][] = [
  ["Safari", new TypeError("Importing a module script failed.")],
  [
    "크롬",
    new TypeError(
      "Failed to fetch dynamically imported module: https://x/assets/StatsPage-abc.js",
    ),
  ],
  [
    "파이어폭스",
    new TypeError(
      "error loading dynamically imported module: https://x/assets/StatsPage-abc.js",
    ),
  ],
  [
    "ChunkLoadError",
    Object.assign(new Error("Loading chunk 12 failed."), {
      name: "ChunkLoadError",
    }),
  ],
];

describe("엔진마다 다른 조각 받기 실패 — 새로 고침 한 번, 10초 안에는 되풀이하지 않는다", () => {
  afterEach(() => vi.useRealTimers());

  it.each(chunkErrors)(
    "%s — Vite 가 감싼 import()(vite:preloadError 먼저)",
    async (_, error) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(1_000_000);
      const reload = vi.fn();
      const Stale = lazy(() => vitePreload(() => Promise.reject(error)));
      await mount(<Stale />, reload);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(failure()).toBeNull();
      expect(host?.querySelector('[data-slot="route-loading"]')).toBeTruthy();

      // 고친 뒤 새 문서에서 5초 만에 또 실패 — 고치지 않고 실패를 보인다
      act(() => root?.unmount());
      offPreload?.();
      vi.setSystemTime(1_005_000);
      const Again = lazy(() => vitePreload(() => Promise.reject(error)));
      await mount(<Again />, reload);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(failure()).toBeTruthy();
    },
  );

  it.each(chunkErrors)(
    "%s — 감싸지 않은 import()(거절만 온다)",
    async (_, error) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(2_000_000);
      const reload = vi.fn();
      const Stale = lazy(() => Promise.reject(error));
      await mount(<Stale />, reload);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(failure()).toBeNull();

      act(() => root?.unmount());
      offPreload?.();
      vi.setSystemTime(2_009_000);
      const Again = lazy(() => Promise.reject(error));
      await mount(<Again />, reload);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(failure()).toBeTruthy();
    },
  );

  it("조각 받기 실패가 아닌 오류는 새로 고치지 않는다", async () => {
    const reload = vi.fn();
    await mount(<Boom />, reload);
    expect(reload).not.toHaveBeenCalled();
    expect(failure()).toBeTruthy();
  });
});

describe("앱 경계 — 라우터 밖에서 멈춰도 #root 가 비지 않는다", () => {
  async function mountApp(node: React.ReactNode) {
    vi.resetModules();
    const reload = vi.fn();
    vi.doMock("../chunk-reload", async (importOriginal) => {
      const m = await importOriginal<typeof import("../chunk-reload")>();
      return {
        ...m,
        reloadOnceForStaleChunk: () => m.reloadOnceForStaleChunk(reload),
      };
    });
    const { AppErrorBoundary } = await import("./RouteErrorBoundary");
    vi.spyOn(console, "error").mockImplementation(() => {});
    host = document.createElement("div");
    document.body.appendChild(host);
    const r = createRoot(host);
    root = r;
    await act(async () =>
      r.render(<AppErrorBoundary>{node}</AppErrorBoundary>),
    );
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
    return reload;
  }

  it("라우터 밖 부품이 그리다 멈추면 실패 결과(새로 고치지 않는다)", async () => {
    const reload = await mountApp(<Boom />);
    expect(failure()).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it("라우트 밖 지연 부품(시트 · 알림 안의 lazy)이 옛 조각을 못 받으면 한 번 새로 고친다", async () => {
    const Stale = lazy(() =>
      Promise.reject(new TypeError("Importing a module script failed.")),
    );
    const reload = await mountApp(
      <Suspense fallback={null}>
        <Stale />
      </Suspense>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(failure()).toBeNull();
  });
});
