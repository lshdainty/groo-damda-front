// 하단 탭 바 — `+` 의 이름은 **탭 바가 짓지 않는다.**
//
// 예전엔 여기서 `t("addTransaction")` 을 직접 불러 어느 화면에서나 "거래 추가" 였다.
// 캘린더에서 열리는 건 일정 폼인데도 그랬다(QA #159). 무엇을 여는지 아는 쪽
// (`AppLayout` + `fabFor`)이 이름도 함께 넘긴다.
//
// `t` 를 "키를 그대로 돌려주는" 목으로 두면 둘을 구분할 수 있다 — 탭바가 제 이름을
// 지으면 `addTransaction` 이 나오고, 부모 것을 쓰면 넘긴 문구가 나온다.
//
// 그 밖에 이 틀이 DS 에 넘기는 것: 가계부 묶음 넷이 모두 "가계부" 현재, 칸은 라우터로 이동, 지금 탭 다시 누르기.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { AppTabBar } = await import("./AppTabBar");
const { TabMemory } = await import("./TabMemory");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
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

const render = (path: string, addLabel = "일정 추가", onAdd = () => {}) =>
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <PathProbe />
        <TabMemory />
        <AppTabBar onAdd={onAdd} addLabel={addLabel} />
      </MemoryRouter>,
    ),
  );

const tabs = () =>
  Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      "[data-slot=bottom-navigation-item]",
    ),
  );
const click = (el: Element | null | undefined) =>
  act(() => {
    el?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });

describe("+ 라벨", () => {
  const fabLabels = (addLabel: string) => {
    render("/desk/calendar", addLabel);
    // 라벨 없는 탭은 링크(<a>)다 — `+` 만 button 에 aria-label 을 든다.
    return [...container.querySelectorAll("button[aria-label]")].map((b) =>
      b.getAttribute("aria-label"),
    );
  };

  it("부모가 넘긴 문구를 그대로 읽는다", () => {
    expect(fabLabels("일정 추가")).toEqual(["일정 추가"]);
  });

  it("탭바가 `addTransaction` 으로 되돌아가지 않는다", () => {
    expect(fabLabels("일정 추가")).not.toContain("addTransaction");
  });

  it("+ 를 누르면 부모의 onAdd 를 부른다", () => {
    const onAdd = vi.fn();
    render("/desk", "거래 추가", onAdd);
    click(container.querySelector("button[aria-label]"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe("탭", () => {
  it("다섯 칸 중 + 를 뺀 넷이 홈 · 가계부 · 캘린더 · 전체 링크다", () => {
    render("/desk");
    expect(tabs().map((a) => a.getAttribute("href"))).toEqual([
      "/desk",
      "/desk/expense",
      "/desk/calendar",
      "/desk/more",
    ]);
  });

  it.each(["/desk/expense", "/desk/asset", "/desk/stats", "/desk/budget"])(
    "%s 에서는 가계부 탭이 현재다",
    (path) => {
      render(path);
      expect(tabs().map((a) => a.getAttribute("aria-current"))).toEqual([
        null,
        "page",
        null,
        null,
      ]);
    },
  );

  it("홈은 정확히 /desk 일 때만 현재다", () => {
    render("/desk/calendar");
    expect(tabs().map((a) => a.getAttribute("aria-current"))).toEqual([
      null,
      null,
      "page",
      null,
    ]);
  });

  it("다른 탭을 누르면 라우터로 옮기고 기록을 쌓는다", () => {
    render("/desk");
    click(tabs()[2]);
    expect(currentPath()).toBe("/desk/calendar");
  });

  it("다른 탭에 갔다 돌아오면 그 탭의 마지막 화면으로 간다", () => {
    render("/desk/stats");
    click(tabs()[0]); // 홈
    expect(currentPath()).toBe("/desk");
    click(tabs()[1]); // 가계부 — 마지막으로 있던 통계
    expect(currentPath()).toBe("/desk/stats");
  });

  it("지금 탭을 다시 누르면 그 탭의 첫 화면으로 돌아간다 — 가계부 묶음 안에서도", () => {
    render("/desk/stats");
    click(tabs()[1]);
    expect(currentPath()).toBe("/desk/expense");
    // 다시 눌렀으니 기억도 첫 화면으로 — 홈에 갔다 와도 통계가 아니다
    click(tabs()[0]);
    click(tabs()[1]);
    expect(currentPath()).toBe("/desk/expense");
  });
});

describe("보는 화면이 바뀌면 줄어든 바를 편다(bottom-navigation.md 줄어들기)", () => {
  const nav: { go: NavigateFunction } = { go: () => {} };
  function NavProbe() {
    const navigate = useNavigate();
    useEffect(() => {
      nav.go = navigate;
    });
    return null;
  }
  const go: NavigateFunction = ((...args: Parameters<NavigateFunction>) =>
    nav.go(...args)) as NavigateFunction;
  // 문서 스크롤 대신 상자 하나 — jsdom 은 scrollTop 을 쓰지 못한다(값을 두고 scroll 을 쏜다)
  let top = 0;
  let box: HTMLDivElement;
  beforeEach(() => {
    top = 0;
    box = document.createElement("div");
    Object.defineProperty(box, "scrollTop", { get: () => top });
    document.body.appendChild(box);
  });
  afterEach(() => box.remove());
  const scrollTo = (y: number) =>
    act(() => {
      top = y;
      box.dispatchEvent(new Event("scroll"));
    });
  const touch = () =>
    act(() => {
      document.dispatchEvent(new Event("touchstart"));
    });
  const compact = () =>
    container
      .querySelector<HTMLElement>("[data-slot=bottom-navigation]")
      ?.hasAttribute("data-compact");
  const mount = (entries: string[]) =>
    act(() =>
      root.render(
        <MemoryRouter
          initialEntries={entries}
          initialIndex={entries.length - 1}
        >
          <NavProbe />
          <AppTabBar onAdd={() => {}} addLabel="거래 추가" />
        </MemoryRouter>,
      ),
    );
  const shrink = () => {
    touch();
    scrollTo(100);
    scrollTo(200);
    expect(compact()).toBe(true);
  };

  it("줄어든 채로 다른 경로로 가면 편다 — 맨 위 스크롤에 기대지 않는다", () => {
    mount(["/desk/expense"]);
    shrink();
    act(() => go("/desk/stats"));
    expect(compact()).toBe(false);
  });

  it("뒤로(POP) 와서 스크롤이 40 아래로 돌아와도 편 채로 둔다 — 돌려놓는 스크롤은 세지 않는다", () => {
    mount(["/desk/expense", "/desk/stats"]);
    shrink();
    act(() => go(-1));
    expect(compact()).toBe(false);
    // 셸이 떠날 때의 스크롤로 돌려놓는다(아래로 600) — 바는 편 그대로
    scrollTo(800);
    expect(compact()).toBe(false);
    // 사용자가 다시 내리면 정해진 거리(20)부터 다시 센다
    touch();
    scrollTo(810);
    expect(compact()).toBe(false);
    scrollTo(825);
    expect(compact()).toBe(true);
  });

  it("같은 화면의 쿼리(?month=)만 바뀌면 줄어든 채로 둔다", () => {
    mount(["/desk/stats?month=2026-10"]);
    shrink();
    act(() => go("/desk/stats?month=2026-09", { replace: true }));
    expect(compact()).toBe(true);
  });

  it("화면 안 Tabs 로 다른 화면(?tab=)을 고르면 편다", () => {
    mount(["/desk/stocks/toss"]);
    shrink();
    act(() => go("/desk/stocks/toss?tab=watch", { replace: true }));
    expect(compact()).toBe(false);
  });

  it("편 뒤에는 정해진 거리(20)를 다시 내려야 준다", () => {
    mount(["/desk/expense"]);
    shrink();
    act(() => go("/desk/stats"));
    expect(compact()).toBe(false);
    touch();
    scrollTo(201);
    scrollTo(215);
    expect(compact()).toBe(false);
    scrollTo(221);
    expect(compact()).toBe(true);
  });
});
