// Side Navigation 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 잴 수 없는 값(폭 규칙 · 기억 · 접힌 항목의 말풍선 · 펼침 메뉴의 기다림 · 키보드 · 안쪽 선 · 흐림)은 여기서 동작으로 본다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SideNavigation,
  SideNavigationContent,
  SideNavigationFooter,
  SideNavigationGroup,
  SideNavigationHeader,
  SideNavigationItem,
  SideNavigationSubItem,
} from ".";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

// 창 폭 — 768 이상(desktop) · 1280 이상(wide)을 바꿔 가며 본다. useSyncExternalStore 가 change 를 듣는다
let media = { desktop: true, wide: true, reduce: false };
const listeners = new Set<() => void>();
function setMedia(next: Partial<typeof media>) {
  media = { ...media, ...next };
  act(() => listeners.forEach((fn) => fn()));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  media = { desktop: true, wide: true, reduce: false };
  listeners.clear();
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query.includes("prefers-reduced-motion")) return media.reduce;
      if (query.includes("1280px")) return media.wide;
      if (query.includes("768px")) return media.desktop;
      return false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

const nav = () =>
  container.querySelector<HTMLElement>("[data-slot=side-navigation]");
const trigger = () =>
  container.querySelector<HTMLButtonElement>(
    "[data-slot=side-navigation-trigger]",
  );
const items = () =>
  Array.from(
    container.querySelectorAll<HTMLElement>("[data-slot=side-navigation-item]"),
  );
const item = (i: number) => items()[i] as HTMLElement;
const labelOf = (el: Element) =>
  el.querySelector<HTMLElement>("[data-slot=side-navigation-item-label]");
const click = (el: Element | null | undefined, init: MouseEventInit = {}) => {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  // 링크 누르기는 jsdom 이 이동하지 못한다("Not implemented: navigation") — 문서 끝에서 막는다
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener("click", stop);
  act(() => {
    el?.dispatchEvent(event);
  });
  document.removeEventListener("click", stop);
  return event;
};
const pointer = (type: "pointerover" | "pointerout", el: Element | null) =>
  act(() => {
    el?.dispatchEvent(
      new MouseEvent(type, { bubbles: true, relatedTarget: null }),
    );
  });

function Nav({
  current = "",
  ...rest
}: { current?: string } & React.ComponentProps<typeof SideNavigation>) {
  return (
    <SideNavigation {...rest}>
      <SideNavigationHeader logo={<span>그루 담다</span>} />
      <SideNavigationContent>
        <SideNavigationGroup label="워크스페이스">
          <SideNavigationItem
            href="/desk"
            icon={<svg />}
            label="홈"
            current={current === "home"}
          />
          <SideNavigationItem icon={<svg />} label="증권">
            <SideNavigationSubItem
              href="/desk/namu"
              label="나무증권"
              current={current === "namu"}
            />
            <SideNavigationSubItem
              href="/desk/toss"
              label="토스증권"
              current={current === "toss"}
            />
          </SideNavigationItem>
        </SideNavigationGroup>
        <SideNavigationGroup label="기록">
          <SideNavigationItem
            href="/desk/calendar"
            icon={<svg />}
            label="캘린더"
          />
        </SideNavigationGroup>
      </SideNavigationContent>
      <SideNavigationFooter>바닥</SideNavigationFooter>
    </SideNavigation>
  );
}

describe("SideNavigation — 폭", () => {
  it("<nav aria-label='주 메뉴'> — 흰 면 + 오른쪽 안쪽 1px 선(그림자 없음) · 높이 전체 · 왼쪽 sticky", () => {
    render(<Nav />);
    const bar = nav() as HTMLElement;
    expect(bar.tagName).toBe("NAV");
    expect(bar.getAttribute("aria-label")).toBe("주 메뉴");
    expect(bar.className).toContain("bg-bg-layer-default");
    expect(bar.className).toContain(
      "shadow-[inset_-1px_0_0_0_var(--color-stroke-neutral-subtle)]",
    );
    expect(bar.className).toContain("sticky");
    // 쌓임 맥락이라 층이 auto 면 본문 카드가 펼침 메뉴를 가린다
    expect(bar.className).toContain("z-(--z-sticky)");
    expect(bar.className).toContain("h-dvh");
    expect(bar.className).not.toMatch(/rounded|ring/);
  });

  it("1280 이상은 펼침 240 · 768 ~ 1279 는 접힘 56 — 처음 열 때도 폭을 본다", () => {
    render(<Nav />);
    expect(nav()?.className).toContain("w-(--layout-sidebar)");
    expect(nav()?.dataset.collapsed).toBeUndefined();
    act(() => root.unmount());
    root = createRoot(container);
    media = { ...media, wide: false };
    render(<Nav />);
    expect(nav()?.className).toContain("w-(--layout-sidebar-collapsed)");
    expect(nav()?.dataset.collapsed).toBe("true");
  });

  it("768 미만에서는 그리지 않는다(Desk 는 하단 탭 바 · HR 은 ☰ + Side Panel)", () => {
    media = { ...media, desktop: false, wide: false };
    render(<Nav />);
    expect(nav()).toBeNull();
    setMedia({ desktop: true });
    expect(nav()).not.toBeNull();
  });

  it("창 폭이 1280 을 넘나들면 기본으로 다시 정한다", () => {
    render(<Nav />);
    expect(nav()?.dataset.collapsed).toBeUndefined();
    setMedia({ wide: false });
    expect(nav()?.dataset.collapsed).toBe("true");
    setMedia({ wide: true });
    expect(nav()?.dataset.collapsed).toBeUndefined();
  });

  it("1280 이상에서 손으로 접으면 기억한다 — 다음에도 접힌 채 열고, 접기 버튼이 펴면 기억도 바뀐다", () => {
    render(<Nav />);
    click(trigger());
    expect(nav()?.dataset.collapsed).toBe("true");
    expect(
      window.localStorage.getItem("porest:side-navigation-collapsed"),
    ).toBe("true");
    act(() => root.unmount());
    root = createRoot(container);
    render(<Nav />);
    expect(nav()?.dataset.collapsed).toBe("true");
    click(trigger());
    expect(nav()?.dataset.collapsed).toBeUndefined();
    expect(
      window.localStorage.getItem("porest:side-navigation-collapsed"),
    ).toBe("false");
  });

  it("768 ~ 1279 에서 손으로 편 것은 기억하지 않는다 — 다시 열면 접힌 채, 넘나들면 기본으로", () => {
    media = { ...media, wide: false };
    render(<Nav />);
    click(trigger());
    expect(nav()?.dataset.collapsed).toBeUndefined();
    expect(
      window.localStorage.getItem("porest:side-navigation-collapsed"),
    ).toBeNull();
    // 1280 을 넘었다가 돌아오면 손으로 정한 값은 버려진다
    setMedia({ wide: true });
    setMedia({ wide: false });
    expect(nav()?.dataset.collapsed).toBe("true");
  });

  it("제어 — collapsed 를 주면 스스로 바꾸지 않고 onCollapsedChange 로 알린다 · 기억도 쓰지 않는다", () => {
    const onCollapsedChange = vi.fn();
    render(<Nav collapsed={false} onCollapsedChange={onCollapsedChange} />);
    click(trigger());
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(nav()?.dataset.collapsed).toBeUndefined();
    expect(
      window.localStorage.getItem("porest:side-navigation-collapsed"),
    ).toBeNull();
  });

  it("defaultCollapsed — 창 폭 · 기억을 쓰지 않고 그 값에서 시작한다", () => {
    media = { ...media, wide: false };
    render(<Nav defaultCollapsed={false} />);
    expect(nav()?.dataset.collapsed).toBeUndefined();
    click(trigger());
    expect(nav()?.dataset.collapsed).toBe("true");
    setMedia({ wide: true });
    expect(nav()?.dataset.collapsed).toBe("true");
  });

  it("ref · id · 나머지 속성을 건넨다", () => {
    const ref = createRef<HTMLElement>();
    render(<Nav ref={ref} id="side" data-x="1" />);
    expect(ref.current).toBe(nav());
    expect(nav()?.id).toBe("side");
    expect(nav()?.dataset.x).toBe("1");
  });
});

describe("머리 · 접기 버튼", () => {
  it("이름 '사이드바' · aria-expanded · aria-controls 가 사이드바를 가리킨다 · 로고는 누르지 않는다", () => {
    render(<Nav id="side" />);
    const button = trigger() as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe("사이드바");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe("side");
    expect(button.type).toBe("button");
    const logo = container.querySelector("[data-slot=side-navigation-logo]");
    expect(logo?.textContent).toBe("그루 담다");
    expect(logo?.closest("a,button")).toBeNull();
    click(button);
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
    // 접히면 로고는 숨고 접기 버튼이 56 의 가운데(오른쪽 8)에 선다
    expect(
      container.querySelector("[data-slot=side-navigation-logo]")?.className,
    ).toContain("hidden");
    expect(trigger()?.className).toContain("right-x2");
  });

  it("누르는 영역은 상자 40 + 보이지 않는 여백 2 씩 = 44", () => {
    render(<Nav />);
    expect(trigger()?.className).toContain("size-[40px]");
    expect(trigger()?.className).toContain("before:size-[44px]");
  });
});

describe("묶음 · 항목", () => {
  it("묶음은 목록(ul aria-labelledby 묶음 이름) — 접히면 이름은 보이지 않게 남고 묶음 사이에 1px 선", () => {
    render(<Nav collapsed={false} />);
    const group = container.querySelector(
      "[data-slot=side-navigation-group]",
    ) as HTMLElement;
    const label = group.querySelector<HTMLElement>(
      "[data-slot=side-navigation-group-label]",
    );
    expect(label?.textContent).toBe("워크스페이스");
    expect(group.querySelector("ul")?.getAttribute("aria-labelledby")).toBe(
      label?.id,
    );
    expect(label?.className).toContain("font-bold");
    expect(group.className).not.toContain("before:");

    render(<Nav collapsed />);
    const hidden = container.querySelector<HTMLElement>(
      "[data-slot=side-navigation-group-label]",
    );
    expect(hidden?.className).toContain("sr-only");
    expect(hidden?.textContent).toBe("워크스페이스");
    expect(
      container.querySelector("[data-slot=side-navigation-group]")?.className,
    ).toContain("before:h-px");
  });

  it("항목은 링크 — 지금 화면은 aria-current=page, 바탕은 한 단계 짙은 옅은 회색이고 굵기는 그대로(500)", () => {
    render(<Nav collapsed={false} current="home" />);
    const home = item(0);
    expect(home.tagName).toBe("A");
    expect(home.getAttribute("href")).toBe("/desk");
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(home.className).toContain("bg-bg-neutral-weak-pressed");
    // 지금 항목은 마우스를 올리거나 눌러도 바탕이 그대로다
    expect(home.className).not.toMatch(/hover:bg|active:bg/);
    expect(labelOf(home)?.className).toContain("text-fg-neutral");
    expect(labelOf(home)?.className).toContain("font-medium");
    expect(labelOf(home)?.className).not.toContain("font-bold");
    const cal = items().find(
      (a) => a.getAttribute("href") === "/desk/calendar",
    ) as HTMLElement;
    expect(cal.hasAttribute("aria-current")).toBe(false);
    expect(cal.className).toContain("hover:bg-bg-layer-default-pressed");
  });

  it("긴 이름은 줄을 바꾼다 — 말줄임 없음", () => {
    render(<Nav collapsed={false} />);
    const label = labelOf(item(0));
    expect(label?.className).toContain("break-keep");
    expect(label?.className).not.toContain("truncate");
    expect(label?.className).not.toContain("line-clamp");
  });

  it("접히면 이름이 보이지 않게(sr-only) 남고 항목은 40 · 좌우 10", () => {
    render(<Nav collapsed />);
    expect(labelOf(item(0))?.className).toContain("sr-only");
    expect(labelOf(item(0))?.textContent).toBe("홈");
    expect(item(0).className).toContain("w-[40px]");
    expect(item(0).className).toContain("px-x2_5");
  });

  it("막힌 항목 — 주소 없음 · aria-disabled · fg-disabled · 누르지 못한다", () => {
    const onClick = vi.fn();
    render(
      <SideNavigation collapsed={false}>
        <SideNavigationContent>
          <SideNavigationGroup>
            <SideNavigationItem
              href="/x"
              icon={<svg />}
              label="막힘"
              disabled
              onClick={onClick}
            />
          </SideNavigationGroup>
        </SideNavigationContent>
      </SideNavigation>,
    );
    const link = item(0);
    expect(link.hasAttribute("href")).toBe(false);
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.className).toContain("cursor-not-allowed");
    expect(labelOf(link)?.className).toContain("text-fg-disabled");
    const event = click(link);
    expect(event.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("누르면 onClick · onNavigate(서랍을 닫는다) — 새 탭으로 여는 누르기는 이동이 아니다", () => {
    const onNavigate = vi.fn();
    const onClick = vi.fn();
    render(
      <SideNavigationContent onNavigate={onNavigate}>
        <SideNavigationItem
          href="/a"
          icon={<svg />}
          label="A"
          onClick={onClick}
        />
      </SideNavigationContent>,
    );
    click(item(0));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    click(item(0), { ctrlKey: true });
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("누르면 아이콘 · 이름만 2px 거리 축소(바탕 그대로) — --press-basis 를 잰다", () => {
    render(<Nav collapsed={false} />);
    const content = item(0).querySelector<HTMLElement>(
      "[data-slot=side-navigation-item-content]",
    );
    expect(content?.className).toContain(
      "group-active/side-navigation-item:[scale:calc(1-2/var(--press-basis))]",
    );
    expect(content?.className).toContain(
      "motion-reduce:group-active/side-navigation-item:[scale:1]",
    );
    act(() => {
      item(0).dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(item(0).style.getPropertyValue("--press-basis")).toBe("24");
  });
});

describe("부모 항목 — 펼치기만", () => {
  const parent = () =>
    items().find((el) => el.hasAttribute("data-parent")) as HTMLElement;
  const subList = () =>
    container.querySelector<HTMLElement>(
      "[data-slot=side-navigation-sub-list]",
    ) as HTMLElement;

  it("버튼 — 이동하지 않고 하위를 펼치고 접는다(aria-expanded · aria-controls) · 꺾쇠가 돈다", () => {
    render(<Nav collapsed={false} />);
    const button = parent();
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.hasAttribute("href")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(subList().dataset.state).toBe("closed");
    // 접힌 하위는 보이지 않게 — 보조 기술 · Tab 에서 빠진다
    expect(subList().className).toContain("invisible");
    expect(
      container.querySelector(
        "#" + CSS.escape(button.getAttribute("aria-controls") ?? ""),
      ),
    ).not.toBeNull();
    click(button);
    expect(parent().getAttribute("aria-expanded")).toBe("true");
    expect(subList().dataset.state).toBe("open");
    expect(subList().className).toContain("visible");
    expect(
      container
        .querySelector("[data-slot=side-navigation-chevron]")
        ?.getAttribute("class"),
    ).toContain("rotate-180");
    click(parent());
    expect(parent().getAttribute("aria-expanded")).toBe("false");
  });

  it("하위가 지금 화면이면 저절로 펼쳐진다 — 부모는 지금 항목이 아니고 하위가 지금 항목이다", () => {
    render(<Nav collapsed={false} current="namu" />);
    expect(parent().getAttribute("aria-expanded")).toBe("true");
    expect(parent().className).not.toContain("bg-bg-neutral-weak-pressed");
    const sub = container.querySelector<HTMLElement>(
      "[data-slot=side-navigation-sub-item]",
    );
    expect(sub?.getAttribute("aria-current")).toBe("page");
    expect(sub?.className).toContain("bg-bg-neutral-weak-pressed");
    // 이름은 부모 이름과 같은 자리(40)에서 시작
    expect(sub?.className).toContain("pl-[40px]");
  });

  it("지금 화면이 나중에 하위로 옮겨 오면 그때 펼쳐진다", () => {
    render(<Nav collapsed={false} current="home" />);
    expect(parent().getAttribute("aria-expanded")).toBe("false");
    render(<Nav collapsed={false} current="toss" />);
    expect(parent().getAttribute("aria-expanded")).toBe("true");
  });

  it("defaultOpen — 처음부터 펼친다", () => {
    render(
      <SideNavigation collapsed={false}>
        <SideNavigationContent>
          <SideNavigationItem icon={<svg />} label="증권" defaultOpen>
            <SideNavigationSubItem href="/a" label="A" />
          </SideNavigationItem>
        </SideNavigationContent>
      </SideNavigation>,
    );
    expect(parent().getAttribute("aria-expanded")).toBe("true");
  });

  it("펼침 · 접힘은 300ms(Accordion 과 같다) — 모션 줄이기면 높이를 움직이지 않고 150ms 서서히", () => {
    render(<Nav collapsed={false} />);
    expect(subList().className).toContain("--motion-duration-d6");
    expect(subList().className).toContain(
      "motion-reduce:[transition:grid-template-rows_0s_linear_var(--motion-duration-d3)",
    );
    expect(
      container
        .querySelector("[data-slot=side-navigation-chevron]")
        ?.getAttribute("class"),
    ).toContain("--motion-duration-d6");
  });
});

describe("접힌 사이드바 — 말풍선 · 펼침 메뉴", () => {
  const flyout = () =>
    document.querySelector<HTMLElement>("[data-slot=side-navigation-flyout]");
  const parent = () =>
    items().find((el) => el.hasAttribute("data-parent")) as HTMLElement;
  const rows = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-slot=side-navigation-flyout-item]",
      ),
    );

  it("하위가 있는 항목은 누르면 펼침 메뉴 — role=group · 이름은 부모 · 맨 위에 부모 이름 · 줄 44 · 사이드바 안에 그린다", () => {
    render(<Nav collapsed />);
    expect(flyout()).toBeNull();
    expect(parent().getAttribute("aria-expanded")).toBe("false");
    click(parent());
    const menu = flyout() as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.getAttribute("role")).toBe("group");
    expect(menu.getAttribute("aria-labelledby")).toBe(parent().id);
    expect(parent().getAttribute("aria-expanded")).toBe("true");
    expect(parent().getAttribute("aria-controls")).toBe(menu.id);
    expect(nav()?.contains(menu)).toBe(true);
    expect(
      menu.querySelector("[data-slot=side-navigation-flyout-label]")
        ?.textContent,
    ).toBe("증권");
    expect(rows().map((r) => r.textContent)).toEqual(["나무증권", "토스증권"]);
    expect(rows()[0]?.className).toContain("min-h-[44px]");
    // Menu 표면 — 폭 200 · 모서리 20 · 떠 있는 바탕 + s3 · z-floating
    expect(menu.className).toContain("w-[200px]");
    expect(menu.className).toContain("rounded-r5");
    expect(menu.className).toContain("bg-bg-layer-floating");
    expect(menu.className).toContain("z-(--z-floating)");
    // Menu Sheet 로 바꾸지 않는다
    expect(document.querySelector("[data-slot=menu-sheet]")).toBeNull();
  });

  it("키보드(Enter · Space)로 열면 첫 줄로 초점, 마우스로 열면 옮기지 않는다", () => {
    render(<Nav collapsed />);
    parent().focus();
    // button.click() 은 detail 0 — 키보드로 누른 것
    act(() => parent().click());
    expect(document.activeElement).toBe(rows()[0]);
    click(parent());
    expect(flyout()).toBeNull();
    click(parent(), { detail: 1 });
    expect(flyout()).not.toBeNull();
    expect(document.activeElement).not.toBe(rows()[0]);
  });

  it("마우스를 올리면 200ms 뒤 열리고, 떠나면 100ms 뒤 닫힌다 — 옮겨 가는 동안은 닫히지 않는다", () => {
    vi.useFakeTimers();
    render(<Nav collapsed />);
    pointer("pointerover", parent());
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(flyout()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(flyout()).not.toBeNull();
    // 항목에서 메뉴로 옮겨 가는 길 — 항목을 떠났다가 100ms 안에 메뉴에 들어간다
    pointer("pointerout", parent());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    pointer("pointerover", flyout());
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(flyout()).not.toBeNull();
    pointer("pointerout", flyout());
    act(() => {
      vi.advanceTimersByTime(90);
    });
    expect(flyout()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(20);
    });
    // 닫힘 모션(100ms)이 끝나야 지워진다
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(parent().getAttribute("aria-expanded")).toBe("false");
  });

  it("마우스로 열린 메뉴를 누르면 닫지 않고 붙들어 둔다 — 떠나도 남고, 다시 누르면 닫는다", () => {
    vi.useFakeTimers();
    render(<Nav collapsed />);
    pointer("pointerover", parent());
    act(() => {
      vi.advanceTimersByTime(250);
    });
    click(parent(), { detail: 1 });
    pointer("pointerout", parent());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(parent().getAttribute("aria-expanded")).toBe("true");
    click(parent(), { detail: 1 });
    expect(parent().getAttribute("aria-expanded")).toBe("false");
  });

  it("다른 펼침 메뉴가 열려 있으면 기다리지 않고 바로 연다 · 한 번에 하나만", () => {
    vi.useFakeTimers();
    render(
      <SideNavigation collapsed>
        <SideNavigationContent>
          <SideNavigationItem icon={<svg />} label="증권">
            <SideNavigationSubItem href="/a" label="나무증권" />
          </SideNavigationItem>
          <SideNavigationItem icon={<svg />} label="자산">
            <SideNavigationSubItem href="/b" label="은행" />
          </SideNavigationItem>
        </SideNavigationContent>
      </SideNavigation>,
    );
    const [first, second] = items();
    pointer("pointerover", first ?? null);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(first?.getAttribute("aria-expanded")).toBe("true");
    pointer("pointerout", first ?? null);
    pointer("pointerover", second ?? null);
    expect(second?.getAttribute("aria-expanded")).toBe("true");
    expect(first?.getAttribute("aria-expanded")).toBe("false");
  });

  it("Esc 는 닫고 초점을 부모로 · 하위 링크를 누르면 이동하고 닫힌다(onNavigate)", async () => {
    const onNavigate = vi.fn();
    render(
      <SideNavigation collapsed>
        <SideNavigationContent onNavigate={onNavigate}>
          <SideNavigationItem icon={<svg />} label="증권">
            <SideNavigationSubItem href="/a" label="나무증권" />
          </SideNavigationItem>
        </SideNavigationContent>
      </SideNavigation>,
    );
    act(() => items()[0]?.click());
    expect(flyout()).not.toBeNull();
    act(() => {
      rows()[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(items()[0]?.getAttribute("aria-expanded")).toBe("false");
    // 초점 복귀는 Radix FocusScope 가 한 틱 뒤에 한다
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.activeElement).toBe(items()[0]);

    act(() => items()[0]?.click());
    click(rows()[0]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(items()[0]?.getAttribute("aria-expanded")).toBe("false");
  });

  it("지금 화면의 하위는 접히면 부모가 지금 항목이고, 펼침 메뉴의 그 줄이 aria-current 를 가진다(부모에는 두지 않는다)", () => {
    render(<Nav collapsed current="namu" />);
    expect(parent().className).toContain("bg-bg-neutral-weak-pressed");
    expect(parent().hasAttribute("aria-current")).toBe(false);
    act(() => parent().click());
    expect(rows()[0]?.getAttribute("aria-current")).toBe("page");
    expect(rows()[1]?.hasAttribute("aria-current")).toBe(false);
  });

  it("펴지면 펼침 메뉴는 사라진다", () => {
    const rerender = (c: boolean) => render(<Nav collapsed={c} />);
    rerender(true);
    act(() => parent().click());
    expect(flyout()).not.toBeNull();
    rerender(false);
    expect(flyout()).toBeNull();
    expect(parent().getAttribute("aria-expanded")).toBe("false");
    rerender(true);
    expect(flyout()).toBeNull();
  });

  it("하위가 없는 항목은 이름 말풍선(툴팁)을 쓰고 이름과 같은 글이라 aria-describedby 로 잇지 않는다", () => {
    render(<Nav collapsed />);
    const home = item(0);
    expect(home.hasAttribute("aria-describedby")).toBe(false);
    expect(home.dataset.slot).toBe("side-navigation-item");
    // 펼쳤을 때는 말풍선을 쓰지 않는다 — 이름이 이미 보인다
    render(<Nav collapsed={false} />);
    expect(item(0).hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("내용 · 바닥", () => {
  it("스크롤하면 머리 아래 선(data-scrolled)이 생기고 위 끝으로 돌아오면 사라진다", () => {
    render(<Nav collapsed={false} />);
    const content = container.querySelector<HTMLElement>(
      "[data-slot=side-navigation-content]",
    ) as HTMLElement;
    expect(content.hasAttribute("data-scrolled")).toBe(false);
    let top = 0;
    Object.defineProperty(content, "scrollTop", {
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    });
    top = 30;
    act(() => {
      content.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(content.hasAttribute("data-scrolled")).toBe(true);
    top = 0;
    act(() => {
      content.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(content.hasAttribute("data-scrolled")).toBe(false);
    // 머리의 선은 내용이 스크롤됐을 때만
    expect(
      container.querySelector("[data-slot=side-navigation-header]")?.className,
    ).toContain(
      "[&:has(~[data-slot=side-navigation-content][data-scrolled])]:shadow-[inset_0_-1px_0_0_var(--color-stroke-neutral-subtle)]",
    );
  });

  it("내용 — 이 안에서만 스크롤 · 위 8 · 좌우 8 · 아래 24(흐림 깊이) · 묶음 사이 8, 접히면 0", () => {
    render(<Nav collapsed={false} />);
    const content = container.querySelector<HTMLElement>(
      "[data-slot=side-navigation-content]",
    ) as HTMLElement;
    expect(content.className).toContain("overflow-y-auto");
    expect(content.className).toContain("px-x2");
    expect(content.className).toContain("pb-[24px]");
    expect(content.className).toContain("pt-x2");
    expect(content.className).toContain("gap-x2");
    render(<Nav collapsed />);
    expect(
      container.querySelector("[data-slot=side-navigation-content]")?.className,
    ).toContain("gap-0");
  });

  it("SideNavigation 밖(서랍)에서는 스스로 주 메뉴 nav 가 되고 펼친 모양이다", () => {
    render(
      <SideNavigationContent>
        <SideNavigationGroup label="워크스페이스">
          <SideNavigationItem href="/a" icon={<svg />} label="홈" />
          <SideNavigationItem icon={<svg />} label="증권">
            <SideNavigationSubItem href="/b" label="나무증권" />
          </SideNavigationItem>
        </SideNavigationGroup>
      </SideNavigationContent>,
    );
    const drawer = container.querySelector<HTMLElement>(
      "[data-slot=side-navigation-content]",
    ) as HTMLElement;
    expect(drawer.tagName).toBe("NAV");
    expect(drawer.getAttribute("aria-label")).toBe("주 메뉴");
    expect(drawer.dataset.standalone).toBe("");
    // 말풍선 · 펼침 메뉴 없이 펼친 모양 — 이름이 보이고 부모는 아래로 펼친다
    expect(labelOf(item(0))?.className).not.toContain("sr-only");
    const button = item(1);
    click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.querySelector("[data-slot=side-navigation-flyout]"),
    ).toBeNull();
  });

  it("바닥 — 비면 그리지 않는다", () => {
    render(
      <SideNavigation collapsed={false}>
        <SideNavigationFooter>{null}</SideNavigationFooter>
      </SideNavigation>,
    );
    expect(
      container.querySelector("[data-slot=side-navigation-footer]"),
    ).toBeNull();
    render(
      <SideNavigation collapsed={false}>
        <SideNavigationFooter>계정</SideNavigationFooter>
      </SideNavigation>,
    );
    expect(
      container.querySelector("[data-slot=side-navigation-footer]")
        ?.textContent,
    ).toBe("계정");
  });
});

describe("이름 숨김의 시간", () => {
  it("펴질 때 이름은 다 펴진 뒤(200ms) 나타나고, 접힐 때는 바로 사라진다 — 모션 줄이기면 바로", () => {
    vi.useFakeTimers();
    render(<Nav collapsed />);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(labelOf(item(0))?.className).toContain("sr-only");
    render(<Nav collapsed={false} />);
    // 막 펴졌다 — 이름은 아직 숨어 있다
    expect(labelOf(item(0))?.className).toContain("sr-only");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(labelOf(item(0))?.className).not.toContain("sr-only");
    render(<Nav collapsed />);
    expect(labelOf(item(0))?.className).toContain("sr-only");

    media = { ...media, reduce: true };
    render(<Nav collapsed={false} />);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(labelOf(item(0))?.className).not.toContain("sr-only");
  });
});
