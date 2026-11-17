// Bottom Navigation 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 잴 수 없는 값(그림자 + 안쪽 선 · 5칸 · 누름 축소 · 안전 영역 식 · 줄어들기 기준)은 여기서 클래스 · 동작으로 본다.
import { act, createRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOTTOM_NAVIGATION_INSET,
  BottomNavigation,
  BottomNavigationAddButton,
  BottomNavigationItem,
} from ".";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

const nav = () =>
  container.querySelector<HTMLElement>("[data-slot=bottom-navigation]");
const items = () =>
  Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      "[data-slot=bottom-navigation-item]",
    ),
  );
const item = (i: number) => items()[i] as HTMLAnchorElement;

// 링크 누르기는 jsdom 이 이동하지 못한다("Not implemented: navigation") — 문서 끝에서 막되, 그 전의 defaultPrevented 를 돌려준다
const click = (el: Element | null, init: MouseEventInit = {}) => {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  let defaultPrevented = false;
  const last = (e: Event) => {
    defaultPrevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener("click", last);
  act(() => {
    el?.dispatchEvent(event);
  });
  document.removeEventListener("click", last);
  return { defaultPrevented };
};

function Bar({
  current = "calendar",
  notify = [],
  ...rest
}: {
  current?: "home" | "ledger" | "calendar" | "more";
  notify?: string[];
} & React.ComponentProps<typeof BottomNavigation>) {
  return (
    <BottomNavigation {...rest}>
      <BottomNavigationItem
        href="/desk"
        icon={<svg />}
        label="홈"
        current={current === "home"}
        notification={notify.includes("home")}
      />
      <BottomNavigationItem
        href="/desk/ledger"
        icon={<svg />}
        label="가계부"
        current={current === "ledger"}
      />
      <BottomNavigationAddButton
        aria-label={current === "calendar" ? "일정 추가" : "거래 추가"}
      />
      <BottomNavigationItem
        href="/desk/calendar"
        icon={<svg />}
        label="캘린더"
        current={current === "calendar"}
      />
      <BottomNavigationItem
        href="/desk/more"
        icon={<svg />}
        label="전체"
        current={current === "more"}
      />
    </BottomNavigation>
  );
}

// jsdom 은 scrollTop 을 쓰지 못한다 — 상자 하나에 값을 두고 scroll 을 쏜다
function makeScrollBox() {
  const box = document.createElement("div");
  let top = 0;
  Object.defineProperty(box, "scrollTop", {
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  box.scrollTo = vi.fn() as unknown as typeof box.scrollTo;
  document.body.appendChild(box);
  const scrollTo = (y: number) => {
    act(() => {
      top = y;
      box.dispatchEvent(new Event("scroll"));
    });
  };
  return { box, scrollTo };
}

describe("BottomNavigation — 바", () => {
  it("<nav aria-label='주 메뉴'> — 떠 있는 알약: 불투명 floating 바탕 · 모서리 full · z-sticky · 칸 다섯 · 흐림 없음", () => {
    render(<Bar compact={false} />);
    const bar = nav() as HTMLElement;
    expect(bar.tagName).toBe("NAV");
    expect(bar.getAttribute("aria-label")).toBe("주 메뉴");
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("rounded-full");
    expect(bar.className).toContain("bg-bg-layer-floating");
    expect(bar.className).toContain("z-(--z-sticky)");
    expect(bar.className).toContain("grid-cols-5");
    expect(bar.className).toContain("max-w-[480px]");
    // 그림자 s3 + 안쪽 1px 선 한 겹
    expect(bar.className).toContain("var(--shadow-s3)");
    expect(bar.className).toContain(
      "inset_0_0_0_1px_var(--color-stroke-neutral-subtle)",
    );
    expect(bar.className).not.toMatch(/backdrop|blur|opacity/);
  });

  it("펼침 66 · 줄어듦 48 — 좌우 안전 영역을 더하고 아래는 max(14 · 12, 안전 영역 − 6 · 8)", () => {
    render(<Bar compact={false} />);
    expect(nav()?.className).toContain("h-[66px]");
    expect(nav()?.className).toContain(
      "bottom-[max(14px,calc(env(safe-area-inset-bottom)-6px))]",
    );
    expect(nav()?.className).toContain("env(safe-area-inset-left)");
    expect(nav()?.className).toContain("env(safe-area-inset-right)");
    render(<Bar compact />);
    expect(nav()?.className).toContain("h-[48px]");
    expect(nav()?.className).toContain(
      "bottom-[max(12px,calc(env(safe-area-inset-bottom)-8px))]",
    );
    expect(nav()?.dataset.compact).toBe("true");
  });

  it("본문 아래 여백 식 — 바의 아래 자리 + 66 + 24", () => {
    expect(BOTTOM_NAVIGATION_INSET).toBe(
      "calc(max(14px, env(safe-area-inset-bottom) - 6px) + 90px)",
    );
  });

  it("ref · 나머지 속성을 바에 건넨다", () => {
    const ref = createRef<HTMLElement>();
    render(<Bar ref={ref} id="tabs" />);
    expect(ref.current).toBe(nav());
    expect(ref.current?.id).toBe("tabs");
  });

  it("안 · 밖 — 칸 · +는 BottomNavigation 안에서만 쓴다", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(<BottomNavigationAddButton aria-label="거래 추가" />),
    ).toThrow(/BottomNavigation 안에 둔다/);
    spy.mockRestore();
  });
});

describe("칸", () => {
  it("링크 + 지금 탭 aria-current=page · 아이콘은 장식 · 지금 탭은 선 2.5 짙은 색, 다른 탭은 선 2 흐린 색(브랜드 색 없음)", () => {
    render(<Bar current="home" compact={false} />);
    const home = item(0);
    const ledger = item(1);
    expect(home.tagName).toBe("A");
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(ledger.hasAttribute("aria-current")).toBe(false);
    expect(home.className).toContain("text-fg-neutral ");
    expect(home.className).toContain("[&_svg]:[stroke-width:2.5]");
    expect(ledger.className).toContain("text-fg-neutral-subtle");
    expect(ledger.className).toContain("[&_svg]:[stroke-width:2]");
    expect(home.className).not.toMatch(/brand/);
    expect(
      home
        .querySelector("[data-slot=notification-badge-target]")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("칸은 누르면 2px 거리 축소만(색은 그대로) — 모션 줄이기면 없다 · 호버 모양 없음", () => {
    render(<Bar compact={false} />);
    const first = item(0);
    expect(first.className).toContain(
      "active:[scale:calc(1-2/var(--press-basis,54))]",
    );
    expect(first.className).toContain("motion-reduce:active:[scale:1]");
    expect(first.className).not.toMatch(/hover:|active:bg/);
    act(() => {
      first.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    // jsdom 은 크기를 재지 않아 max(0, 0, 24) = 24
    expect(first.style.getPropertyValue("--press-basis")).toBe("24");
  });

  it("라벨 — 11 / 15 · 500 고정 크기 · 한 줄, 줄어든 바에서는 보이지 않게(sr-only) 남아 칸의 이름이 된다", () => {
    render(<Bar compact={false} />);
    const label = item(0).querySelector<HTMLElement>(
      "[data-slot=bottom-navigation-label]",
    );
    expect(label?.className).toContain("text-t1-static");
    expect(label?.className).toContain("font-medium");
    expect(label?.className).toContain("truncate");
    expect(label?.textContent).toBe("홈");

    render(<Bar compact />);
    const hidden = item(0).querySelector<HTMLElement>(
      "[data-slot=bottom-navigation-label]",
    );
    expect(hidden?.className).toContain("sr-only");
    expect(hidden?.textContent).toBe("홈");
    expect(items().map((a) => a.textContent)).toEqual([
      "홈",
      "가계부",
      "캘린더",
      "전체",
    ]);
  });

  it("알림 점 — 점만 · 이름 뒤에 '새 소식'(보이지 않게)", () => {
    render(<Bar compact={false} notify={["home"]} />);
    const home = item(0);
    const ledger = item(1);
    expect(home.querySelector("[data-slot=notification-badge]")).not.toBeNull();
    expect(home.textContent).toBe("홈새 소식");
    expect(ledger.querySelector("[data-slot=notification-badge]")).toBeNull();
    expect(ledger.textContent).toBe("가계부");
  });

  it("다른 탭을 누르면 onClick — 이동은 링크가 맡는다", () => {
    const onClick = vi.fn();
    render(
      <BottomNavigation compact={false}>
        <BottomNavigationItem
          href="/desk"
          icon={<svg />}
          label="홈"
          onClick={onClick}
        />
      </BottomNavigation>,
    );
    click(item(0));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("지금 탭을 다시 누르기", () => {
  it("onReselect 를 주면 이동하지 않고(같은 주소를 쌓지 않는다) 그것만 부른다 — scrollToTop 을 받는다", () => {
    const onReselect = vi.fn();
    const onClick = vi.fn();
    render(
      <BottomNavigation compact={false}>
        <BottomNavigationItem
          href="/desk"
          icon={<svg />}
          label="홈"
          current
          onClick={onClick}
          onReselect={onReselect}
        />
      </BottomNavigation>,
    );
    const event = click(item(0));
    expect(event.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    expect(onReselect).toHaveBeenCalledTimes(1);
    expect(onReselect.mock.calls[0]?.[0].href).toBe("/desk");
    expect(typeof onReselect.mock.calls[0]?.[0].scrollToTop).toBe("function");
  });

  it("기본 — 맨 위로 올리고, 지금 주소가 그 탭의 첫 화면이 아니면 주소를 고쳐 쓴다(replace)", () => {
    const replace = vi.fn();
    const scrollTo = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/desk/ledger/detail",
      search: "",
      hash: "",
      href: "http://localhost/desk/ledger/detail",
      replace,
    });
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    render(
      <BottomNavigation compact={false}>
        <BottomNavigationItem
          href="/desk/ledger"
          icon={<svg />}
          label="가계부"
          current
        />
      </BottomNavigation>,
    );
    click(item(0));
    expect(scrollTo).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/desk/ledger");
  });

  it("이미 그 탭의 첫 화면이면 주소는 그대로 — 맨 위로만", () => {
    const replace = vi.fn();
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/desk/ledger",
      search: "",
      hash: "",
      href: "http://localhost/desk/ledger",
      replace,
    });
    render(
      <BottomNavigation compact={false}>
        <BottomNavigationItem
          href="/desk/ledger"
          icon={<svg />}
          label="가계부"
          current
        />
      </BottomNavigation>,
    );
    click(item(0));
    expect(replace).not.toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("새 탭으로 여는 누르기(⌘ · Ctrl · 가운데 단추)는 브라우저에 맡긴다", () => {
    const onReselect = vi.fn();
    render(
      <BottomNavigation compact={false}>
        <BottomNavigationItem
          href="/desk"
          icon={<svg />}
          label="홈"
          current
          onReselect={onReselect}
        />
      </BottomNavigation>,
    );
    const event = click(item(0), { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(onReselect).not.toHaveBeenCalled();
  });
});

describe("가운데 +", () => {
  it("<button type=button> — 이름은 화면마다, 원 44(줄어듦 36 · + 20) 는 장식이다", () => {
    const onClick = vi.fn();
    render(
      <BottomNavigation compact={false}>
        <BottomNavigationAddButton aria-label="거래 추가" onClick={onClick} />
      </BottomNavigation>,
    );
    const add = container.querySelector<HTMLButtonElement>(
      "[data-slot=bottom-navigation-add]",
    );
    expect(add?.type).toBe("button");
    expect(add?.getAttribute("aria-label")).toBe("거래 추가");
    // 칸 전체가 누르는 자리
    expect(add?.className).toContain("h-full");
    const circle = container.querySelector<HTMLElement>(
      "[data-slot=bottom-navigation-add-circle]",
    );
    expect(circle?.getAttribute("aria-hidden")).toBe("true");
    expect(circle?.className).toContain("size-[44px]");
    expect(circle?.className).toContain("[&_svg]:size-[24px]");
    expect(circle?.className).toContain("bg-bg-brand-solid");
    expect(circle?.className).toContain(
      "group-active/bottom-navigation-add:bg-bg-brand-solid-pressed",
    );
    // 원 바깥 2px 링
    expect(circle?.className).toContain(
      "group-focus-visible/bottom-navigation-add:outline-offset-2",
    );
    click(add);
    expect(onClick).toHaveBeenCalledTimes(1);

    render(
      <BottomNavigation compact>
        <BottomNavigationAddButton aria-label="일정 추가" />
      </BottomNavigation>,
    );
    const small = container.querySelector<HTMLElement>(
      "[data-slot=bottom-navigation-add-circle]",
    );
    expect(small?.className).toContain("size-[36px]");
    expect(small?.className).toContain("[&_svg]:size-[20px]");
  });
});

describe("좁은 칸(Layout 지원 폭 — 320 보다 좁은 화면)", () => {
  /** 바의 안쪽 폭을 알린다 — jsdom 은 레이아웃이 없어 ResizeObserver 를 흉내 내고 콜백을 직접 부른다 */
  let observed: { cb: ResizeObserverCallback; el: Element }[] = [];
  beforeEach(() => {
    observed = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: ResizeObserverCallback) {}
        observe(el: Element) {
          observed.push({ cb: this.cb, el });
        }
        unobserve() {}
        disconnect() {
          observed = observed.filter((o) => o.cb !== this.cb);
        }
      },
    );
  });
  const barWidth = (content: number) =>
    act(() => {
      for (const o of observed.filter((x) => x.el === nav()))
        o.cb(
          [{ contentRect: { width: content } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
    });
  const circle = () =>
    container.querySelector<HTMLElement>(
      "[data-slot=bottom-navigation-add-circle]",
    )!;
  const labels = () =>
    items().map((a) =>
      a.querySelector<HTMLElement>("[data-slot=bottom-navigation-label]")!,
    );

  it("320 화면(바 292 · 안쪽 272 → 칸 52.8)과 줄어든 바(안쪽 232 → 44.8)는 그대로다 — 라벨 · 원 44", () => {
    render(<Bar compact={false} />);
    barWidth(272);
    expect(nav()!.hasAttribute("data-narrow")).toBe(false);
    expect(circle().className).toContain("size-[44px]");
    for (const l of labels()) expect(l.className).not.toContain("sr-only");
    // 줄어든 바의 칸 44.8 도 44 이상이라 걸리지 않는다(원 36 은 줄어든 바 몫)
    barWidth(232);
    expect(nav()!.hasAttribute("data-narrow")).toBe(false);
  });

  it("칸이 + 원 44 보다 좁으면(바 173 · 안쪽 153 → 칸 29) 줄어든 바처럼 라벨을 숨기고 원을 36 으로 — 이름은 남는다", () => {
    render(<Bar compact={false} />);
    barWidth(153);
    const bar = nav()!;
    expect(bar.getAttribute("data-narrow")).toBe("true");
    // 바 높이 · 자리는 펼친 바 그대로(줄어든 건 아니다)
    expect(bar.hasAttribute("data-compact")).toBe(false);
    expect(bar.className).toContain("h-[66px]");
    expect(circle().className).toContain("size-[36px]");
    expect(circle().className).toContain("[&_svg]:size-[20px]");
    // 라벨은 보이지 않게만 — 칸의 이름으로 남는다
    for (const l of labels()) expect(l.className).toContain("sr-only");
    expect(item(0).textContent).toContain("홈");
    // 다시 넓어지면(칸 44 경계 — 안쪽 228 = 칸 44) 라벨 · 원 44 로 돌아온다
    barWidth(228);
    expect(nav()!.hasAttribute("data-narrow")).toBe(false);
    expect(circle().className).toContain("size-[44px]");
    for (const l of labels()) expect(l.className).not.toContain("sr-only");
  });
});

describe("줄어들기", () => {
  function Live({
    scrollRoot,
    onChange,
  }: {
    scrollRoot: HTMLElement;
    onChange?: (c: boolean) => void;
  }) {
    const [compact, setCompact] = useState<boolean | null>(null);
    return (
      <>
        <Bar
          scrollRoot={scrollRoot}
          onCompactChange={(c) => {
            setCompact(c);
            onChange?.(c);
          }}
        />
        <output>{String(compact)}</output>
      </>
    );
  }

  it("아래로 20 이상이면 줄고, 위로 28 이상이면 펴진다 — 맨 위 40 안이면 바로 펴진다", () => {
    const { box, scrollTo } = makeScrollBox();
    render(<Live scrollRoot={box} />);
    expect(nav()?.dataset.compact).toBeUndefined();
    scrollTo(10); // 맨 위 40 안 — 센 거리 없음
    scrollTo(100); // 처음 위치를 얻는다(이전 값 10 → 100: 아래로 90)
    expect(nav()?.dataset.compact).toBe("true");
    scrollTo(90); // 위로 10 — 모자라다
    expect(nav()?.dataset.compact).toBe("true");
    scrollTo(70); // 위로 합 30 ≥ 28
    expect(nav()?.dataset.compact).toBeUndefined();
    scrollTo(50);
    scrollTo(130);
    expect(nav()?.dataset.compact).toBe("true");
    scrollTo(30); // 맨 위 40 안
    expect(nav()?.dataset.compact).toBeUndefined();
    box.remove();
  });

  it("아래로 20 에 못 미치게는 줄지 않는다", () => {
    const { box, scrollTo } = makeScrollBox();
    render(<Live scrollRoot={box} />);
    scrollTo(100); // 처음 본 값 — 기준만 잡는다
    scrollTo(110);
    scrollTo(115);
    expect(nav()?.dataset.compact).toBeUndefined();
    scrollTo(125);
    expect(nav()?.dataset.compact).toBe("true");
    box.remove();
  });

  it("scrollRoot 가 아닌 상자의 스크롤은 세지 않는다 · 시트(dialog) 안도 세지 않는다", () => {
    const { box } = makeScrollBox();
    const other = makeScrollBox();
    render(<Live scrollRoot={box} />);
    other.scrollTo(10);
    other.scrollTo(200);
    expect(nav()?.dataset.compact).toBeUndefined();
    other.box.remove();
    box.remove();

    // scrollRoot 가 없으면 화면 안의 세로 스크롤 모두 — 단 시트 안은 뺀다
    const sheet = makeScrollBox();
    sheet.box.setAttribute("role", "dialog");
    render(<Bar />);
    sheet.scrollTo(10);
    sheet.scrollTo(300);
    expect(nav()?.dataset.compact).toBeUndefined();
    const page = makeScrollBox();
    page.scrollTo(10);
    page.scrollTo(300);
    expect(nav()?.dataset.compact).toBe("true");
    sheet.box.remove();
    page.box.remove();
  });

  it("제어 — compact 를 주면 스스로 바꾸지 않고 onCompactChange 로 알린다", () => {
    const onCompactChange = vi.fn();
    const { box, scrollTo } = makeScrollBox();
    render(
      <Bar
        compact={false}
        onCompactChange={onCompactChange}
        scrollRoot={box}
      />,
    );
    scrollTo(10);
    scrollTo(200);
    expect(onCompactChange).toHaveBeenCalledWith(true);
    expect(nav()?.dataset.compact).toBeUndefined();
    box.remove();
  });

  it("줄어든 바는 어디를 눌러도 펴진다 — 칸을 눌렀으면 그 탭으로도 간다(onClick)", () => {
    const onCompactChange = vi.fn();
    const onClick = vi.fn();
    render(
      <BottomNavigation compact onCompactChange={onCompactChange}>
        <BottomNavigationItem
          href="/desk"
          icon={<svg />}
          label="홈"
          onClick={onClick}
        />
      </BottomNavigation>,
    );
    click(item(0));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onCompactChange).toHaveBeenCalledWith(false);
  });

  it("줄어든 바를 눌러 펴면 거리를 처음부터 다시 센다 — 다시 20 을 내려야 준다", () => {
    const { box, scrollTo } = makeScrollBox();
    render(<Live scrollRoot={box} />);
    scrollTo(100);
    scrollTo(200); // 아래로 100 — 줄었다
    expect(nav()?.dataset.compact).toBe("true");
    click(nav());
    expect(nav()?.dataset.compact).toBeUndefined();
    scrollTo(201); // 아래로 1 — 예전엔 남은 거리 100 에 더해져 바로 다시 줄었다
    scrollTo(215); // 합 15
    expect(nav()?.dataset.compact).toBeUndefined();
    scrollTo(221); // 합 21 ≥ 20
    expect(nav()?.dataset.compact).toBe("true");
    box.remove();
  });

  it("보는 화면(screenKey)이 바뀌면 편다 — 같은 값이면 그대로, 처음 그릴 때는 손대지 않는다", () => {
    const { box, scrollTo } = makeScrollBox();
    render(<Bar scrollRoot={box} screenKey="/desk/expense" />);
    expect(nav()?.dataset.compact).toBeUndefined();
    scrollTo(100);
    scrollTo(200);
    expect(nav()?.dataset.compact).toBe("true");
    // 같은 화면(쿼리만 바뀐 셸은 같은 값을 준다) — 그대로
    render(<Bar scrollRoot={box} screenKey="/desk/expense" />);
    expect(nav()?.dataset.compact).toBe("true");
    // 다른 화면 — 편다
    render(<Bar scrollRoot={box} screenKey="/desk/stats" />);
    expect(nav()?.dataset.compact).toBeUndefined();
    box.remove();
  });

  it("화면이 바뀐 뒤의 스크롤 복원은 세지 않는다 — 사용자가 다시 만지면(휠 · 터치 · 키 · 누르기) 그다음부터 센다", () => {
    const { box, scrollTo } = makeScrollBox();
    render(<Bar scrollRoot={box} screenKey="/a" />);
    scrollTo(100);
    scrollTo(200);
    expect(nav()?.dataset.compact).toBe("true");
    render(<Bar scrollRoot={box} screenKey="/b" />);
    expect(nav()?.dataset.compact).toBeUndefined();
    // 짧아진 본문에 깎였다가(300) 데이터가 와서 돌려놓는다(800) — 아래로 500 이지만 세지 않는다
    scrollTo(300);
    scrollTo(800);
    expect(nav()?.dataset.compact).toBeUndefined();
    // 사용자가 만진 다음 아래로 25 — 준다
    act(() => {
      document.dispatchEvent(new Event("wheel"));
    });
    scrollTo(810);
    expect(nav()?.dataset.compact).toBeUndefined();
    scrollTo(825);
    expect(nav()?.dataset.compact).toBe("true");
    box.remove();
  });

  it("펼친 바를 눌러도 알리지 않는다", () => {
    const onCompactChange = vi.fn();
    render(<Bar compact={false} onCompactChange={onCompactChange} />);
    click(item(0));
    expect(onCompactChange).not.toHaveBeenCalled();
  });

  it("펴질 때 라벨은 다 펴진 뒤(200ms) 보인다 — 줄어들 때는 바로 숨는다", () => {
    vi.useFakeTimers();
    const label = () =>
      item(0).querySelector("[data-slot=bottom-navigation-label]")?.className ??
      "";
    render(<Bar compact />);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(label()).toContain("sr-only");
    render(<Bar compact={false} />);
    // 막 펴졌다 — 라벨은 아직 숨어 있다
    expect(label()).toContain("sr-only");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(label()).not.toContain("sr-only");
    render(<Bar compact />);
    expect(label()).toContain("sr-only");
  });

  it("모션 줄이기면 라벨이 바로 나온다", () => {
    vi.useFakeTimers();
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    render(<Bar compact />);
    render(<Bar compact={false} />);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      item(0).querySelector("[data-slot=bottom-navigation-label]")?.className,
    ).not.toContain("sr-only");
    expect(nav()?.className).toContain("motion-reduce:transition-none");
  });
});

describe("화면 키보드", () => {
  it("visualViewport 가 화면보다 150 넘게 작으면 바를 가린다", () => {
    const listeners = new Set<() => void>();
    const vv = {
      height: 800,
      scale: 1,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    vi.stubGlobal("visualViewport", vv);
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    render(<Bar compact={false} />);
    expect(nav()?.className).not.toContain("invisible");
    act(() => {
      vv.height = 480;
      listeners.forEach((fn) => fn());
    });
    expect(nav()?.className).toContain("invisible");
    act(() => {
      vv.height = 790;
      listeners.forEach((fn) => fn());
    });
    expect(nav()?.className).not.toContain("invisible");
  });
});
