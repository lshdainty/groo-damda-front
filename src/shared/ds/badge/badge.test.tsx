// Badge 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Badge, BadgeGroup } from "./badge";

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

const Icon = () => <svg data-testid="icon" />;

describe("Badge", () => {
  it("기본은 weak · neutral · medium — 옅은 바탕 + 진한 글자 · 500", () => {
    const badge = render(<Badge>예정</Badge>);
    expect(badge.tagName).toBe("SPAN");
    expect(badge.dataset.slot).toBe("badge");
    expect(badge.className).toContain("bg-bg-neutral-weak");
    expect(badge.className).toContain("text-fg-neutral-muted");
    expect(badge.className).toContain("font-medium");
    expect(badge.className).toContain("min-h-x5");
    expect(badge.className).toContain("text-t1-static");
  });

  it("누르지 않는다 — 역할 · 포커스가 없고 글이 앞뒤 글과 이어 읽힌다", () => {
    const badge = render(<Badge tone="critical">연체 3</Badge>);
    expect(badge.hasAttribute("role")).toBe(false);
    expect(badge.hasAttribute("tabindex")).toBe(false);
    expect(badge.className).toContain("cursor-default");
    expect(badge.textContent).toBe("연체 3");
  });

  it("글은 한 줄 — 부모가 좁을 때만 말줄임하고 글 전체는 DOM 에 남는다", () => {
    const badge = render(<Badge>한도 초과 — 이번 달 카드</Badge>);
    const label = badge.querySelector("[data-slot=badge-label]")!;
    expect(label.className).toContain("truncate");
    expect(label.className).toContain("min-w-0");
    expect(label.textContent).toBe("한도 초과 — 이번 달 카드");
    // 최대 폭이 없다 — max-w 를 걸지 않는다
    expect(badge.className).not.toMatch(/\bmax-w-/);
  });

  it("앞 아이콘은 보조 기술에 숨기고 크기는 배지가 정한다(12 · 14)", () => {
    const medium = render(<Badge prefixIcon={<Icon />}>편집 가능</Badge>);
    const icon = medium.querySelector("[data-slot=badge-prefix-icon]")!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.className).toContain("[&>svg]:size-x3");
    expect(icon.querySelector("[data-testid=icon]")).not.toBeNull();
    // 아이콘이 글보다 앞이다
    expect(medium.firstElementChild).toBe(icon);

    const large = render(
      <Badge size="large" prefixIcon={<Icon />}>
        편집 가능
      </Badge>,
    );
    expect(
      large.querySelector("[data-slot=badge-prefix-icon]")!.className,
    ).toContain("[&>svg]:size-x3_5");
  });

  it("앞 아이콘이 없으면(null · false) 칸을 두지 않는다", () => {
    const none = render(<Badge prefixIcon={null}>예정</Badge>);
    expect(none.querySelector("[data-slot=badge-prefix-icon]")).toBeNull();
    const off = render(<Badge prefixIcon={false}>예정</Badge>);
    expect(off.querySelector("[data-slot=badge-prefix-icon]")).toBeNull();
  });

  it("solid 는 채움 + 흰 글자 · 700, 중립 solid 는 뒤집힌 면 + 뒤집힌 글자", () => {
    const warning = render(
      <Badge variant="solid" tone="warning">
        만료 임박
      </Badge>,
    );
    expect(warning.className).toContain("bg-bg-warning-solid");
    expect(warning.className).toContain("text-static-white");
    expect(warning.className).toContain("font-bold");

    const neutral = render(<Badge variant="solid">단종</Badge>);
    expect(neutral.className).toContain("bg-bg-neutral-inverted");
    expect(neutral.className).toContain("text-fg-neutral-inverted");
  });

  it("outline 은 안쪽 1px 옅은 선 — 그림자라 상자 크기가 변하지 않는다", () => {
    const badge = render(
      <Badge variant="outline" tone="positive">
        편집 가능
      </Badge>,
    );
    expect(badge.className).toContain("bg-transparent");
    expect(badge.className).toContain("text-fg-positive");
    expect(badge.className).toContain("[--badge-stroke-width:1px]");
    expect(badge.className).toContain(
      "[--badge-stroke-color:var(--color-stroke-positive-weak)]",
    );
    // 테두리(border)를 쓰지 않는다
    expect(badge.className).not.toMatch(/(^|\s)border(-|\s|$)/);
  });

  it("large 는 24 · 좌우 8 · 위아래 4 · 모서리 6 · t2-static", () => {
    const badge = render(<Badge size="large">신용</Badge>);
    expect(badge.className).toContain("min-h-x6");
    expect(badge.className).toContain("px-x2");
    expect(badge.className).toContain("py-x1");
    expect(badge.className).toContain("rounded-r1_5");
    expect(badge.className).toContain("text-t2-static");
  });

  it("쓰는 쪽의 className · ref 를 받는다", () => {
    const ref = createRef<HTMLSpanElement>();
    const badge = render(
      <Badge ref={ref} className="shrink-0">
        예정
      </Badge>,
    );
    expect(ref.current).toBe(badge);
    expect(badge.className).toContain("shrink-0");
  });
});

describe("BadgeGroup", () => {
  it("배지 사이 4, 줄을 바꾸지 않는다", () => {
    const group = render(
      <BadgeGroup>
        <Badge size="large">신용</Badge>
        <Badge size="large" variant="solid">
          단종
        </Badge>
      </BadgeGroup>,
    );
    expect(group.dataset.slot).toBe("badge-group");
    expect(group.className).toContain("gap-x1");
    expect(group.className).toContain("flex-nowrap");
    expect(group.querySelectorAll("[data-slot=badge]")).toHaveLength(2);
  });
});
