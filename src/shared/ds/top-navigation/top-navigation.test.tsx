// Top Navigation 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 잴 수 없는 값(sticky 위치 · 한 줄 말줄임 · 누름 축소 · 안전 영역 · 1.2배 한도)은 여기서 클래스를 본다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  focusScreenTitle,
  ScreenTitle,
  TopNavigation,
  TopNavigationActions,
  TopNavigationBackButton,
  TopNavigationCloseButton,
  TopNavigationIconButton,
  TopNavigationMenuButton,
  TopNavigationPrimaryButton,
  TopNavigationProvider,
  TopNavigationSearch,
  TopNavigationTextButton,
  TopNavigationTitle,
  useScreenTitle,
} from ".";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, "");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.title = "";
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

const slot = (name: string) =>
  container.querySelector<HTMLElement>(`[data-slot=${name}]`);
const click = (el: Element | null) =>
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

describe("TopNavigation — 바", () => {
  it("<header>(banner)이고 안쪽 줄이 56 이다 — 맨 위에 붙고 선 · 그림자가 없다", () => {
    render(
      <TopNavigation>
        <TopNavigationTitle>알림</TopNavigationTitle>
      </TopNavigation>,
    );
    const bar = slot("top-navigation") as HTMLElement;
    expect(bar.tagName).toBe("HEADER");
    expect(bar.dataset.type).toBe("standard");
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("top-0");
    expect(bar.className).toContain("z-(--z-sticky)");
    expect(bar.className).toContain("bg-bg-layer-default");
    // 위 안전 영역은 바탕만 채운다 · 좌우 6 + 안전 영역
    expect(bar.className).toContain("pt-[env(safe-area-inset-top)]");
    expect(bar.className).toContain("env(safe-area-inset-left)");
    expect(bar.className).toContain("env(safe-area-inset-right)");
    // 스크롤해도 선 · 그림자 · 숨김이 없다
    expect(bar.className).not.toMatch(/border|shadow|translate|hidden/);
    expect(slot("top-navigation-row")?.className).toContain("h-[56px]");
  });

  it("desktop 은 왼쪽이 본문 여백 32 이고 제목을 그리지 않는다", () => {
    render(
      <TopNavigation type="desktop">
        <TopNavigationTitle>가계부</TopNavigationTitle>
        <TopNavigationActions>
          <TopNavigationIconButton aria-label="설정">
            <svg />
          </TopNavigationIconButton>
        </TopNavigationActions>
      </TopNavigation>,
    );
    const bar = slot("top-navigation") as HTMLElement;
    expect(bar.className).toContain("var(--layout-margin)");
    expect(slot("top-navigation-title")).toBeNull();
  });

  it("ref 와 나머지 속성을 바에 건넨다", () => {
    const ref = createRef<HTMLElement>();
    render(
      <TopNavigation ref={ref} id="bar" aria-label="화면 머리">
        <TopNavigationTitle>홈</TopNavigationTitle>
      </TopNavigation>,
    );
    expect(ref.current).toBe(slot("top-navigation"));
    expect(ref.current?.id).toBe("bar");
  });
});

describe("TopNavigationTitle — 화면의 h1", () => {
  it("h1 · tabIndex -1 · data-screen-title — Tab 으로 서지 않고 화면을 옮길 때 초점만 받는다", () => {
    render(
      <TopNavigation>
        <TopNavigationTitle>알림</TopNavigationTitle>
      </TopNavigation>,
    );
    const title = slot("top-navigation-title") as HTMLElement;
    expect(title.tagName).toBe("H1");
    expect(title.tabIndex).toBe(-1);
    expect(title.hasAttribute("data-screen-title")).toBe(true);
    expect(title.textContent).toBe("알림");
  });

  it("한 줄 말줄임 · 700 이고 글자 크기 설정은 1.2배까지만 따른다(clamp)", () => {
    render(
      <TopNavigation>
        <TopNavigationTitle>
          아주 긴 화면 이름 아주 긴 화면 이름
        </TopNavigationTitle>
      </TopNavigation>,
    );
    const standard = (slot("top-navigation-title") as HTMLElement).className;
    expect(standard).toContain("truncate");
    expect(standard).toContain("font-bold");
    expect(standard).toContain("min-w-0 flex-1");
    // t6 18 / 24 — 고정 값(-static), 설정을 따르는 값, 고정 값 × 1.2
    expect(standard).toContain(
      "clamp(var(--text-t6-static),var(--text-t6),calc(var(--text-t6-static)*1.2))",
    );
    // 왼쪽 버튼이 없으면 50 을 띄워 화면 끝에서 56 의 같은 자리
    expect(standard).toContain("first:ml-[50px]");

    render(
      <TopNavigation type="root">
        <TopNavigationTitle>홈</TopNavigationTitle>
      </TopNavigation>,
    );
    const rootTitle = (slot("top-navigation-title") as HTMLElement).className;
    expect(rootTitle).toContain("ml-x2_5");
    expect(rootTitle).toContain("--text-t8-static");
  });
});

describe("TopNavigationActions · 버튼", () => {
  it("오른쪽 자리는 제목 끝과 8 을 비우고 오른쪽으로 민다", () => {
    render(
      <TopNavigation>
        <TopNavigationActions>
          <TopNavigationIconButton aria-label="검색">
            <svg />
          </TopNavigationIconButton>
        </TopNavigationActions>
      </TopNavigation>,
    );
    const actions = slot("top-navigation-actions") as HTMLElement;
    expect(actions.className).toContain("pl-x2");
    expect(actions.className).toContain("ml-auto");
    // 버튼끼리 붙는다 — gap 이 없다
    expect(actions.className).not.toMatch(/\bgap-/);
  });

  it("아이콘 버튼은 <button type=button> — 상자 44 · 누르면 2px 거리 축소(44 → 0.955) · 모션 줄이기면 축소 없음", () => {
    const onClick = vi.fn();
    render(
      <TopNavigationIconButton aria-label="검색" onClick={onClick}>
        <svg />
      </TopNavigationIconButton>,
    );
    const button = slot("top-navigation-icon-button") as HTMLButtonElement;
    expect(button.tagName).toBe("BUTTON");
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("검색");
    expect(button.className).toContain("size-[44px]");
    expect(button.className).toContain("[&_svg]:size-[24px]");
    expect(button.className).toContain("active:[scale:calc(1-2/44)]");
    expect(button.className).toContain("motion-reduce:active:[scale:1]");
    // 키보드 포커스에만 상자 안쪽 2px 링
    expect(button.className).toContain("focus-visible:-outline-offset-2");
    // 막히면 fg-disabled — 흐리게 하지 않는다
    expect(button.className).toContain("disabled:text-fg-disabled");
    expect(button.className).not.toContain("opacity");
    click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("알림 점 — 점만 그리고 장식이다(이름에 새 알림을 넣는 것은 부르는 쪽)", () => {
    render(
      <TopNavigationIconButton notification aria-label="알림, 새 알림 있음">
        <svg />
      </TopNavigationIconButton>,
    );
    const dot = slot("notification-badge") as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.dataset.size).toBe("small");
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(slot("top-navigation-icon-button")?.getAttribute("aria-label")).toBe(
      "알림, 새 알림 있음",
    );

    render(
      <TopNavigationIconButton aria-label="알림">
        <svg />
      </TopNavigationIconButton>,
    );
    expect(slot("notification-badge")).toBeNull();
  });

  it("켜고 끄는 단추 — aria-pressed 로 선 2 · 2.5 를 가르고 색은 켬 · 끔이 같다", () => {
    render(
      <TopNavigationIconButton aria-label="금액 가리기" aria-pressed>
        <svg />
      </TopNavigationIconButton>,
    );
    const button = slot("top-navigation-icon-button") as HTMLElement;
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.className).toContain(
      "aria-pressed:[&_svg]:[stroke-width:2.5]",
    );
    expect(button.className).toContain(
      "aria-[pressed=false]:[&_svg]:[stroke-width:2]",
    );
    // 끔을 흐리게(Toggle 의 fg-neutral-muted) 두지 않는다 · 켬 · 끔에 따라 바탕이 바뀌지 않는다
    expect(button.className).not.toContain("fg-neutral-muted");
    expect(button.className).not.toMatch(
      /aria-pressed:bg|aria-\[pressed[^\]]*\]:bg/,
    );
  });

  it("글 버튼 — 높이 44 · 좌우 10 · 누르는 순간 기준(--press-basis)을 잰다", () => {
    render(<TopNavigationTextButton>모두 읽음</TopNavigationTextButton>);
    const button = slot("top-navigation-text-button") as HTMLButtonElement;
    expect(button.type).toBe("button");
    expect(button.className).toContain("h-[44px]");
    expect(button.className).toContain("px-x2_5");
    expect(button.className).toContain("font-medium");
    expect(button.className).toContain("--text-t5-static");
    expect(button.className).toContain("var(--press-basis,44)");
    act(() => {
      button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    // jsdom 은 크기를 재지 않아 max(0, 0, 24) = 24 — 기준의 아래 한도
    expect(button.style.getPropertyValue("--press-basis")).toBe("24");
  });

  it("주 버튼 — Button brandSolid small 그대로 + 오른쪽 8", () => {
    render(
      <TopNavigation type="desktop">
        <TopNavigationActions>
          <TopNavigationPrimaryButton>내역 추가</TopNavigationPrimaryButton>
        </TopNavigationActions>
      </TopNavigation>,
    );
    const button = slot("top-navigation-primary-button") as HTMLElement;
    expect(button.textContent).toBe("내역 추가");
    expect(button.className).toContain("mr-x2");
    expect(button.className).toContain("h-[36px]");
  });
});

describe("왼쪽 버튼", () => {
  it("← — 이름은 '뒤로'이고 onClick 을 주면 그것만 부른다", () => {
    const onClick = vi.fn();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<TopNavigationBackButton fallbackHref="/desk" onClick={onClick} />);
    const button = slot("top-navigation-back-button") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBe("뒤로");
    click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it("← — 앱 안에 앞 화면이 있으면 history.back()", () => {
    window.history.replaceState({ idx: 2 }, "");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    render(<TopNavigationBackButton fallbackHref="/desk" />);
    click(slot("top-navigation-back-button"));
    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("← — 앞 화면이 없으면 상위 화면으로 지금 주소를 고쳐 쓴다(replace)", () => {
    window.history.replaceState({ idx: 0 }, "");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    render(<TopNavigationBackButton fallbackHref="/desk" />);
    click(slot("top-navigation-back-button"));
    expect(replace).toHaveBeenCalledWith("/desk");
    expect(back).not.toHaveBeenCalled();
  });

  it("✕ — 입력한 값이 없으면 바로 닫는다(이름 '닫기')", () => {
    const onClick = vi.fn();
    render(<TopNavigationCloseButton onClick={onClick} />);
    const button = slot("top-navigation-close-button") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBe("닫기");
    click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("작성한 내용이 사라져요");
  });

  it("✕ — dirty 면 먼저 묻고 [나가기] 를 골랐을 때만 닫는다", () => {
    const onClick = vi.fn();
    render(<TopNavigationCloseButton dirty onClick={onClick} />);
    click(slot("top-navigation-close-button"));
    expect(onClick).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("작성한 내용이 사라져요");
    const stay = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "계속 작성",
    );
    click(stay ?? null);
    expect(onClick).not.toHaveBeenCalled();

    click(slot("top-navigation-close-button"));
    const leave = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "나가기",
    );
    click(leave ?? null);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("☰ — 이름 '주 메뉴' · aria-haspopup=dialog, aria-expanded · aria-controls 는 부르는 쪽이 준다", () => {
    render(<TopNavigationMenuButton aria-expanded aria-controls="main-menu" />);
    const button = slot("top-navigation-menu-button") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBe("주 메뉴");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe("main-menu");
  });

  it("왼쪽 버튼의 이름은 aria-label 이다(아이콘은 장식)", () => {
    render(
      <TopNavigation>
        <TopNavigationBackButton fallbackHref="/" onClick={() => {}} />
        <TopNavigationMenuButton />
      </TopNavigation>,
    );
    const names = Array.from(container.querySelectorAll("button")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(names).toEqual(["뒤로", "주 메뉴"]);
  });
});

describe("화면을 옮길 때", () => {
  function Screen({ title }: { title: string }) {
    useScreenTitle(title);
    return null;
  }

  it("문서 제목은 '{화면 제목} - {서비스}' — Provider 가 없으면 화면 제목만", () => {
    render(
      <TopNavigationProvider product="그루 담다">
        <Screen title="알림" />
      </TopNavigationProvider>,
    );
    expect(document.title).toBe("알림 - 그루 담다");
    render(<Screen title="캘린더" />);
    expect(document.title).toBe("캘린더");
  });

  it("focusScreenTitle — 보이는 제목에 초점을 두고 스크롤 상자를 맨 위로 보낸다", () => {
    // jsdom 은 배치를 하지 않아 getClientRects 가 늘 비어 있다 — 보이는 것으로 친다
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
      () => [{}] as unknown as DOMRectList,
    );
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    render(
      <main id="main" style={{ overflowY: "auto" }}>
        <TopNavigation type="desktop" />
        <ScreenTitle>가계부</ScreenTitle>
      </main>,
    );
    const main = container.querySelector("main") as HTMLElement;
    Object.defineProperty(main, "scrollHeight", { value: 900 });
    Object.defineProperty(main, "clientHeight", { value: 300 });
    main.scrollTop = 600;
    act(() => focusScreenTitle());
    expect(document.activeElement).toBe(slot("screen-title"));
    expect(main.scrollTop).toBe(0);
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("ScreenTitle — 데스크톱 본문 맨 위 h1, text-screen-title · 700 · 머리 아래 20", () => {
    render(<ScreenTitle>가계부</ScreenTitle>);
    const title = slot("screen-title") as HTMLElement;
    expect(title.tagName).toBe("H1");
    expect(title.tabIndex).toBe(-1);
    expect(title.hasAttribute("data-screen-title")).toBe(true);
    expect(title.className).toContain("text-screen-title");
    expect(title.className).toContain("font-bold");
    expect(title.className).toContain("mt-nav-to-title");
  });

  it("ScreenTitle — description · actions 를 주면 한 줄 제목 줄(제목 덩어리 왼쪽 · 버튼 오른쪽 아래 끝)", () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <ScreenTitle
        ref={ref}
        description="모든 거래 내역"
        actions={<button type="button">내보내기</button>}
      >
        가계부
      </ScreenTitle>,
    );
    const row = slot("screen-title-row") as HTMLElement;
    expect(row.className).toContain("items-end");
    expect(row.className).toContain("justify-between");
    expect(row.className).toContain("gap-x4");
    expect(row.className).toContain("mt-nav-to-title");
    const title = slot("screen-title") as HTMLElement;
    // ref 는 늘 h1, 줄 전체의 위 20 은 줄이 맡고 h1 은 0
    expect(ref.current).toBe(title);
    expect(title.tagName).toBe("H1");
    expect(title.className).toContain("mt-0");
    expect(title.className).not.toContain("mt-nav-to-title");
    const desc = slot("screen-description") as HTMLElement;
    expect(desc.textContent).toBe("모든 거래 내역");
    expect(desc.className).toContain("text-t5");
    expect(desc.className).toContain("mt-x0_5");
    expect(desc.className).toContain("font-normal");
    expect(desc.className).toContain("text-fg-neutral-muted");
    const actions = slot("screen-actions") as HTMLElement;
    expect(actions.className).toContain("gap-x2");
    expect(actions.textContent).toBe("내보내기");
    expect(title.parentElement).toBe(desc.parentElement);
    expect(row.contains(actions)).toBe(true);
  });

  it("ScreenTitle — 설명만 줘도 줄이 서고 동작 칸은 없다", () => {
    render(<ScreenTitle description="부제">제목</ScreenTitle>);
    expect(slot("screen-title-row")).not.toBeNull();
    expect(slot("screen-actions")).toBeNull();
  });

  it("ScreenTitle — 동작만 줘도 줄이 서고, 둘 다 없으면 h1 하나(줄 없음)", () => {
    render(<ScreenTitle actions={<span>a</span>}>제목</ScreenTitle>);
    expect(slot("screen-description")).toBeNull();
    expect(slot("screen-actions")).not.toBeNull();
  });

  it("ScreenTitle — 설명 · 동작이 없으면 줄 상자 없이 h1 하나", () => {
    render(<ScreenTitle>제목</ScreenTitle>);
    expect(slot("screen-title-row")).toBeNull();
    expect((slot("screen-title") as HTMLElement).className).toContain(
      "mt-nav-to-title",
    );
  });

  it('TopNavigationSearch — standard 는 제목 자리(보이지 않는 h1 "검색"), desktop 은 폭 360 에 h1 없음', () => {
    render(
      <TopNavigation>
        <TopNavigationSearch>
          <input aria-label="거래 검색" />
        </TopNavigationSearch>
      </TopNavigation>,
    );
    const h1 = container.querySelector("h1")!;
    expect(h1.textContent).toBe("검색");
    expect(h1.className).toContain("sr-only");
    expect(h1.hasAttribute("data-screen-title")).toBe(true);
    const box = slot("top-navigation-search") as HTMLElement;
    expect(box.getAttribute("role")).toBe("search");
    expect(box.className).toContain("flex-1");

    render(
      <TopNavigation type="desktop">
        <TopNavigationSearch>
          <input aria-label="거래 검색" />
        </TopNavigationSearch>
      </TopNavigation>,
    );
    expect(container.querySelector("h1")).toBeNull();
    expect(slot("top-navigation-search")!.className).toContain("w-[360px]");
  });
});
