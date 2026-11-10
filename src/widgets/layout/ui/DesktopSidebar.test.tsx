// 증권사 구분이 페이지 안 탭에서 사이드바 하위 메뉴로 옮겨왔다.
// 하위 메뉴는 **연결한 증권사** 목록이라 사용자마다 달라진다 — 어느 경우에 몇 개가 뜨는지를 고정한다.
// 바닥 계정 항목은 두지 않는다(Q-017 18-1 C).
// 모양 · 접힘 · 키보드는 DS(shared/ds/side-navigation)가 맡고, 여기서는 이 틀이 DS 에 무엇을 넘기는지만 본다:
// 증권 부모의 규칙(model/shell.ts 임시 선택 4) · 지금 항목 · 라우터 이동.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  hasSecurities: true,
  connectedBrokers: [] as string[],
  connections: undefined as
    { broker: string; displayName: string }[] | undefined,
  brokerConnectionsEnabled: undefined as boolean | undefined,
}));

vi.mock("@/features/subscription/model/useSubscription", () => ({
  useHasSecurities: () => state.hasSecurities,
  useMyFeatures: () => ({
    data: {
      features: state.hasSecurities ? ["SECURITIES"] : [],
      connectedBrokers: state.connectedBrokers,
      primaryBroker: null,
      tossConnected: false,
    },
    isLoading: false,
  }),
  useBrokerConnections: (enabled = true) => {
    state.brokerConnectionsEnabled = enabled;
    return { data: enabled ? state.connections : undefined };
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { DesktopSidebar } = await import("./DesktopSidebar");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.hasSecurities = true;
  state.connectedBrokers = [];
  state.connections = undefined;
  state.brokerConnectionsEnabled = undefined;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // 창 폭 — 768 이상 · 1280 이상(펼침)
  window.matchMedia = ((query: string) => ({
    matches: !query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function PathProbe() {
  return <span data-path={useLocation().pathname} />;
}
const currentPath = () =>
  container.querySelector("[data-path]")?.getAttribute("data-path");

function render(path = "/desk") {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <PathProbe />
        <DesktopSidebar />
      </MemoryRouter>,
    ),
  );
}

const click = (el: Element | null | undefined) =>
  act(() => {
    el?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });

const subLinks = () =>
  Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      "[data-slot=side-navigation-sub-item]",
    ),
  );
const subHrefs = () => subLinks().map((a) => a.getAttribute("href"));
const labelOf = (el: Element) =>
  el.querySelector("[data-slot=side-navigation-item-label]")?.textContent;
/** 최상위 항목 — 링크(<a>) 또는 부모(<button>). 번역 mock 이 키를 그대로 돌려주므로 라벨이 곧 labelKey 다. */
const topItem = (label: string) =>
  Array.from(
    container.querySelectorAll<HTMLElement>("[data-slot=side-navigation-item]"),
  ).find((el) => labelOf(el) === label);

describe("DesktopSidebar 쌓임", () => {
  it("사이드바는 z-sticky — 접힘 펼침 메뉴가 본문의 뒤 형제(Card) 아래로 깔리지 않는다", () => {
    render("/desk");
    const nav = container.querySelector("[data-slot=side-navigation]");
    expect(nav?.className).toContain("z-(--z-sticky)");
  });
});

describe("DesktopSidebar 증권 하위 메뉴", () => {
  it("연결이 둘 이상이면 증권사별 하위 항목이 뜬다 — 부모는 링크가 아니라 펼치기 버튼이다", () => {
    state.connectedBrokers = ["TOSS", "NAMU"];
    render("/desk/stocks/toss");
    expect(subHrefs()).toEqual(["/desk/stocks/toss", "/desk/stocks/namu"]);
    expect(topItem("stocks")?.tagName).toBe("BUTTON");
  });

  it("연결이 하나면 하위 메뉴가 없고 증권은 /desk/stocks 링크다", () => {
    state.connectedBrokers = ["TOSS"];
    render("/desk/stocks/toss");
    expect(subLinks()).toHaveLength(0);
    expect(topItem("stocks")?.getAttribute("href")).toBe("/desk/stocks");
  });

  it("연결이 없어도 증권 링크는 남는다 — 연결 안내 화면으로 간다", () => {
    state.connectedBrokers = [];
    render("/desk/stocks");
    expect(subLinks()).toHaveLength(0);
    expect(topItem("stocks")?.getAttribute("href")).toBe("/desk/stocks");
  });

  it("증권 구독이 없으면 증권 메뉴도 하위도 없고, 증권사 조회를 걸지 않는다", () => {
    state.hasSecurities = false;
    state.connectedBrokers = ["TOSS", "NAMU"];
    render();
    expect(subLinks()).toHaveLength(0);
    expect(topItem("stocks")).toBeUndefined();
    expect(state.brokerConnectionsEnabled).toBe(false);
  });

  it("표시명은 서버 displayName 을 쓰고, 없으면 번역 키로 떨어진다", () => {
    state.connectedBrokers = ["TOSS", "NAMU"];
    state.connections = [{ broker: "TOSS", displayName: "토스증권" }];
    render("/desk/stocks/toss");
    expect(subLinks().map((a) => a.textContent)).toEqual([
      "토스증권",
      "broker.namu",
    ]);
  });

  it("보고 있는 증권사 항목만 aria-current 를 단다 — 조상(증권)까지 달면 현재 위치가 둘로 읽힌다", () => {
    state.connectedBrokers = ["TOSS", "NAMU"];
    render("/desk/stocks/namu");
    expect(subLinks().map((a) => a.getAttribute("aria-current"))).toEqual([
      null,
      "page",
    ]);
    expect(topItem("stocks")?.getAttribute("aria-current")).toBeNull();
  });

  it("종목 상세 · 포트폴리오 주소에서도 그 증권사 항목이 지금이다 — 하위 경로를 정확 일치로 보지 않는다(I-13 31)", () => {
    state.connectedBrokers = ["TOSS", "NAMU"];
    for (const path of [
      "/desk/stocks/toss/005930",
      "/desk/stocks/toss/BRK.B",
      "/desk/stocks/toss/portfolio",
    ]) {
      render(path);
      expect(subLinks().map((a) => a.getAttribute("aria-current"))).toEqual([
        "page",
        null,
      ]);
      expect(topItem("stocks")?.getAttribute("aria-expanded")).toBe("true");
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("다른 증권사 이름이 접두사로 겹쳐도 지금이 되지 않는다 — /desk/stocks/toss 와 /desk/stocks/tossx", () => {
    state.connectedBrokers = ["TOSS", "NAMU"];
    render("/desk/stocks/tossx");
    expect(subLinks().map((a) => a.getAttribute("aria-current"))).toEqual([
      null,
      null,
    ]);
  });

  it("하위가 지금이면 저절로 펼쳐지고, 증권 화면 밖에서는 접혀 있다", () => {
    state.connectedBrokers = ["TOSS", "NAMU"];
    render("/desk/stocks/namu");
    expect(topItem("stocks")?.getAttribute("aria-expanded")).toBe("true");
    act(() => root.unmount());
    root = createRoot(container);
    render("/desk");
    expect(topItem("stocks")?.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("DesktopSidebar 이동", () => {
  it("항목을 누르면 전체 새로고침 없이 라우터로 옮긴다", () => {
    render("/desk");
    click(topItem("calendar"));
    expect(currentPath()).toBe("/desk/calendar");
  });

  it("지금 화면 항목에 aria-current 가 붙는다 — 홈은 정확히 /desk 일 때만", () => {
    render("/desk/calendar");
    expect(topItem("calendar")?.getAttribute("aria-current")).toBe("page");
    expect(topItem("home")?.getAttribute("aria-current")).toBeNull();
  });
});

describe("DesktopSidebar 머리 로고(I-05 87)", () => {
  it("나무 24 + 이름 글 — 사각 4단 마크(rect)가 아니다", () => {
    render("/desk");
    const logo = container.querySelector("[data-slot=side-navigation-logo]")!;
    const svg = logo.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("147 183 154 166");
    expect(svg.getAttribute("height")).toBe("24");
    expect(svg.querySelectorAll("path")).toHaveLength(4);
    expect(svg.querySelector("rect")).toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(logo.textContent).toBe("app.title");
  });

  it("나무는 로고 슬롯의 직계 svg 가 아니다 — 슬롯의 24×24 고정이 폭 22.3 을 늘리지 않는다", () => {
    render("/desk");
    const logo = container.querySelector("[data-slot=side-navigation-logo]")!;
    expect(logo.querySelector(":scope > svg")).toBeNull();
  });
});
