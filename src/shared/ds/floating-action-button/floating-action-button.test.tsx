// Floating Action Button 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 잴 수 없는 값(fixed · 그림자 · 누름 축소 · 안전 영역 식)은 여기서 클래스를 본다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FloatingActionButton } from ".";
import { SnackbarProvider } from "@/shared/ds/snackbar";

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
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.querySelector("button") as HTMLButtonElement;
}

const Icon = (props: { "aria-hidden"?: boolean }) => (
  <svg data-testid="icon" {...props} />
);

describe("FloatingActionButton", () => {
  it("<button type=button> — 이름은 aria-label 이고 보이는 글이 없다(폼 안에서 제출되지 않는다)", () => {
    const submit = vi.fn((e: Event) => e.preventDefault());
    const form = document.createElement("form");
    form.addEventListener("submit", submit);
    document.body.appendChild(form);
    const formRoot = createRoot(form);
    act(() =>
      formRoot.render(
        <FloatingActionButton icon={<Icon />} aria-label="할 일 추가" />,
      ),
    );
    const button = form.querySelector("button") as HTMLButtonElement;
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("할 일 추가");
    expect(button.textContent).toBe("");
    act(() => {
      button.click();
    });
    expect(submit).not.toHaveBeenCalled();
    act(() => formRoot.unmount());
    form.remove();
  });

  it("아이콘은 장식이다(aria-hidden) — 이미 달려 있지 않아도 단다", () => {
    const button = render(
      <FloatingActionButton icon={<Icon />} aria-label="할 일 추가" />,
    );
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("누르면 onClick 을 부른다 · ref 와 나머지 속성을 건넨다 · 막으면 누르지 못한다", () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const button = render(
      <FloatingActionButton
        ref={ref}
        icon={<Icon />}
        aria-label="할 일 추가"
        id="fab"
        onClick={onClick}
      />,
    );
    expect(ref.current).toBe(button);
    expect(button.id).toBe("fab");
    act(() => {
      button.click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);

    const blocked = render(
      <FloatingActionButton
        icon={<Icon />}
        aria-label="할 일 추가"
        disabled
        onClick={onClick}
      />,
    );
    act(() => {
      blocked.click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("원 56 · 브랜드 채움 · 흰 아이콘 24(선 2.5) · 그림자 s3 — 글 · 색을 바꾸는 속성이 없다", () => {
    const { className } = render(
      <FloatingActionButton icon={<Icon />} aria-label="할 일 추가" />,
    );
    expect(className).toContain("size-[56px]");
    expect(className).toContain("rounded-full");
    expect(className).toContain("bg-bg-brand-solid");
    expect(className).toContain("text-static-white");
    expect(className).toContain("shadow-[var(--shadow-s3)]");
    expect(className).toContain("[&>svg]:size-[24px]");
    expect(className).toContain("[&>svg]:[stroke-width:2.5]");
  });

  it("오른쪽 아래 fixed — 화면 끝 · 아래에서 20 + 안전 영역 · z-sticky(스크롤해도 그 자리 · 숨지 않는다)", () => {
    const { className } = render(
      <FloatingActionButton icon={<Icon />} aria-label="할 일 추가" />,
    );
    expect(className).toContain("fixed");
    expect(className).toContain("z-(--z-sticky)");
    expect(className).toContain(
      "right-[calc(20px+env(safe-area-inset-right))]",
    );
    expect(className).toContain(
      "bottom-[calc(20px+env(safe-area-inset-bottom)+var(--fab-offset-bottom,0px))]",
    );
    expect(className).not.toMatch(/translate|hidden|scroll/);
  });

  it("offsetBottom — 아래 고정 요소의 높이만큼 위에 선다(--fab-offset-bottom), 주지 않으면 변수를 두지 않는다", () => {
    const plain = render(
      <FloatingActionButton icon={<Icon />} aria-label="할 일 추가" />,
    );
    expect(plain.style.getPropertyValue("--fab-offset-bottom")).toBe("");
    const lifted = render(
      <FloatingActionButton
        icon={<Icon />}
        aria-label="더치페이 만들기"
        offsetBottom={64}
        style={{ opacity: 1 }}
      />,
    );
    expect(lifted.style.getPropertyValue("--fab-offset-bottom")).toBe("64px");
    // 쓰는 쪽의 style 은 그대로 남는다
    expect(lifted.style.opacity).toBe("1");
  });

  it("상태 — 호버 · 누름은 누름 색, 누르면 2px 거리 축소(56 → 0.964) · 모션 줄이기면 없다 · 키보드 포커스에만 원 바깥 2px 링", () => {
    const { className } = render(
      <FloatingActionButton icon={<Icon />} aria-label="할 일 추가" />,
    );
    expect(className).toContain("hover:bg-bg-brand-solid-pressed");
    expect(className).toContain("active:bg-bg-brand-solid-pressed");
    expect(className).toContain("active:[scale:calc(1-2/56)]");
    expect(className).toContain("motion-reduce:active:[scale:1]");
    expect(className).toContain("focus-visible:outline-2");
    expect(className).toContain("focus-visible:outline-offset-2");
    expect(className).toContain("focus-visible:outline-stroke-focus-ring");
    // 모션 — 색 · 축소
    expect(className).toContain("--motion-duration-color-transition");
    expect(className).toContain("--motion-duration-pressed-scale");
  });

  it("className 은 합쳐진다", () => {
    const { className } = render(
      <FloatingActionButton
        icon={<Icon />}
        aria-label="할 일 추가"
        className="custom"
      />,
    );
    expect(className).toContain("custom");
    expect(className).toContain("size-[56px]");
  });
});

describe("FloatingActionButton — 스낵바 피하기(L6)", () => {
  it("스낵바 띠는 이 버튼 윗변 위 8 에 선다 — 감싼 요소가 버튼이라 ref 가 버튼에 닿는다", () => {
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      800,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return (
          this.dataset.slot === "floating-action-button"
            ? { top: 724, width: 56, height: 56 }
            : { top: 800, width: 0, height: 0 }
        ) as DOMRect;
      },
    );
    const ref = createRef<HTMLButtonElement>();
    act(() =>
      root.render(
        <SnackbarProvider>
          <FloatingActionButton
            ref={ref}
            icon={<Icon />}
            aria-label="할 일 추가"
          />
        </SnackbarProvider>,
      ),
    );
    // 사용자가 넘긴 ref 도 버튼에 그대로 닿는다
    expect(ref.current).toBe(container.querySelector("button"));
    const region = document.querySelector<HTMLElement>(
      "[data-slot=snackbar-region]",
    )!;
    expect(region.style.getPropertyValue("--snackbar-avoid")).toBe("76px");
  });

  it("Provider 밖에서도 그냥 그려진다", () => {
    const button = render(
      <FloatingActionButton icon={<Icon />} aria-label="할 일 추가" />,
    );
    expect(button).not.toBeNull();
  });
});
