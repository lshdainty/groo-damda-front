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
  vi.restoreAllMocks();
});

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

async function mount(asset: React.ReactNode) {
  // chunk-reload 의 모듈 상태(고침을 걸어 둔 참)가 시험마다 새로 시작하게 다시 불러온다
  vi.resetModules();
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
