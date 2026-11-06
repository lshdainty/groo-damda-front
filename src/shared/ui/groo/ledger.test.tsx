// 공용 원장 부품(가계부 · 할 일 · 검색이 함께 쓴다) — ds 값: 머리는 Scroll Auto Hide, 오는 날은 불투명도 없이 색, 날짜 머리는 h2.
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LedgerCell,
  LedgerCellNum,
  LedgerDivider,
  LedgerDayDate,
  LedgerDayGroup,
  LedgerDayHead,
  LedgerDaySum,
  LedgerExpand,
  LedgerBar,
  LedgerHead,
  LedgerKeep,
  LedgerList,
  LedgerMonthNav,
  LedgerShell,
  LedgerNavBtn,
  LedgerPin,
  LedgerSumBtn,
} from "./ledger";
import { useLedgerScroll } from "./use-ledger-scroll";
import { SCROLL_AUTO_HIDE_SYNC_EVENT } from "@/shared/ds/scroll-auto-hide";

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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (node: React.ReactNode) => act(() => root.render(node));

describe("원장 머리 — Scroll Auto Hide (할 일 원장도 같은 부품)", () => {
  it("머리는 sticky · bg-layer-default 의 Scroll Auto Hide 이고 옛 접힘이 없다", () => {
    render(
      <LedgerPin>
        <LedgerNavBtn aria-label="이전 달">‹</LedgerNavBtn>
      </LedgerPin>,
    );
    const pin = container.querySelector("[data-scroll-auto-hide]")!;
    expect(pin.className).toContain("sticky");
    expect(pin.className).toContain("bg-bg-layer-default");
    expect(container.querySelector("[data-ledger-collapse]")).toBeNull();
  });

  it("단추 셋: 월 이동 = ghost medium iconOnly, 토글 = small neutralOutline, 펼침 = aria-expanded", () => {
    render(
      <>
        <LedgerNavBtn aria-label="이전 달">‹</LedgerNavBtn>
        <LedgerSumBtn aria-expanded={false}>소비 요약</LedgerSumBtn>
        <LedgerExpand aria-label="월 달력" expanded />
      </>,
    );
    const nav = container.querySelector<HTMLElement>('[aria-label="이전 달"]')!;
    expect(nav.className).toContain("min-h-[40px]");
    expect(nav.className).toContain("w-[40px]");
    const sum = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "소비 요약",
    )!;
    expect(sum.className).toContain("min-h-[36px]");
    expect(sum.className).toContain(
      "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
    );
    expect(
      container
        .querySelector('[aria-label="월 달력"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("true");
  });
});

describe("날 숫자 · 날짜 머리", () => {
  it("오는 날은 fg-neutral-subtle(불투명도 0), 일 · 토는 critical · brand, 고른 날은 짙은 원(브랜드 채움 아님), 오늘은 옅은 원 + 700", () => {
    render(
      <>
        <LedgerCellNum future>1</LedgerCellNum>
        <LedgerCellNum dow={0}>2</LedgerCellNum>
        <LedgerCellNum dow={6}>3</LedgerCellNum>
        <LedgerCellNum selected>4</LedgerCellNum>
        <LedgerCellNum today>5</LedgerCellNum>
        <LedgerCellNum today selected>
          6
        </LedgerCellNum>
      </>,
    );
    const [future, sun, sat, sel, today, todaySel] = Array.from(
      container.querySelectorAll("span"),
    );
    expect(future!.className).toContain("text-fg-neutral-subtle");
    expect(future!.className).not.toContain("opacity");
    expect(sun!.className).toContain("text-fg-critical");
    expect(sat!.className).toContain("text-fg-brand");
    expect(sel!.className).toContain("bg-bg-neutral-inverted");
    expect(sel!.className).toContain("text-fg-neutral-inverted");
    expect(sel!.className).not.toContain("bg-bg-brand-solid");
    expect(today!.className).toContain("bg-bg-neutral-weak");
    expect(today!.className).toContain("font-bold");
    // 고름이 이긴다 — 오늘을 고르면 짙은 원, 굵기(700)는 남는다
    expect(todaySel!.className).toContain("bg-bg-neutral-inverted");
    expect(todaySel!.className).not.toContain("bg-bg-neutral-weak");
    expect(todaySel!.className).toContain("font-bold");
  });

  it("날짜 머리는 List Header(t4 · 500) 안 h2 — 합계는 h2 밖, 오늘 · 어제는 h2 안에 붙는다", () => {
    render(
      <LedgerDayGroup day="2026-10-15">
        <LedgerDayHead>
          <LedgerDayDate relative="오늘">26. 10. 15(목)</LedgerDayDate>
          <LedgerDaySum>12,000원</LedgerDaySum>
        </LedgerDayHead>
      </LedgerDayGroup>,
    );
    const head = container.querySelector("[data-slot=list-header]")!;
    expect(head.className).toContain("text-t4");
    expect(head.className).toContain("font-medium");
    expect(head.className).toContain("px-0");
    expect(head.querySelector("h2")?.className).toContain(
      "text-[color:inherit]",
    );
    expect(head.querySelector("h2")?.textContent).toContain("오늘");
    expect(head.querySelector("h2")?.textContent).not.toContain("12,000");
    expect(container.querySelector("[data-ledger-day]")).not.toBeNull();
  });

  it("임시 gutter 인자를 켜면 머리가 제 좌우 24 를 갖는다(px-0 이 빠진다)", () => {
    render(<LedgerDayHead gutter>x</LedgerDayHead>);
    expect(
      container.querySelector("[data-slot=list-header]")!.className,
    ).not.toContain("px-0");
  });
});

describe("머리 단추 내림", () => {
  it("왼쪽 묶음 기본 폭이 절반 − 간격이라 단추가 절반을 넘을 때만 아래로 내려간다(앱 LedgerTotalRow)", () => {
    render(
      <LedgerHead>
        <div>합계</div>
        <LedgerSumBtn>소비 요약</LedgerSumBtn>
      </LedgerHead>,
    );
    const head = container.firstElementChild!;
    expect(head.className).toContain("flex-wrap");
    expect(head.className).toContain(
      "[&>:first-child]:basis-[calc(50%-var(--spacing-x3))]",
    );
  });
});

describe("월 줄 끝 아이콘 단추", () => {
  it("마지막 단추는 오른쪽으로 11 번져 아이콘(18)이 화면 여백 24 선에 닿는다(앱 _bleedEnd)", () => {
    render(
      <LedgerMonthNav>
        <LedgerNavBtn aria-label="필터">f</LedgerNavBtn>
        <LedgerNavBtn aria-label="추가">+</LedgerNavBtn>
      </LedgerMonthNav>,
    );
    expect(container.firstElementChild!.className).toContain(
      "[&>button:last-child]:-mr-[11px]",
    );
  });
});

describe("칸 · 선", () => {
  it("스켈레톤용 empty 칸도 안의 날 숫자를 그린다 — 눌리는 칸이 아니라 div 다", () => {
    render(
      <LedgerCell empty>
        <LedgerCellNum>18</LedgerCellNum>
      </LedgerCell>,
    );
    expect(container.textContent).toBe("18");
    expect(container.querySelector("button")).toBeNull();
  });

  it("머리 아래 선은 ds Divider 한 줄이다 — 풀블리드, inset 이면 들이지 않는다", () => {
    render(
      <>
        <LedgerDivider />
        <LedgerDivider inset />
      </>,
    );
    const lines = container.querySelectorAll("div");
    expect(lines[0]!.className).toContain("-mx-global-gutter");
    // 부모 폭 + 양쪽 24 — w-full 만 두면 왼쪽만 나가고 오른쪽 24 가 모자라다
    expect(lines[0]!.className).toContain(
      "w-[calc(100%+2*var(--spacing-global-gutter))]",
    );
    expect(lines[0]!.className).toContain("bg-stroke-neutral-subtle");
    expect(lines[1]!.className).not.toContain("-mx-global-gutter");
  });
});

describe("원장 머리 — 달 이동 줄 · 주 달력은 남고 총액만 숨는다", () => {
  function Harness({ days }: { days: string[] }) {
    const { rootRef, pinRef, selected } = useLedgerScroll({
      initialSelected: days[0] ?? null,
    });
    return (
      <div className="m-scroll" data-testid="scroll">
        <LedgerShell ref={rootRef}>
          <LedgerBar top={56}>
            <LedgerMonthNav>
              <LedgerNavBtn aria-label="필터">f</LedgerNavBtn>
            </LedgerMonthNav>
          </LedgerBar>
          <LedgerPin ref={pinRef} top={56}>
            <LedgerHead>
              <div>총액</div>
              <LedgerSumBtn>소비 요약</LedgerSumBtn>
            </LedgerHead>
            <LedgerKeep>
              <output data-testid="sel">{selected}</output>
              <LedgerExpand aria-label="월 달력" />
              <LedgerDivider />
            </LedgerKeep>
          </LedgerPin>
          <LedgerList>
            {days.map((d) => (
              <LedgerDayGroup key={d} day={d}>
                {d}
              </LedgerDayGroup>
            ))}
          </LedgerList>
        </LedgerShell>
      </div>
    );
  }

  it("달 이동 줄은 Pin 밖의 sticky(z-3) 이고, 주 달력 · 꺾쇠는 Pin 안 Keep 에, 총액 · 요약 단추는 Keep 위(숨는 부분)에 있다", () => {
    render(<Harness days={["2026-10-29"]} />);
    const bar = container.querySelector<HTMLElement>("[data-ledger-bar]")!;
    const pin = container.querySelector<HTMLElement>(
      "[data-scroll-auto-hide]",
    )!;
    const keep = pin.querySelector<HTMLElement>("[data-ledger-keep]")!;
    expect(bar.className.split(" ")).toEqual(
      expect.arrayContaining(["sticky", "z-3", "bg-bg-layer-default"]),
    );
    expect(bar.style.top).toBe("56px");
    expect(pin.contains(bar)).toBe(false);
    // Pin 은 상단 바 + 달 줄 높이 아래에 붙는다
    expect(pin.style.top).toBe("calc(56px + var(--ledger-bar-h, 0px))");
    expect(keep.querySelector('[aria-label="월 달력"]')).not.toBeNull();
    const sum = Array.from(pin.querySelectorAll("button")).find(
      (b) => b.textContent === "소비 요약",
    )!;
    expect(keep.contains(sum)).toBe(false);
    // 달 줄 높이를 셸에 적는다(jsdom 은 높이 0)
    expect(bar.parentElement!.style.getPropertyValue("--ledger-bar-h")).toBe(
      "0px",
    );
  });

  it("목록을 내리면 고른 날이 Pin 아래 맨 위 날짜 묶음을 따라간다(스크롤 스파이)", () => {
    const days = ["2026-10-29", "2026-10-27", "2026-10-21", "2026-10-15"];
    render(<Harness days={days} />);
    const scroll = container.querySelector<HTMLElement>(
      "[data-testid=scroll]",
    )!;
    const pin = container.querySelector<HTMLElement>(
      "[data-scroll-auto-hide]",
    )!;
    const groups = Array.from(
      container.querySelectorAll<HTMLElement>("[data-ledger-day]"),
    );
    // 남는 머리(달 줄 + 주 달력)의 아래 끝 200 — 묶음 윗변을 스크롤 거리만큼 올린다
    pin.getBoundingClientRect = () => ({ bottom: 200 }) as DOMRect;
    let offset = 0;
    groups.forEach((g, i) => {
      g.getBoundingClientRect = () =>
        ({ top: 240 + i * 300 - offset }) as DOMRect;
    });
    const sel = () => container.querySelector("[data-testid=sel]")!.textContent;
    const scrollBy = (y: number) => {
      offset = y;
      act(() => {
        scroll.dispatchEvent(new Event("scroll"));
      });
    };
    expect(sel()).toBe("2026-10-29");
    scrollBy(320); // 둘째 묶음 윗변 220 ≤ 200 + 28
    expect(sel()).toBe("2026-10-27");
    scrollBy(900); // 넷째 묶음 윗변 240
    expect(sel()).toBe("2026-10-21");
    scrollBy(1000);
    expect(sel()).toBe("2026-10-15");
    scrollBy(0);
    expect(sel()).toBe("2026-10-29");
  });

  it("짧은 목록 — 숨는 부분은 높이를 접지 않고(transform 만) 남는 부분도 그대로라 스크롤 끝이 줄지 않는다(깜빡임 없음)", () => {
    render(<Harness days={["2026-10-29"]} />);
    const scroll = container.querySelector<HTMLElement>(
      "[data-testid=scroll]",
    )!;
    const pin = container.querySelector<HTMLElement>(
      "[data-scroll-auto-hide]",
    )!;
    act(() => {
      scroll.dispatchEvent(new Event("scroll"));
    });
    expect(pin.style.height).toBe("");
    expect(pin.style.maxHeight).toBe("");
    expect(container.querySelector("[data-ledger-collapse]")).toBeNull();
    expect(pin.querySelector("[data-ledger-keep]")).not.toBeNull();
    expect(pin.textContent).toContain("총액");
  });
});

describe("펼친 월 달력 — 펼친 채 내리기 시작하면 고른 날이 든 주로 접는다", () => {
  function Harness() {
    const [expanded, setExpanded] = React.useState(true);
    const { rootRef, pinRef, selected } = useLedgerScroll({
      initialSelected: "2026-10-22",
      expanded,
      onCollapse: () => setExpanded(false),
    });
    return (
      <div className="m-scroll" data-testid="scroll">
        <LedgerShell ref={rootRef}>
          <LedgerPin ref={pinRef}>
            <LedgerKeep>
              <output data-testid="sel">{selected}</output>
              <LedgerExpand
                aria-label="월 달력"
                expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              />
            </LedgerKeep>
          </LedgerPin>
          <LedgerList>
            {["2026-10-29", "2026-10-22"].map((d) => (
              <LedgerDayGroup key={d} day={d}>
                {d}
              </LedgerDayGroup>
            ))}
          </LedgerList>
        </LedgerShell>
      </div>
    );
  }

  function setup() {
    render(<Harness />);
    const scroll = container.querySelector<HTMLElement>(
      "[data-testid=scroll]",
    )!;
    let top = 0;
    Object.defineProperty(scroll, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    });
    // 스파이가 22 를 그대로 고르게 — 22 묶음 윗변이 머리 아래 선 안
    const pin = container.querySelector<HTMLElement>(
      "[data-scroll-auto-hide]",
    )!;
    pin.getBoundingClientRect = () => ({ bottom: 400 }) as DOMRect;
    const groups = container.querySelectorAll<HTMLElement>("[data-ledger-day]");
    groups[0]!.getBoundingClientRect = () =>
      ({ top: 100, bottom: 380 }) as DOMRect;
    groups[1]!.getBoundingClientRect = () =>
      ({ top: 380, bottom: 700 }) as DOMRect;
    const scrollTo = (y: number) => {
      top = y;
      act(() => {
        scroll.dispatchEvent(new Event("scroll"));
      });
    };
    const expanded = () =>
      container
        .querySelector('[aria-label="월 달력"]')!
        .getAttribute("aria-expanded");
    const sel = () => container.querySelector("[data-testid=sel]")!.textContent;
    return { scrollTo, expanded, sel };
  }

  it("맨 위(0)에서는 펼친 채로 있고, 20 미만 내림은 접지 않는다", () => {
    const { scrollTo, expanded } = setup();
    expect(expanded()).toBe("true");
    scrollTo(0);
    expect(expanded()).toBe("true");
    scrollTo(19);
    expect(expanded()).toBe("true");
  });

  it("20 이상 내리면 접히고(꺾쇠 ∨) 고른 날은 그대로다", () => {
    const { scrollTo, expanded, sel } = setup();
    scrollTo(10);
    scrollTo(30);
    expect(expanded()).toBe("false");
    expect(sel()).toBe("2026-10-22");
  });

  it("접은 뒤 맨 위 묶음의 화면 y 가 바뀌었으면 그만큼 scrollTop 을 당기고, 머리 숨김에 sync 를 알린다", () => {
    const { scrollTo, expanded } = setup();
    const scroll = container.querySelector<HTMLElement>(
      "[data-testid=scroll]",
    )!;
    const groups = container.querySelectorAll<HTMLElement>("[data-ledger-day]");
    // 접히면 달력이 268 줄어 묶음이 268 위로 간다 — 펼침 여부로 rect 를 바꾼다
    const isOpen = () => expanded() === "true";
    groups[0]!.getBoundingClientRect = () =>
      ({ top: isOpen() ? 100 : -168, bottom: isOpen() ? 420 : 152 }) as DOMRect;
    let synced = 0;
    scroll.addEventListener(SCROLL_AUTO_HIDE_SYNC_EVENT, () => synced++);
    scrollTo(300);
    expect(expanded()).toBe("false");
    expect(scroll.scrollTop).toBe(300 - 268);
    expect(synced).toBe(1);
  });

  it("위로 올렸다가 다시 내리면 가장 위로 간 자리부터 20 을 센다", () => {
    const { scrollTo, expanded } = setup();
    scrollTo(500);
    act(() => {
      container.querySelector<HTMLElement>('[aria-label="월 달력"]')!.click();
    });
    expect(expanded()).toBe("true");
    scrollTo(450);
    scrollTo(465);
    expect(expanded()).toBe("true");
    scrollTo(470);
    expect(expanded()).toBe("false");
  });
});

describe("날 누름 이동 — 묶음 윗변이 고정 덩어리 아래 끝에 딱 붙는다(틈 0)", () => {
  type Api = {
    scrollToDay: (ds: string) => void;
    setSelected: (ds: string) => void;
  };
  function Harness({ onApi }: { onApi: (api: Api) => void }) {
    const { rootRef, pinRef, selected, setSelected, scrollToDay } =
      useLedgerScroll({ initialSelected: "2026-10-22" });
    React.useEffect(() => {
      onApi({ scrollToDay, setSelected });
    });
    return (
      <div className="m-scroll" data-testid="scroll">
        <LedgerShell ref={rootRef}>
          <LedgerPin ref={pinRef}>
            <LedgerHead>총액</LedgerHead>
            <LedgerKeep>
              <output data-testid="sel">{selected}</output>
            </LedgerKeep>
          </LedgerPin>
          <LedgerList>
            {["2026-10-29", "2026-10-22"].map((d) => (
              <LedgerDayGroup key={d} day={d}>
                {d}
              </LedgerDayGroup>
            ))}
          </LedgerList>
        </LedgerShell>
      </div>
    );
  }

  // 머리: sticky top 0 · 높이 215 · 숨는 높이(Keep 윗변) 65 — 남는 덩어리 150. 상자 맨 위 0.
  function setup(scrollTop: number) {
    let api!: Api;
    render(<Harness onApi={(a) => (api = a)} />);
    const scroll = container.querySelector<HTMLElement>(
      "[data-testid=scroll]",
    )!;
    const pin = container.querySelector<HTMLElement>(
      "[data-scroll-auto-hide]",
    )!;
    const keep = pin.querySelector<HTMLElement>("[data-ledger-keep]")!;
    let top = scrollTop;
    const calls: number[] = [];
    Object.defineProperty(scroll, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    });
    scroll.scrollTo = ((o: ScrollToOptions) => {
      calls.push(o.top ?? 0);
      top = Math.max(0, o.top ?? 0);
    }) as typeof scroll.scrollTo;
    scroll.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    Object.defineProperty(pin, "offsetHeight", { value: 215 });
    Object.defineProperty(keep, "offsetTop", { value: 65 });
    const groups = container.querySelectorAll<HTMLElement>("[data-ledger-day]");
    // 내용 안 위치: 29 = 215, 22 = 1215 — 화면 y = 내용 위치 − scrollTop
    const at = [215, 1215];
    groups.forEach((g, i) => {
      g.getBoundingClientRect = () =>
        ({ top: at[i]! - top, bottom: at[i]! - top + 900 }) as DOMRect;
    });
    pin.getBoundingClientRect = () =>
      ({ bottom: top > 0 ? 150 : 215 }) as DOMRect;
    const sel = () => container.querySelector("[data-testid=sel]")!.textContent;
    const fire = () =>
      act(() => {
        scroll.dispatchEvent(new Event("scroll"));
      });
    return { api: () => api, calls, sel, fire, scrollTop: () => top };
  }

  it("내려갈 때 — 남는 덩어리(150) 아래 끝에 틈 없이", () => {
    const { api, calls } = setup(0);
    act(() => api().scrollToDay("2026-10-22"));
    // 1215 − (215 − 65) = 1065 → 화면 y 1215 − 1065 = 150 = 덩어리 아래 끝
    expect(calls).toEqual([1065]);
  });

  it("올라갈 때 — 머리 전체(215) 아래 끝에 틈 없이, 맨 위를 넘으면 0", () => {
    const { api, calls } = setup(2000);
    act(() => api().scrollToDay("2026-10-22"));
    expect(calls).toEqual([1215 - 215]);
    act(() => api().scrollToDay("2026-10-29"));
    expect(calls[1]).toBe(0);
  });

  it("스크롤 0 에서도 고른 날이 맞다 — 맨 위 묶음(29)이 머리 아래 끝에 붙어 스파이 기준선(+28) 안", () => {
    const { api, sel, fire, scrollTop } = setup(1065);
    fire();
    expect(sel()).toBe("2026-10-22");
    act(() => {
      api().setSelected("2026-10-29");
      api().scrollToDay("2026-10-29");
    });
    expect(scrollTop()).toBe(0);
    fire();
    expect(sel()).toBe("2026-10-29");
  });
});
