// `/desk/stocks` 에 직접 들어온 미구독자를 아무 말 없이 홈으로 튕기던 자리다(QA #5).
// 여기서 고정하는 건 "튕기지 않는다" 와 "그래도 나갈 길은 있다" 두 가지다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  features: [] as string[],
  isLoading: false,
  isError: false,
  /** 받아 둔 값이 없는 채로 실패했는가(처음 조회 실패) */
  noData: false,
  refetch: vi.fn(),
}));

vi.mock("../model/useSubscription", () => ({
  useMyFeatures: () => ({
    data: state.noData ? undefined : { features: state.features },
    isLoading: state.isLoading,
    isError: state.isError,
    isRefetching: false,
    refetch: state.refetch,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { SecuritiesGate } = await import("./SecuritiesGate");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.features = [];
  state.isLoading = false;
  state.isError = false;
  state.noData = false;
  state.refetch = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Here() {
  return <span data-path>{useLocation().pathname}</span>;
}

function Shell({ mobile }: { mobile: boolean }) {
  return (
    <>
      <Here />
      <Outlet context={{ mobile, onAddTx: () => {} }} />
    </>
  );
}

function renderGate(children: ReactNode, mobile = false) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/desk/stocks"]}>
        <Routes>
          <Route element={<Shell mobile={mobile} />}>
            <Route
              path="/desk/stocks"
              element={<SecuritiesGate>{children}</SecuritiesGate>}
            />
            <Route path="/desk" element={<div data-dashboard />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
  );
}

const path = () => container.querySelector("[data-path]")!.textContent;

describe("SecuritiesGate", () => {
  it("구독이 있으면 본문을 그대로 그린다", () => {
    state.features = ["SECURITIES"];
    renderGate(<div data-stocks />);
    expect(container.querySelector("[data-stocks]")).not.toBeNull();
    expect(path()).toBe("/desk/stocks");
  });

  it("구독이 없어도 홈으로 튕기지 않고 이유를 띄운다", () => {
    state.features = [];
    renderGate(<div data-stocks />);
    expect(path()).toBe("/desk/stocks");
    expect(container.querySelector("[data-stocks]")).toBeNull();
    expect(container.textContent).toContain("gate.title");
  });

  it("안내에서 구독 화면으로 가는 길이 있다", () => {
    state.features = [];
    renderGate(<div data-stocks />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "/desk/settings?section=subscription",
    );
  });

  it("모바일은 뒤로 헤더를 붙인다 — 풀스크린이라 없으면 갇힌다", () => {
    state.features = [];
    renderGate(<div data-stocks />, true);
    // ds 상단 바의 ← 버튼(44 — top-navigation.md). 이게 없으면 전역 헤더·탭바가 없는 화면이라
    // 나갈 길이 사라진다.
    expect(
      container.querySelector("[data-slot=top-navigation-back-button]"),
    ).not.toBeNull();
  });

  it("데스크톱은 전역 셸이 있으니 뒤로 헤더를 붙이지 않는다", () => {
    state.features = [];
    renderGate(<div data-stocks />, false);
    expect(
      container.querySelector("[data-slot=top-navigation-back-button]"),
    ).toBeNull();
  });

  it("아직 모르는 동안엔 아무것도 그리지 않는다", () => {
    state.isLoading = true;
    renderGate(<div data-stocks />);
    expect(container.querySelector("[data-stocks]")).toBeNull();
    expect(container.textContent).not.toContain("gate.title");
  });

  it("처음 조회가 실패하면 홈으로 튕기지 않고 그 자리에서 실패를 말한다 — 없는 구독을 팔지도 않는다", () => {
    state.isError = true;
    state.noData = true;
    renderGate(<div data-stocks />);
    expect(path()).toBe("/desk/stocks");
    expect(container.querySelector("[data-stocks]")).toBeNull();
    expect(container.textContent).toContain("gate.loadError");
    expect(container.textContent).not.toContain("gate.action");
  });

  it("실패 화면의 [다시 시도] 가 기능 조회를 다시 부른다", () => {
    state.isError = true;
    state.noData = true;
    renderGate(<div data-stocks />);
    const retry = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("common.retry"),
    )!;
    act(() => retry.click());
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it("받아 둔 값이 있는데 재조회만 실패하면 Pro 사용자를 내보내지 않는다", () => {
    state.features = ["SECURITIES"];
    state.isError = true;
    renderGate(<div data-stocks />);
    expect(container.querySelector("[data-stocks]")).not.toBeNull();
  });
});

// 폰 본문은 흰 면이다 — 셸 바닥(basement) 위에 안내 · 단추를 두지 않는다(ConnectGate 와 같은 면, I-wrap-b1 ε 검수 M1).
// 옛 `.m-back-header + …` 흰 띠 CSS 는 머리를 ds 상단 바로 바꾸며 짝을 잃었다 — 면은 본문이 직접 칠한다.
// 실제 계산 색은 하네스(sec-gate 장면)가 잰다. 여기서는 상단 바 바로 뒤 본문이 흰 면 클래스와 남는 높이를 갖는지 본다.
describe("폰 본문 바탕 (I-wrap-b1 ε M1)", () => {
  const bodyAfterBar = () => {
    const bar = container.querySelector("[data-slot=top-navigation]");
    return bar?.nextElementSibling as HTMLElement | null;
  };
  it("미구독 안내 — 상단 바 아래 본문이 흰 면(bg-layer-default) · 남는 높이", () => {
    state.features = [];
    renderGate(<div data-stocks />, true);
    const body = bodyAfterBar();
    expect(body?.className).toContain("bg-bg-layer-default");
    expect(body?.className).toContain("min-h-[calc(100dvh-3.5rem)]");
  });
  it("불러오기 실패 — 상단 바 아래 본문이 흰 면 · [다시 시도]도 그 위", () => {
    state.isError = true;
    state.noData = true;
    renderGate(<div data-stocks />, true);
    const body = bodyAfterBar();
    expect(body?.className).toContain("bg-bg-layer-default");
    expect(
      body?.querySelector("[data-slot=result-section] button"),
    ).not.toBeNull();
  });
});
