// Quantity Picker 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 검사기가 못 재는 값(안쪽 그림자 · 누르는 자리 44 · 축소 · 반응형 · 읽는 말)은 여기서 클래스와 속성으로 본다(quantity-picker.measure.mjs 머리).
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "@/shared/ds/field";

import { QuantityPicker } from "./quantity-picker";

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

const group = () =>
  container.querySelector<HTMLElement>("[data-slot=quantity-picker]")!;
const dec = () =>
  container.querySelector<HTMLButtonElement>(
    "[data-slot=quantity-picker-decrement]",
  )!;
const inc = () =>
  container.querySelector<HTMLButtonElement>(
    "[data-slot=quantity-picker-increment]",
  )!;
const valueCell = () =>
  container.querySelector<HTMLElement>("[data-slot=quantity-picker-value]")!;
const shownText = () => valueCell().lastElementChild!.textContent;
const hidden = () =>
  container.querySelector<HTMLInputElement>(
    "[data-slot=quantity-picker-input]",
  );
const click = (el: HTMLElement) => act(() => el.click());
const unit = (v: number) => `${v}회`;

describe("값 바꾸기", () => {
  it("+ · − 는 한 단계씩 바꾸고 바뀐 값을 알린다", () => {
    const onValueChange = vi.fn();
    render(
      <QuantityPicker
        defaultValue={1}
        max={3}
        onValueChange={onValueChange}
        getValueText={unit}
        aria-label="횟수"
      />,
    );
    click(inc());
    expect(shownText()).toBe("2회");
    click(dec());
    click(dec());
    expect(shownText()).toBe("0회");
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual([2, 1, 0]);
  });

  it("value 를 주면 쥐고 다룬다 — 부모가 받아 주기 전에는 바뀌지 않는다", () => {
    const onValueChange = vi.fn();
    render(
      <QuantityPicker
        value={2}
        onValueChange={onValueChange}
        aria-label="횟수"
      />,
    );
    click(inc());
    expect(onValueChange).toHaveBeenCalledWith(3);
    expect(shownText()).toBe("2");
  });

  it("step 만큼 바꾸되 끝을 넘지 않는다", () => {
    render(
      <QuantityPicker defaultValue={8} max={10} step={5} aria-label="분" />,
    );
    click(inc());
    expect(shownText()).toBe("10");
    click(dec());
    expect(shownText()).toBe("5");
    click(dec());
    click(dec());
    expect(shownText()).toBe("0");
  });

  it("처음 값은 기본 min", () => {
    render(<QuantityPicker min={1} aria-label="횟수" />);
    expect(shownText()).toBe("1");
  });
});

describe("끝 — 최소 · 최대", () => {
  it("최소에서 줄이기는 aria-disabled 이고 눌러도 아무 일이 없다(초점은 남는다)", () => {
    const onValueChange = vi.fn();
    render(
      <QuantityPicker
        defaultValue={0}
        max={3}
        onValueChange={onValueChange}
        aria-label="횟수"
      />,
    );
    expect(dec().getAttribute("aria-disabled")).toBe("true");
    expect(dec().disabled).toBe(false);
    expect(inc().hasAttribute("aria-disabled")).toBe(false);
    dec().focus();
    click(dec());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(dec());
  });

  it("키보드로 끝까지 눌러도 초점이 그 버튼에 남는다", () => {
    render(<QuantityPicker defaultValue={2} max={3} aria-label="횟수" />);
    inc().focus();
    click(inc());
    expect(inc().getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(inc());
    click(inc());
    expect(shownText()).toBe("3");
  });

  it("max 를 주지 않으면 아주 큰 수에서도 막히지 않고 폭 자리 글에 열여섯 자리 수를 싣지 않는다", () => {
    render(<QuantityPicker defaultValue={5} aria-label="횟수" />);
    expect(inc().hasAttribute("aria-disabled")).toBe(false);
    const placeholders = valueCell().querySelectorAll("[aria-hidden]");
    // 최소(0)만 — 최대(9007199254740991)는 싣지 않는다
    expect(Array.from(placeholders).map((p) => p.textContent)).toEqual(["0"]);
  });

  it('hug — 끝값보다 긴 글이 범위 안에 있으면 그 글이 폭 자리를 잡는다(소요 시간 "23시간 30분")', () => {
    const text = (n: number) => {
      const h = Math.floor(n);
      return n % 1 ? `${h}시간 30분` : `${h}시간`;
    };
    render(
      <QuantityPicker
        defaultValue={0}
        min={0}
        max={24}
        step={0.5}
        getValueText={text}
        aria-label="소요 시간"
      />,
    );
    const placeholders = Array.from(
      valueCell().querySelectorAll("[aria-hidden]"),
    ).map((p) => p.textContent);
    // 끝값(24시간)만으로는 "23시간 30분" 같은 가장 긴 글이 들어가지 않아 값이 바뀔 때 + 가 밀렸다(QA IE-18)
    expect(placeholders).toContain("24시간");
    expect(placeholders).toContain("23시간 30분");
    expect(placeholders).toHaveLength(2);
  });

  it("0 · 최대 값 — 범위 밖 value 는 고치지 않고 그대로 둔다(invalid 로 알린다)", () => {
    render(
      <QuantityPicker
        value={3}
        max={2}
        invalid
        getValueText={unit}
        aria-label="횟수"
      />,
    );
    expect(shownText()).toBe("3회");
    expect(inc().getAttribute("aria-disabled")).toBe("true");
    expect(group().hasAttribute("data-invalid")).toBe(true);
    expect(group().className).toContain("data-[invalid]:shadow-");
  });
});

describe("누르고 있어도 한 번", () => {
  it("되풀이되는 keydown(repeat)은 버린다 — Enter 를 누르고 있어도 한 단계", () => {
    render(<QuantityPicker defaultValue={0} max={9} aria-label="횟수" />);
    const repeat = new KeyboardEvent("keydown", {
      key: "Enter",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      inc().dispatchEvent(repeat);
    });
    expect(repeat.defaultPrevented).toBe(true);
    const first = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      inc().dispatchEvent(first);
    });
    expect(first.defaultPrevented).toBe(false);
  });

  it("화살표 키로는 바뀌지 않고 값 칸은 초점 · 누르기를 받지 않는다", () => {
    render(<QuantityPicker defaultValue={1} max={9} aria-label="횟수" />);
    expect(group().getAttribute("role")).toBe("group");
    expect(
      group().querySelector("[role=spinbutton], input:not([type=hidden])"),
    ).toBeNull();
    expect(valueCell().tabIndex).toBe(-1);
    expect(valueCell().className).toContain("pointer-events-none");
    act(() => {
      inc().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      );
    });
    expect(shownText()).toBe("1");
  });
});

describe("접근성", () => {
  it("묶음에 이름이 있고 버튼 이름은 줄이기 · 늘리기(바꿀 수 있다)", () => {
    render(<QuantityPicker aria-label="승인 필요 횟수" />);
    expect(group().getAttribute("aria-label")).toBe("승인 필요 횟수");
    expect(dec().getAttribute("aria-label")).toBe("줄이기");
    expect(inc().getAttribute("aria-label")).toBe("늘리기");
    render(
      <QuantityPicker
        aria-label="수량"
        decrementAriaLabel="하나 빼기"
        incrementAriaLabel="하나 더하기"
      />,
    );
    expect(dec().getAttribute("aria-label")).toBe("하나 빼기");
    expect(inc().getAttribute("aria-label")).toBe("하나 더하기");
  });

  it("값 칸은 aria-live polite · atomic — 바뀐 값을 단위와 함께 읽는다", () => {
    render(
      <QuantityPicker defaultValue={3} getValueText={unit} aria-label="횟수" />,
    );
    expect(valueCell().getAttribute("aria-live")).toBe("polite");
    expect(valueCell().getAttribute("aria-atomic")).toBe("true");
    click(inc());
    expect(valueCell().textContent).toContain("4회");
  });

  it("선은 장식이다(aria-hidden), 아이콘도 숨긴다", () => {
    render(<QuantityPicker aria-label="횟수" />);
    const dividers = container.querySelectorAll(
      "[data-slot=quantity-picker-divider]",
    );
    expect(dividers).toHaveLength(2);
    dividers.forEach((d) => expect(d.getAttribute("aria-hidden")).toBe("true"));
    container
      .querySelectorAll("button > svg")
      .forEach((s) => expect(s.getAttribute("aria-hidden")).toBe("true"));
  });

  it("Field 안이면 라벨이 이름, 설명 · 오류가 묶음의 설명이 된다", () => {
    render(
      <Field label="승인 필요 횟수" description="0 이면 승인 없이 바로 써요.">
        <QuantityPicker />
      </Field>,
    );
    const labelId = group().getAttribute("aria-labelledby")!;
    expect(container.querySelector(`[id="${labelId}"]`)?.textContent).toContain(
      "승인 필요 횟수",
    );
    const described = group().getAttribute("aria-describedby")!;
    expect(container.querySelector(`[id="${described}"]`)?.textContent).toBe(
      "0 이면 승인 없이 바로 써요.",
    );
  });

  it("Field 의 막힘 · 읽기 전용 · 오류를 받고, 직접 준 값이 이긴다", () => {
    render(
      <Field label="횟수" disabled>
        <QuantityPicker />
      </Field>,
    );
    expect(dec().disabled).toBe(true);
    render(
      <Field label="횟수" disabled>
        <QuantityPicker disabled={false} />
      </Field>,
    );
    expect(dec().disabled).toBe(false);
    render(
      <Field label="횟수" readOnly>
        <QuantityPicker defaultValue={1} max={3} />
      </Field>,
    );
    expect(inc().getAttribute("aria-disabled")).toBe("true");
    const before = shownText();
    click(inc());
    expect(shownText()).toBe(before);
    render(
      <Field label="횟수" invalid errorMessage="범위를 벗어났어요.">
        <QuantityPicker />
      </Field>,
    );
    expect(group().hasAttribute("data-invalid")).toBe(true);
  });
});

describe("막힘 · 읽기 전용", () => {
  it("disabled — 두 버튼 모두 disabled 속성, 값 흐림, 숨은 입력도 막힌다", () => {
    render(
      <QuantityPicker disabled name="n" defaultValue={1} aria-label="횟수" />,
    );
    expect(dec().disabled).toBe(true);
    expect(inc().disabled).toBe(true);
    expect(dec().hasAttribute("aria-disabled")).toBe(false);
    expect(valueCell().hasAttribute("data-disabled")).toBe(true);
    expect(hidden()!.disabled).toBe(true);
    click(inc());
    expect(shownText()).toBe("1");
  });

  it("readOnly — 두 버튼 aria-disabled(초점은 받는다), 값은 제출된다", () => {
    render(
      <QuantityPicker readOnly name="n" defaultValue={2} aria-label="횟수" />,
    );
    expect(dec().getAttribute("aria-disabled")).toBe("true");
    expect(inc().getAttribute("aria-disabled")).toBe("true");
    expect(dec().disabled).toBe(false);
    click(inc());
    click(dec());
    expect(shownText()).toBe("2");
    expect(hidden()!.disabled).toBe(false);
    expect(hidden()!.value).toBe("2");
  });

  it("name 을 주면 단위 없는 정수를 숨은 입력으로 낸다", () => {
    render(
      <QuantityPicker
        name="approvalCount"
        defaultValue={1}
        getValueText={unit}
        aria-label="횟수"
      />,
    );
    expect(hidden()!.name).toBe("approvalCount");
    expect(hidden()!.value).toBe("1");
    click(inc());
    expect(hidden()!.value).toBe("2");
  });
});

describe("지우기(removable)", () => {
  const props = {
    min: 1,
    max: 9,
    removable: true,
    removeAriaLabel: "점심 도시락 지우기",
  } as const;

  it("최소에서 줄이기가 지우기가 되어 이름이 바뀌고 막히지 않으며, 누르면 onRemove 만 부른다", () => {
    const onRemove = vi.fn();
    const onValueChange = vi.fn();
    render(
      <QuantityPicker
        {...props}
        defaultValue={1}
        onRemove={onRemove}
        onValueChange={onValueChange}
        aria-label="수량"
      />,
    );
    expect(dec().getAttribute("aria-label")).toBe("점심 도시락 지우기");
    expect(dec().hasAttribute("aria-disabled")).toBe(false);
    expect(dec().hasAttribute("data-remove")).toBe(true);
    click(dec());
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(shownText()).toBe("1");
  });

  it("최소가 아니면 보통 줄이기", () => {
    render(
      <QuantityPicker
        {...props}
        defaultValue={2}
        onRemove={() => {}}
        aria-label="수량"
      />,
    );
    expect(dec().getAttribute("aria-label")).toBe("줄이기");
    expect(dec().hasAttribute("data-remove")).toBe(false);
  });

  it("컨트롤 전체가 막히면 지우기도 막힌다", () => {
    const onRemove = vi.fn();
    render(
      <QuantityPicker
        {...props}
        defaultValue={1}
        disabled
        onRemove={onRemove}
        aria-label="수량"
      />,
    );
    expect(dec().disabled).toBe(true);
    click(dec());
    expect(onRemove).not.toHaveBeenCalled();
  });
});

describe("로딩", () => {
  it("기다리는 버튼의 누르기를 버리고 aria-busy · 원을 단다, 다른 쪽은 그대로 눌린다", () => {
    const onValueChange = vi.fn();
    render(
      <QuantityPicker
        defaultValue={1}
        max={5}
        loading={{ increment: true }}
        onValueChange={onValueChange}
        aria-label="수량"
      />,
    );
    expect(inc().getAttribute("aria-busy")).toBe("true");
    expect(inc().querySelector("[data-slot=progress-circle]")).not.toBeNull();
    expect(inc().querySelector("svg:not([data-slot])")).toBeNull();
    expect(dec().hasAttribute("aria-busy")).toBe(false);
    click(inc());
    expect(onValueChange).not.toHaveBeenCalled();
    click(dec());
    expect(onValueChange).toHaveBeenCalledWith(0);
  });

  it("loading=true 는 두 버튼", () => {
    render(<QuantityPicker loading aria-label="수량" />);
    expect(dec().getAttribute("aria-busy")).toBe("true");
    expect(inc().getAttribute("aria-busy")).toBe("true");
  });
});

describe("모양 — 검사기가 못 재는 값", () => {
  it("크기마다 상자 높이 · 모서리, 버튼 정사각 · 누르는 자리 44(36 · 40)", () => {
    render(<QuantityPicker size="small" aria-label="a" />);
    expect(group().className).toContain("min-h-[36px]");
    expect(dec().className).toContain("size-[36px]");
    expect(dec().className).toContain("before:min-h-[44px]");
    render(<QuantityPicker size="large" aria-label="a" />);
    expect(group().className).toContain("min-h-[52px]");
    expect(group().className).toContain("rounded-r3");
    expect(dec().className).toContain("size-[52px]");
  });

  it("상자 높이는 최소 높이다 — 글자 200% 에서 숫자를 자르지 않고 상자가 자란다(옆 Input · Select large 와 같은 규칙)", () => {
    for (const size of ["small", "medium", "large", "responsive"] as const) {
      render(<QuantityPicker size={size} aria-label="a" />);
      expect(group().className).not.toMatch(/(^|\s)(lg:)?h-\[/);
    }
  });

  it("responsive(기본)는 1280 미만 large · 이상 medium", () => {
    render(<QuantityPicker aria-label="a" />);
    expect(group().dataset.size).toBe("responsive");
    expect(group().className).toContain("min-h-[52px]");
    expect(group().className).toContain("lg:min-h-[40px]");
    expect(dec().className).toContain("lg:size-[40px]");
    expect(valueCell().className).toContain("text-t6");
    expect(valueCell().className).toContain("lg:text-t5");
  });

  it("누름 축소는 그 버튼만(active) · 모션 줄이기면 없고, 끝 · 막힘은 축소 없음", () => {
    render(<QuantityPicker aria-label="a" />);
    expect(inc().className).toContain(
      "active:[scale:calc(1-2/var(--press-basis))]",
    );
    expect(inc().className).toContain("motion-reduce:active:[scale:1]");
    expect(inc().className).toContain("aria-disabled:active:[scale:1]");
    expect(inc().className).toContain("disabled:active:[scale:1]");
    expect(group().className).not.toContain("active:");
  });

  it("값 칸 폭 — 가장 긴 값(min · max · 지금 값)의 글을 숨겨 둔 자리 글로 잡는다", () => {
    render(
      <QuantityPicker
        min={0}
        max={99}
        defaultValue={5}
        getValueText={unit}
        aria-label="횟수"
      />,
    );
    const hiddenTexts = Array.from(
      valueCell().querySelectorAll("[aria-hidden]"),
    ).map((p) => p.textContent);
    expect(hiddenTexts).toEqual(["0회", "99회"]);
    expect(shownText()).toBe("5회");
  });

  it("hug 는 내용 폭, fill 은 남은 폭", () => {
    render(<QuantityPicker aria-label="a" />);
    expect(group().className).toContain("w-fit");
    render(<QuantityPicker layout="fill" aria-label="a" />);
    expect(group().className).toContain("grow");
  });

  it("긴 단위 글도 줄을 바꾸지 않는다", () => {
    render(
      <QuantityPicker
        defaultValue={10}
        getValueText={(v) => `${v}명의 승인자`}
        aria-label="a"
      />,
    );
    expect(valueCell().lastElementChild!.className).toContain(
      "whitespace-nowrap",
    );
  });
});
