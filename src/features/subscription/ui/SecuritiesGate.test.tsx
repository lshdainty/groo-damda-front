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
}));

vi.mock("../model/useSubscription", () => ({
  useMyFeatures: () => ({
    data: { features: state.features },
    isLoading: state.isLoading,
    isError: state.isError,
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
    // 공용 MobileBackHeader 의 ← 버튼. 이게 없으면 전역 헤더·탭바가 없는 화면이라
    // 나갈 길이 사라진다.
    expect(container.querySelector('button[aria-label="back"]')).not.toBeNull();
  });

  it("데스크톱은 전역 셸이 있으니 뒤로 헤더를 붙이지 않는다", () => {
    state.features = [];
    renderGate(<div data-stocks />, false);
    expect(container.querySelector('button[aria-label="back"]')).toBeNull();
  });

  it("아직 모르는 동안엔 아무것도 그리지 않는다", () => {
    state.isLoading = true;
    renderGate(<div data-stocks />);
    expect(container.querySelector("[data-stocks]")).toBeNull();
    expect(container.textContent).not.toContain("gate.title");
  });

  it("조회 자체가 실패하면 종전처럼 홈으로 — 없는 구독을 팔지 않는다", () => {
    state.isError = true;
    renderGate(<div data-stocks />);
    expect(path()).toBe("/desk");
    expect(container.textContent).not.toContain("gate.title");
  });
});
