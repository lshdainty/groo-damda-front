// Color Swatch 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Field } from "@/shared/ds/field";

import { ColorSwatchGroup, type ColorSwatchValue } from "./color-swatch";
import {
  colorName,
  COLOR_SWATCH_ORDER,
  CHECK,
  SWATCH,
  firstUnusedColor,
  parseRgb,
  contrastOf,
} from "./color-swatch-variants";

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
  // jsdom 에 없는 브라우저 기능 — 툴팁(크기 재기)과 지금 색 칸의 체크(색 모드 바뀜)가 쓴다
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

const group = () => container.querySelector<HTMLElement>("[role=radiogroup]")!;
const radios = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("[role=radio]"));
const names = () => radios().map((r) => r.getAttribute("aria-label"));
const checked = () =>
  radios().find((r) => r.getAttribute("aria-checked") === "true");

function key(el: HTMLElement, k: string) {
  const e = new KeyboardEvent("keydown", {
    key: k,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    el.dispatchEvent(e);
  });
  return e;
}

describe("firstUnusedColor", () => {
  it("v110 배정 순서에서 쓰지 않은 첫 색 — 회색은 주지 않는다", () => {
    expect(firstUnusedColor([])).toBe("blue");
    expect(firstUnusedColor(["blue", "green"])).toBe("orange");
    // 기본 지출 카테고리 여덟 — 아홉 번째는 쓰지 않은 갈색 · 늘 빨강이 아니다
    expect(
      firstUnusedColor([
        "blue",
        "green",
        "orange",
        "violet",
        "pink",
        "indigo",
        "red",
        "yellow",
      ]),
    ).toBe("brown");
  });

  it("아홉 색을 다 쓰면 파랑부터 다시 — null · undefined 는 센 것이 아니다", () => {
    expect(
      firstUnusedColor([
        "blue",
        "green",
        "orange",
        "violet",
        "pink",
        "indigo",
        "red",
        "yellow",
        "brown",
        "gray",
      ]),
    ).toBe("blue");
    expect(firstUnusedColor([null, undefined])).toBe("blue");
    expect(firstUnusedColor(new Set(["blue"] as const))).toBe("green");
  });
});

describe("글자 크기를 따르지 않는 px(color-swatch.yaml:71)", () => {
  it("칸 40 · 누르는 44 · 체크 16 · 링 간격 6 · 간격 12 모두 px 클래스 — rem 이 아니다", () => {
    const cls = SWATCH.split(" ");
    expect(cls).toContain("size-[40px]");
    expect(cls).toContain("before:-inset-[2px]");
    expect(cls).toContain("after:-inset-[6px]");
    expect(CHECK).toContain("[&_svg]:size-[16px]");
    expect(SWATCH).not.toMatch(/-inset-(0\.5|1\.5)\b/);
  });
});

describe("색 이름 · 차례", () => {
  it("차례는 색상환 — 칸 이름은 색 이름 열 개", () => {
    render(<ColorSwatchGroup aria-label="색상" />);
    expect(names()).toEqual([
      "빨강",
      "주황",
      "노랑",
      "초록",
      "파랑",
      "남색",
      "보라",
      "분홍",
      "갈색",
      "회색",
    ]);
    expect(COLOR_SWATCH_ORDER.map((c) => colorName(c))).toEqual(names());
  });

  it("묶음은 radiogroup — 이름은 aria-label, 칸은 role=radio · 5 × 2 격자", () => {
    render(<ColorSwatchGroup aria-label="색상" />);
    expect(group().getAttribute("aria-label")).toBe("색상");
    expect(radios()).toHaveLength(10);
    const grid = container.querySelector<HTMLElement>(
      "[data-slot=color-swatch-grid]",
    )!;
    expect(grid.className).toContain("grid-cols-[repeat(5,40px)]");
    expect(grid.className).toContain("w-[248px]");
  });

  it("Field 안이면 라벨이 묶음 이름 · 설명이 설명", () => {
    render(
      <Field label="색상" description="항목에 붙일 색이에요.">
        <ColorSwatchGroup />
      </Field>,
    );
    const labelId = group().getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)?.textContent).toContain("색상");
    expect(
      document.getElementById(group().getAttribute("aria-describedby")!)
        ?.textContent,
    ).toContain("붙일 색");
  });
});

describe("고르기", () => {
  it("누르면 고르고 고리 · 체크가 옮겨 간다 — 알림은 한 번", () => {
    const onValueChange = vi.fn();
    render(
      <ColorSwatchGroup aria-label="색상" onValueChange={onValueChange} />,
    );
    expect(checked()).toBeUndefined();
    expect(
      container.querySelector("[data-slot=color-swatch-check]"),
    ).toBeNull();
    act(() => radios()[4]!.click());
    expect(checked()?.getAttribute("aria-label")).toBe("파랑");
    expect(onValueChange).toHaveBeenCalledWith("blue");
    expect(
      container.querySelectorAll("[data-slot=color-swatch-check]"),
    ).toHaveLength(1);
    expect(
      checked()!.contains(
        container.querySelector("[data-slot=color-swatch-check]"),
      ),
    ).toBe(true);
    // 체크는 보조 기술에 숨긴다 — 고름은 aria-checked 가 말한다
    expect(
      container
        .querySelector("[data-slot=color-swatch-check]")!
        .getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("고른 칸을 다시 눌러도 그대로 — 알리지 않는다(라디오)", () => {
    const onValueChange = vi.fn();
    render(
      <ColorSwatchGroup
        aria-label="색상"
        defaultValue="red"
        onValueChange={onValueChange}
      />,
    );
    act(() => radios()[0]!.click());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(checked()?.getAttribute("aria-label")).toBe("빨강");
  });

  it("값을 밖에서 쥐면 바뀐 값을 넣어야 바뀐다", () => {
    const Controlled = () => {
      const [v, setV] = useState<ColorSwatchValue | null>("green");
      return (
        <ColorSwatchGroup aria-label="색상" value={v} onValueChange={setV} />
      );
    };
    render(<Controlled />);
    expect(checked()?.getAttribute("aria-label")).toBe("초록");
    act(() => radios()[8]!.click());
    expect(checked()?.getAttribute("aria-label")).toBe("갈색");

    const onValueChange = vi.fn();
    act(() =>
      root.render(
        <ColorSwatchGroup
          aria-label="색상"
          value="red"
          onValueChange={onValueChange}
        />,
      ),
    );
    act(() => radios()[1]!.click());
    expect(onValueChange).toHaveBeenCalledWith("orange");
    expect(checked()?.getAttribute("aria-label")).toBe("빨강");
  });

  it("막히면 누를 수 없고 색은 그대로 보이며, 고른 칸의 고리는 회색으로 남는다", () => {
    const onValueChange = vi.fn();
    render(
      <ColorSwatchGroup
        aria-label="색상"
        defaultValue="blue"
        disabled
        onValueChange={onValueChange}
      />,
    );
    expect(radios().every((r) => r.disabled)).toBe(true);
    act(() => radios()[0]!.click());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(group().getAttribute("aria-disabled")).toBe("true");
    expect(radios()[0]!.className).toContain("bg-chart-red");
    expect(radios()[0]!.className).toContain(
      "disabled:aria-checked:outline-stroke-neutral-solid",
    );
  });

  it("Field 의 막힘 · 오류 · 필수를 받는다", () => {
    render(
      <Field
        label="색상"
        disabled
        invalid
        required
        errorMessage="색을 골라주세요."
      >
        <ColorSwatchGroup />
      </Field>,
    );
    expect(radios().every((r) => r.disabled)).toBe(true);
    expect(group().getAttribute("aria-invalid")).toBe("true");
    expect(group().getAttribute("aria-required")).toBe("true");
  });
});

describe("키보드 — radiogroup", () => {
  const setup = (value: ColorSwatchValue | null = null, extra = {}) => {
    const onValueChange = vi.fn();
    render(
      <ColorSwatchGroup
        aria-label="색상"
        defaultValue={value}
        onValueChange={onValueChange}
        {...extra}
      />,
    );
    return { onValueChange };
  };

  it("묶음에 Tab 하나 — 고른 칸에 서고, 고른 칸이 없으면 첫 칸", () => {
    setup(null);
    expect(radios().map((r) => r.tabIndex)).toEqual([0, ...Array(9).fill(-1)]);
    act(() =>
      root.render(<ColorSwatchGroup aria-label="색상" defaultValue="blue" />),
    );
    // 비제어라 defaultValue 가 바뀌어도 이미 든 값(null)이다 — 새로 그려 확인
    act(() => root.unmount());
    root = createRoot(container);
    render(<ColorSwatchGroup aria-label="색상" defaultValue="blue" />);
    expect(radios().findIndex((r) => r.tabIndex === 0)).toBe(4);
    expect(radios().filter((r) => r.tabIndex === 0)).toHaveLength(1);
  });

  it("← → 는 차례대로 옮기며 고른다 — 끝에서 처음으로 돈다, 초점도 따라간다", () => {
    const { onValueChange } = setup("gray");
    act(() => radios()[9]!.focus());
    key(radios()[9]!, "ArrowRight");
    expect(checked()?.getAttribute("aria-label")).toBe("빨강");
    expect(document.activeElement).toBe(radios()[0]);
    expect(onValueChange).toHaveBeenLastCalledWith("red");
    key(radios()[0]!, "ArrowLeft");
    expect(checked()?.getAttribute("aria-label")).toBe("회색");
  });

  it("↑ ↓ 는 위아래 줄의 같은 칸 — 두 줄이라 오간다", () => {
    setup("green");
    act(() => radios()[3]!.focus());
    key(radios()[3]!, "ArrowDown");
    expect(checked()?.getAttribute("aria-label")).toBe("갈색");
    key(radios()[8]!, "ArrowDown");
    expect(checked()?.getAttribute("aria-label")).toBe("초록");
    key(radios()[3]!, "ArrowUp");
    expect(checked()?.getAttribute("aria-label")).toBe("갈색");
  });

  it("Home · End · PageUp · PageDown 은 받지 않는다 — 화살표만(03-E 결정 3 후속)", () => {
    setup("blue");
    act(() => radios()[4]!.focus());
    for (const k of ["End", "Home", "PageUp", "PageDown"]) {
      key(radios()[4]!, k);
      expect(checked()?.getAttribute("aria-label")).toBe("파랑");
      expect(document.activeElement).toBe(radios()[4]);
    }
  });

  it("Enter 는 고르지 않고 폼을 제출한다", () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <ColorSwatchGroup aria-label="색상" defaultValue="red" />
        <button type="submit">저장</button>
      </form>,
    );
    act(() => radios()[2]!.focus());
    const e = key(radios()[2]!, "Enter");
    expect(e.defaultPrevented).toBe(true);
    expect(checked()?.getAttribute("aria-label")).toBe("빨강");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("그 밖의 키는 건드리지 않는다 — 막히면 화살표도 먹지 않는다", () => {
    const { onValueChange } = setup("red");
    act(() => radios()[0]!.focus());
    const e = key(radios()[0]!, "a");
    expect(e.defaultPrevented).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("지금 색 · 자동", () => {
  it('currentColor 를 주면 격자 앞에 "지금 색" 칸 — 저장된 색을 그대로 칠하고 이름이 아래 글로 보인다', () => {
    render(
      <ColorSwatchGroup
        aria-label="색상"
        defaultValue="current"
        currentColor="#9E9E9E"
      />,
    );
    expect(radios()).toHaveLength(11);
    expect(names()[0]).toBe("지금 색");
    expect(checked()?.dataset.slot).toBe("color-swatch-current");
    expect(checked()!.style.background).toMatch(/158, 158, 158|#9e9e9e/i);
    expect(
      container.querySelector("[data-slot=color-swatch-current-label]")!
        .textContent,
    ).toBe("지금 색");
    expect(
      container.querySelector("[data-slot=color-swatch-divider]"),
    ).not.toBeNull();
    // 묶음이 놓인 자리의 폭으로 위 · 옆을 가른다
    expect(group().className).toContain("@container");
    // 폭을 못 잰 곳(jsdom)은 옆으로 둔다 — 실제 폭 판정은 아래 시험
    expect(
      container.querySelector("[data-slot=color-swatch-layout]")!.className,
    ).toContain("flex-row");
  });

  describe("지금 색 칸 위 · 옆 — 실제 폭으로 판정", () => {
    const layout = () =>
      container
        .querySelector("[data-slot=color-swatch-layout]")!
        .className.split(" ");
    const divider = () =>
      container
        .querySelector("[data-slot=color-swatch-divider]")!
        .className.split(" ");
    function measured(rootWidth: number, columnWidth: number) {
      const cw = vi
        .spyOn(HTMLElement.prototype, "clientWidth", "get")
        .mockImplementation(function (this: HTMLElement) {
          return this.dataset.slot === "color-swatch-group" ? rootWidth : 0;
        });
      const ow = vi
        .spyOn(HTMLElement.prototype, "offsetWidth", "get")
        .mockImplementation(function (this: HTMLElement) {
          return this.dataset.slot === "color-swatch-current-column"
            ? columnWidth
            : 0;
        });
      return () => {
        cw.mockRestore();
        ow.mockRestore();
      };
    }
    const renderCurrent = () =>
      render(<ColorSwatchGroup aria-label="색상" currentColor="#9E9E9E" />);

    it("폭이 칸 + 33 + 격자 248 보다 좁으면(312) 위 줄 · 가로 선", () => {
      const restore = measured(312, 40);
      renderCurrent();
      expect(layout()).toContain("flex-col");
      expect(layout()).not.toContain("@min-[321px]:flex-row");
      expect(divider()).toContain("h-px");
      restore();
    });

    it("넓으면(342) 옆 · 세로 선", () => {
      const restore = measured(342, 40);
      renderCurrent();
      expect(layout()).toContain("flex-row");
      expect(divider()).toContain("w-px");
      restore();
    });

    it("글자 확대로 칸이 넓어지면(80) 같은 342 에서도 위 줄로 올려 가로로 넘치지 않는다", () => {
      const restore = measured(342, 80);
      renderCurrent();
      expect(layout()).toContain("flex-col");
      expect(layout()).not.toContain("@min-[321px]:flex-row");
      restore();
    });
  });

  it('autoColor 는 "자동" 칸 — 점선 원에 차트가 줄 색', () => {
    render(
      <ColorSwatchGroup
        aria-label="색상"
        defaultValue="current"
        autoColor="brown"
      />,
    );
    expect(names()[0]).toBe("자동");
    const auto = radios()[0]!;
    expect(auto.className).toContain("bg-chart-brown");
    expect(auto.className).toContain("border-dashed");
    expect(
      container.querySelector("[data-slot=color-swatch-current-label]")!
        .textContent,
    ).toBe("자동");
  });

  it("지금 색 칸을 고르고 격자에서 고르면 바뀌고, 다시 지금 색을 고르면 저장 값을 그대로 둔다", () => {
    const onValueChange = vi.fn();
    render(
      <ColorSwatchGroup
        aria-label="색상"
        defaultValue="current"
        currentColor="#9E9E9E"
        onValueChange={onValueChange}
      />,
    );
    act(() => radios()[5]!.click());
    expect(onValueChange).toHaveBeenLastCalledWith("blue");
    act(() => radios()[0]!.click());
    expect(onValueChange).toHaveBeenLastCalledWith("current");
  });

  it("아무것도 고르지 않으면 값을 만들지 않는다 — 몰래 빨강으로 바꾸지 않는다", () => {
    const onValueChange = vi.fn();
    render(
      <ColorSwatchGroup
        aria-label="색상"
        currentColor="#9E9E9E"
        onValueChange={onValueChange}
      />,
    );
    expect(checked()).toBeUndefined();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("차례는 지금 색 칸이 맨 앞 — → 로 지금 색에서 빨강으로, ↑ ↓ 는 지금 색 칸에서 그대로", () => {
    render(
      <ColorSwatchGroup
        aria-label="색상"
        defaultValue="current"
        currentColor="#9E9E9E"
      />,
    );
    act(() => radios()[0]!.focus());
    key(radios()[0]!, "ArrowDown");
    expect(checked()?.getAttribute("aria-label")).toBe("지금 색");
    key(radios()[0]!, "ArrowRight");
    expect(checked()?.getAttribute("aria-label")).toBe("빨강");
    // 격자 안 ↓ 는 격자 줄 기준 — 빨강(첫 칸)의 아래 줄 첫 칸은 남색
    key(radios()[1]!, "ArrowDown");
    expect(checked()?.getAttribute("aria-label")).toBe("남색");
  });

  it("지금 색 칸의 체크는 두 색 가운데 대비가 큰 쪽으로 정한다(셈)", () => {
    // 밝은 칸 위 짙은 글자 · 짙은 칸 위 밝은 글자
    const light = parseRgb("rgb(240, 240, 240)")!;
    const dark = parseRgb("rgb(20, 20, 30)")!;
    const white = parseRgb("rgb(255, 255, 255)")!;
    expect(contrastOf(dark, light)).toBeGreaterThan(contrastOf(white, light));
    expect(contrastOf(white, dark)).toBeGreaterThan(contrastOf(dark, dark));
    expect(parseRgb("transparent")).toBeNull();
  });
});
