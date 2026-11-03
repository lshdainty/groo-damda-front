// List · List Header 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 검사기가 못 재는 값(누르는 영역 · 누름 축소 · 전환 시간 · 하위 줄 접힘 — list.measure.mjs 머리)은 여기서 클래스 · 속성으로 본다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as variants from "./list-variants";
import {
  List,
  ListButtonItem,
  ListCheckGroup,
  ListCheckItem,
  ListDivider,
  ListHeader,
  ListItem,
  ListLinkItem,
  ListParentItem,
  ListRadioGroup,
  ListRadioItem,
  ListSwitchItem,
  ListTile,
} from "./list";

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
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

const classes = (el: Element) => (el.getAttribute("class") ?? "").split(" ");
const slot = (name: string, from: ParentNode = container) =>
  from.querySelector<HTMLElement>(`[data-slot=${name}]`)!;
const slots = (name: string, from: ParentNode = container) =>
  Array.from(from.querySelectorAll<HTMLElement>(`[data-slot=${name}]`));
const byText = (text: string) =>
  Array.from(container.querySelectorAll<HTMLElement>("button, a, [role]")).find(
    (el) => el.textContent?.includes(text),
  )!;
const click = (el: Element) => act(() => (el as HTMLElement).click());
// 문서 순서로 Tab 이 닿는 것 — 막힌 것 · 숨긴 것 · tabindex -1 은 빠진다
const tabStops = () =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      "button, a[href], input, [tabindex]",
    ),
  ).filter(
    (el) =>
      !(el as HTMLButtonElement).disabled &&
      el.tabIndex >= 0 &&
      !el.closest("[hidden]") &&
      !el.closest("[aria-hidden=true]"),
  );

// 폼 안에서는 Radix 가 숨은 input 의 크기를 재려고 ResizeObserver 를 쓴다 — jsdom 에 없다
const stubResizeObserver = () =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

const pressEnter = (el: Element) =>
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });

// ── 목록 · 보기만 하는 줄 ────────────────────────────────────

describe("List — 좁은 줄(03-D 결정 1 B · 결정 2 B)", () => {
  it("줄(li)이 컨테이너다 — 줄 안 폭 16em(16rem) 미만이면 격자로 바뀌어 값이 본문 아래로 간다", () => {
    render(
      <List>
        <ListItem title="점심" suffix="-123,456,789,012원" />
      </List>,
    );
    const li = slot("list-item");
    expect(classes(li)).toContain("@container/list-item");
    const content = classes(slot("list-content"));
    // 문턱 = 16rem + 좌우 여백(줄 24 + 24)
    expect(content).toEqual(
      expect.arrayContaining([
        "@max-[calc(16rem+48px)]/list-item:grid",
        "@max-[calc(16rem+48px)]/list-item:items-start",
        "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-body]]:pr-0",
      ]),
    );
    // 값은 본문 칸 안 왼쪽 · 설명 아래 4(바깥 여백 2 + 안쪽 여백 2) — 화살표 · 컨트롤 · 작은 버튼이 든 뒤 붙이개는 값이 아니다(줄 끝 그대로)
    expect(content.join(" ")).toContain(
      "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))]:mt-x0_5",
    );
    expect(content.join(" ")).toContain(
      "[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))]:row-start-2",
    );
    expect(content.join(" ")).toContain(
      "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:not(:has(svg,button,a,input,[data-slot=list-mark]))]:pt-x0_5",
    );
    expect(content).toContain("[&>[data-slot=list-suffix]]:col-start-4");
  });

  it("문턱은 단계마다 다르다 — 부모 줄은 왼쪽 4 라 16rem + 28, 하위 줄은 104 라 16rem + 128", () => {
    render(
      <List>
        <ListParentItem
          title="식비"
          expandLabel="식비 하위 카테고리"
          defaultOpen
        >
          <ListButtonItem title="외식" suffix="-4,500원" />
        </ListParentItem>
      </List>,
    );
    const [parent, child] = slots("list-content");
    expect(classes(parent!)).toContain(
      "@max-[calc(16rem+28px)]/list-item:grid",
    );
    expect(classes(child!)).toContain(
      "@max-[calc(16rem+128px)]/list-item:grid",
    );
    // 꺾쇠 단추 · 앞 붙이개는 격자 첫 · 둘째 칸에서 위에 맞춘다
    expect(classes(parent!).join(" ")).toContain(
      "[&>:is([data-slot=list-expand-button],[data-slot=list-expand-slot])]:col-start-1",
    );
  });

  it("값 + 꺾쇠 한 덩어리는 좁은 줄에서 풀려 값만 아래로 · 꺾쇠는 줄 끝 — 글 조각은 span 으로 감싼다", () => {
    render(
      <List>
        <ListButtonItem
          title="기본 통화"
          suffix={
            <>
              대한민국 원<svg data-testid="chev" />
            </>
          }
        />
      </List>,
    );
    const suffix = slot("list-suffix");
    expect(suffix.children[0]!.tagName).toBe("SPAN");
    expect(suffix.children[0]!.textContent).toBe("대한민국 원");
    const content = classes(slot("list-content")).join(" ");
    expect(content).toContain(
      "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))]:contents",
    );
    // 본문 오른쪽 여백 — 옆에 조작 요소가 남으면 10, 남지 않으면 좁은 줄에서 0
    expect(content).toContain(":pr-x2_5");
    expect(content).toContain(
      "@max-[calc(16rem+48px)]/list-item:[&>[data-slot=list-body]]:pr-0",
    );
  });

  it("값 + 꺾쇠를 한 요소로 싸 넘기면 풀리지 않는다 — Fragment 로 넘길 때만 값이 내려간다(suffix 계약)", () => {
    const mixed =
      "[data-slot=list-suffix]:has(>:is(svg,button,a,input,[data-slot=list-mark])):has(>:not(svg,button,a,input,[data-slot=list-mark]))";
    render(
      <List>
        <ListItem
          title="통화"
          suffix={
            <>
              대한민국 원<svg />
            </>
          }
        />
        <ListItem
          title="언어"
          suffix={
            <span>
              한국어
              <svg />
            </span>
          }
        />
      </List>,
    );
    const [fragment, wrapped] = slots("list-suffix");
    expect(fragment!.matches(mixed)).toBe(true);
    // 한 요소로 싸면 suffix 의 직계 자식이 그 요소 하나뿐이라 풀리지 않는다 — 값까지 줄 끝에 남는다
    expect(wrapped!.matches(mixed)).toBe(false);
  });

  it("글로 넘긴 금액은 쉼표 뒤에 <wbr> — 글 값(이메일)은 그대로", () => {
    render(
      <List>
        <ListItem title="점심" suffix="-123,456,789,012원" />
        <ListItem title="이메일" suffix="groo@example.com" />
      </List>,
    );
    const [amount, mail] = slots("list-suffix");
    expect(amount!.innerHTML).toBe("-123,<wbr>456,<wbr>789,<wbr>012원");
    expect(amount!.textContent).toBe("-123,456,789,012원");
    expect(mail!.innerHTML).toBe("groo@example.com");
  });
});

describe("List · ListItem", () => {
  it("목록은 ul · 줄 사이 간격 0 · 줄은 li — 바탕 층 + 콘텐츠 층(앞 · 본문 · 뒤)", () => {
    const list = render(
      <List aria-label="계정 정보">
        <ListItem
          prefix={<svg />}
          title="가입일"
          detail="처음 가입한 날"
          suffix="2026년 3월 2일"
        />
      </List>,
    );
    expect(list.tagName).toBe("UL");
    expect(list.getAttribute("aria-label")).toBe("계정 정보");
    expect(classes(list)).toEqual(["flex", "w-full", "flex-col", "gap-0"]);
    const item = slot("list-item");
    expect(item.tagName).toBe("LI");
    expect(classes(item)).toEqual(
      expect.arrayContaining(["group/list-item", "relative", "flex", "w-full"]),
    );
    // 바탕 층은 장식이다 — 보조 기술에 숨기고 누르지 않는다
    const background = slot("list-background", item);
    expect(background.getAttribute("aria-hidden")).toBe("true");
    expect(classes(background)).toEqual(
      expect.arrayContaining(["pointer-events-none", "absolute", "inset-x-0"]),
    );
    const content = slot("list-content", item);
    expect(classes(content)).toEqual(
      expect.arrayContaining([
        "relative",
        "flex",
        "w-full",
        "py-x3",
        "items-center",
        "px-global-gutter",
      ]),
    );
    expect(content.children).toHaveLength(3);
    expect(slot("list-prefix").nextElementSibling).toBe(slot("list-body"));
    expect(slot("list-body").nextElementSibling).toBe(slot("list-suffix"));
    expect(slot("list-title").textContent).toBe("가입일");
    expect(slot("list-detail").textContent).toBe("처음 가입한 날");
    expect(slot("list-suffix").textContent).toBe("2026년 3월 2일");
  });

  it("글자 — 제목 t5 · 400 · fg-neutral, 설명 t3 · fg-neutral-subtle, 설명이 없으면 그리지 않는다", () => {
    render(
      <List>
        <ListItem title="가입일" detail="처음 가입한 날" />
        <ListItem title="이메일" />
      </List>,
    );
    const [first, second] = slots("list-item");
    expect(classes(slot("list-title", first))).toEqual(
      expect.arrayContaining(["text-t5", "font-normal", "text-fg-neutral"]),
    );
    expect(classes(slot("list-detail", first))).toEqual(
      expect.arrayContaining(["text-t3", "text-fg-neutral-subtle"]),
    );
    expect(slot("list-detail", second)).toBeNull();
    // 설명 칸은 내용 폭을 0 으로 세고 본문 폭만 min-width 로 건다 — 한 줄 말줄임이 본문 폭을 밀어 값이 줄 밖으로 나가지 않게
    expect(classes(slot("list-detail", first))).toEqual(
      expect.arrayContaining(["w-0", "min-w-full"]),
    );
    // 본문은 제목 아래 2 · 뒤 붙이개와 10 — 폭이 내용을 따르는 flex 항목이라 최소 폭 제목 글자 1개(--text-t5) + 뒤 여백 10
    expect(classes(slot("list-body", second))).toEqual(
      expect.arrayContaining([
        "min-w-min",
        "flex-1",
        "flex-col",
        "gap-x0_5",
        "pr-x2_5",
      ]),
    );
  });

  it("앞 붙이개 아이콘 22 · 뒤 붙이개 값 글자 t5 · 화살표 18 · 안의 버튼 · 링크는 줄의 덮개 위(z 1)", () => {
    render(
      <List>
        <ListItem prefix={<svg />} title="언어" suffix="한국어" />
      </List>,
    );
    expect(classes(slot("list-prefix"))).toEqual(
      expect.arrayContaining([
        "pr-x3",
        "shrink-0",
        "[&>svg]:size-[22px]",
        "text-fg-neutral",
      ]),
    );
    expect(classes(slot("list-suffix"))).toEqual(
      expect.arrayContaining([
        "gap-x1",
        "text-t5",
        "text-fg-neutral-subtle",
        "[&>svg]:size-x4_5",
        "[&_a]:z-1",
        "[&_button:not([data-slot=input-button]>button)]:z-1",
      ]),
    );
  });

  it("보기만 하는 줄은 누르지 않는다 — 표식 · 버튼 · 링크 · Tab 이 없다(호버 · 누름 바탕은 표식을 보고 생긴다)", () => {
    render(
      <List>
        <ListItem title="가입일" suffix="2026년 3월 2일" />
        <ListItem title="이메일" suffix="groo@example.com" />
      </List>,
    );
    expect(container.querySelector("[data-list-action]")).toBeNull();
    expect(container.querySelector("button, a")).toBeNull();
    expect(tabStops()).toHaveLength(0);
    for (const item of slots("list-item")) {
      expect(item.className).not.toMatch(/cursor-pointer/);
    }
  });

  it("맞춤 — 기본 가운데, top 이면 위", () => {
    render(
      <List>
        <ListItem title="가운데" />
        <ListItem align="top" title="위" />
      </List>,
    );
    const [center, top] = slots("list-content");
    expect(classes(center!)).toContain("items-center");
    expect(classes(top!)).toContain("items-start");
    expect(classes(top!)).not.toContain("items-center");
  });

  it("강조 — 바탕 층만 옅은 브랜드 색(점 · 막대 없음), 올리거나 눌러도 줄은 보기만 하는 줄이면 변하지 않는다", () => {
    render(
      <List>
        <ListItem highlighted title="안 읽음" detail="새 알림" suffix="방금" />
        <ListItem title="읽음" />
      </List>,
    );
    const [on, off] = slots("list-background");
    expect(classes(on!)).toEqual(
      expect.arrayContaining([
        "bg-bg-brand-weak",
        "[@media(hover:hover)]:group-has-[[data-list-action]:not([data-disabled]):hover]/list-item:bg-bg-brand-weak-pressed",
      ]),
    );
    expect(classes(off!)).toContain("bg-transparent");
    expect(classes(off!)).not.toContain("bg-bg-brand-weak");
    // 설명 · 값 글자는 올리거나 누르는 동안 한 단계 짙다 — 제목 · 화살표는 그대로
    expect(classes(slot("list-detail"))).toContain(
      "group-has-[[data-list-action]:not([data-disabled]):active]/list-item:text-fg-neutral-muted",
    );
    expect(classes(slot("list-suffix"))).toContain(
      "group-has-[[data-list-action]:not([data-disabled]):active]/list-item:text-fg-neutral-muted",
    );
    expect(classes(slot("list-suffix"))).toContain(
      "[&>svg]:text-fg-neutral-subtle",
    );
    expect(classes(slot("list-title"))).not.toContain(
      "group-has-[[data-list-action]:not([data-disabled]):active]/list-item:text-fg-neutral-muted",
    );
    // 강조가 아니면 짙어지지 않는다
    render(
      <List>
        <ListItem title="읽음" detail="새 알림" suffix="방금" />
      </List>,
    );
    expect(classes(slot("list-detail")).join(" ")).not.toMatch(
      /fg-neutral-muted/,
    );
  });

  it("itemRadius 는 누름 · 호버 바탕의 모서리 변수로 간다 — 카드 안의 동심 모서리(기본 radius-r2_5)", () => {
    const list = render(
      <List itemRadius="10px" style={{ margin: "0px" }}>
        <ListButtonItem title="계정" />
      </List>,
    );
    expect(list.style.getPropertyValue("--list-item-radius")).toBe("10px");
    expect(list.style.margin).toBe("0px");
    expect(classes(slot("list-background")).join(" ")).toContain(
      "rounded-[var(--list-item-radius,var(--radius-r2_5))]",
    );
    render(
      <List>
        <ListButtonItem title="계정" />
      </List>,
    );
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue(
        "--list-item-radius",
      ),
    ).toBe("");
  });

  it("className · 나머지 속성은 li 에 · ref 는 li 로 간다", () => {
    const ref = { current: null as HTMLLIElement | null };
    render(
      <List>
        <ListItem
          ref={ref}
          className="extra"
          id="row-1"
          title="가입일"
          data-testid="x"
        />
      </List>,
    );
    expect(ref.current).toBe(slot("list-item"));
    expect(ref.current!.id).toBe("row-1");
    expect(classes(ref.current!)).toContain("extra");
    expect(ref.current!.getAttribute("data-testid")).toBe("x");
  });
});

// ── 누르는 줄 · 링크 줄 ──────────────────────────────────────

describe("ListButtonItem · ListLinkItem", () => {
  it("누르는 줄은 줄 전체가 버튼(type=button) — 이름은 제목 + 설명, 누르면 onClick", () => {
    const onClick = vi.fn();
    render(
      <List>
        <ListButtonItem
          title="결제 알림"
          detail="결제 예정일 D-1"
          suffix="켜짐"
          onClick={onClick}
        />
      </List>,
    );
    const button = container.querySelector("button")!;
    expect(button.type).toBe("button");
    expect(button.textContent).toBe("결제 알림결제 예정일 D-1");
    expect(button.getAttribute("data-list-action")).toBe("");
    expect(button.getAttribute("data-slot")).toBe("list-body");
    // 뒤 붙이개는 버튼 밖(형제)이다 — 값 글자가 버튼의 이름에 들지 않는다
    expect(button.textContent).not.toContain("켜짐");
    expect(classes(button)).toEqual(
      expect.arrayContaining([
        "cursor-pointer",
        "after:absolute",
        "after:inset-0",
        "data-[disabled]:cursor-not-allowed",
        "min-w-min",
      ]),
    );
    click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("키보드 포커스에만 줄 안쪽 링 2px — 링은 콘텐츠 층이 그린다(본문의 :focus-visible)", () => {
    render(
      <List>
        <ListButtonItem title="계정" />
      </List>,
    );
    const content = classes(slot("list-content"));
    expect(content).toEqual(
      expect.arrayContaining([
        "has-[[data-slot=list-body]:focus-visible]:outline-2",
        "has-[[data-slot=list-body]:focus-visible]:-outline-offset-2",
        "has-[[data-slot=list-body]:focus-visible]:outline-stroke-focus-ring",
      ]),
    );
    // 버튼 자신은 기본 링을 끈다 — 링이 둘로 겹치지 않는다
    expect(classes(container.querySelector("button")!)).toContain(
      "outline-none",
    );
  });

  it("호버 · 누름은 줄의 표식을 보고 바탕 층이 좌우 6 들어와 모서리 10 · 콘텐츠 층만 2px 거리 축소 — 모션 줄이기면 축소 없음", () => {
    render(
      <List>
        <ListButtonItem title="계정" />
      </List>,
    );
    const hover =
      "[@media(hover:hover)]:group-has-[[data-list-action]:not([data-disabled]):hover]/list-item";
    const active =
      "group-has-[[data-list-action]:not([data-disabled]):active]/list-item";
    const background = classes(slot("list-background"));
    expect(background).toEqual(
      expect.arrayContaining([
        `${hover}:inset-x-x1_5`,
        `${hover}:bg-bg-layer-default-pressed`,
        `${active}:inset-x-x1_5`,
        `${active}:bg-bg-layer-default-pressed`,
        "rounded-none",
      ]),
    );
    // 바탕은 150ms 색 · 들임 · 모서리 전환
    expect(background).toContain(
      "[transition:background-color_var(--motion-duration-color-transition)_var(--motion-ease-easing),inset_var(--motion-duration-color-transition)_var(--motion-ease-easing),border-radius_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
    );
    const content = classes(slot("list-content"));
    expect(content).toEqual(
      expect.arrayContaining([
        `${active}:[scale:calc(1-2/var(--press-basis))]`,
        `motion-reduce:${active}:[scale:1]`,
        "[transition:scale_var(--motion-duration-pressed-scale)_var(--motion-ease-pressed-scale)]",
      ]),
    );
    // 줄은 24 를 기본으로 두고 누르는 순간 잰다
    expect(classes(slot("list-item"))).toContain("[--press-basis:24]");
  });

  it("누르는 순간(포인터 · 키) 줄을 재서 축소 기준을 --press-basis 로 넘긴다 — 부르는 쪽 핸들러도 부른다", () => {
    const onPointerDown = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <List>
        <ListButtonItem
          title="계정"
          rootProps={{ onPointerDown, onKeyDown, className: "root-extra" }}
        />
      </List>,
    );
    const item = slot("list-item");
    expect(classes(item)).toContain("root-extra");
    const button = container.querySelector("button")!;
    act(() => {
      button.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
        }),
      );
    });
    // jsdom 은 크기가 0 이라 바닥값 24 — max(높이, 폭 ÷ 4, 24)
    expect(item.style.getPropertyValue("--press-basis")).toBe("24");
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    item.style.removeProperty("--press-basis");
    act(() => {
      button.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    expect(item.style.getPropertyValue("--press-basis")).toBe("24");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("누르는 동안 줄어든 영역 밖에서 떼도 그 줄이 눌리게 포인터를 잡아 둔다 — 마우스 · 펜만(터치는 브라우저가 이미 잡는다)", () => {
    const capture = vi.fn();
    Object.defineProperty(Element.prototype, "setPointerCapture", {
      configurable: true,
      writable: true,
      value: capture,
    });
    try {
      render(
        <List>
          <ListButtonItem title="계정" />
        </List>,
      );
      const button = container.querySelector("button")!;
      const down = (pointerType: string) =>
        act(() => {
          button.dispatchEvent(
            new PointerEvent("pointerdown", {
              bubbles: true,
              pointerType,
              pointerId: 7,
            }),
          );
        });
      down("touch");
      expect(capture).not.toHaveBeenCalled();
      down("mouse");
      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledWith(7);
      down("pen");
      expect(capture).toHaveBeenCalledTimes(2);
    } finally {
      Reflect.deleteProperty(Element.prototype, "setPointerCapture");
    }
  });

  it("막힌 줄 — disabled · data-disabled · 제목 · 설명 · 앞뒤 아이콘 · 값 글자가 모두 fg-disabled, 불투명도로 흐리지 않는다 · 누르기 · Tab 불가", () => {
    const onClick = vi.fn();
    render(
      <List>
        <ListButtonItem
          disabled
          highlighted
          prefix={
            <ListTile className="bg-chart-orange-weak text-chart-orange" />
          }
          title="주간 리포트"
          detail="푸시 알림이 꺼져 있어요"
          suffix="꺼짐"
          onClick={onClick}
        />
      </List>,
    );
    const button = container.querySelector("button")!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("data-disabled")).toBe("");
    click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(tabStops()).toHaveLength(0);
    expect(classes(slot("list-title"))).toContain("text-fg-disabled");
    expect(classes(slot("list-detail"))).toContain("text-fg-disabled");
    expect(classes(slot("list-detail")).join(" ")).not.toMatch(/muted/);
    expect(classes(slot("list-suffix"))).toContain("text-fg-disabled");
    // 타일은 부르는 쪽의 카테고리 색을 덮고 비활성 색으로 — 앞 붙이개가 정한다
    expect(classes(slot("list-prefix"))).toEqual(
      expect.arrayContaining([
        "text-fg-disabled",
        "[&_[data-slot=list-tile]]:bg-bg-disabled",
        "[&_[data-slot=list-tile]]:text-fg-disabled",
      ]),
    );
    for (const el of container.querySelectorAll("*")) {
      expect(el.className?.toString()).not.toMatch(/(^|\s)opacity-/);
    }
  });

  it("줄 · 작은 버튼 · 메뉴 — 누르는 것 셋은 따로 눌린다(작은 버튼은 줄의 덮개 위, 이벤트도 줄로 가지 않는다)", () => {
    const onRow = vi.fn();
    const onSmall = vi.fn();
    const onMenu = vi.fn();
    render(
      <List>
        <ListButtonItem
          title="카페 · 아메리카노"
          onClick={onRow}
          suffix={
            <>
              <button type="button" onClick={onSmall}>
                분류
              </button>
              <button type="button" aria-label="더 보기" onClick={onMenu}>
                ⋮
              </button>
            </>
          }
        />
      </List>,
    );
    // 문서 순서 — 줄 → 작은 버튼 → 메뉴
    expect(tabStops().map((el) => el.textContent)).toEqual([
      "카페 · 아메리카노",
      "분류",
      "⋮",
    ]);
    click(byText("분류"));
    expect(onSmall).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
    click(byText("⋮"));
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
    click(byText("카페 · 아메리카노"));
    expect(onRow).toHaveBeenCalledTimes(1);
    expect(onSmall).toHaveBeenCalledTimes(1);
    // 안의 버튼은 덮개 위로 올린다 — 줄을 어디 눌러도 눌리지만 버튼은 따로 눌린다
    expect(classes(slot("list-suffix"))).toContain(
      "[&_button:not([data-slot=input-button]>button)]:z-1",
    );
  });

  it("className 은 버튼에 · rootProps 는 li 에 · ref 는 버튼으로 · type 을 바꿀 수 있다", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <List>
        <ListButtonItem
          ref={ref}
          type="submit"
          className="btn-extra"
          rootProps={{ id: "row" }}
          title="저장"
        />
      </List>,
    );
    expect(ref.current).toBe(container.querySelector("button"));
    expect(ref.current!.type).toBe("submit");
    expect(classes(ref.current!)).toContain("btn-extra");
    expect(slot("list-item").id).toBe("row");
  });

  it("링크 줄은 줄 전체가 링크 — 이름은 제목 + 설명, 막지 않는다(disabled 가 없다)", () => {
    render(
      <List>
        <ListLinkItem
          href="https://example.com/help"
          title="도움말"
          detail="설명서에서 알아보세요"
          suffix="›"
        />
      </List>,
    );
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com/help");
    expect(link.textContent).toBe("도움말설명서에서 알아보세요");
    expect(link.getAttribute("data-list-action")).toBe("");
    expect(classes(link)).toEqual(
      expect.arrayContaining([
        "cursor-pointer",
        "after:absolute",
        "no-underline",
      ]),
    );
    expect(tabStops()).toEqual([link]);
  });

  it("라우터의 링크는 asChild 의 자식으로 — 제목 · 설명은 그 링크 안에 그려진다", () => {
    const onClick = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    render(
      <List>
        <ListLinkItem asChild title="도움말" detail="설명서">
          <a href="/help" onClick={onClick} />
        </ListLinkItem>
      </List>,
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.getAttribute("href")).toBe("/help");
    expect(link.textContent).toBe("도움말설명서");
    expect(link.getAttribute("data-list-action")).toBe("");
    expect(link.getAttribute("data-slot")).toBe("list-body");
    expect(classes(link)).toContain("after:absolute");
    click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ── 컨트롤 줄 ───────────────────────────────────────────────

describe("ListSwitchItem", () => {
  it("줄 전체가 라벨 — 줄 어디를 눌러도 스위치가 바뀌고, 이름은 제목 + 설명이다", () => {
    const onCheckedChange = vi.fn();
    render(
      <List>
        <ListSwitchItem
          title="결제 알림"
          detail="결제 예정일 D-1"
          onCheckedChange={onCheckedChange}
        />
      </List>,
    );
    const label = container.querySelector("label")!;
    const toggle = container.querySelector<HTMLButtonElement>("[role=switch]")!;
    expect(label.htmlFor).toBe(toggle.id);
    expect(label.textContent).toBe("결제 알림결제 예정일 D-1");
    expect(toggle.labels?.[0]).toBe(label);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    // 제목 · 빈 자리 · 설명 어디를 눌러도 같다
    click(slot("list-title"));
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    click(slot("list-detail"));
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    click(label);
    expect(onCheckedChange).toHaveBeenCalledTimes(3);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
  });

  it("스위치는 뒤에 32(제목 16 줄) · 따로 줄지 않는다 · 라벨과 컨트롤이 줄의 표식을 가진다 · 줄이 라벨이라 호버 · 누름 바탕이 생긴다", () => {
    render(
      <List>
        <ListSwitchItem prefix={<svg />} title="결제 알림" defaultChecked />
      </List>,
    );
    const toggle = container.querySelector<HTMLElement>("[role=switch]")!;
    expect(classes(toggle)).toEqual(
      expect.arrayContaining(["h-[32px]", "w-[52px]", "active:[scale:1]"]),
    );
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.getAttribute("data-list-action")).toBe("");
    // 스위치는 뒤 붙이개 자리에 선다
    expect(slot("list-suffix").contains(toggle)).toBe(true);
    const label = container.querySelector("label")!;
    expect(label.getAttribute("data-list-action")).toBe("");
    expect(label.getAttribute("data-slot")).toBe("list-content");
    expect(classes(label)).toEqual(
      expect.arrayContaining([
        "cursor-pointer",
        "select-none",
        "px-global-gutter",
      ]),
    );
  });

  it("막힌 줄 — 스위치 · 라벨 · 글자가 모두 막힘, 눌러도 바뀌지 않는다", () => {
    const onCheckedChange = vi.fn();
    render(
      <List>
        <ListSwitchItem
          disabled
          title="결제 알림"
          onCheckedChange={onCheckedChange}
        />
      </List>,
    );
    const toggle = container.querySelector<HTMLButtonElement>("[role=switch]")!;
    expect(toggle.disabled).toBe(true);
    expect(
      container.querySelector("label")!.getAttribute("data-disabled"),
    ).toBe("");
    expect(classes(slot("list-title"))).toContain("text-fg-disabled");
    click(slot("list-title"));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(tabStops()).toHaveLength(0);
  });

  it("className · ref 는 스위치로, rootProps 는 줄로", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <List>
        <ListSwitchItem
          ref={ref}
          className="mark-extra"
          rootProps={{ className: "row-extra" }}
          title="결제 알림"
        />
      </List>,
    );
    expect(ref.current).toBe(container.querySelector("[role=switch]"));
    expect(classes(ref.current!)).toContain("mark-extra");
    expect(classes(slot("list-item"))).toContain("row-extra");
  });
});

describe("ListCheckItem · ListCheckGroup", () => {
  const Export = (props: {
    onCheckedChange?: (v: boolean | "indeterminate") => void;
    markPosition?: "prefix" | "suffix";
  }) => (
    <ListCheckGroup aria-label="내보낼 항목">
      <ListCheckItem
        title="거래 내역"
        detail="날짜별"
        defaultChecked
        markPosition={props.markPosition}
        onCheckedChange={props.onCheckedChange}
      />
      <ListCheckItem title="예산" />
    </ListCheckGroup>
  );

  it("묶음은 fieldset(role=group) · 이름이 있고 줄은 li 대신 div — 체크는 앞(기본) 24, 이름은 제목 + 설명", () => {
    const group = render(<Export />);
    expect(group.tagName).toBe("FIELDSET");
    expect(group.getAttribute("aria-label")).toBe("내보낼 항목");
    expect(classes(group)).toEqual(
      expect.arrayContaining(["flex", "flex-col", "gap-0", "border-0", "p-0"]),
    );
    const items = slots("list-item");
    expect(items.map((el) => el.tagName)).toEqual(["DIV", "DIV"]);
    expect(group.querySelector("li")).toBeNull();
    const check =
      container.querySelector<HTMLButtonElement>("[role=checkbox]")!;
    expect(classes(check)).toEqual(
      expect.arrayContaining(["size-[24px]", "active:[scale:1]"]),
    );
    expect(slot("list-prefix", items[0]).contains(check)).toBe(true);
    expect(check.labels?.[0]?.textContent).toBe("거래 내역날짜별");
  });

  it("체크는 뒤에도 둔다 — 뒤 붙이개 자리에 서고 앞에는 부르는 쪽의 앞 붙이개가 선다", () => {
    render(
      <ListCheckGroup aria-label="자산">
        <ListCheckItem
          markPosition="suffix"
          prefix={<svg data-testid="icon" />}
          title="카드"
        />
      </ListCheckGroup>,
    );
    const check = container.querySelector<HTMLElement>("[role=checkbox]")!;
    expect(slot("list-suffix").contains(check)).toBe(true);
    expect(
      slot("list-prefix").querySelector("[data-testid=icon]"),
    ).not.toBeNull();
  });

  it("줄 어디를 눌러도 체크가 바뀌고 고른 것 · 안 고른 것이 모두 보인다 — 여럿 고르기", () => {
    const onCheckedChange = vi.fn();
    render(<Export onCheckedChange={onCheckedChange} />);
    const [first, second] = Array.from(
      container.querySelectorAll<HTMLElement>("[role=checkbox]"),
    );
    expect(first!.getAttribute("aria-checked")).toBe("true");
    expect(second!.getAttribute("aria-checked")).toBe("false");
    click(slot("list-title", slots("list-item")[0]!));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    click(slot("list-title", slots("list-item")[1]!));
    expect(first!.getAttribute("aria-checked")).toBe("false");
    expect(second!.getAttribute("aria-checked")).toBe("true");
  });

  it("목록(ul) 안에서도 쓴다 — 줄은 li", () => {
    render(
      <List>
        <ListCheckItem title="거래 내역" />
      </List>,
    );
    expect(slot("list-item").tagName).toBe("LI");
  });

  it("Enter 는 폼을 제출한다 — 폼의 기본 버튼을 누르고, 체크는 바뀌지 않는다(Space 만 켜고 끈다)", () => {
    stubResizeObserver();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    render(
      <form onSubmit={onSubmit}>
        <Export />
        <button type="submit">저장</button>
      </form>,
    );
    const second =
      container.querySelectorAll<HTMLElement>("[role=checkbox]")[1]!;
    pressEnter(second);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(second.getAttribute("aria-checked")).toBe("false");
  });

  it("Enter — 폼이 없거나 기본 버튼이 막혀 있으면 아무 일도 없다", () => {
    stubResizeObserver();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    render(<Export />);
    pressEnter(container.querySelector("[role=checkbox]")!);
    render(
      <form onSubmit={onSubmit}>
        <Export />
        <button type="submit" disabled>
          저장
        </button>
      </form>,
    );
    pressEnter(container.querySelector("[role=checkbox]")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("막힌 줄 — 체크 · 글자가 막히고 눌러도 바뀌지 않는다", () => {
    const onCheckedChange = vi.fn();
    render(
      <ListCheckGroup aria-label="항목">
        <ListCheckItem
          disabled
          title="거래 내역"
          onCheckedChange={onCheckedChange}
        />
      </ListCheckGroup>,
    );
    const check =
      container.querySelector<HTMLButtonElement>("[role=checkbox]")!;
    expect(check.disabled).toBe(true);
    click(slot("list-title"));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(classes(slot("list-title"))).toContain("text-fg-disabled");
  });
});

describe("ListRadioItem · ListRadioGroup", () => {
  const Currency = (props: {
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <ListRadioGroup
      aria-label="기본 통화"
      value={props.value}
      defaultValue={props.value === undefined ? "KRW" : undefined}
      onValueChange={props.onValueChange}
    >
      <ListRadioItem value="KRW" title="대한민국 원" detail="KRW" />
      <ListRadioItem value="USD" title="미국 달러" detail="USD" />
    </ListRadioGroup>
  );
  const radios = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("[role=radio]"));

  it("묶음은 role=radiogroup · 이름이 있고 줄은 li 대신 div — 라디오는 뒤(기본) 24, 이름은 제목 + 설명", () => {
    const group = render(<Currency />);
    expect(group.getAttribute("role")).toBe("radiogroup");
    expect(group.getAttribute("aria-label")).toBe("기본 통화");
    expect(classes(group)).toEqual(
      expect.arrayContaining(["flex", "flex-col", "gap-0"]),
    );
    const items = slots("list-item");
    expect(items.map((el) => el.tagName)).toEqual(["DIV", "DIV"]);
    expect(group.querySelector("li")).toBeNull();
    expect(radios()).toHaveLength(2);
    expect(classes(radios()[0]!)).toEqual(
      expect.arrayContaining(["size-[24px]", "active:[scale:1]"]),
    );
    expect(slot("list-suffix", items[0]).contains(radios()[0]!)).toBe(true);
    expect(radios()[0]!.labels?.[0]?.textContent).toBe("대한민국 원KRW");
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
  });

  it("앞에도 둔다 — 앞 붙이개 자리에 서고 뒤 붙이개는 없다", () => {
    render(
      <ListRadioGroup aria-labelledby="h" defaultValue="me">
        <ListRadioItem markPosition="prefix" value="me" title="나만 보기" />
        <ListRadioItem markPosition="prefix" value="all" title="모두" />
      </ListRadioGroup>,
    );
    const first = slots("list-item")[0]!;
    expect(slot("list-prefix", first).contains(radios()[0]!)).toBe(true);
    expect(slot("list-suffix", first)).toBeNull();
  });

  it("줄 어디를 눌러도 고르고 앞에 고른 것은 풀린다 — 고른 줄을 다시 눌러도 그대로다", () => {
    const onValueChange = vi.fn();
    render(<Currency onValueChange={onValueChange} />);
    click(slot("list-title", slots("list-item")[1]!));
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
    ]);
    expect(onValueChange).toHaveBeenLastCalledWith("USD");
    click(slot("list-detail", slots("list-item")[1]!));
    expect(radios()[1]!.getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("쥐고 다루는 값도 받는다", () => {
    function Controlled() {
      const [value, setValue] = useState("USD");
      return <Currency value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
    ]);
    click(slot("list-title", slots("list-item")[0]!));
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
  });

  it("Enter 는 폼을 제출한다 — 묶음이 받고 폼의 기본 버튼을 누른다, 고르지 않는다(고르기는 Space · 화살표). 부르는 쪽 onKeyDown 도 불린다", () => {
    stubResizeObserver();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    const onKeyDown = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <ListRadioGroup
          aria-label="기본 통화"
          defaultValue="KRW"
          onKeyDown={onKeyDown}
        >
          <ListRadioItem value="KRW" title="대한민국 원" />
          <ListRadioItem value="USD" title="미국 달러" />
        </ListRadioGroup>
        <button type="submit">저장</button>
      </form>,
    );
    pressEnter(radios()[1]!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
  });

  it("Enter — 기본 버튼이 막혀 있으면 아무 일도 없다", () => {
    stubResizeObserver();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    render(
      <form onSubmit={onSubmit}>
        <Currency />
        <button type="submit" disabled>
          저장
        </button>
      </form>,
    );
    pressEnter(radios()[0]!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("막힌 줄 — 라디오 · 글자가 막히고 눌러도 고르지 않는다", () => {
    const onValueChange = vi.fn();
    render(
      <ListRadioGroup
        aria-label="기본 통화"
        defaultValue="KRW"
        onValueChange={onValueChange}
      >
        <ListRadioItem value="KRW" title="대한민국 원" />
        <ListRadioItem disabled value="USD" title="미국 달러" />
      </ListRadioGroup>,
    );
    expect(radios()[1]!.disabled).toBe(true);
    click(slot("list-title", slots("list-item")[1]!));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(classes(slot("list-title", slots("list-item")[1]!))).toContain(
      "text-fg-disabled",
    );
  });

  it("묶음의 이름은 필수다 — 둘 다 없으면 타입이 막는다(aria-label · aria-labelledby)", () => {
    // 아래는 타입 검사로만 확인한다(실행하지 않는다) — @ts-expect-error 가 없으면 tsc 가 실패한다
    const _typeLocks = () => (
      <>
        {/* @ts-expect-error 이름 없는 하나 고르기 묶음 */}
        <ListRadioGroup defaultValue="a" />
        {/* @ts-expect-error 이름 없는 여럿 고르기 묶음 */}
        <ListCheckGroup />
        {/* @ts-expect-error 앞에 둔 라디오는 앞 붙이개를 같이 줄 수 없다 */}
        <ListRadioItem
          value="a"
          title="카드"
          markPosition="prefix"
          prefix={<svg />}
        />
        {/* @ts-expect-error 컨트롤 줄에는 따로 누르는 버튼(뒤 붙이개)을 같이 넣지 않는다 */}
        <ListSwitchItem title="알림" suffix={<button />} />
      </>
    );
    expect(typeof _typeLocks).toBe("function");
  });
});

// ── 구분선 · 제목 · 타일 ─────────────────────────────────────

describe("ListDivider · ListHeader · ListTile", () => {
  it("줄 사이 선 — 1px · stroke-neutral-subtle · 보조 기술에 숨긴다, 목록 안에서는 li · 묶음 안에서는 div", () => {
    render(
      <>
        <List>
          <ListItem title="가입일" />
          <ListDivider />
          <ListDivider inset />
        </List>
        <ListCheckGroup aria-label="항목">
          <ListDivider />
        </ListCheckGroup>
      </>,
    );
    const [full, inset, inGroup] = slots("list-divider");
    expect(full!.tagName).toBe("LI");
    expect(inGroup!.tagName).toBe("DIV");
    for (const divider of [full!, inset!, inGroup!]) {
      expect(divider.getAttribute("aria-hidden")).toBe("true");
      expect(classes(divider)).toEqual(
        expect.arrayContaining(["h-px", "bg-stroke-neutral-subtle"]),
      );
    }
    expect(classes(full!)).toContain("w-full");
    expect(classes(inset!)).toContain("mx-global-gutter");
    expect(classes(inset!)).not.toContain("w-full");
  });

  it("목록 제목은 오른쪽 동작이 머리 폭의 절반을 넘으면 제목 아래 줄 오른쪽 끝으로 내려간다 — 제목 최소 50% · 줄바꿈(03-G 4A)", () => {
    render(<ListHeader id="h1">일반</ListHeader>);
    expect(classes(slots("list-header")[0]!)).toEqual(
      expect.arrayContaining([
        "flex-wrap",
        "[&>:first-child:not(:last-child)]:min-w-[50%]",
        "[&>:first-child:not(:last-child)]:flex-1",
        "[&>:last-child:not(:first-child)]:ml-auto",
      ]),
    );
  });

  it("줄 제목은 색이 바뀔 때만 150ms 색 전환이 있고 모션 줄이기면 전환이 없다 — 처음 그림은 모션 없음(앱 List 와 같은 값)", () => {
    render(
      <List>
        <ListItem title="제목" />
      </List>,
    );
    const title = slots("list-title")[0]!;
    expect(classes(title)).toEqual(
      expect.arrayContaining([
        "[transition:color_var(--motion-duration-color-transition)_var(--motion-ease-easing)]",
        "motion-reduce:transition-none",
      ]),
    );
    // 전환은 color 만 — 등장 애니메이션(animation)은 없다
    expect(classes(title).some((c) => c.startsWith("animate-"))).toBe(false);
  });

  it("목록 제목의 오른쪽 글 버튼은 위아래 −8 · 오른쪽 −14 로 스스로 번진다 — 화면이 −mr 를 따로 주지 않는다(list-header.yaml action.marginY)", () => {
    render(<ListHeader id="h1">일반</ListHeader>);
    expect(classes(slots("list-header")[0]!)).toEqual(
      expect.arrayContaining([
        "[&>button:last-child:not(:first-child)]:-my-x2",
        "[&>button:last-child:not(:first-child)]:-mr-x3_5",
      ]),
    );
  });

  it("목록 제목 — 14 · 500 · 옅은 색(기본) · boldSolid 는 700 · 짙은 색, 좌우 24 · 위아래 8 · 버튼과 사이 10", () => {
    render(
      <>
        <ListHeader id="h1">일반</ListHeader>
        <ListHeader variant="boldSolid" id="h2">
          이번 달 지출
        </ListHeader>
      </>,
    );
    const [weak, bold] = slots("list-header");
    for (const header of [weak!, bold!]) {
      expect(classes(header)).toEqual(
        expect.arrayContaining([
          "flex",
          "w-full",
          "items-center",
          "justify-between",
          "gap-x2_5",
          "px-global-gutter",
          "py-x2",
          "text-t4",
        ]),
      );
    }
    expect(classes(weak!)).toEqual(
      expect.arrayContaining(["font-medium", "text-fg-neutral-subtle"]),
    );
    expect(classes(bold!)).toEqual(
      expect.arrayContaining(["font-bold", "text-fg-neutral"]),
    );
  });

  it("목록 제목은 제목 태그다 — 기본 h2, 카드 안이면 as=h3 · 브라우저 기본 여백은 없다(03D-007)", () => {
    render(
      <>
        <ListHeader>목록</ListHeader>
        <ListHeader as="h3">카드 안 목록</ListHeader>
      </>,
    );
    const [h2, h3] = slots("list-header");
    expect(h2!.tagName).toBe("H2");
    expect(h3!.tagName).toBe("H3");
    expect(classes(h2!)).toContain("m-0");
    // 전역 h2 의 글자 사이 −0.012em 을 물려받지 않는다(스펙 t4 는 0)
    expect(classes(h2!)).toContain("tracking-normal");
  });

  it('오른쪽 버튼이 있는 머리는 as="div" + 제목 글만 머리말 — 머리말 이름에 버튼 글이 섞이지 않는다(스펙 #186)', () => {
    render(
      <>
        <ListHeader as="div">
          <h2 id="budget2" className="m-0 tracking-normal [font:inherit]">
            카테고리별 예산
          </h2>
          <button type="button">전체 보기</button>
        </ListHeader>
        <List aria-labelledby="budget2">
          <ListItem title="식비" />
        </List>
      </>,
    );
    const header = slot("list-header");
    expect(header.tagName).toBe("DIV");
    const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
    expect(headings).toHaveLength(1);
    // 머리말 이름 = 제목 글만, 버튼은 제목 밖의 형제
    expect(headings[0]!.textContent).toBe("카테고리별 예산");
    expect(headings[0]!.parentElement).toBe(header);
    expect(header.querySelector("button")!.parentElement).toBe(header);
    expect(headings[0]!.contains(header.querySelector("button"))).toBe(false);
    const list = container.querySelector("ul")!;
    expect(
      document.getElementById(list.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("카테고리별 예산");
  });

  it("목록 제목이 있으면 목록에 aria-labelledby 로 잇는다 — 오른쪽 버튼은 제목 글 밖이라 목록 이름에 섞이지 않는다", () => {
    render(
      <>
        <ListHeader>
          <span id="budget">카테고리별 예산</span>
          <button type="button">전체 보기</button>
        </ListHeader>
        <List aria-labelledby="budget">
          <ListItem title="식비" />
        </List>
      </>,
    );
    const list = container.querySelector("ul")!;
    expect(
      document.getElementById(list.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("카테고리별 예산");
  });

  it("목록 제목은 asChild 로 부르는 쪽의 요소(제목 태그)가 된다", () => {
    render(
      <ListHeader asChild>
        <h2>일반</h2>
      </ListHeader>,
    );
    expect(container.querySelector("div")).toBeNull();
    const heading = container.querySelector("h2")!;
    expect(classes(heading)).toContain("px-global-gutter");
  });

  it("타일 — 40 · 모서리 12 · 아이콘 20, 색은 부르는 쪽의 카테고리 색", () => {
    render(
      <ListTile className="bg-chart-orange-weak text-chart-orange">
        <svg />
      </ListTile>,
    );
    const tile = slot("list-tile");
    expect(classes(tile)).toEqual(
      expect.arrayContaining([
        "size-x10",
        "rounded-r3",
        "[&>svg]:size-x5",
        "bg-chart-orange-weak",
        "text-chart-orange",
      ]),
    );
  });
});

// ── 하위 줄 ─────────────────────────────────────────────────

describe("ListParentItem — 하위 줄을 접는 부모 줄", () => {
  const Food = (props: {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    onEdit?: () => void;
    collapsible?: boolean;
  }) => (
    <List aria-label="지출 카테고리">
      <ListParentItem
        prefix={<ListTile />}
        title="식비"
        detail="지출 · 하위 2개"
        {...(props.collapsible === false
          ? { collapsible: false as const }
          : {
              expandLabel: "식비 하위 카테고리",
              open: props.open,
              defaultOpen: props.defaultOpen,
              onOpenChange: props.onOpenChange,
            })}
        onClick={props.onEdit}
      >
        <ListButtonItem title="외식" />
        <ListButtonItem title="배달음식" />
      </ListParentItem>
      <ListParentItem
        prefix={<ListTile />}
        title="기타"
        detail="지출 · 하위 없음"
        expandLabel="기타 하위 카테고리"
      />
    </List>
  );
  const expandButton = () => slot("list-expand-button");
  const subList = () => slot("list-sub-list");

  it('꺾쇠 단추 — 이름은 고정("{카테고리} 하위 카테고리") + aria-expanded · aria-controls(하위 줄 ul), 상태마다 이름을 바꾸지 않는다', () => {
    render(<Food />);
    const button = expandButton();
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("식비 하위 카테고리");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    const target = document.getElementById(
      button.getAttribute("aria-controls")!,
    );
    expect(target).toBe(subList());
    expect(target!.tagName).toBe("UL");
    click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("식비 하위 카테고리");
    expect(button.textContent).toBe("");
    click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("식비 하위 카테고리");
  });

  it("누르는 영역 44(보이는 상자 = 누르는 영역) · 모서리 10 · 20 꺾쇠 · 단추 뒤 4 · 올리거나 누르면 단추만 바탕 · 누르면 2px 거리 축소(기준 44)", () => {
    render(<Food />);
    expect(classes(expandButton())).toEqual(
      expect.arrayContaining([
        "size-[44px]",
        "rounded-r2_5",
        "mr-x1",
        "text-fg-neutral-subtle",
        "cursor-pointer",
        "[--press-basis:44]",
        "[@media(hover:hover)]:hover:bg-bg-layer-default-pressed",
        "active:bg-bg-layer-default-pressed",
        "active:[scale:calc(1-2/var(--press-basis))]",
        "motion-reduce:active:[scale:1]",
        // 키보드 포커스에만 단추 안쪽 링 2px
        "focus-visible:outline-2",
        "focus-visible:-outline-offset-2",
        "focus-visible:outline-stroke-focus-ring",
        "z-1",
      ]),
    );
    const icon = expandButton().querySelector("svg")!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(classes(icon)).toEqual(
      expect.arrayContaining(["size-x5", "motion-reduce:transition-none"]),
    );
    // 꺾쇠는 chevron-right — 접히면 오른쪽(0°), 펼치면 아래(90°)
    expect(icon.getAttribute("class")).toContain("lucide-chevron-right");
    expect(classes(icon)).toContain("rotate-0");
    click(expandButton());
    expect(classes(expandButton().querySelector("svg")!)).toContain(
      "rotate-90",
    );
    // 회전은 300ms · motion-ease-easing
    expect(classes(icon).join(" ")).toContain(
      "[transition:rotate_var(--motion-duration-d6)_var(--motion-ease-easing)]",
    );
  });

  it("꺾쇠 단추는 줄과 따로 눌린다 — 단추를 눌러도 줄의 편집은 열리지 않고, 줄을 눌러도 접히지 않는다", () => {
    const onEdit = vi.fn();
    render(<Food onEdit={onEdit} />);
    click(expandButton());
    expect(onEdit).not.toHaveBeenCalled();
    expect(expandButton().getAttribute("aria-expanded")).toBe("true");
    click(byText("지출 · 하위 2개"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(expandButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("접힘이 기본 — 하위 줄 묶음은 hidden(그리지 않는다), 펼치면 보이고 안의 줄은 늘 DOM 에 있다", () => {
    render(<Food />);
    expect(subList().hidden).toBe(true);
    expect(subList().getAttribute("data-state")).toBe("closed");
    expect(slots("list-item", subList())).toHaveLength(2);
    click(expandButton());
    expect(subList().hidden).toBe(false);
    expect(subList().getAttribute("data-state")).toBe("open");
    click(expandButton());
    expect(subList().hidden).toBe(true);
  });

  it("처음 펼침은 화면이 정한다 — defaultOpen", () => {
    render(<Food defaultOpen />);
    expect(expandButton().getAttribute("aria-expanded")).toBe("true");
    expect(subList().hidden).toBe(false);
  });

  it("쥐고 다루는 펼침 — open 을 따르고 onOpenChange 로 바꾸려는 값을 알린다(안 바꿔 주면 그대로)", () => {
    const onOpenChange = vi.fn();
    render(<Food open={false} onOpenChange={onOpenChange} />);
    click(expandButton());
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(expandButton().getAttribute("aria-expanded")).toBe("false");
    render(<Food open onOpenChange={onOpenChange} />);
    expect(expandButton().getAttribute("aria-expanded")).toBe("true");
    click(expandButton());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("스스로 다룰 때도 onOpenChange 를 부른다", () => {
    const onOpenChange = vi.fn();
    render(<Food onOpenChange={onOpenChange} />);
    click(expandButton());
    click(expandButton());
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it("부모 줄은 줄 앞 4 · 앞 붙이개가 52 에서 시작한다 — 하위 줄은 부모의 제목 자리 104 에서 시작하고 누름 바탕은 줄 폭 그대로", () => {
    render(<Food defaultOpen />);
    const parentContent = slot("list-content");
    expect(classes(parentContent)).toEqual(
      expect.arrayContaining(["pl-x1", "pr-global-gutter"]),
    );
    expect(classes(parentContent)).not.toContain("px-global-gutter");
    // 꺾쇠 단추(44) 가 앞 붙이개 앞에 선다
    expect(parentContent.firstElementChild).toBe(expandButton());
    expect(expandButton().nextElementSibling).toBe(slot("list-prefix"));
    const children = slots("list-content", subList());
    expect(children).toHaveLength(2);
    for (const content of children) {
      expect(classes(content)).toEqual(
        expect.arrayContaining(["pl-[104px]", "pr-global-gutter"]),
      );
    }
    // 하위 줄의 바탕 층은 줄 폭 그대로 — 들임은 콘텐츠 층만
    for (const bg of slots("list-background", subList())) {
      expect(classes(bg)).toContain("inset-x-0");
    }
  });

  it("하위가 없는 부모 줄은 같은 폭(44 + 4)의 빈 자리를 둔다 — 부모 타일이 모두 52 에 선다, 꺾쇠 단추 · 하위 줄 묶음은 없다", () => {
    render(<Food />);
    const second = slots("list-parent-item")[1]!;
    expect(slot("list-expand-button", second)).toBeNull();
    expect(slot("list-sub-list", second)).toBeNull();
    const spot = slot("list-expand-slot", second);
    expect(spot.getAttribute("aria-hidden")).toBe("true");
    expect(classes(spot)).toEqual(
      expect.arrayContaining(["size-[44px]", "mr-x1", "shrink-0"]),
    );
    expect(spot.nextElementSibling).toBe(slot("list-prefix", second));
    // 접힌 부모와 같은 자리에서 시작한다
    expect(classes(slot("list-content", second))).toEqual(
      classes(slots("list-content")[0]!),
    );
  });

  it("collapsible={false}(늘 펼친 편집 모드) — 꺾쇠 자리를 비우고(aria-hidden · 같은 폭) 하위 줄은 늘 보이며 aria-expanded 가 없다", () => {
    render(<Food collapsible={false} />);
    expect(expandButton()).toBeNull();
    const slotEls = slots("list-expand-slot");
    expect(slotEls).toHaveLength(2);
    for (const el of slotEls) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(classes(el)).toEqual(
        expect.arrayContaining(["size-[44px]", "mr-x1", "shrink-0"]),
      );
    }
    expect(subList().hidden).toBe(false);
    expect(subList().getAttribute("data-state")).toBe("open");
    expect(container.querySelector("[aria-expanded]")).toBeNull();
    // 줄 본문은 그대로 눌린다
    expect(slot("list-body").tagName).toBe("BUTTON");
  });

  it("collapsible 은 기본 true — 접는 줄은 expandLabel 이 필수다(빠뜨리면 타입 오류), 늘 펼친 줄은 expandLabel · open 을 받지 않는다", () => {
    render(
      <List>
        {/* @ts-expect-error 접는 줄(기본)은 expandLabel 이 필수다 */}
        <ListParentItem title="식비">
          <ListButtonItem title="외식" />
        </ListParentItem>
        {/* @ts-expect-error 늘 펼친 줄은 expandLabel 을 받지 않는다 */}
        <ListParentItem
          collapsible={false}
          expandLabel="식비 하위 카테고리"
          title="취미"
        />
        {/* @ts-expect-error 늘 펼친 줄은 open 을 받지 않는다 */}
        <ListParentItem collapsible={false} open title="여행" />
      </List>,
    );
    // 타입이 막는 것과 별개로 런타임은 안전하다 — expandLabel 없이도 그려진다
    expect(slots("list-parent-item")).toHaveLength(3);
  });

  it("Tab 은 꺾쇠 단추 → 그 줄 → 펼친 하위 줄 → 다음 부모의 줄 — 접힌 하위 줄은 건너뛴다, 단추는 줄에 가려지지 않는다", () => {
    render(<Food defaultOpen />);
    expect(tabStops().map((el) => el.textContent)).toEqual([
      "",
      "식비지출 · 하위 2개",
      "외식",
      "배달음식",
      "기타지출 · 하위 없음",
    ]);
    expect(tabStops()[0]).toBe(expandButton());
    click(expandButton());
    expect(tabStops().map((el) => el.textContent)).toEqual([
      "",
      "식비지출 · 하위 2개",
      "기타지출 · 하위 없음",
    ]);
  });

  it("펼침 · 접힘은 높이 300ms — 펼칠 때 0 에서 전체 높이까지, 접을 때 지금 높이에서 0 까지, 끝나면 숨긴다", () => {
    const animations: {
      keyframes: Keyframe[];
      options: KeyframeAnimationOptions;
      anim: { onfinish: (() => void) | null; cancel: () => void };
    }[] = [];
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      writable: true,
      value: vi.fn(
        (keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
          const anim = {
            onfinish: null as (() => void) | null,
            cancel: vi.fn(),
          };
          animations.push({ keyframes, options, anim });
          return anim;
        },
      ),
    });
    try {
      render(<Food />);
      // 처음 그릴 때는 움직이지 않는다
      expect(animations).toHaveLength(0);
      click(expandButton());
      expect(animations).toHaveLength(1);
      expect(animations[0]!.options.duration).toBe(300);
      expect(Object.keys(animations[0]!.keyframes[0]!)).toEqual(["height"]);
      expect(animations[0]!.keyframes[0]).toEqual({ height: "0px" });
      expect(subList().hidden).toBe(false);
      act(() => animations[0]!.anim.onfinish?.());
      click(expandButton());
      expect(animations).toHaveLength(2);
      expect(animations[1]!.options.duration).toBe(300);
      expect(animations[1]!.keyframes[1]).toEqual({ height: "0px" });
      // 접히는 동안은 아직 그려져 있고, 끝나면 숨긴다
      expect(subList().hidden).toBe(false);
      act(() => animations[1]!.anim.onfinish?.());
      expect(subList().hidden).toBe(true);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });

  it("모션 줄이기면 높이를 움직이지 않고 150ms 서서히 나타나고 사라진다", () => {
    const animations: {
      keyframes: Keyframe[];
      options: KeyframeAnimationOptions;
    }[] = [];
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      writable: true,
      value: vi.fn(
        (keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
          animations.push({ keyframes, options });
          return { onfinish: null, cancel: vi.fn() };
        },
      ),
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    try {
      render(<Food />);
      click(expandButton());
      expect(animations).toHaveLength(1);
      expect(animations[0]!.options.duration).toBe(150);
      expect(animations[0]!.keyframes).toEqual([
        { opacity: 0 },
        { opacity: 1 },
      ]);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });

  it("막힌 부모 줄 — 줄은 막히고 비활성 색, 꺾쇠 단추는 따로 눌린다", () => {
    const onEdit = vi.fn();
    render(
      <List aria-label="지출 카테고리">
        <ListParentItem
          disabled
          prefix={<ListTile />}
          title="식비"
          expandLabel="식비 하위 카테고리"
          onClick={onEdit}
        >
          <ListButtonItem title="외식" />
        </ListParentItem>
      </List>,
    );
    const row = container.querySelector<HTMLButtonElement>(
      "[data-slot=list-body]",
    )!;
    expect(row.disabled).toBe(true);
    click(row);
    expect(onEdit).not.toHaveBeenCalled();
    expect(classes(slot("list-title"))).toContain("text-fg-disabled");
    click(expandButton());
    expect(expandButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("ref · className 은 줄의 버튼으로, rootProps 는 부모 li 로", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <List>
        <ListParentItem
          ref={ref}
          className="btn-extra"
          rootProps={{ id: "food" }}
          title="식비"
          expandLabel="식비 하위 카테고리"
        />
      </List>,
    );
    expect(ref.current).toBe(slot("list-body"));
    expect(classes(ref.current!)).toContain("btn-extra");
    expect(slot("list-parent-item").id).toBe("food");
  });
});

// ── 가장 나쁜 값 ─────────────────────────────────────────────

describe("가장 나쁜 값", () => {
  it("아주 긴 제목 · 설명은 줄을 바꿔 끝까지 그린다 — 말줄임 · 줄 수 제한이 없고 긴 낱말도 칸 안에서 끊기게 min-w-0", () => {
    const longTitle =
      "롯데백화점 본점 지하 1층 식품관 프리미엄 한우 선물세트 · 추석 명절 대량 구매 ".repeat(
        3,
      );
    const longWord = "porest-desk-front-design-system-list-component".repeat(4);
    render(
      <List>
        <ListButtonItem align="top" title={longTitle} detail={longWord} />
      </List>,
    );
    expect(slot("list-title").textContent).toBe(longTitle);
    expect(slot("list-detail").textContent).toBe(longWord);
    for (const el of container.querySelectorAll("*")) {
      expect(el.className?.toString()).not.toMatch(
        /(^|\s)(truncate|line-clamp-\d|text-ellipsis|overflow-hidden|whitespace-nowrap)(\s|$)/,
      );
    }
    // 본문은 제목의 가장 긴 낱말 폭(min-content)까지만 줄고, 제목은 break-word(min-content 를 줄이지 않는다) · 글 설명은 칸 끝에서 끊는다(안 B)
    expect(classes(slot("list-body"))).toEqual(
      expect.arrayContaining(["min-w-min", "flex-1", "pr-x2_5"]),
    );
    expect(classes(slot("list-body"))).not.toContain("min-w-0");
    // 글 제목은 anywhere + 높이 0 ::before(data-ruler)가 min-content 만 정한다 — 가장 긴 낱말 폭, 상한은 (줄 안 폭 − 앞 자리) ÷ 2.
    // 제목 자신에 max-width 를 걸지 않는다(띄어쓰기 있는 제목이 절반에서 줄을 바꾸면 안 된다)
    const titleClasses = classes(slot("list-title"));
    expect(titleClasses).toContain("[overflow-wrap:anywhere]");
    expect(titleClasses).toContain("before:content-[attr(data-ruler)]");
    expect(titleClasses).toContain(
      "before:[max-inline-size:calc((100cqw-var(--list-gutters,58px)-var(--list-lead-p,0px)-var(--list-lead-e,0px))/2)]",
    );
    expect(titleClasses.some((c) => c.startsWith("max-w-"))).toBe(false);
    expect(slot("list-title").getAttribute("data-ruler")).toBe(longTitle);
    expect(classes(slot("list-detail"))).toContain("[overflow-wrap:anywhere]");
    expect(classes(slot("list-content"))).toContain("items-start");
  });

  it("두 글자 제목 + 긴 값 — 본문은 제목 낱말 폭(min-content) 아래로 줄지 않고 값이 남은 폭에서 줄을 바꾼다", () => {
    render(
      <List>
        <ListItem
          title="장소"
          suffix="서울특별시 강남구 테헤란로 123 그루빌딩 지하 1층 대회의실 B"
        />
        <ListButtonItem
          title="이메일"
          suffix="groo.desk.design.system.long.address@example-company-domain.co.kr"
        />
      </List>,
    );
    for (const body of slots("list-body")) {
      // 1em(한 글자) 고정이 아니라 min-content — 두 글자 제목이 "장/소" 로 갈라지지 않는다
      expect(classes(body)).toContain("min-w-min");
      expect(classes(body).join(" ")).not.toContain("--text-t5");
      expect(classes(body)).not.toContain("min-w-0");
    }
    for (const value of slots("list-suffix")) {
      expect(value.getAttribute("data-value")).toBe("text");
      expect(classes(value)).toEqual(
        expect.arrayContaining([
          "min-w-0",
          "shrink",
          "[overflow-wrap:anywhere]",
        ]),
      );
    }
  });

  it("제목 상한(절반)의 앞 자리는 상수다 — 앞 붙이개 54 · 꺾쇠 48, 재지 않는다. 좁은 줄에서는 풀린다", () => {
    render(
      <List>
        <ListItem title="없음" suffix="값" />
        <ListItem prefix={<svg />} title="앞" suffix="값" />
      </List>,
    );
    const [plain, withPrefix] = slots("list-content");
    const lead = (el: Element) => classes(el).join(" ");
    // 앞 붙이개 유무는 has() 로 갈리고 값은 상수다
    expect(lead(plain!)).toContain(
      "has-[>[data-slot=list-prefix]]:[--list-lead-p:54px]",
    );
    expect(lead(plain!)).toContain(
      "has-[>:is([data-slot=list-expand-button],[data-slot=list-expand-slot])]:[--list-lead-e:48px]",
    );
    expect(plain!.querySelector("[data-slot=list-prefix]")).toBeNull();
    expect(
      withPrefix!.querySelector(":scope > [data-slot=list-prefix]"),
    ).not.toBeNull();
    expect(lead(plain!)).toContain("[&_[data-slot=list-title]]:before:hidden");
    // 인라인으로 재서 넘기지 않는다
    expect(plain!.getAttribute("style") ?? "").not.toContain("--list-lead");
  });

  it("좁은 줄에서 값 안쪽의 오른쪽 맞춤 표식을 왼쪽으로 푼다 — 세 단계 모두, 값 요소와 자손만", () => {
    render(
      <List>
        <ListItem title="줄" suffix={<b>1원</b>} />
        <ListParentItem title="부모" expandLabel="부모 하위" defaultOpen>
          <ListItem title="하위" suffix={<b>2원</b>} />
        </ListParentItem>
      </List>,
    );
    const [plain, parent, child] = slots("list-content");
    const RIGHT =
      ":is(.items-end,.justify-end,.text-end,.text-right,.self-end,.ml-auto)";
    for (const [content, threshold] of [
      [plain!, "calc(16rem+48px)"],
      [parent!, "calc(16rem+28px)"],
      [child!, "calc(16rem+128px)"],
    ] as const) {
      const cls = classes(content).join(" ");
      expect(cls).toContain(`@max-[${threshold}]/list-item:`);
      expect(cls).toContain(`${RIGHT}]:items-start!`);
      expect(cls).toContain(`${RIGHT}]:text-start!`);
      expect(cls).toContain(`${RIGHT}]:justify-start!`);
      // 화살표 · 컨트롤은 건드리지 않는다 — 값 요소 선택자는 :not(컨트롤) 이다
      expect(cls).toContain(":not(svg,button,a,input,[data-slot=list-mark])");
    }
  });

  it("ResizeObserver 를 쓰지 않는다 — 수백 줄 목록에서 줄마다 관찰자를 달지 않는다", () => {
    const ro = vi.fn();
    vi.stubGlobal("ResizeObserver", ro);
    render(
      <List>
        <ListItem prefix={<svg />} title="앞" suffix="값" />
        <ListParentItem title="부모" expandLabel="부모 하위" defaultOpen>
          <ListItem title="하위" />
        </ListParentItem>
      </List>,
    );
    expect(ro).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("data-ruler 는 제목 글이 바뀔 때만 다시 쓴다 — 같은 글로 다시 그려도 DOM 을 쓰지 않는다", () => {
    const rerender = render;
    render(
      <List>
        <ListItem title="가나다" />
      </List>,
    );
    const title = slot("list-title");
    expect(title.getAttribute("data-ruler")).toBe("가나다");
    const writes: string[] = [];
    const mo = new MutationObserver((rs) =>
      rs.forEach((r) => writes.push(r.attributeName ?? "")),
    );
    mo.observe(title, { attributes: true });
    rerender(
      <List>
        <ListItem title="가나다" />
      </List>,
    );
    expect(mo.takeRecords()).toHaveLength(0);
    rerender(
      <List>
        <ListItem title="가나다라" />
      </List>,
    );
    expect(mo.takeRecords().map((r) => r.attributeName)).toEqual([
      "data-ruler",
    ]);
    expect(slot("list-title").getAttribute("data-ruler")).toBe("가나다라");
    mo.disconnect();
  });

  it("뒤 붙이개 — 요소(금액 · 화살표 · 컨트롤)는 줄지 않고, 글로 넘긴 값(이메일 · 계좌)은 줄 끝에서 끊어 본문 위로 넘치지 않는다", () => {
    render(
      <List>
        <ListItem title="금액" suffix={<b>-1,234,567,890,123원</b>} />
        <ListItem title="화살표" suffix={<svg />} />
        <ListItem
          title="이메일"
          suffix="groo.desk.design.system.long.address@example-company-domain.co.kr"
        />
        <ListItem title="횟수" suffix={12} />
      </List>,
    );
    const [money, arrow, email, count] = slots("list-suffix");
    for (const node of [money!, arrow!]) {
      expect(node.getAttribute("data-value")).toBe("node");
      expect(classes(node)).toContain("shrink-0");
      expect(classes(node)).not.toContain("[overflow-wrap:anywhere]");
    }
    for (const text of [email!, count!]) {
      expect(text.getAttribute("data-value")).toBe("text");
      expect(classes(text)).toEqual(
        expect.arrayContaining([
          "min-w-0",
          "shrink",
          "[overflow-wrap:anywhere]",
        ]),
      );
      expect(classes(text)).not.toContain("shrink-0");
    }
    // 말줄임으로 자르지 않는다(10A) — 글이 그대로 있다
    expect(email!.textContent).toContain("example-company-domain.co.kr");
    for (const el of container.querySelectorAll("*")) {
      expect(el.className?.toString()).not.toMatch(
        /(^|\s)(truncate|text-ellipsis|overflow-hidden|whitespace-nowrap)(\s|$)/,
      );
    }
  });

  it("1억이 넘는 금액은 줄지 않고(shrink-0 — 본문이 양보한다) · 접힌 하위 줄이 많은 부모는 줄 하나 + 숨긴 묶음", () => {
    render(
      <List>
        <ListButtonItem title="입출금 통장" suffix={<b>-123,456,789원</b>} />
        <ListParentItem title="식비" expandLabel="식비 하위 카테고리">
          {Array.from({ length: 48 }, (_, i) => (
            <ListButtonItem key={i} title={`하위 ${i + 1}`} />
          ))}
        </ListParentItem>
      </List>,
    );
    expect(classes(slots("list-suffix")[0]!)).toContain("shrink-0");
    expect(slot("list-sub-list").hidden).toBe(true);
    expect(slots("list-item", slot("list-sub-list"))).toHaveLength(48);
    // 접힌 동안 Tab 은 하위 48 줄을 건너뛴다
    expect(tabStops().map((el) => el.textContent)).toEqual([
      "입출금 통장",
      "",
      "식비",
    ]);
  });

  it("빈 목록 · 줄이 하나인 목록도 그린다", () => {
    render(<List aria-label="빈 목록" />);
    expect(container.querySelector("ul")!.children).toHaveLength(0);
    render(
      <List>
        <ListItem title="하나" />
      </List>,
    );
    expect(slots("list-item")).toHaveLength(1);
  });
});

describe("ListCheckItem · locked (끌 수 없는 켬 — 칸만 막는다, list.md)", () => {
  const render = (node: ReactNode) => act(() => root.render(node));
  const lockedRow = (onChange = vi.fn()) => (
    <ListCheckGroup aria-label="캘린더">
      <ListCheckItem
        locked
        onCheckedChange={onChange}
        prefix={<span data-testid="dot">●</span>}
        title={
          <>
            개인 <span data-testid="badge">기본</span>
          </>
        }
      />
      <ListCheckItem checked={false} onCheckedChange={() => {}} title="가족" />
    </ListCheckGroup>
  );

  it('칸은 체크 + 막힘이고 포커스에서 빠진다 — 낭독은 "개인 기본, 체크됨, 사용할 수 없음"', () => {
    render(lockedRow());
    const box = container.querySelector<HTMLElement>("[role=checkbox]")!;
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect((box as HTMLButtonElement).disabled).toBe(true);
    // 이름은 제목 · 배지 글(라벨), 상태는 체크됨 · 막힘(사용할 수 없음)
    const name = (box as HTMLButtonElement).labels?.[0]?.textContent ?? "";
    expect(name.replace(/\s+/g, " ")).toContain("개인 기본");
    expect(box.getAttribute("data-disabled")).not.toBeNull();
  });

  it("줄은 누르지 못한다 — 눌러도 바뀌지 않고 호버 · 누름 바탕 표식에서 빠진다", () => {
    const onChange = vi.fn();
    render(lockedRow(onChange));
    const label = container.querySelector<HTMLElement>(
      "[data-slot=list-content]",
    )!;
    expect(label.getAttribute("data-disabled")).not.toBeNull();
    act(() => label.click());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("제목 · 앞 붙이개 · 배지는 보통 색이다 — 줄 전체 막힘(disabled)의 회색이 아니다", () => {
    render(lockedRow());
    const row = container.querySelector<HTMLElement>("[data-slot=list-item]")!;
    // 칸(체크)만 회색이다 — 제목 · 앞 붙이개 자리는 보통 색
    expect(
      row.querySelector("[data-slot=list-title]")!.className,
    ).not.toContain("disabled");
    expect(
      row.querySelector("[data-slot=list-prefix]")!.className,
    ).not.toContain("disabled");
    expect(
      row.querySelector("[data-testid=dot]")!.closest("span[data-slot]")!
        .className,
    ).not.toContain("text-fg-disabled");
    const other = container.querySelectorAll(
      "[role=checkbox]",
    )[1] as HTMLButtonElement;
    // 보통 줄은 그대로 눌린다
    expect(other.disabled).toBe(false);
  });

  it("locked 가 아닌 disabled 는 지금처럼 줄 전체를 막는다", () => {
    render(
      <ListCheckGroup aria-label="캘린더">
        <ListCheckItem
          disabled
          checked
          onCheckedChange={() => {}}
          title="가족"
        />
      </ListCheckGroup>,
    );
    const row = container.querySelector<HTMLElement>("[data-slot=list-item]")!;
    expect(row.querySelector("[data-slot=list-title]")!.className).toMatch(
      /disabled/,
    );
  });
});

describe("List — 값이 글인데 안에 버튼이 든 뒤 붙이개(일정 폼 시작 · 종료)", () => {
  it("좁은 줄에서 값을 본문 아래로 내리는 규칙이 글 값(data-value=text)에도 걸려 있다", () => {
    act(() =>
      root.render(
        <List aria-label="값">
          <ListItem
            title="시작"
            suffixText
            suffix={
              <span>
                <button type="button">11월 2일</button>
              </span>
            }
          />
        </List>,
      ),
    );
    const suffix = container.querySelector<HTMLElement>(
      "[data-slot=list-suffix]",
    )!;
    expect(suffix.dataset.value).toBe("text");
    // 버튼이 직접 자식이 아닌 글 값 — 줄(content 층)의 클래스에 이 값을 아래로 내리는 선택자가 있다
    const content = suffix.parentElement!;
    expect(content.className).toContain(
      "[data-value=text]:not(:has(>:is(svg,button",
    );
  });
});

describe("List — 글 값은 줄 수와 상관없이 줄 끝 오른쪽 맞춤", () => {
  it("글 값 뒤 붙이개(data-value=text)에 text-end, 금액 노드에는 없다", () => {
    act(() =>
      root.render(
        <List aria-label="값">
          <ListItem
            title="장소"
            suffixText
            suffix="서울시 강남구 테헤란로 123 한국빌딩 7층"
          />
          <ListItem title="금액" suffix={<b>1,000원</b>} />
        </List>,
      ),
    );
    const [text, node] = [
      ...container.querySelectorAll<HTMLElement>("[data-slot=list-suffix]"),
    ] as [HTMLElement, HTMLElement];
    expect(text.dataset.value).toBe("text");
    expect(text.className).toContain("text-end");
    expect(node.dataset.value).toBe("node");
    expect(node.className).not.toContain("text-end");
  });
});

describe("뒤 붙이개 안의 버튼", () => {
  it("Input Button 의 누르는 층(상자를 덮는 absolute)은 relative 로 덮지 않는다", () => {
    const { listSuffixVariants } = variants;
    const cls = listSuffixVariants();
    // 일반 버튼 · 링크는 줄의 ::after 위로 올린다
    expect(cls).toContain(
      "[&_button:not([data-slot=input-button]>button)]:relative",
    );
    // 모든 button 에 거는 규칙은 없다 — 있으면 Input Button 층의 폭이 0 이 된다
    expect(cls).not.toMatch(/(^|\s)\[&_button\]:relative/);
  });
});
