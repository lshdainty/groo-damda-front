// Input 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 검사기가 못 재는 값(안쪽 그림자 · ::after 테두리 · 그 전환 · placeholder · 반응형)은 여기서 클래스로 본다(input.measure.mjs 머리).
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Search } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field, setNativeValue } from "@/shared/ds/field";

import { Input } from "./input";

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
}

const box = () =>
  container.querySelector<HTMLElement>("[data-slot=text-input]")!;
const input = () => container.querySelector("input")!;
const slot = (name: string) =>
  container.querySelector<HTMLElement>(`[data-slot=text-input-${name}]`);
const clearButton = () => slot("clear") as HTMLButtonElement | null;
const classes = (el: Element) => el.className.split(/\s+/);
const describedBy = (el: Element) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent);

describe("Input", () => {
  it("기본은 상자(outline) · responsive — className 은 입력(<input>)에, rootClassName 은 상자에", () => {
    render(
      <Input
        aria-label="메모"
        className="tracking-tight"
        rootClassName="mt-x1"
      />,
    );
    expect(box().dataset.variant).toBe("outline");
    expect(box().dataset.size).toBe("responsive");
    expect(classes(box())).toContain("mt-x1");
    expect(input().type).toBe("text");
    expect(input().dataset.slot).toBe("text-input-value");
    expect(classes(input())).toContain("tracking-tight");
  });

  it("ref 는 입력(<input>)이다", () => {
    const ref = createRef<HTMLInputElement>();
    const callback = vi.fn();
    render(
      <>
        <Input ref={ref} aria-label="이름" />
        <Input ref={callback} aria-label="메모" />
      </>,
    );
    expect(ref.current).toBe(container.querySelectorAll("input")[0]);
    expect(callback).toHaveBeenLastCalledWith(
      container.querySelectorAll("input")[1],
    );
  });

  it("테두리는 안쪽 1px 그림자, 포커스 · 오류 2px 는 ::after 에 덧그린다 — 읽기 전용이면 포커스 테두리가 없고, 오류는 포커스해도 빨갛다", () => {
    render(<Input aria-label="메모" variant="outline" size="large" />);
    const outline = classes(box());
    expect(outline).toContain(
      "shadow-[inset_0_0_0_1px_var(--color-stroke-neutral-weak)]",
    );
    expect(outline).toContain("after:border-2");
    expect(outline).toContain("after:border-transparent");
    // 포커스 — 오류 · 읽기 전용이 아닐 때만 짙은 테두리
    expect(outline).toContain(
      "[&:has(input:focus):not([data-invalid]):not([data-readonly])]:after:border-stroke-neutral-contrast",
    );
    expect(outline).toContain(
      "data-[invalid]:after:border-stroke-critical-solid",
    );
    // 색만 100ms 로(두께는 바로) — motion d2 · easing
    expect(outline).toContain(
      "after:[transition:border-color_var(--motion-duration-d2)_var(--motion-ease-easing)]",
    );

    render(<Input aria-label="메모" variant="underline" size="large" />);
    const underline = classes(box());
    expect(underline).toContain(
      "shadow-[inset_0_-1px_0_0_var(--color-stroke-neutral-weak)]",
    );
    expect(underline).toContain("after:border-b-2");
    expect(underline).not.toContain("after:border-2");
    expect(underline).toContain("rounded-none");
  });

  it("오류 · 비활성 · 읽기 전용은 상자의 data-* 로 — 오류는 aria-invalid 에서", () => {
    render(<Input aria-label="메모" aria-invalid />);
    expect(box().dataset.invalid).toBe("true");
    expect(box().dataset.disabled).toBeUndefined();

    render(<Input aria-label="메모" disabled />);
    expect(box().dataset.disabled).toBe("true");
    expect(input().disabled).toBe(true);

    render(<Input aria-label="메모" readOnly />);
    expect(box().dataset.readonly).toBe("true");
    expect(box().dataset.invalid).toBeUndefined();
    expect(input().readOnly).toBe(true);
  });

  it("비활성 · 읽기 전용은 상자 바탕(bg-disabled)으로 가른다 — 밑줄형은 바탕이 없어 읽기 전용을 글자 색으로", () => {
    render(<Input aria-label="메모" variant="outline" readOnly />);
    expect(classes(box())).toContain("data-[readonly]:bg-bg-disabled");
    expect(classes(box())).toContain("data-[disabled]:bg-bg-disabled");
    expect(classes(input())).toContain("text-fg-neutral");

    render(<Input aria-label="메모" variant="underline" readOnly />);
    expect(classes(box())).not.toContain("data-[readonly]:bg-bg-disabled");
    expect(classes(input())).toContain("text-fg-neutral-muted");
    expect(classes(input())).toContain("placeholder:text-fg-neutral-muted");
  });

  it("글자 · placeholder · 붙이개 · 아이콘 색 — 비활성이면 모두 fg-disabled", () => {
    const affixes = {
      prefixIcon: <Search />,
      prefix: "만",
      suffix: "세",
      suffixIcon: <Search />,
    };
    render(<Input aria-label="나이" {...affixes} />);
    expect(classes(input())).toEqual(
      expect.arrayContaining([
        "text-fg-neutral",
        "placeholder:text-fg-placeholder",
      ]),
    );
    expect(classes(slot("prefix")!)).toContain("text-fg-neutral-subtle");
    expect(classes(slot("suffix")!)).toContain("text-fg-neutral-subtle");
    expect(classes(slot("prefix-icon")!)).toContain("text-fg-neutral-muted");
    expect(classes(slot("suffix-icon")!)).toContain("text-fg-neutral-muted");

    render(<Input aria-label="나이" disabled {...affixes} />);
    expect(classes(input())).toEqual(
      expect.arrayContaining([
        "text-fg-disabled",
        "placeholder:text-fg-disabled",
      ]),
    );
    for (const name of ["prefix", "suffix", "prefix-icon", "suffix-icon"]) {
      expect(classes(slot(name)!)).toContain("text-fg-disabled");
    }
  });

  it("좌우 여백은 맨 앞 · 맨 뒤 요소가 가진다 — 입력이면 안쪽 여백, 붙이개 · 지우기면 바깥 여백", () => {
    render(
      <Input
        aria-label="나이"
        prefix="만"
        suffix="세"
        defaultValue="20"
        clearable
      />,
    );
    expect(classes(input())).toEqual(
      expect.arrayContaining([
        "first:pl-[var(--text-input-px)]",
        "last:pr-[var(--text-input-px)]",
      ]),
    );
    for (const el of [slot("prefix")!, slot("suffix")!, clearButton()!]) {
      expect(classes(el)).toEqual(
        expect.arrayContaining([
          "first:ml-[var(--text-input-px)]",
          "last:mr-[var(--text-input-px)]",
        ]),
      );
    }
    // 차례 — 앞 아이콘 · 앞 글자 · 입력 · 뒤 글자 · 뒤 아이콘 · 지우기
    expect(
      Array.from(box().children, (el) => (el as HTMLElement).dataset.slot),
    ).toEqual([
      "text-input-prefix",
      "text-input-value",
      "text-input-suffix",
      "text-input-clear",
    ]);
  });

  it("반응형(기본)은 1280(lg) 미만 large · 이상 medium 의 값을 쓴다", () => {
    render(<Input aria-label="메모" />);
    expect(classes(box())).toEqual(
      expect.arrayContaining([
        "min-h-[52px]",
        "rounded-r3",
        "text-t5",
        "lg:min-h-[40px]",
        "lg:rounded-r2",
        "lg:text-t4",
        "lg:[--text-input-px:var(--spacing-x3_5)]",
      ]),
    );
    render(<Input aria-label="메모" variant="underline" />);
    expect(classes(box())).toEqual(
      expect.arrayContaining([
        "min-h-[40px]",
        "text-t6",
        "lg:min-h-[34px]",
        "lg:text-t5",
        "lg:py-x1_5",
      ]),
    );
  });

  it("Field 안이면 id · 설명 · 오류 · 필수 · 막힘을 받는다", () => {
    render(
      <Field
        label="아이디"
        description="영문 · 숫자 20자까지"
        showRequiredIndicator
        invalid
        errorMessage="이미 쓰고 있는 아이디예요."
      >
        <Input defaultValue="groo" />
      </Field>,
    );
    const label = container.querySelector("label")!;
    expect(label.getAttribute("for")).toBe(input().id);
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(input().getAttribute("aria-required")).toBe("true");
    expect(describedBy(input())).toEqual(["이미 쓰고 있는 아이디예요."]);
    expect(box().dataset.invalid).toBe("true");

    render(
      <Field label="계좌" disabled>
        <Input defaultValue="국민 123-45-6789" />
      </Field>,
    );
    expect(input().disabled).toBe(true);
    expect(box().dataset.disabled).toBe("true");
  });

  it("붙이개 글자는 입력의 설명으로도 읽힌다 — 앞 · 뒤 글자 다음에 Field 의 설명. 아이콘은 숨긴다", () => {
    render(
      <Field label="나이" description="만 나이로 써요.">
        <Input prefixIcon={<Search />} prefix="만" suffix="세" />
      </Field>,
    );
    expect(describedBy(input())).toEqual(["만", "세", "만 나이로 써요."]);
    expect(slot("prefix-icon")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("지우기는 값이 있을 때만 — 누르면 값을 비우고(onChange 로 빈 값) 입력에 포커스를 둔다", () => {
    const onChange = vi.fn();
    render(<Input aria-label="검색" clearable onChange={onChange} />);
    expect(clearButton()).toBeNull();

    act(() => setNativeValue(input(), "회의록"));
    const button = clearButton()!;
    expect(button.getAttribute("aria-label")).toBe("지우기");
    // Tab 순서에는 넣지 않는다 — 원 X 는 장식
    expect(button.tabIndex).toBe(-1);
    expect(button.type).toBe("button");
    expect(button.querySelector("svg")!.getAttribute("aria-hidden")).toBe(
      "true",
    );

    act(() => button.click());
    expect(input().value).toBe("");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.lastCall![0].target.value).toBe("");
    expect(document.activeElement).toBe(input());
    expect(clearButton()).toBeNull();
  });

  it("뒤 단추 슬롯 — 맨 뒤면 오른쪽 여백을 바깥 여백으로 갖고 입력 글은 슬롯만큼 비는다", () => {
    render(
      <Input
        aria-label="키"
        defaultValue="abc"
        suffixAction={<button type="button">보기</button>}
      />,
    );
    const action = slot("action")!;
    expect(action).not.toBeNull();
    expect(action.querySelector("button")?.textContent).toBe("보기");
    expect(classes(action)).toContain("last:mr-[var(--text-input-px)]");
    // 입력은 더 이상 맨 뒤가 아니라 안쪽 오른쪽 여백을 갖지 않는다 — 슬롯이 그 자리를 비운다
    expect(input().nextElementSibling).toBe(action);
  });

  it("뒤 단추 슬롯 안 단추는 호버 · 누름 바탕을 그리지 않는다 — 지우기 버튼과 같다(상태는 아이콘으로만)", () => {
    render(
      <Input
        aria-label="키"
        defaultValue="abc"
        suffixAction={<button type="button">보기</button>}
      />,
    );
    const cls = classes(slot("action")!);
    expect(cls).toContain("[&_button]:hover:bg-transparent");
    expect(cls).toContain("[&_button]:active:bg-transparent");
  });

  it("뒤 단추 슬롯은 지우기 버튼 뒤에 놓인다", () => {
    render(
      <Input
        aria-label="키"
        clearable
        defaultValue="abc"
        suffixAction={<button type="button">보기</button>}
      />,
    );
    expect(clearButton()!.nextElementSibling).toBe(slot("action"));
  });

  it("막혔거나 읽기 전용이면 지우기가 없다", () => {
    render(
      <Input aria-label="검색" clearable disabled defaultValue="회의록" />,
    );
    expect(clearButton()).toBeNull();
    render(
      <Input aria-label="검색" clearable readOnly defaultValue="회의록" />,
    );
    expect(clearButton()).toBeNull();
    render(<Input aria-label="검색" clearable defaultValue="회의록" />);
    expect(clearButton()).not.toBeNull();
  });

  it("상자의 붙이개 · 여백을 눌러도 입력으로 포커스가 간다 — 입력 · 버튼은 브라우저에 맡긴다", () => {
    const mouseDown = (el: Element) => {
      const e = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        el.dispatchEvent(e);
      });
      return e.defaultPrevented;
    };
    render(
      <Input aria-label="금액" suffix="원" defaultValue="12,000" clearable />,
    );
    expect(mouseDown(slot("suffix")!)).toBe(true);
    expect(document.activeElement).toBe(input());
    act(() => input().blur());
    expect(mouseDown(box())).toBe(true);
    expect(document.activeElement).toBe(input());
    // 입력 · 지우기 버튼은 그대로(커서 자리 · 누르기)
    expect(mouseDown(input())).toBe(false);
    expect(mouseDown(clearButton()!)).toBe(false);

    // 막힌 칸은 옮기지 않는다(jsdom 은 막힌 요소를 blur 하지 않아 막기 전에 놓는다)
    act(() => input().blur());
    render(<Input aria-label="금액" suffix="원" disabled />);
    expect(mouseDown(slot("suffix")!)).toBe(false);
    expect(document.activeElement).not.toBe(input());
  });

  it("최대 글자 수(Field)에서 멈춘다 — 자소 단위", () => {
    const onChange = vi.fn();
    render(
      <Field label="카테고리 이름" maxGraphemeCount={3}>
        <Input onChange={onChange} />
      </Field>,
    );
    act(() => setNativeValue(input(), "🇰🇷가나다"));
    expect(input().value).toBe("🇰🇷가나");
    expect(container.querySelector("[id$=count]")!.textContent).toBe("3/3");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
