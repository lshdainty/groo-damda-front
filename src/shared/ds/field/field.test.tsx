// Field 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "./field";
import {
  countGraphemes,
  setNativeValue,
  sliceGraphemes,
  useFieldControl,
  useFieldGroup,
  useTextControl,
} from "./field-context";

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

// 입력 — Input · Textarea 가 Field 에 붙는 방법 그대로(useFieldControl + useTextControl)
function TestInput({
  onChange,
  onCompositionEnd,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  const control = useFieldControl(props);
  const text = useTextControl(ref, { onChange, onCompositionEnd });
  return (
    <input
      ref={ref}
      {...props}
      {...control}
      onChange={text.onChange}
      onCompositionEnd={text.onCompositionEnd}
    />
  );
}

// 묶음 — Checkbox · Radio · Select Box 묶음이 Field 에 붙는 방법 그대로(useFieldGroup)
function TestGroup(props: { "aria-label"?: string }) {
  const group = useFieldGroup(props);
  return <div role="radiogroup" {...group} />;
}

// 고르는 칸 — Input Button · Select 의 트리거처럼 버튼인 칸
function TestTrigger({ onClick }: { onClick: () => void }) {
  const control = useFieldControl({});
  return (
    <button type="button" {...control} onClick={onClick}>
      고르기
    </button>
  );
}

const input = () => container.querySelector("input")!;
const label = () => container.querySelector<HTMLElement>("[id$=label]")!;
const count = () => container.querySelector<HTMLElement>("[id$=count]")!;
const describedBy = (el: Element) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent);

describe("Field", () => {
  it("라벨은 칸과 잇는다 — <label for> 가 칸의 id, 설명은 aria-describedby", () => {
    render(
      <Field label="카테고리 이름" description="목록에 이 이름으로 보여요.">
        <TestInput />
      </Field>,
    );
    expect(label().tagName).toBe("LABEL");
    expect(label().getAttribute("for")).toBe(input().id);
    expect(input().labels?.[0]).toBe(label());
    expect(describedBy(input())).toEqual(["목록에 이 이름으로 보여요."]);
  });

  it("labelHidden — 라벨은 읽는 이름으로 남고 머리 줄은 흐름에서 빠져 칸 위 gap 이 한 칸 더 생기지 않는다", () => {
    render(
      <Field label="제목" labelHidden>
        <TestInput />
      </Field>,
    );
    // 읽는 이름 유지 — <label for> 가 칸을 잇는다
    expect(label().tagName).toBe("LABEL");
    expect(input().labels?.[0]).toBe(label());
    expect(label().textContent).toBe("제목");
    // 머리 줄이 sr-only(절대 위치) — flex 열의 gap 을 만들지 않는다
    const header = container.querySelector("[data-slot=field-header]")!;
    expect(header.className).toContain("sr-only");
    expect(header.className).not.toContain("flex");
  });

  it("labelHidden 이어도 headerAction 이 있으면 머리는 보인다", () => {
    render(
      <Field label="제목" labelHidden headerAction={<button>도움말</button>}>
        <TestInput />
      </Field>,
    );
    const header = container.querySelector("[data-slot=field-header]")!;
    expect(header.className).not.toContain("sr-only");
  });

  it("칸에 id 를 주면 라벨이 그 id 로 간다 — 칸에 직접 준 설명도 함께 잇는다", () => {
    render(
      <Field label="메모" description="목록에 보여요.">
        <span id="extra">덧붙임</span>
        <TestInput id="memo" aria-describedby="extra" />
      </Field>,
    );
    expect(input().id).toBe("memo");
    expect(label().getAttribute("for")).toBe("memo");
    expect(describedBy(input())).toEqual(["목록에 보여요.", "덧붙임"]);
  });

  it("필수 점은 화면 읽기 프로그램에 숨기고 칸에 aria-required — required 속성은 쓰지 않는다", () => {
    render(
      <Field label="이름" showRequiredIndicator>
        <TestInput />
      </Field>,
    );
    const dot = label().querySelector("span")!;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(input().getAttribute("aria-required")).toBe("true");
    expect(input().hasAttribute("required")).toBe(false);
  });

  it("required 만 주면 점 없이 aria-required 만 — 2/3 규칙에서 필수 칸이 많은 화면", () => {
    render(
      <Field label="휴대폰 번호" required>
        <TestInput />
      </Field>,
    );
    expect(label().querySelector("span")).toBeNull();
    expect(input().getAttribute("aria-required")).toBe("true");
  });

  it("필수 점과 “선택” 은 섞지 않는다 — 점이 있으면 “선택” 을 그리지 않는다", () => {
    render(
      <Field label="메모" indicator="선택">
        <TestInput />
      </Field>,
    );
    expect(label().textContent).toBe("메모선택");
    act(() =>
      root.render(
        <Field label="메모" indicator="선택" showRequiredIndicator>
          <TestInput />
        </Field>,
      ),
    );
    expect(label().textContent).toBe("메모");
    expect(label().querySelector("span[aria-hidden]")).not.toBeNull();
  });

  it("오류는 설명을 대신하고 aria-describedby 로 이어진다 — 보이는 글은 숨기고 알림 자리가 한 번 읽는다", () => {
    render(
      <Field
        label="아이디"
        description="영문 · 숫자 20자까지"
        invalid
        errorMessage="이미 쓰고 있는 아이디예요."
      >
        <TestInput />
      </Field>,
    );
    expect(container.textContent).not.toContain("영문 · 숫자 20자까지");
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(describedBy(input())).toEqual(["이미 쓰고 있는 아이디예요."]);
    const error = container.querySelector("[id$=error]")!;
    expect(error.getAttribute("aria-hidden")).toBe("true");
    // 오류 앞 아이콘 — 색만으로 알리지 않는다
    expect(error.querySelector("svg")).not.toBeNull();
    const live = container.querySelector("[aria-live=polite]")!;
    expect(live.textContent).toBe("이미 쓰고 있는 아이디예요.");
  });

  it("오류 글이 없으면 invalid 여도 설명을 둔다 — 알림 자리는 비어 있다", () => {
    render(
      <Field label="아이디" description="영문 · 숫자 20자까지" invalid>
        <TestInput />
      </Field>,
    );
    expect(describedBy(input())).toEqual(["영문 · 숫자 20자까지"]);
    expect(container.querySelector("[aria-live=polite]")!.textContent).toBe("");
  });

  it("글자 수 — 자소 단위로 세고(국기 이모지도 한 글자) 최대에서 자른다. 비면 최대와 같은 색", () => {
    const onChange = vi.fn();
    render(
      <Field label="카테고리 이름" maxGraphemeCount={3}>
        <TestInput onChange={onChange} />
      </Field>,
    );
    expect(count().textContent).toBe("0/3");
    expect(count().firstElementChild!.className).toBe("text-fg-neutral-subtle");
    // 글자 수도 칸의 설명이다
    expect(describedBy(input())).toEqual(["0/3"]);

    act(() => setNativeValue(input(), "🇰🇷가"));
    expect(count().textContent).toBe("2/3");
    expect(count().firstElementChild!.className).toBe("text-fg-neutral");

    act(() => setNativeValue(input(), "🇰🇷가나다라"));
    expect(input().value).toBe("🇰🇷가나");
    expect(count().textContent).toBe("3/3");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("오류면 글자 수도 빨갛다", () => {
    render(
      <Field label="아이디" maxGraphemeCount={20} invalid errorMessage="오류">
        <TestInput defaultValue="groo" />
      </Field>,
    );
    expect(count().textContent).toBe("4/20");
    for (const span of count().children) {
      expect(span.className).toBe("text-fg-critical");
    }
  });

  it("한글을 조합하는 동안에는 자르지 않고, 조합이 끝나면 자르고 onChange 로 새 값을 보낸다", () => {
    const onChange = vi.fn();
    render(
      <Field label="이름" maxGraphemeCount={2}>
        <TestInput onChange={onChange} />
      </Field>,
    );
    const el = input();
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(el, "가나다");
      el.dispatchEvent(
        new InputEvent("input", { bubbles: true, isComposing: true }),
      );
    });
    expect(el.value).toBe("가나다");
    act(() => {
      el.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      );
    });
    expect(el.value).toBe("가나");
    expect(count().textContent).toBe("2/2");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: el }),
    );
  });

  it("묶음이면 라벨은 span 이고 묶음이 aria-labelledby 로 가리킨다", () => {
    render(
      <Field label="종료" invalid errorMessage="종료를 골라주세요.">
        <TestGroup />
      </Field>,
    );
    const group = container.querySelector("[role=radiogroup]")!;
    expect(label().tagName).toBe("SPAN");
    expect(group.getAttribute("aria-labelledby")).toBe(label().id);
    expect(describedBy(group)).toEqual(["종료를 골라주세요."]);
  });

  it("묶음에 aria-label 을 주면 그 이름이 이긴다", () => {
    render(
      <Field label="종료">
        <TestGroup aria-label="반복 종료" />
      </Field>,
    );
    const group = container.querySelector("[role=radiogroup]")!;
    expect(group.hasAttribute("aria-labelledby")).toBe(false);
    expect(group.getAttribute("aria-label")).toBe("반복 종료");
  });

  it("칸이 버튼이면 라벨을 눌러도 포커스만 옮긴다 — 누르지 않는다(시트 · 목록을 열지 않는다)", () => {
    const onClick = vi.fn();
    render(
      <Field label="카테고리">
        <TestTrigger onClick={onClick} />
      </Field>,
    );
    const trigger = container.querySelector("button")!;
    expect(label().getAttribute("for")).toBe(trigger.id);
    act(() => label().click());
    expect(onClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("막힘 · 읽기 전용은 칸이 받는다", () => {
    const el = render(
      <Field label="메모" disabled readOnly>
        <TestInput />
      </Field>,
    );
    expect(el.dataset.disabled).toBe("true");
    expect(input().disabled).toBe(true);
    expect(input().readOnly).toBe(true);
  });

  it("보조 액션은 머리 오른쪽에 둔다 — 라벨이 없어도 머리를 그린다", () => {
    render(
      <Field headerAction={<button type="button">예시 보기</button>}>
        <TestInput aria-label="메모" />
      </Field>,
    );
    const header = container.querySelector("[data-slot=field-header]")!;
    expect(header.querySelector("label")).toBeNull();
    expect(
      header.querySelector("[data-slot=field-header-action]")!.textContent,
    ).toBe("예시 보기");
  });
});

describe("자소 셈", () => {
  it("국기 · 조합 이모지는 한 글자다", () => {
    expect(countGraphemes("🇰🇷")).toBe(1);
    expect(countGraphemes("👨‍👩‍👧")).toBe(1);
    expect(countGraphemes("가나다")).toBe(3);
    expect(sliceGraphemes("🇰🇷🇯🇵가", 2)).toBe("🇰🇷🇯🇵");
    expect(sliceGraphemes("가나", 5)).toBe("가나");
  });
});

describe("Field 머리 — 글자 200% · 좁은 폭", () => {
  it("머리는 줄바꿈이 되고 라벨은 단어 단위(keep-all), 오른쪽 동작은 자리가 모자라면 다음 줄 오른쪽으로", () => {
    const el = render(
      <Field
        label="보유 종목"
        headerAction={<span>12종목 · 55,950,000원</span>}
      >
        <input />
      </Field>,
    );
    const header = el.querySelector("[data-slot=field-header]")!;
    expect(header.className).toContain("flex-wrap");
    const label = header.querySelector("label")!;
    expect(label.className).toContain("break-keep");
    expect(label.className).toContain("min-w-0");
    const action = el.querySelector("[data-slot=field-header-action]")!;
    expect(action.className).toContain("ml-auto");
    expect(action.className).toContain("shrink-0");
  });
});
