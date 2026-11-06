// 넓은 화면 셸의 스크롤 틀 — 본문 스크롤 상자(main)가 하나이고, 본문 안 absolute 요소가 문서를 늘리지 못하게
// main 이 기댈 자리(positioned)인지 잠근다.
// 카드 혜택 1280 이상에서 쪽 넘김의 sr-only(absolute)가 positioned 조상 없이 문서 첫 상자에 기대, 본문 스크롤 높이만큼
// 문서를 늘렸다 — 창 스크롤이 하나 더 생기고 끝까지 내리면 셸이 통째로 올라가 사이드바 아래가 비었다.
// jsdom 은 레이아웃(offsetParent · scrollHeight)을 재지 않는다 — 실제 스크롤 상자 개수 · 문서 높이는 렌더 하네스 측정이 맡고
// (1280 · 1440 · 1920 × 라이트 · 다크), 여기서는 그 결과를 만드는 구조(클래스)만 본다.
import * as React from "react";
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
const mounts = vi.hoisted(() => ({ addTx: 0 }));
// 셸이 여는 거래 시트 — 마운트 횟수와 안의 값으로 "다시 붙었는가" 를 본다
vi.mock("@/widgets/add-tx", async () => {
  const React = await import("react");
  return {
    AddTxSheet: () => {
      React.useEffect(() => {
        mounts.addTx += 1;
      }, []);
      return <input aria-label="금액" data-testid="add-tx-amount" />;
    },
  };
});
// 폰 셸 부품 — 진짜는 라우터 · 알림 · 탭 기억에 기대 무겁다. 자리만 본다
vi.mock("./MobileHeader", () => ({
  MobileHeader: () => (
    <header>
      <button type="button" data-testid="m-search">
        검색
      </button>
    </header>
  ),
}));
vi.mock("./MoneyTabs", () => ({ MoneyTabs: () => null }));
vi.mock("./TabMemory", () => ({ TabMemory: () => null }));
vi.mock("./AppTabBar", () => ({
  AppTabBar: ({ onAdd }: { onAdd: () => void }) => (
    <nav>
      <button type="button" data-testid="fab" onClick={onAdd}>
        +
      </button>
    </nav>
  ),
}));
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

/** 쓰던 값이 있는 페이지 — 다시 붙으면 값이 사라진다 */
function TypingPage() {
  const [v, setV] = React.useState("");
  return (
    <input
      aria-label="메모"
      data-testid="page-input"
      value={v}
      onChange={(e) => setV(e.target.value)}
    />
  );
}
const renderPage = () =>
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/desk/expense"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/desk/expense" element={<TypingPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
  );
const typeInto = (el: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const q = (id: string) =>
  container.ownerDocument.querySelector<HTMLElement>(`[data-testid=${id}]`);

describe("셸 한 트리 — 768 을 넘나들어도(단계 6)", () => {
  it("페이지가 다시 붙지 않는다 — 쓰던 값이 남는다(390 → 844 → 390)", () => {
    state.size = "mobile";
    renderPage();
    typeInto(q("page-input") as HTMLInputElement, "치과 정기 검진");
    state.size = "tablet";
    renderPage();
    expect((q("page-input") as HTMLInputElement).value).toBe("치과 정기 검진");
    expect(q("desktop-sidebar")).not.toBeNull();
    state.size = "mobile";
    renderPage();
    expect((q("page-input") as HTMLInputElement).value).toBe("치과 정기 검진");
  });

  it("셸이 연 거래 시트는 열린 채, 다시 붙지 않는다(쓰던 금액이 남는다)", () => {
    mounts.addTx = 0;
    state.size = "mobile";
    renderPage();
    act(() => q("fab")!.click());
    typeInto(q("add-tx-amount") as HTMLInputElement, "12500");
    state.size = "tablet";
    renderPage();
    state.size = "mobile";
    renderPage();
    expect((q("add-tx-amount") as HTMLInputElement).value).toBe("12500");
    expect(mounts.addTx).toBe(1);
  });

  it("초점이 사라지는 셸 부품(폰 머리 검색)에 있었으면 body 로 떨어지지 않고 본문(main)으로 간다", () => {
    state.size = "mobile";
    renderPage();
    act(() => q("m-search")!.focus());
    expect(document.activeElement).toBe(q("m-search"));
    state.size = "tablet";
    renderPage();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(container.querySelector("main#main"));
  });

  it("본문 안 초점은 그대로 둔다 — 경계를 넘어도 쓰던 칸에 남는다", () => {
    state.size = "mobile";
    renderPage();
    const input = q("page-input") as HTMLInputElement;
    act(() => input.focus());
    state.size = "tablet";
    renderPage();
    expect(document.activeElement).toBe(input);
  });
});
