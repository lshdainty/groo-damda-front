// 넓은 화면 셸의 스크롤 틀 — 본문 스크롤 상자(main)가 하나이고, 본문 안 absolute 요소가 문서를 늘리지 못하게
// main 이 기댈 자리(positioned)인지 잠근다.
// 카드 혜택 1280 이상에서 쪽 넘김의 sr-only(absolute)가 positioned 조상 없이 문서 첫 상자에 기대, 본문 스크롤 높이만큼
// 문서를 늘렸다 — 창 스크롤이 하나 더 생기고 끝까지 내리면 셸이 통째로 올라가 사이드바 아래가 비었다.
// jsdom 은 레이아웃(offsetParent · scrollHeight)을 재지 않는다 — 실제 스크롤 상자 개수 · 문서 높이는 렌더 하네스 측정이 맡고
// (1280 · 1440 · 1920 × 라이트 · 다크), 여기서는 그 결과를 만드는 구조(클래스)만 본다.
import * as React from "react";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
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

const titleFocus = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/shared/ds/top-navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/top-navigation")>()),
  focusScreenTitle: () => {
    titleFocus.calls += 1;
    // 진짜는 본문을 맨 위로도 보낸다 — 앞으로 가는 시험이 "맨 위" 를 실제로 본다
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  },
}));

const { AppLayout } = await import("./AppLayout");
const { resetScreenMemory } = await import("../lib/screen-memory");
const { SwipeActions } = await import("@/shared/ds/swipe-actions");

let container: HTMLDivElement;
let root: Root;

// 폭 질의 — 셸의 폰 판정(768 미만)과 스크롤 주체가 같은 질의를 읽으므로 mock 한 useDeviceSize(state.size)와 맞춘다.
// 폰이면 768 · 1280 모두 거짓, 아니면 768 은 참이고 1280 은 wide 일 때만 참
function stubMedia(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches:
      state.size !== "mobile" &&
      (query.includes("768") || (wide && query.includes("1280"))),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // MemoryRouter 첫 항목 key 는 늘 "default" — 앞 시험의 화면 기억을 끊는다
  resetScreenMemory();
  state.size = "desktop";
  stubMedia(true);
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

// ── 고정 정리 주소(/desk/stats/fixed) — 1280 이상은 같은 화면 위 대화상자라 화면 전환 효과(맨 위로 · 제목에 초점)를 건너뛴다 ──
const nav = { go: (() => {}) as NavigateFunction };
const Stats = () => {
  const navigate = useNavigate();
  useEffect(() => {
    nav.go = navigate;
  });
  return (
    <div>
      <h1 data-screen-title>통계</h1>
      {/* 두 줄을 밀어 열어 보는 자리 — 셸의 Provider 하나가 한 번에 한 줄만 열리게 한다 */}
      {["가", "나"].map((n) => (
        <SwipeActions
          key={n}
          rowLabel={n}
          actions={[{ label: "삭제", kind: "destructive", onSelect: () => {} }]}
        >
          <div>{n}</div>
        </SwipeActions>
      ))}
    </div>
  );
};
const renderStats = () =>
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/desk/stats"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/desk/stats" element={<Stats />}>
              <Route path="fixed" element={null} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
  );
const setWide = (wide: boolean) => stubMedia(wide);
const frame = () =>
  act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });

describe("고정 정리 주소가 바뀔 때의 셸 효과(I-wrap-b1 δ H1)", () => {
  it("1280 이상: 열고 닫아도 화면 전환 효과(맨 위로 · 제목 초점)를 부르지 않는다", async () => {
    setWide(true);
    titleFocus.calls = 0;
    renderStats();
    act(() => nav.go("/desk/stats/fixed"));
    await frame();
    act(() => nav.go("/desk/stats"));
    await frame();
    expect(titleFocus.calls).toBe(0);
  });

  it("1280 미만: 고정 정리 페이지는 화면이라 전환 효과를 부른다", async () => {
    setWide(false);
    titleFocus.calls = 0;
    renderStats();
    act(() => nav.go("/desk/stats/fixed"));
    await frame();
    expect(titleFocus.calls).toBe(1);
  });
});

describe("셸의 밀기 Provider(I-wrap-b1 δ 3)", () => {
  const fire = (el: Element, type: string, x: number) =>
    el.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: 200,
      }),
    );
  const swipeOpen = (wrapper: Element) =>
    act(() => {
      const row = wrapper.querySelector("[data-slot=swipe-actions-row]")!;
      fire(row, "pointerdown", 200);
      for (let i = 1; i <= 10; i++) fire(row, "pointermove", 200 - 8 * i);
      fire(row, "pointerup", 120);
    });
  it("두 줄을 차례로 밀어도 열린 줄은 하나다(셸에 Provider 가 있다)", () => {
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
    setWide(false);
    renderStats();
    const rows = container.querySelectorAll("[data-slot=swipe-actions]");
    expect(rows).toHaveLength(2);
    swipeOpen(rows[0]!);
    swipeOpen(rows[1]!);
    expect(
      container.querySelectorAll("[data-slot=swipe-actions][data-state=open]"),
    ).toHaveLength(1);
  });
});

// ── 뒤로(POP)는 떠날 때 스크롤 · 누른 요소로 돌아온다(I-wrap-b5 1-a, top-navigation.md:230) ──
const NavHolder = () => {
  const navigate = useNavigate();
  useEffect(() => {
    nav.go = navigate;
  });
  return <h1 data-screen-title>정리</h1>;
};

describe("화면을 옮길 때 PUSH 와 POP 을 가른다", () => {
  const Stats2 = () => {
    const navigate = useNavigate();
    useEffect(() => {
      nav.go = navigate;
    });
    return (
      <div>
        <h1 data-screen-title tabIndex={-1}>
          통계
        </h1>
        <button type="button" data-testid="to-bulk">
          거래를 고정으로 정리하기
        </button>
      </div>
    );
  };
  const renderTwoScreens = () =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/desk/stats"]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/desk/stats" element={<Stats2 />} />
              <Route
                path="/desk/stats/fixed"
                element={<h1 data-screen-title>정리</h1>}
              />
            </Route>
          </Routes>
        </MemoryRouter>,
      ),
    );
  const growMain = () => {
    const main = container.querySelector<HTMLElement>("main#main")!;
    Object.defineProperty(main, "scrollHeight", {
      configurable: true,
      value: 3000,
    });
    Object.defineProperty(main, "clientHeight", {
      configurable: true,
      value: 600,
    });
    return main;
  };
  const scrollTo = (main: HTMLElement, y: number) =>
    act(() => {
      main.scrollTop = y;
      main.dispatchEvent(new Event("scroll"));
    });

  it("앞으로(PUSH)는 제목 초점 + 맨 위, 뒤로(POP)는 제목을 부르지 않고 스크롤 400 · 누른 단추 초점을 돌려준다", async () => {
    setWide(false);
    titleFocus.calls = 0;
    renderTwoScreens();
    const main = growMain();
    scrollTo(main, 400);
    const btn = q("to-bulk")!;
    act(() => {
      btn.focus();
    });
    act(() => nav.go("/desk/stats/fixed"));
    await frame();
    expect(titleFocus.calls).toBe(1);
    // 새 화면이 본문을 깎았다
    act(() => {
      main.scrollTop = 0;
    });
    act(() => nav.go(-1 as unknown as string));
    await frame();
    await frame();
    expect(titleFocus.calls).toBe(1);
    expect(main.scrollTop).toBe(400);
    expect(document.activeElement).toBe(q("to-bulk"));
  });

  it("맨 위에서 떠난 화면은 뒤로 오면 0 이다 — 상세에서 내린 800 이 셸 스크롤 상자에 남지 않는다", async () => {
    setWide(false);
    titleFocus.calls = 0;
    renderTwoScreens();
    const main = growMain();
    // 맨 위에서 단추를 눌러 떠난다(스크롤 없음)
    act(() => {
      q("to-bulk")!.focus();
    });
    act(() => nav.go("/desk/stats/fixed"));
    await frame();
    scrollTo(main, 800);
    act(() => nav.go(-1 as unknown as string));
    await frame();
    await frame();
    expect(main.scrollTop).toBe(0);
  });

  it("기억이 없는 뒤로(새로 고침 뒤)는 앞으로 갈 때처럼 제목 초점 + 맨 위다", async () => {
    setWide(false);
    titleFocus.calls = 0;
    act(() =>
      root.render(
        <MemoryRouter
          initialEntries={["/desk/stats", "/desk/stats/fixed"]}
          initialIndex={1}
        >
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/desk/stats" element={<Stats2 />} />
              <Route path="/desk/stats/fixed" element={<NavHolder />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      ),
    );
    const main = growMain();
    main.scrollTop = 500;
    act(() => nav.go(-1 as unknown as string));
    await frame();
    await frame();
    expect(titleFocus.calls).toBe(1);
    expect(main.scrollTop).toBe(0);
  });

  it("누른 단추가 새로 그려져도 이름과 자리로 다시 찾아 초점을 돌려준다", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    try {
      setWide(false);
      titleFocus.calls = 0;
      renderTwoScreens();
      growMain();
      act(() => {
        q("to-bulk")!.focus();
      });
      act(() => nav.go("/desk/stats/fixed"));
      act(() => nav.go(-1 as unknown as string));
      // 되돌아온 화면의 단추는 새로 그려진 요소 — 이름이 같아 다시 찾는다
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(titleFocus.calls).toBe(1); // PUSH 한 번뿐
      expect(document.activeElement).toBe(q("to-bulk"));
    } finally {
      vi.useRealTimers();
    }
  });
});
