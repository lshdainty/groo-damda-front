// Popover 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "./popover";
import {
  POPOVER,
  POPOVER_BODY,
  POPOVER_BODY_FOG,
  POPOVER_CLOSE,
  POPOVER_POSITION,
} from "./popover-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom 에 없다 — Radix · 본문 스크롤 측정이 쓴다
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom 은 배치를 하지 않아 모든 칸이 "안 보인다" 로 나온다 — 초점 순서를 보려고 보이는 것으로 친다
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    {} as DOMRect,
  ] as unknown as DOMRectList);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

// Radix 는 닫힌 뒤 초점 되돌리기 · 바깥 누르기 듣기를 다음 틱에 한다
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const trigger = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=popover-trigger]")!;
const surface = () =>
  document.querySelector<HTMLElement>("[data-slot=popover-content]");
const closeButton = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=popover-close]");

function key(el: Element, k: string, init: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

function Info({
  title = "연차 사용 규정",
  description,
  ariaLabel,
  onOpenChange,
  children,
}: {
  title?: string;
  description?: string;
  ariaLabel?: string;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <>
      <Popover onOpenChange={onOpenChange}>
        <PopoverTrigger aria-label="연차 사용 규정">ⓘ</PopoverTrigger>
        <PopoverContent
          title={title || undefined}
          description={description}
          aria-label={ariaLabel}
        >
          <PopoverBody>
            {children ?? (
              <>
                <p>입사 1년 미만은 한 달에 1일씩 생겨요.</p>
                <button type="button" data-testid="first">
                  첫 칸
                </button>
                <button type="button" data-testid="last">
                  마지막 칸
                </button>
              </>
            )}
          </PopoverBody>
        </PopoverContent>
      </Popover>
      <button type="button" data-testid="outside">
        다음 칸
      </button>
    </>
  );
}

const byId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid=${id}]`)!;

function open() {
  act(() => {
    trigger().focus();
    trigger().click();
  });
}

// 스펙 값(생성물 — 읽기만 한다). 검사기가 CSS 로 잴 수 없는 값(자리 계산 · 상한)을 여기서 맞춘다
type SpecJson = {
  rules: {
    when: Record<string, string>;
    enabled?: Record<string, Record<string, unknown>>;
  }[];
};
const SPEC = Object.values(
  import.meta.glob<SpecJson>("../spec/popover.json", {
    eager: true,
    import: "default",
  }),
)[0]!;
const BASE = SPEC.rules.find((r) => Object.keys(r.when).length === 0)!.enabled!;

describe("Popover — 스펙 값", () => {
  it("자리는 아래 · 트리거와 8 · 가장자리 16", () => {
    expect(POPOVER_POSITION.side).toBe("bottom");
    expect(POPOVER_POSITION.sideOffset).toBe(BASE.root?.offset);
  });

  it("표면의 폭 · 높이 상한은 스펙 값", () => {
    expect(POPOVER).toContain(`min(${BASE.root?.minWidth}px,`);
    expect(POPOVER).toContain(`min(${BASE.root?.maxWidth}px,`);
    expect(POPOVER).toContain(`min(${BASE.root?.maxHeight}px,`);
    expect(POPOVER).toContain("z-(--z-floating)");
    expect(POPOVER).toContain("shadow-[var(--shadow-s3)]");
  });

  it("닫기 버튼 — 아이콘이 위 27 · 오른쪽 24, 누르면 bg-layer-floating-pressed + 2px 거리 축소", () => {
    const close = BASE.closeButton!;
    // 아이콘은 52 상자 안에서 (52 − 22) ÷ 2 = 15 안쪽이다
    const inset = (Number(close.size) - Number(close.iconSize)) / 2;
    // 100% 에서 위 27 − 15 = 12, 제목(t7 27) 줄이 높아지면 늘어난 만큼의 절반을 더 내린다(첫 줄 가운데 — header-button-position.test)
    expect(POPOVER_CLOSE).toContain(
      `top-[calc(${Number(close.top) - inset}px+(var(--text-t7--line-height)_-_27px)/2)]`,
    );
    expect(POPOVER_CLOSE).toContain(`-${inset}px`);
    expect(POPOVER_CLOSE).toContain("active:bg-bg-layer-floating-pressed");
    expect(POPOVER_CLOSE).toContain("[--press-basis:52]");
    expect(POPOVER_CLOSE).toContain("motion-reduce:active:[scale:1]");
  });

  it("끝 흐림 본문은 위 20 · 아래 80 을 비운다", () => {
    expect(POPOVER_BODY_FOG).toContain("pt-[20px]");
    expect(POPOVER_BODY_FOG).toContain("pb-[80px]");
    expect(POPOVER_BODY).toContain("overscroll-contain");
  });
});

describe("Popover", () => {
  it("닫혀 있으면 트리거는 팝업을 알리기만 한다 — aria-controls 는 열린 동안만", () => {
    render(<Info />);
    expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().hasAttribute("aria-controls")).toBe(false);
    expect(surface()).toBeNull();
  });

  it("누르면 열고 — dialog(aria-modal 없음), 제목 · 설명으로 이름과 설명, 트리거와 이어진다", () => {
    render(<Info description="연차가 생기는 방식이에요." />);
    open();
    const el = surface()!;
    expect(el.getAttribute("role")).toBe("dialog");
    expect(el.hasAttribute("aria-modal")).toBe(false);
    expect(
      document.getElementById(el.getAttribute("aria-labelledby")!)?.tagName,
    ).toBe("H2");
    expect(
      document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent,
    ).toBe("연차 사용 규정");
    expect(
      document.getElementById(el.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("연차가 생기는 방식이에요.");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(el.id);
    expect(el.dataset.side).toBe("bottom");
  });

  it("다시 누르면 닫는다", () => {
    render(<Info />);
    open();
    act(() => trigger().click());
    expect(surface()).toBeNull();
  });

  it("뒤 화면을 막지 않는다 — 딤 · 스크롤 잠금 · 숨김이 없다", () => {
    render(<Info />);
    open();
    expect(container.hasAttribute("aria-hidden")).toBe(false);
    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("열면 초점은 머리 닫기 버튼이 아니라 내용의 첫 칸으로 간다", () => {
    render(<Info />);
    open();
    expect(closeButton()).not.toBeNull();
    expect(document.activeElement).toBe(byId("first"));
  });

  it("내용에 칸이 없으면 초점은 표면으로 간다", () => {
    render(<Info>읽기만 하는 안내예요.</Info>);
    open();
    expect(document.activeElement).toBe(surface());
  });

  it("autoFocus 를 단 칸이 있으면 그 칸 — 열 때 초점을 옮기는 것은 쓰는 쪽이 막을 수도 있다", () => {
    const onOpenAutoFocus = vi.fn((e: Event) => e.preventDefault());
    render(
      <Popover>
        <PopoverTrigger>ⓘ</PopoverTrigger>
        <PopoverContent
          aria-label="날짜 고르기"
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <PopoverBody>
            <button type="button">첫 칸</button>
          </PopoverBody>
        </PopoverContent>
      </Popover>,
    );
    open();
    expect(onOpenAutoFocus).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it("머리가 없으면(title 없음) 머리 · 닫기 버튼이 없고 aria-label 이 이름이다", () => {
    render(<Info title="" ariaLabel="날짜 고르기" />);
    open();
    expect(surface()!.querySelector("[data-slot=popover-header]")).toBeNull();
    expect(closeButton()).toBeNull();
    expect(surface()!.getAttribute("aria-label")).toBe("날짜 고르기");
    expect(surface()!.hasAttribute("aria-labelledby")).toBe(false);
  });

  it('머리가 있으면 닫기 버튼은 이름 "닫기" — 누르면 닫고 초점은 트리거로', async () => {
    render(<Info />);
    open();
    expect(closeButton()!.getAttribute("aria-label")).toBe("닫기");
    act(() => closeButton()!.click());
    await tick();
    expect(surface()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("Esc 는 닫고 초점은 트리거로 돌아간다", async () => {
    render(<Info />);
    open();
    key(byId("first"), "Escape");
    await tick();
    expect(surface()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("바깥을 누르면 닫는다 — 누른 곳이 초점을 받으면 거기에 둔다", async () => {
    const onOpenChange = vi.fn();
    render(<Info onOpenChange={onOpenChange} />);
    open();
    await tick();
    act(() => {
      const outside = byId("outside");
      outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      outside.focus();
    });
    await tick();
    expect(surface()).toBeNull();
    expect(document.activeElement).toBe(byId("outside"));
    // 거듭 청해도 한 번만 알린다
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it("열린 동안 트리거에서 Tab — 표면 안(내용의 첫 칸)으로", () => {
    render(<Info />);
    open();
    act(() => trigger().focus());
    key(trigger(), "Tab");
    expect(document.activeElement).toBe(byId("first"));
  });

  it("마지막 칸에서 Tab — 초점을 트리거에 두어 브라우저가 다음 칸으로 보내게 하고, 바깥으로 나간 초점에 닫힌다", async () => {
    render(<Info />);
    open();
    await tick();
    act(() => byId("last").focus());
    key(byId("last"), "Tab");
    expect(document.activeElement).toBe(trigger());
    // 브라우저가 트리거 다음 칸으로 옮긴 셈
    act(() => byId("outside").focus());
    await tick();
    expect(surface()).toBeNull();
    expect(document.activeElement).toBe(byId("outside"));
  });

  it("가운데 칸에서 Tab 은 막지 않는다", () => {
    render(<Info />);
    open();
    act(() => byId("first").focus());
    key(byId("first"), "Tab");
    expect(document.activeElement).toBe(byId("first"));
    expect(surface()).not.toBeNull();
  });

  it("첫 칸(머리가 있으면 닫기 버튼)에서 Shift+Tab — 트리거로, 표면은 열린 채. 내용의 첫 칸에서는 닫기 버튼으로 거슬러 간다", () => {
    render(<Info />);
    open();
    // 내용의 첫 칸 앞에는 머리의 닫기 버튼이 있다 — 브라우저 순서에 맡긴다(막지 않는다)
    act(() => byId("first").focus());
    key(byId("first"), "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(byId("first"));
    act(() => closeButton()!.focus());
    key(closeButton()!, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(trigger());
    expect(surface()).not.toBeNull();
  });

  it("초점을 가두지 않는다 — 표면 밖 칸에 초점을 주면 닫힌다", async () => {
    render(<Info />);
    open();
    await tick();
    act(() => byId("outside").focus());
    await tick();
    expect(surface()).toBeNull();
  });

  it("처음부터 열어 둘 수 있고, 제어하는 open 은 여닫음을 쓰는 쪽이 정한다", () => {
    const onOpenChange = vi.fn();
    render(
      <Popover open onOpenChange={onOpenChange}>
        <PopoverTrigger>ⓘ</PopoverTrigger>
        <PopoverContent title="안내">
          <PopoverBody>내용</PopoverBody>
        </PopoverContent>
      </Popover>,
    );
    expect(surface()).not.toBeNull();
    act(() => closeButton()!.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(surface()).not.toBeNull();
  });

  it("띄울 자리(container)를 주면 그 안에 띄운다", () => {
    const place = document.createElement("div");
    document.body.appendChild(place);
    render(
      <Popover defaultOpen>
        <PopoverTrigger>ⓘ</PopoverTrigger>
        <PopoverContent container={place} title="안내">
          <PopoverBody>내용</PopoverBody>
        </PopoverContent>
      </Popover>,
    );
    expect(place.contains(surface())).toBe(true);
    act(() => root.render(null));
    place.remove();
  });

  it("안은 자유롭게 받는다 — 본문 없이 아무 내용이나(달력 · 목록)", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>ⓘ</PopoverTrigger>
        <PopoverContent aria-label="날짜 고르기">
          <div data-testid="grid" role="grid" />
        </PopoverContent>
      </Popover>,
    );
    expect(surface()!.querySelector("[data-testid=grid]")).not.toBeNull();
  });
});

describe("PopoverBody · PopoverFooter", () => {
  it("본문은 scrollFog 일 때만 끝 흐림 표시를 단다", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>ⓘ</PopoverTrigger>
        <PopoverContent title="안내">
          <PopoverBody scrollFog>긴 내용</PopoverBody>
        </PopoverContent>
      </Popover>,
    );
    const body = document.querySelector("[data-slot=popover-body]")!;
    expect(body.getAttribute("data-scroll-fog")).toBe("overlayBody");
    expect(body.className).toContain("pb-[80px]");
  });

  it("바닥 버튼은 크기를 주지 않은 바로 아래 자식에 small 을 넣는다 — 준 것은 그대로", () => {
    function Probe({ size, label }: { size?: string; label: string }) {
      return <i data-size={size ?? "none"}>{label}</i>;
    }
    render(
      <Popover defaultOpen>
        <PopoverTrigger>ⓘ</PopoverTrigger>
        <PopoverContent aria-label="고르기">
          <PopoverFooter>
            <Probe label="취소" />
            <>
              <Probe label="완료" />
            </>
            <Probe label="큰 것" size="large" />
            <span data-testid="plain">글</span>
          </PopoverFooter>
        </PopoverContent>
      </Popover>,
    );
    const sizes = Array.from(
      document.querySelectorAll("[data-slot=popover-footer] i"),
    ).map((el) => el.getAttribute("data-size"));
    expect(sizes).toEqual(["small", "small", "large"]);
    expect(
      document.querySelector("[data-testid=plain]")!.hasAttribute("size"),
    ).toBe(false);
  });

  it("긴 제목 · 빈 본문도 그려진다", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>ⓘ</PopoverTrigger>
        <PopoverContent title={"가".repeat(200)} description="">
          <PopoverBody />
        </PopoverContent>
      </Popover>,
    );
    expect(
      document.querySelector("[data-slot=popover-title]")!.textContent,
    ).toHaveLength(200);
    expect(
      document.querySelector("[data-slot=popover-body]")!.children,
    ).toHaveLength(0);
  });
});
