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
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
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
