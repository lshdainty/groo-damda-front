// Tooltip 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 help-bubble 스펙(opens: hover)과 맞춘다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUBBLE_POSITION } from "@/shared/ds/help-bubble";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { CLOSE_DELAY, OPEN_DELAY, SKIP_DELAY } from "./tooltip-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
// 모듈 상태(마지막으로 닫힌 시각)가 앞 테스트에서 넘어오지 않게 시계를 테스트마다 멀리 보낸다
let clock = new Date("2026-10-15T00:00:00Z").getTime();

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  vi.useFakeTimers();
  clock += 60_000;
  vi.setSystemTime(clock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const render = (node: ReactNode) => act(() => root.render(node));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

const trigger = (name: string) =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-slot=tooltip-trigger]"),
  ).find(
    (b) => b.getAttribute("aria-label") === name || b.textContent === name,
  )!;
const bubble = () =>
  document.querySelector<HTMLElement>("[data-slot=tooltip-content]");
// 말풍선의 글 — Radix 가 읽는 이를 위해 같은 글을 숨겨 둔 사본(role=tooltip)이 안에 하나 더 있다
const textOf = (el: HTMLElement) => el.firstChild?.textContent;
const bubbles = () =>
  document.querySelectorAll<HTMLElement>("[data-slot=tooltip-content]");

const pointer = (
  el: Element,
  type: string,
  init: PointerEventInit & { relatedTarget?: EventTarget | null } = {},
) =>
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
        ...init,
      }),
    );
  });
// 마우스를 트리거 위로 — React 의 onPointerEnter 는 pointerover 로, Radix 는 pointermove 로 알아챈다
const enter = (el: Element, pointerType = "mouse") => {
  pointer(el, "pointerover", { pointerType });
  pointer(el, "pointermove", { pointerType });
};
const leave = (el: Element) =>
  pointer(el, "pointerout", { relatedTarget: document.body });

function Pair({
  onOpenChange,
  disabled,
  text = "금액 가리기",
}: {
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  text?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip onOpenChange={onOpenChange} disabled={disabled}>
        <TooltipTrigger aria-label="금액 가리기">가</TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger aria-label="알림">나</TooltipTrigger>
        <TooltipContent>알림</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("여는 방식", () => {
  it("마우스를 올리면 200ms 뒤에 연다", () => {
    render(<Pair />);
    enter(trigger("금액 가리기"));
    advance(OPEN_DELAY - 1);
    expect(bubble()).toBeNull();
    advance(1);
    expect(bubble()).not.toBeNull();
    expect(textOf(bubble()!)).toBe("금액 가리기");
  });

  it("트리거와 말풍선을 모두 벗어나면 100ms 뒤에 닫는다", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    enter(t);
    advance(OPEN_DELAY);
    leave(t);
    advance(CLOSE_DELAY - 1);
    expect(bubble()).not.toBeNull();
    advance(1 + 400); // 사라짐 모션이 끝나 Radix 가 지울 때까지
    expect(bubble()).toBeNull();
  });

  it("말풍선 위로 옮기는 동안은 닫히지 않는다(WCAG 1.4.13)", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    enter(t);
    advance(OPEN_DELAY);
    leave(t);
    advance(CLOSE_DELAY - 10);
    pointer(bubble()!, "pointerover");
    advance(1000);
    expect(bubble()).not.toBeNull();
    // 말풍선도 벗어나면 100ms 뒤 닫힌다
    pointer(bubble()!, "pointerout", { relatedTarget: document.body });
    advance(CLOSE_DELAY + 400);
    expect(bubble()).toBeNull();
  });

  it("손가락(touch)으로는 열지 않는다", () => {
    render(<Pair />);
    enter(trigger("금액 가리기"), "touch");
    advance(2000);
    expect(bubble()).toBeNull();
  });

  it("마우스로 눌러 생긴 초점에는 열지 않는다(키보드 초점에만 바로 연다)", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    // 포인터로 눌러 초점이 온 경우 — :focus-visible 이 아니다
    vi.spyOn(t, "matches").mockImplementation(
      (selector: string) =>
        selector !== ":focus-visible" &&
        Element.prototype.matches.call(t, selector),
    );
    act(() => t.focus());
    advance(2000);
    expect(bubble()).toBeNull();
  });

  it("키보드 초점이 오면 기다리지 않고 바로 연다 — 초점이 떠나면 닫는다", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    vi.spyOn(t, "matches").mockImplementation(
      (selector: string) =>
        selector === ":focus-visible" ||
        Element.prototype.matches.call(t, selector),
    );
    act(() => t.focus());
    expect(bubble()).not.toBeNull();
    // 초점이 있는 동안 포인터가 지나가도 닫지 않는다
    enter(t);
    leave(t);
    advance(CLOSE_DELAY + 500);
    expect(bubble()).not.toBeNull();
    act(() => t.blur());
    advance(500);
    expect(bubble()).toBeNull();
  });

  it("손가락으로 누른 뒤 스크립트가 옮긴 초점에는 열지 않는다 — :focus-visible 을 이어받아도 직전 입력이 포인터면 키보드 초점이 아니다", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    vi.spyOn(t, "matches").mockImplementation(
      (selector: string) =>
        selector === ":focus-visible" ||
        Element.prototype.matches.call(t, selector),
    );
    document.documentElement.dataset.input = "pointer";
    try {
      act(() => t.focus());
      advance(2000);
      expect(bubble()).toBeNull();
      act(() => t.blur());
      // 키보드로 오면 연다
      document.documentElement.dataset.input = "keyboard";
      act(() => t.focus());
      expect(bubble()).not.toBeNull();
    } finally {
      delete document.documentElement.dataset.input;
    }
  });

  it("Esc 는 닫고 초점은 트리거에 그대로", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    vi.spyOn(t, "matches").mockImplementation(
      (selector: string) =>
        selector === ":focus-visible" ||
        Element.prototype.matches.call(t, selector),
    );
    act(() => t.focus());
    expect(bubble()).not.toBeNull();
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    advance(500);
    expect(bubble()).toBeNull();
    expect(document.activeElement).toBe(t);
  });

  it("트리거를 누르면 열지도 닫지도 않는다 — 기다리던 열기도 거둔다", () => {
    const onClick = vi.fn();
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger aria-label="금액 가리기" onClick={onClick}>
            가
          </TooltipTrigger>
          <TooltipContent>금액 가리기</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const t = trigger("금액 가리기");
    enter(t);
    advance(100);
    pointer(t, "pointerdown");
    advance(2000);
    expect(bubble()).toBeNull();
    act(() => t.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(bubble()).toBeNull();
    // 트리거를 떠났다가 다시 올리면 다시 기다린다
    leave(t);
    enter(t);
    advance(OPEN_DELAY);
    expect(bubble()).not.toBeNull();
  });

  it("열려 있는 툴팁을 눌러도 닫히지 않는다(누름은 트리거의 동작)", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    enter(t);
    advance(OPEN_DELAY);
    pointer(t, "pointerdown");
    act(() => t.click());
    advance(500);
    expect(bubble()).not.toBeNull();
  });

  it("옆 트리거로 옮기면 기다리지 않고 모션 없이 바로 바꿔 연다 — 한 번에 하나만", () => {
    render(<Pair />);
    const a = trigger("금액 가리기");
    const b = trigger("알림");
    enter(a);
    advance(OPEN_DELAY);
    expect(bubbles()).toHaveLength(1);
    leave(a);
    enter(b);
    // 기다림 없이 — 앞의 것은 바로 닫혀 하나만 남는다
    expect(bubbles()).toHaveLength(1);
    expect(textOf(bubble()!)).toBe("알림");
    expect(bubble()!.hasAttribute("data-instant")).toBe(true);
  });

  it("하나가 닫힌 지 300ms 안에 옆으로 옮겨도 바로 연다 — 지나면 다시 200ms 기다린다", () => {
    render(<Pair />);
    const a = trigger("금액 가리기");
    const b = trigger("알림");
    enter(a);
    advance(OPEN_DELAY);
    leave(a);
    advance(CLOSE_DELAY); // 닫는다 — 이 시각부터 300ms 를 센다
    advance(SKIP_DELAY - 50);
    enter(b);
    expect(bubble()).not.toBeNull();
    // 충분히 지난 뒤에는 다시 기다린다
    leave(b);
    advance(CLOSE_DELAY);
    advance(SKIP_DELAY + 50);
    enter(a);
    advance(OPEN_DELAY - 1);
    expect(bubbles().length).toBe(0);
    advance(1);
    expect(bubble()).not.toBeNull();
    expect(bubble()!.hasAttribute("data-instant")).toBe(false);
  });

  it("disabled 이면 열지 않는다(트리거는 그대로)", () => {
    render(<Pair disabled />);
    enter(trigger("금액 가리기"));
    advance(2000);
    expect(bubble()).toBeNull();
  });

  it("open 으로 제어할 수 있다 — Esc 로 닫으라고 알린다(값은 쓰는 쪽이 정한다)", () => {
    const onOpenChange = vi.fn();
    render(
      <Tooltip open onOpenChange={onOpenChange}>
        <TooltipTrigger aria-label="금액 가리기">가</TooltipTrigger>
        <TooltipContent>금액 가리기</TooltipContent>
      </Tooltip>,
    );
    expect(bubble()).not.toBeNull();
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // 제어하는 값이 그대로면 열려 있다
    expect(bubble()).not.toBeNull();
  });

  it("Provider 밖에서도 혼자 쓸 수 있다", () => {
    render(
      <Tooltip>
        <TooltipTrigger aria-label="금액 가리기">가</TooltipTrigger>
        <TooltipContent>금액 가리기</TooltipContent>
      </Tooltip>,
    );
    enter(trigger("금액 가리기"));
    advance(OPEN_DELAY);
    expect(bubble()).not.toBeNull();
  });
});

describe("접근성 — 툴팁은 보조다", () => {
  it("열려 있는 동안 트리거는 aria-describedby 로 말풍선을 가리키고, 말풍선은 role=tooltip 이다", () => {
    render(<Pair />);
    const t = trigger("금액 가리기");
    enter(t);
    advance(OPEN_DELAY);
    const hidden = document.querySelector<HTMLElement>("[role=tooltip]")!;
    expect(hidden).not.toBeNull();
    expect(t.getAttribute("aria-describedby")).toBe(hidden.id);
    expect(hidden.textContent).toBe("금액 가리기");
  });

  it("툴팁은 이름을 대신하지 않는다 — aria-label · aria-labelledby · title 을 달지 않는다", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>가</TooltipTrigger>
          <TooltipContent>금액 가리기</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const t = document.querySelector<HTMLElement>(
      "[data-slot=tooltip-trigger]",
    )!;
    // 이름이 없는 트리거에 툴팁이 이름을 채워 주지 않는다 — 이름은 쓰는 쪽의 aria-label · 보이는 글이다
    expect(t.hasAttribute("aria-label")).toBe(false);
    expect(t.hasAttribute("aria-labelledby")).toBe(false);
    expect(t.hasAttribute("title")).toBe(false);
    expect(bubble()!.hasAttribute("title")).toBe(false);
    // 설명으로만 이어진다
    expect(t.hasAttribute("aria-describedby")).toBe(true);
  });

  it("쓰는 쪽의 aria-label 은 그대로이고 툴팁 글과 따로다", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger aria-label="금액 가리기">가</TooltipTrigger>
          <TooltipContent>금액을 가려요</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const t = document.querySelector<HTMLElement>(
      "[data-slot=tooltip-trigger]",
    )!;
    expect(t.getAttribute("aria-label")).toBe("금액 가리기");
  });

  it("닫혀 있으면 말풍선이 문서에 없다 — 정보를 툴팁에만 두면 닫힌 동안(손가락 · 막힌 버튼) 읽을 수 없다", () => {
    render(<Pair text="복사할 지난달 예산이 없어요." />);
    expect(document.body.textContent).not.toContain(
      "복사할 지난달 예산이 없어요.",
    );
    expect(document.querySelector("[role=tooltip]")).toBeNull();
    // 손가락으로 눌러도 열리지 않는다
    enter(trigger("금액 가리기"), "touch");
    pointer(trigger("금액 가리기"), "pointerdown", { pointerType: "touch" });
    act(() => trigger("금액 가리기").click());
    advance(2000);
    expect(document.body.textContent).not.toContain(
      "복사할 지난달 예산이 없어요.",
    );
  });

  it("막힌 버튼은 초점을 받지 못해 키보드로 툴팁을 열 수 없다 — 이유는 가까운 글에 둔다", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button disabled aria-describedby="reason">
              지난달 예산 복사
            </button>
          </TooltipTrigger>
          <TooltipContent>툴팁에만 둔 이유</TooltipContent>
        </Tooltip>
        <p id="reason">복사할 지난달 예산이 없어요.</p>
      </TooltipProvider>,
    );
    const button = document.querySelector<HTMLButtonElement>("button")!;
    act(() => button.focus());
    // 막힌 버튼은 초점이 가지 않고, 그래서 툴팁도 열리지 않는다
    expect(document.activeElement).not.toBe(button);
    advance(2000);
    expect(bubble()).toBeNull();
    // 같은 뜻은 가까운 글에 늘 있다 — 버튼이 aria-describedby 로 가리킨다
    expect(button.getAttribute("aria-describedby")).toBe("reason");
    expect(document.getElementById("reason")!.textContent).toBe(
      "복사할 지난달 예산이 없어요.",
    );
  });
});

describe("모양", () => {
  it("Help Bubble 과 같은 말풍선 — 최대 280 · 짙은 바탕 · 화살표 · z-tooltip, 글 하나(굵게)", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger aria-label="금액 가리기">가</TooltipTrigger>
          <TooltipContent>금액 가리기</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const cls = bubble()!.className;
    expect(cls).toContain("max-w-[min(280px,");
    expect(cls).toContain("rounded-r3");
    expect(cls).toContain("bg-bg-neutral-inverted");
    expect(cls).toContain("px-x3");
    expect(cls).toContain("py-x2_5");
    expect(cls).toContain("z-(--z-tooltip)");
    expect(cls).toContain("text-t3");
    expect(cls).toContain("font-bold");
    expect(cls).toContain("break-keep");
    const arrow = bubble()!.querySelector("[data-slot=tooltip-arrow]")!;
    expect(arrow.getAttribute("viewBox")).toBe("0 0 12 8");
    expect(arrow.getAttribute("width")).toBe("12");
    expect(arrow.getAttribute("height")).toBe("8");
    expect(arrow.getAttribute("aria-hidden")).toBe("true");
  });

  it("위치 값 — 화살표 끝 ↔ 트리거 4 · 화살표 ↔ 모서리 14 · 화면 가장자리 16, 기본은 위", () => {
    expect(BUBBLE_POSITION).toEqual({
      sideOffset: 4,
      arrowPadding: 14,
      collisionPadding: 16,
    });
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger aria-label="금액 가리기">가</TooltipTrigger>
          <TooltipContent>금액 가리기</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(bubble()!.getAttribute("data-side")).toBe("top");
  });

  it("긴 글은 줄을 바꾸고(말줄임 없음) 줄바꿈 문자는 살린다", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger aria-label="예산 안내">가</TooltipTrigger>
          <TooltipContent>
            {
              "첫 줄\n둘째 줄 — 아주 긴 글이 들어와도 줄을 바꿀 뿐 잘리지 않아요"
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const cls = bubble()!.className;
    expect(cls).toContain("whitespace-pre-line");
    expect(cls).toContain("[overflow-wrap:break-word]");
    expect(cls).not.toContain("truncate");
  });

  it("열림은 모션이 있고, 이어서 열릴 때(data-instant)는 모션 없다 · 걷힌 것은 보이지 않는다", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger aria-label="금액 가리기">가</TooltipTrigger>
          <TooltipContent>금액 가리기</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const cls = bubble()!.className;
    expect(cls).toContain("data-[instant]:animate-none!");
    expect(cls).toContain("data-[cut]:invisible");
    expect(cls).toContain("motion-safe:data-[state=delayed-open]:zoom-in-90");
  });
});
