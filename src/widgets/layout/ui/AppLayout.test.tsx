// 넓은 화면 셸의 스크롤 틀 — 본문 스크롤 상자(main)가 하나이고, 본문 안 absolute 요소가 문서를 늘리지 못하게
// main 이 기댈 자리(positioned)인지 잠근다.
// 카드 혜택 1280 이상에서 쪽 넘김의 sr-only(absolute)가 positioned 조상 없이 문서 첫 상자에 기대, 본문 스크롤 높이만큼
// 문서를 늘렸다 — 창 스크롤이 하나 더 생기고 끝까지 내리면 셸이 통째로 올라가 사이드바 아래가 비었다.
// jsdom 은 레이아웃(offsetParent · scrollHeight)을 재지 않는다 — 실제 스크롤 상자 개수 · 문서 높이는 렌더 하네스 측정이 맡고
// (1280 · 1440 · 1920 × 라이트 · 다크), 여기서는 그 결과를 만드는 구조(클래스)만 본다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  size: "desktop" as "mobile" | "tablet" | "desktop",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/lib/groo/responsive", () => ({
  useDeviceSize: () => state.size,
}));
vi.mock("./DesktopHeader", () => ({
  DesktopHeader: () => <header data-testid="desktop-header" />,
}));
vi.mock("./DesktopSidebar", () => ({
  DesktopSidebar: () => <nav data-testid="desktop-sidebar" />,
}));
vi.mock("@/widgets/add-tx", () => ({ AddTxSheet: () => null }));
vi.mock("@/widgets/calendar/ui/CalendarEventFormHost", () => ({
  CalendarEventFormHost: () => null,
}));
vi.mock("@/features/hide-amounts", () => ({ useHideCardsSync: () => {} }));
vi.mock("@/features/notification", () => ({ useNotificationSSE: () => {} }));

const { AppLayout } = await import("./AppLayout");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.size = "desktop";
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () =>
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/desk/card-benefit"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              path="/desk/card-benefit"
              element={
                <div data-testid="page">
                  <span className="sr-only">본문 안 absolute</span>
                </div>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
  );

// 세로로 스크롤하는 상자 — overflow-y-auto · overflow-y-scroll · overflow-auto · overflow-scroll
const scrolls = (el: Element) =>
  /(^|\s)overflow(-y)?-(auto|scroll)(\s|$)/.test(el.className);

describe("AppLayout 넓은 화면 스크롤 틀", () => {
  it("본문 스크롤 상자는 main 하나다 — 셸의 다른 상자는 스크롤하지 않는다", () => {
    render();
    const main = container.querySelector("main#main");
    expect(main).not.toBeNull();
    expect(scrolls(main!)).toBe(true);
    const others = [...container.querySelectorAll("*")].filter(
      (el) => el !== main && !main!.contains(el) && scrolls(el),
    );
    expect(others).toEqual([]);
  });

  it("main 은 positioned 다 — 본문 안 absolute 요소가 main 에 기대 문서를 늘리지 않는다", () => {
    render();
    const main = container.querySelector("main#main")!;
    expect(main.className).toMatch(/(^|\s)(relative|absolute|fixed)(\s|$)/);
    // 본문은 main 안에 그대로 있다
    expect(main.querySelector("[data-testid=page] .sr-only")).not.toBeNull();
  });

  it("셸은 화면 높이에 묶이고, main 을 품은 칸은 넘침을 잘라 창 스크롤을 만들지 않는다", () => {
    render();
    const main = container.querySelector("main#main")!;
    const column = main.parentElement!;
    const shell = column.parentElement!;
    expect(shell.className).toMatch(/(^|\s)h-svh(\s|$)/);
    expect(column.className).toMatch(/(^|\s)overflow-hidden(\s|$)/);
    expect(main.className).toMatch(/(^|\s)min-h-0(\s|$)/);
  });
});
