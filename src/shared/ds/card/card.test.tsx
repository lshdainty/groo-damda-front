// Card 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { List, ListButtonItem } from "@/shared/ds/list";
import { trackInputModality } from "@/shared/lib/input-modality";
import {
  pressKey,
  pressPointer,
  ringTargets,
} from "@/shared/lib/input-modality.test-utils";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardHeroAmount,
  CardHeroDetail,
  CardHeroLabel,
  CardLink,
  CardStat,
  CardTitle,
  Delta,
} from "./card";

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

const slot = (name: string) =>
  container.querySelector<HTMLElement>(`[data-slot=${name}]`);

// 이름 — aria-labelledby 가 가리키는 글을 이어 붙인다
function nameOf(el: HTMLElement) {
  const ids = el.getAttribute("aria-labelledby")?.split(" ") ?? [];
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();
}

describe("Card — 면", () => {
  it("기본은 default · content · 보기만 하는 div — 역할이 없다", () => {
    const card = render(<Card>본문</Card>);
    expect(card.tagName).toBe("DIV");
    expect(card.dataset.variant).toBe("default");
    expect(card.dataset.body).toBe("content");
    expect(card.dataset.press).toBe("none");
    expect(card.getAttribute("role")).toBeNull();
    expect(card.tabIndex).toBe(-1);
  });

  it("바닥 위 흰 면 + 1px 테두리 · 모서리 16 · 여백 24 · 그림자 없음", () => {
    const card = render(<Card>본문</Card>);
    for (const c of [
      "bg-bg-layer-default",
      "border",
      "border-stroke-neutral-weak",
      "rounded-r4",
      "p-x6",
      "overflow-hidden",
    ])
      expect(card.className).toContain(c);
    expect(card.className).not.toMatch(/shadow/);
  });

  it("목록 카드 — 좌우 · 위 여백 0, 아래 12, 머리가 없으면 위도 12", () => {
    const card = render(
      <Card body="list">
        <ul />
      </Card>,
    );
    expect(card.dataset.body).toBe("list");
    expect(card.className).not.toContain("p-x6");
    expect(card.className).toContain("pb-x3");
    expect(card.className).toContain(
      "[&:not(:has(>[data-slot=card-header]))]:pt-x3",
    );
  });

  it("카드 안 목록의 누름 바탕 모서리는 List 기본 10(카드 16 − 6) — 카드가 덮지 않는다", () => {
    const card = render(
      <Card body="list">
        <List aria-label="오늘 쓴 돈">
          <ListButtonItem title="점심" onClick={() => {}} />
        </List>
      </Card>,
    );
    expect(
      card.querySelector("ul")!.style.getPropertyValue("--list-item-radius"),
    ).toBe("");
    expect(slot("list-background")!.className).toContain(
      "rounded-[var(--list-item-radius,var(--radius-r2_5))]",
    );
  });

  it("아코디언 카드 — 아래 8, 머리가 없으면 위도 8", () => {
    const card = render(<Card body="accordion" />);
    expect(card.className).toContain("pb-x2");
    expect(card.className).not.toContain("p-x6");
  });

  it("머리는 동작이 머리 폭의 절반을 넘으면 제목 아래 줄 오른쪽 끝으로 내려가는 클래스를 가진다 — 제목 최소 50% · 줄바꿈(03-G 4A)", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>제목</CardTitle>
          <button type="button">전체 보기</button>
        </CardHeader>
      </Card>,
    );
    const cls = slot("card-header")!.className.split(" ");
    expect(cls).toEqual(
      expect.arrayContaining([
        "flex-wrap",
        "[&>:first-child:not(:last-child)]:min-w-[50%]",
        "[&>:first-child:not(:last-child)]:flex-1",
        "[&>:last-child:not(:first-child)]:ml-auto",
      ]),
    );
  });

  it("머리는 본문 종류를 따른다 — 글 카드 아래 8, 목록 카드 위 24 · 좌우 24 · 아래 4", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>제목</CardTitle>
        </CardHeader>
      </Card>,
    );
    expect(slot("card-header")!.className).toContain("pb-x2");
    render(
      <Card body="list">
        <CardHeader>
          <CardTitle>제목</CardTitle>
        </CardHeader>
      </Card>,
    );
    const header = slot("card-header")!;
    for (const c of ["px-x6", "pt-x6", "pb-x1"])
      expect(header.className).toContain(c);
  });

  it("제목은 h2 기본, as 로 바꾼다 · 16 / 22 · 700", () => {
    render(
      <Card>
        <CardTitle>오늘 쓴 돈</CardTitle>
      </Card>,
    );
    expect(slot("card-title")!.tagName).toBe("H2");
    expect(slot("card-title")!.className).toContain("text-t5");
    expect(slot("card-title")!.className).toContain("font-bold");
    render(
      <Card>
        <CardTitle as="h3">오늘 쓴 돈</CardTitle>
      </Card>,
    );
    expect(slot("card-title")!.tagName).toBe("H3");
  });

  it("className 을 덧붙이고 ref 를 넘긴다", () => {
    const ref = createRef<HTMLElement>();
    const card = render(
      <Card ref={ref} className="mt-x2">
        본문
      </Card>,
    );
    expect(ref.current).toBe(card);
    expect(card.className).toContain("mt-x2");
  });
});

describe("Card — 머리 동작", () => {
  it('링크(href)와 버튼(onClick)을 가르고 이름은 "{제목} {글}" 이다', () => {
    render(
      <Card body="list">
        <CardHeader>
          <CardTitle>오늘 쓴 돈</CardTitle>
          <CardAction href="/desk/ledger">전체 보기</CardAction>
        </CardHeader>
      </Card>,
    );
    const link = slot("card-action")!;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/desk/ledger");
    expect(nameOf(link)).toBe("오늘 쓴 돈 전체 보기");

    const onClick = vi.fn();
    render(
      <Card>
        <CardHeader>
          <CardTitle>예산</CardTitle>
          <CardAction onClick={onClick}>관리</CardAction>
        </CardHeader>
      </Card>,
    );
    const button = slot("card-action")!;
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    act(() => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(nameOf(button)).toBe("예산 관리");
  });

  it("aria-label 을 주면 그것이 이름이다 — labelledby 는 달지 않는다", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>예산</CardTitle>
          <CardAction aria-label="예산 관리하기" onClick={() => {}}>
            관리
          </CardAction>
        </CardHeader>
      </Card>,
    );
    const button = slot("card-action")!;
    expect(button.getAttribute("aria-label")).toBe("예산 관리하기");
    expect(button.getAttribute("aria-labelledby")).toBeNull();
  });

  it("글 버튼(SEED Text Button) — 보이는 상자 36 · 좌우 14 · 700 · muted · 누르는 영역 44 · 꺾쇠 없음", () => {
    render(
      <Card>
        <CardAction onClick={() => {}}>전체 보기</CardAction>
      </Card>,
    );
    const action = slot("card-action")!;
    expect(action.className).toContain("min-h-[36px]");
    expect(action.className).toContain("px-x3_5");
    expect(action.className).toContain("-mr-x3_5");
    expect(action.className).toContain("font-bold");
    expect(action.className).toContain("text-fg-neutral-muted");
    expect(action.className).toContain("before:h-[44px]");
    expect(action.className).toContain("before:min-w-[44px]");
    expect(action.querySelector("svg")).toBeNull();
  });

  it("누르는 순간 --press-basis 를 잰다 · 모션 줄이기면 축소하지 않는다", () => {
    render(
      <Card>
        <CardAction onClick={() => {}}>전체 보기</CardAction>
      </Card>,
    );
    const action = slot("card-action")!;
    act(() => {
      action.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(action.style.getPropertyValue("--press-basis")).toBe("24");
    expect(action.className).toContain("motion-reduce:active:[scale:1]");
    expect(action.className).toContain("hover:bg-bg-layer-default-pressed");
  });
});

describe("Card — 누름", () => {
  it("href 를 주면 카드 전체가 링크(whole) — 색 + 2px 축소 · 포커스 링", () => {
    const card = render(<Card href="/desk/budget/1">본문</Card>);
    expect(card.tagName).toBe("A");
    expect(card.getAttribute("href")).toBe("/desk/budget/1");
    expect(card.dataset.press).toBe("whole");
    for (const c of [
      "hover:bg-bg-layer-default-pressed",
      "active:bg-bg-layer-default-pressed",
      "active:[scale:calc(1-2/var(--press-basis))]",
      "motion-reduce:active:[scale:1]",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
    ])
      expect(card.className).toContain(c);
  });

  it("onClick 만 주면 카드 전체가 버튼 — Enter · Space 도 누름으로 잰다", () => {
    const onClick = vi.fn();
    const card = render(<Card onClick={onClick}>본문</Card>);
    expect(card.tagName).toBe("BUTTON");
    expect(card.getAttribute("type")).toBe("button");
    act(() => card.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    act(() => {
      card.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    expect(card.style.getPropertyValue("--press-basis")).toBe("24");
  });

  it("누를 곳이 없는 press=whole 은 보기만 하는 카드로 그린다", () => {
    const card = render(<Card press="whole">본문</Card>);
    expect(card.tagName).toBe("DIV");
    expect(card.dataset.press).toBe("none");
  });

  it("peers — 면 색만 바뀌고 축소는 없다, 안의 버튼이 카드 링크 위에 놓인다", () => {
    const onPin = vi.fn();
    const onOpen = vi.fn();
    const card = render(
      <Card press="peers">
        <CardLink href="/memo/1" onClick={onOpen}>
          장보기
        </CardLink>
        <button type="button" onClick={onPin}>
          고정
        </button>
      </Card>,
    );
    expect(card.dataset.press).toBe("peers");
    expect(card.tagName).toBe("DIV");
    expect(card.className).not.toContain("scale");
    expect(card.className).toContain(
      "[&_button:not([data-slot=card-link])]:z-[1]",
    );
    const link = slot("card-link")!;
    expect(link.tagName).toBe("A");
    expect(link.className).toContain("after:absolute");
    expect(link.className).toContain("after:inset-0");
    act(() => card.querySelector("button")!.click());
    expect(onPin).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("카드 링크 링은 직전 입력이 포인터면 그리지 않는다 — 키로 오면 카드 둘레에 그린다(index.css focus-visible 과 같은 조건)", () => {
    trackInputModality();
    const card = render(
      <Card press="peers">
        <CardLink href="/memo/1">장보기</CardLink>
      </Card>,
    );
    act(() => slot("card-link")!.focus());
    pressPointer();
    expect(ringTargets(card)).toEqual([]);
    pressKey();
    expect(ringTargets(card)).toEqual([card]);
    expect(ringTargets(card, "outline-offset-2")).toEqual([card]);
  });

  it("CardLink 는 href 가 없으면 버튼이다", () => {
    render(
      <Card press="peers">
        <CardLink onClick={() => {}}>장보기</CardLink>
      </Card>,
    );
    expect(slot("card-link")!.tagName).toBe("BUTTON");
  });

  it("보기만 하는 카드는 호버 · 누름 색이 없다", () => {
    const card = render(<Card>본문</Card>);
    expect(card.className).not.toContain("hover:");
    expect(card.className).not.toContain("active:");
  });
});

describe("Delta — 증감", () => {
  it("up 은 ▲ fg-critical, down 은 ▼ fg-informative — 값과 기준 글이 함께", () => {
    render(<Delta direction="up" value="12%" text="지난달보다" />);
    expect(slot("delta-value")!.textContent).toBe("▲ 12%");
    expect(slot("delta-value")!.className).toContain("text-fg-critical");
    expect(slot("delta-text")!.textContent).toBe("지난달보다");
    render(<Delta direction="down" value="3%" text="지난달보다" />);
    expect(slot("delta-value")!.textContent).toBe("▼ 3%");
    expect(slot("delta-value")!.className).toContain("text-fg-informative");
  });

  it('값 앞의 부호는 떼고 보인다 — "+-12.5%" 가 아니라 "▼ 12.5%"', () => {
    for (const v of ["+12.5%", "-12.5%", "−12.5%", "+-12.5%", "±12.5%"]) {
      render(<Delta direction="down" value={v} />);
      const shown = slot("delta-value")!.textContent!;
      expect(shown).toMatch(/^▼ [±]?12\.5%$/);
    }
    render(<Delta direction="up" value="+-12.5%" />);
    expect(slot("delta-value")!.textContent).toBe("▲ 12.5%");
  });

  it('flat 은 화살표도 기준 글도 없이 "변화 없음" 만 보인다', () => {
    render(<Delta direction="flat" text="지난달보다" />);
    expect(slot("delta-value")!.textContent).toBe("변화 없음");
    expect(slot("delta-text")).toBeNull();
    expect(slot("delta-value")!.className).toContain("text-fg-neutral-subtle");
  });

  it("보조 기술에는 문장으로 읽힌다 — 화살표 · 값 조각은 숨긴다", () => {
    render(<Delta direction="up" value="12%" text="지난달보다" />);
    const box = slot("delta")!;
    expect(box.querySelector(".sr-only")!.textContent).toBe(
      "지난달보다 12% 늘었어요",
    );
    expect(slot("delta-value")!.getAttribute("aria-hidden")).toBe("true");
    expect(slot("delta-text")!.getAttribute("aria-hidden")).toBe("true");
    render(<Delta direction="down" value="−3%" text="지난달보다" />);
    expect(slot("delta")!.querySelector(".sr-only")!.textContent).toBe(
      "지난달보다 3% 줄었어요",
    );
    render(<Delta direction="flat" text="지난달보다" />);
    expect(slot("delta")!.querySelector(".sr-only")!.textContent).toBe(
      "지난달보다 변화가 없어요",
    );
  });

  it("srText 를 주면 그 문장이 읽힌다(좋고 나쁨은 글이 말한다)", () => {
    render(
      <Delta
        direction="up"
        value="12%"
        text="지난달보다"
        srText="지난달보다 12% 더 썼어요"
      />,
    );
    expect(slot("delta")!.querySelector(".sr-only")!.textContent).toBe(
      "지난달보다 12% 더 썼어요",
    );
  });

  it("순자산 카드 안에서는 모두 흰 글자다", () => {
    render(
      <Card variant="hero">
        <Delta direction="up" value="1.8%" text="지난달보다" />
      </Card>,
    );
    expect(slot("delta-value")!.className).toContain("text-static-white");
    expect(slot("delta-value")!.className).not.toContain("text-fg-critical");
    expect(slot("delta-text")!.className).toContain("text-static-white");
  });
});

describe("CardStat — 지표", () => {
  it("라벨 · 숫자 · 증감 — 기본 large 24 / 32, small 20 / 27, 고정폭 숫자", () => {
    render(
      <Card>
        <CardStat
          label="이번 달 지출"
          value="1,240,000원"
          delta={{ direction: "up", value: "12%", text: "지난달보다" }}
        />
      </Card>,
    );
    expect(slot("card-stat")!.dataset.size).toBe("large");
    expect(slot("card-stat-label")!.textContent).toBe("이번 달 지출");
    expect(slot("card-stat-value")!.className).toContain("text-t9");
    expect(slot("card-stat-value")!.className).toContain("tabular-nums");
    expect(slot("delta")!.className).toContain("mt-x1");
    render(
      <Card>
        <CardStat size="small" label="지출" value="1,240,000원" />
      </Card>,
    );
    expect(slot("card-stat-value")!.className).toContain("text-t7");
    expect(slot("delta")).toBeNull();
  });

  it("1억이 넘는 금액도 줄이지 않고 그대로 보인다", () => {
    render(
      <Card>
        <CardStat label="순자산" value="−123,456,789,012원" />
      </Card>,
    );
    expect(slot("card-stat-value")!.textContent).toBe("−123,456,789,012원");
    expect(slot("card-stat-value")!.className).not.toContain("truncate");
  });

  it("금액은 쉼표 뒤에서만 줄을 바꾼다 — <wbr> 이 쉼표 뒤마다, 글자는 그대로(03-D 결정 2 B)", () => {
    render(
      <Card>
        <CardStat label="순자산" value="−123,456,789,012원" />
      </Card>,
    );
    const value = slot("card-stat-value")!;
    expect(value.querySelectorAll("wbr")).toHaveLength(3);
    expect(value.innerHTML).toBe("−123,<wbr>456,<wbr>789,<wbr>012원");
    expect(value.textContent).toBe("−123,456,789,012원");
    // 묶음 하나가 칸보다 길 때만 칸 끝 끊기 — flex 항목이라 min-content 까지 줄도록 anywhere + 칸 폭
    expect(value.className).toContain("[overflow-wrap:anywhere]");
    expect(value.className).toContain("max-w-full");
  });
});

describe("순자산 카드(hero)", () => {
  const hero = () =>
    render(
      <Card variant="hero">
        <CardHeroLabel>순자산</CardHeroLabel>
        <CardHeroAmount>42,898,100원</CardHeroAmount>
        <CardHeroDetail>아래 글</CardHeroDetail>
      </Card>,
    );

  it("순자산 금액도 쉼표 뒤에서만 줄을 바꾼다 — 글자는 그대로", () => {
    hero();
    const amount = slot("card-hero-amount")!;
    expect(amount.innerHTML).toBe("42,<wbr>898,<wbr>100원");
    expect(amount.textContent).toBe("42,898,100원");
  });

  it("브랜드 채움 그라디언트 — 다크는 끝 색이 다르다 · 테두리 없음 · 여백 24", () => {
    const card = hero();
    expect(card.dataset.variant).toBe("hero");
    expect(card.className).toContain("bg-bg-brand-solid");
    expect(card.className).toContain("var(--color-brand-900))");
    expect(card.className).toContain("dark:bg-[linear-gradient(135deg");
    expect(card.className).toContain("var(--color-brand-300-dark))");
    expect(card.className).toContain("border-0");
    expect(card.className).toContain("p-x6");
  });

  it("장식 빛은 글자 뒤에 깔리고 보조 기술에 숨긴다", () => {
    hero();
    const glow = slot("card-hero-glow")!;
    expect(glow.getAttribute("aria-hidden")).toBe("true");
    expect(glow.className).toContain("-z-10");
    expect(glow.className).toContain("size-[240px]");
  });

  it("글자 셋은 흰 글자이고 흐리게(불투명도) 두지 않는다", () => {
    hero();
    for (const name of [
      "card-hero-label",
      "card-hero-amount",
      "card-hero-detail",
    ]) {
      const cls = slot(name)!.className;
      expect(cls).toContain("text-static-white");
      expect(cls).not.toMatch(/opacity|\/\d/);
    }
    expect(slot("card-hero-amount")!.className).toContain("text-t12");
    expect(slot("card-hero-amount")!.className).toContain("font-bold");
  });

  it("누르면 면 색은 그대로, 축소만 한다", () => {
    const card = render(
      <Card variant="hero" href="/desk/assets">
        <CardHeroLabel>순자산</CardHeroLabel>
      </Card>,
    );
    expect(card.className).toContain("active:[scale:");
    expect(card.className).not.toContain("hover:bg-bg-layer-default-pressed");
    expect(card.className).not.toContain("active:bg-bg-layer-default-pressed");
  });

  it("body=list 를 줘도 순자산은 늘 글 카드 여백이다", () => {
    const card = render(<Card variant="hero" body="list" />);
    expect(card.dataset.body).toBe("content");
    expect(card.className).toContain("p-x6");
  });
});

describe("CardContent", () => {
  it("요소 사이 12 로 쌓는다", () => {
    render(
      <Card>
        <CardContent>
          <p>하나</p>
          <p>둘</p>
        </CardContent>
      </Card>,
    );
    expect(slot("card-content")!.className).toContain("gap-x3");
  });
});
