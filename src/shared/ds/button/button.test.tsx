// Button 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

describe("Button", () => {
  it("기본은 neutralSolid · medium · 글자", () => {
    const btn = render(<Button>저장</Button>);
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("bg-bg-neutral-inverted");
    expect(btn.className).toContain("min-h-[40px]");
    expect(btn.className).not.toMatch(/(^|\s)h-\[/);
    expect(btn.className).toContain("px-x4");
  });

  it("로딩이면 누르기를 삼키고 aria-busy 를 단다 — 두 번 제출 방지", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    const form = render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading onClick={onClick}>
          저장
        </Button>
      </form>,
    );
    const btn = form.querySelector("button")!;
    act(() => btn.click());
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    // 포커스를 빼앗지 않는다 — 비활성으로 만들지 않는다
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("로딩 원은 장식이다 — 버튼의 aria-busy 가 알린다", () => {
    const btn = render(<Button loading>저장</Button>);
    const circle = btn.querySelector("[data-slot=progress-circle]")!;
    expect(circle).not.toBeNull();
    expect(circle.getAttribute("aria-hidden")).toBe("true");
    // 크기 · 색은 버튼이 정한다(--progress-size · --progress-range …)
    expect(circle.getAttribute("data-size")).toBe("inherit");
    expect(circle.getAttribute("data-tone")).toBe("inherit");
  });

  it("로딩이 아니면 로딩 원이 없고 누르면 불린다", () => {
    const onClick = vi.fn();
    const btn = render(<Button onClick={onClick}>저장</Button>);
    expect(btn.querySelector("[data-slot=progress-circle]")).toBeNull();
    expect(btn.hasAttribute("aria-busy")).toBe(false);
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("비활성이면 누르지 않는다", () => {
    const onClick = vi.fn();
    const btn = render(
      <Button disabled onClick={onClick}>
        저장
      </Button>,
    );
    act(() => btn.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("누른 동작이 끝날 때까지 한 번 — onClick 이 돌려준 Promise 가 끝나기 전의 누름은 버리고, 끝나면 다시 누를 수 있다", async () => {
    let finish!: () => void;
    const onClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const btn = render(<Button onClick={onClick}>저장</Button>);
    act(() => btn.click());
    act(() => btn.click());
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("버리는 누름은 제출도 막는다 — 끝나기 전에 Enter · Space 로 다시 눌러도 폼이 한 번만 간다", async () => {
    let finish!: () => void;
    const onSubmit = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    const form = render(
      <form onSubmit={onSubmit}>
        <Button
          type="submit"
          onClick={() =>
            new Promise<void>((resolve) => {
              finish = resolve;
            })
          }
        >
          저장
        </Button>
      </form>,
    );
    const btn = form.querySelector("button")!;
    act(() => btn.click());
    act(() => btn.click());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it("Promise 가 거부돼도 잠금은 풀린다 — 거부는 그대로 넘어가 삼키지 않는다", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    let fail!: (reason: Error) => void;
    const onClick = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    const btn = render(<Button onClick={onClick}>저장</Button>);
    act(() => btn.click());
    await act(async () => {
      fail(new Error("저장 실패"));
      await new Promise((r) => setTimeout(r, 0));
    });
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(unhandled).toHaveBeenCalled();
    process.off("unhandledRejection", unhandled);
  });

  it("Promise 를 돌려주지 않으면 잠그지 않는다 — 연달아 눌러도 그때마다 불린다", () => {
    const onClick = vi.fn();
    const btn = render(<Button onClick={onClick}>저장</Button>);
    act(() => btn.click());
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("누르는 순간 축소 기준 길이를 재고, 부르는 쪽의 onPointerDown 도 부른다", () => {
    const onPointerDown = vi.fn();
    const btn = render(<Button onPointerDown={onPointerDown}>저장</Button>);
    act(() => {
      btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    // jsdom 은 크기가 0 이라 바닥값 24 — max(높이, 폭 ÷ 4, 24)
    expect(btn.style.getPropertyValue("--press-basis")).toBe("24");
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("asChild 면 자식 요소가 버튼 모양을 받는다", () => {
    const el = render(
      <Button asChild variant="brandOutline">
        <a href="/expense">가계부</a>
      </Button>,
    );
    expect(el.tagName).toBe("A");
    expect(el.className).toContain(
      "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
    );
    expect(el.className).not.toMatch(/(^|\s)border(\s|$)/);
    expect(el.className).toContain("text-fg-brand");
  });

  it("가장자리 맞춤은 그 방향 가로 여백만 0 — 크기의 여백보다 뒤에 남는다", () => {
    const btn = render(
      <Button variant="ghost" flush="left">
        더 보기
      </Button>,
    );
    // px-x4 는 남고 pl-0 이 뒤에서 왼쪽만 덮는다
    expect(btn.className).toContain("px-x4");
    expect(btn.className.indexOf("pl-0")).toBeGreaterThan(
      btn.className.indexOf("px-x4"),
    );
  });
});

/**
 * 라벨은 한 줄을 지키고 넘치면 끝을 "…" 로 줄인다(button.md "글자 크기 설정" · groo-design #263). jsdom 은 레이아웃이 없어 클래스로 본다 —
 * 버튼은 놓인 자리보다 넓어지지 않고(max-w-full), 이어진 글은 한 덩어리 span(min-w-0 truncate)이라 버튼 안에서 줄어든다.
 * 글은 DOM 에 그대로라 보조 기술은 전체 라벨을 읽는다. 아이콘은 span 밖 px 그대로다.
 */
describe("Button — 긴 라벨은 한 줄 …", () => {
  const LONG = "엑셀 파일로 모든 거래 내역을 내보내고 메일로 받기";

  it("라벨은 한 span 에서 한 줄 말줄임 · 버튼은 놓인 자리보다 넓어지지 않는다", () => {
    const btn = render(<Button>{LONG}</Button>);
    const labels = btn.querySelectorAll("[data-slot=button-label]");
    expect(labels).toHaveLength(1);
    expect(labels[0]!.className.split(" ")).toEqual(
      expect.arrayContaining(["min-w-0", "truncate"]),
    );
    expect(btn.className.split(" ")).toEqual(
      expect.arrayContaining(["max-w-full", "whitespace-nowrap"]),
    );
    // 보조 기술은 전체 라벨을 읽는다
    expect(btn.textContent).toBe(LONG);
  });

  it('나눠 쓴 글({"총 "}{n}{"개"})도 한 덩어리 — 아이콘은 span 밖 그대로(px)', () => {
    const n = 12;
    const btn = render(
      <Button>
        <svg data-testid="icon" />총 {n}개 내보내기
      </Button>,
    );
    const labels = btn.querySelectorAll("[data-slot=button-label]");
    expect(labels).toHaveLength(1);
    expect(labels[0]!.textContent).toBe("총 12개 내보내기");
    expect(btn.querySelector("[data-testid=icon]")!.parentElement).toBe(btn);
    expect(btn.className).toContain("[&_svg]:size-[16px]");
  });

  it("아이콘만 있는 버튼 · asChild 는 감싸지 않는다", () => {
    const icon = render(
      <Button layout="iconOnly" aria-label="닫기">
        <svg />
      </Button>,
    );
    expect(icon.querySelector("[data-slot=button-label]")).toBeNull();
    const link = render(
      <Button asChild>
        <a href="/x">링크</a>
      </Button>,
    );
    expect(link.tagName).toBe("A");
    expect(link.querySelector("[data-slot=button-label]")).toBeNull();
  });
});
