// Wheel Picker 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { trackInputModality } from "@/shared/lib/input-modality";
import {
  pressPointer,
  ringTargets,
} from "@/shared/lib/input-modality.test-utils";

import {
  WheelPicker,
  WheelPickerColumn,
  type WheelPickerColumnProps,
  type WheelPickerOption,
  type WheelPickerProps,
} from "./wheel-picker";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// jsdom 에는 스크롤이 없다 — scrollTop 은 담아 두므로 scrollTo 만 채운다(바로 옮기고 브라우저처럼 scroll 을 알린다)
beforeAll(() => {
  Element.prototype.scrollTo = function (
    this: Element,
    arg?: ScrollToOptions | number,
    y?: number,
  ) {
    const top = typeof arg === "object" ? arg.top : y;
    if (typeof top === "number") this.scrollTop = top;
    this.dispatchEvent(new Event("scroll"));
  } as Element["scrollTo"];
  // 모션 줄이기를 묻는다 — 끈 사람으로
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollTo;
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

// 누르기 · 키로 칸을 옮기는 시간(스펙 motion-duration-d4, Q-005)
const MOVE_MS = 200;

// 멈췄다고 보는 120ms 와 그다음 프레임까지
const settle = () =>
  act(() => {
    vi.advanceTimersByTime(300);
  });

function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  });
}

const YEARS: WheelPickerOption[] = Array.from({ length: 11 }, (_, i) => ({
  value: String(2021 + i),
  label: `${2021 + i}년`,
}));
const MONTHS: WheelPickerOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}월`,
}));

const column = (name: string) =>
  container.querySelector<HTMLDivElement>(`[aria-label="${name}"]`)!;

function Month(
  props: Partial<WheelPickerColumnProps> &
    Pick<WheelPickerProps, "disabled" | "size" | "visibleItems">,
) {
  const { disabled, size, visibleItems, ...col } = props;
  return (
    <WheelPicker
      aria-label="월 선택"
      disabled={disabled}
      size={size}
      visibleItems={visibleItems}
    >
      <WheelPickerColumn
        aria-label="연도"
        options={YEARS}
        defaultValue="2026"
        {...col}
      />
      <WheelPickerColumn
        aria-label="월"
        options={MONTHS}
        defaultValue="10"
        loop
      />
    </WheelPicker>
  );
}

// 스펙 값(생성물 — 읽기만 한다). 스크롤 계산이 쓰는 칸 높이(JS)는 검사기가 CSS 로 재는 항목 높이와 같아야 한다
type SpecJson = {
  rules: {
    when: Record<string, string>;
    enabled?: Record<string, Record<string, unknown>>;
  }[];
};
const SPEC = Object.values(
  import.meta.glob<SpecJson>("../spec/wheel-picker.json", {
    eager: true,
    import: "default",
  }),
)[0]!;

describe("WheelPicker", () => {
  it("스크롤 계산의 칸 높이는 스펙의 항목 높이 — medium 44 · small 36", () => {
    for (const size of ["medium", "small"] as const) {
      const height = SPEC.rules.find((r) => r.when.size === size)!.enabled!.item
        ?.height;
      act(() => root.render(null));
      render(<Month size={size} />);
      // 2026년은 다섯째(번호 5) — 첫 항목에서 5칸
      expect(column("연도").scrollTop).toBe(5 * (height as number));
    }
  });

  it("휠은 이름 있는 group, 칼럼은 spinbutton — 범위 · 지금 번호 · 읽는 글, 항목은 보조 기술에 숨긴다", () => {
    render(<Month />);
    const wheel = container.querySelector("[data-slot=wheel-picker]")!;
    expect(wheel.getAttribute("role")).toBe("group");
    expect(wheel.getAttribute("aria-label")).toBe("월 선택");
    const year = column("연도");
    expect(year.getAttribute("role")).toBe("spinbutton");
    expect(year.tabIndex).toBe(0);
    expect(year.getAttribute("aria-valuemin")).toBe("0");
    expect(year.getAttribute("aria-valuemax")).toBe("10");
    expect(year.getAttribute("aria-valuenow")).toBe("5");
    expect(year.getAttribute("aria-valuetext")).toBe("2026년");
    const month = column("월");
    expect(month.getAttribute("aria-valuemax")).toBe("11");
    expect(month.getAttribute("aria-valuetext")).toBe("10월");
    for (const item of year.querySelectorAll("[data-slot=wheel-picker-item]"))
      expect(item.getAttribute("aria-hidden")).toBe("true");
  });

  it("기본은 medium · 5칸 — 크기 · 칸 수가 휠 높이(항목 높이 × 보이는 수)를 정한다", () => {
    render(<Month />);
    const wheel = container.querySelector<HTMLElement>(
      "[data-slot=wheel-picker]",
    )!;
    expect(wheel.dataset.size).toBe("medium");
    expect(wheel.className).toContain("[--wheel-item:44px]");
    expect(wheel.className).toContain("[--wheel-count:5]");
    render(<Month size="small" visibleItems={7} />);
    expect(wheel.dataset.size).toBe("small");
    expect(wheel.className).toContain("[--wheel-item:36px]");
    expect(wheel.className).toContain("[--wheel-count:7]");
  });

  it("처음엔 고른 항목을 띠에 둔다 — 가운데 항목에 data-selected · 띠와 겹친 자리", () => {
    render(<Month />);
    const year = column("연도");
    expect(year.scrollTop).toBe(5 * 44);
    const selected = year.querySelector<HTMLElement>("[data-selected]")!;
    expect(selected.dataset.value).toBe("2026");
    expect(selected.hasAttribute("data-overlap")).toBe(true);
    expect(selected.style.getPropertyValue("--wheel-overlap-start")).toBe("0%");
    expect(selected.style.getPropertyValue("--wheel-overlap-end")).toBe("100%");
    // 띠와 겹치는 건 그 항목 하나
    expect(year.querySelectorAll("[data-overlap]")).toHaveLength(1);
  });

  it("반복 칼럼은 항목을 앞뒤로 이어 그리고 가운데 벌에서 시작한다", () => {
    render(<Month />);
    const month = column("월");
    const items = month.querySelectorAll("[data-slot=wheel-picker-item]");
    // 앞뒤 12화면치 — 5칸이면 한쪽에 5벌, 모두 11벌
    expect(items).toHaveLength(12 * 11);
    expect(month.scrollTop).toBe((5 * 12 + 9) * 44);
    expect(
      month.querySelector<HTMLElement>("[data-selected]")!.dataset.value,
    ).toBe("10");
  });

  it("↓ 는 다음 항목 — 멈춘 뒤 값이 한 번 정해진다(stepDelta +1)", () => {
    const onValueChange = vi.fn();
    render(<Month onValueChange={onValueChange} />);
    const year = column("연도");
    key(year, "ArrowDown");
    // 굴리는 동안에는 정하지 않는다
    expect(onValueChange).not.toHaveBeenCalled();
    settle();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("2027", {
      stepDelta: 1,
      jump: false,
    });
    expect(year.getAttribute("aria-valuenow")).toBe("6");
    expect(year.getAttribute("aria-valuetext")).toBe("2027년");
  });

  it("↑ 는 이전, Home · End 는 처음 · 끝 — 처음에서 ↑ 는 그대로", () => {
    const onValueChange = vi.fn();
    render(<Month onValueChange={onValueChange} />);
    const year = column("연도");
    key(year, "ArrowUp");
    settle();
    expect(onValueChange).toHaveBeenLastCalledWith("2025", {
      stepDelta: -1,
      jump: false,
    });
    key(year, "End");
    settle();
    expect(onValueChange).toHaveBeenLastCalledWith("2031", {
      stepDelta: 6,
      jump: true,
    });
    key(year, "Home");
    settle();
    expect(onValueChange).toHaveBeenLastCalledWith("2021", {
      stepDelta: -10,
      jump: true,
    });
    expect(year.getAttribute("aria-valuenow")).toBe("0");
    onValueChange.mockClear();
    key(year, "ArrowUp");
    settle();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(year.getAttribute("aria-valuetext")).toBe("2021년");
  });

  it("빠르게 거듭 누르면 가던 자리에서 이어 가고, 값은 멈춘 뒤 한 번만", () => {
    const onValueChange = vi.fn();
    render(<Month onValueChange={onValueChange} />);
    const year = column("연도");
    key(year, "ArrowDown");
    key(year, "ArrowDown");
    key(year, "ArrowDown");
    settle();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("2029", {
      stepDelta: 3,
      jump: false,
    });
  });

  it("반복 칼럼 — 12월 다음은 1월, stepDelta 로 넘어간 것을 안다", () => {
    const onValueChange = vi.fn();
    render(
      <WheelPicker aria-label="월 선택">
        <WheelPickerColumn
          aria-label="월"
          options={MONTHS}
          defaultValue="12"
          loop
          onValueChange={onValueChange}
        />
      </WheelPicker>,
    );
    const month = column("월");
    key(month, "ArrowDown");
    settle();
    expect(onValueChange).toHaveBeenCalledWith("1", {
      stepDelta: 1,
      jump: false,
    });
    expect(month.getAttribute("aria-valuetext")).toBe("1월");
    key(month, "ArrowUp");
    settle();
    expect(onValueChange).toHaveBeenLastCalledWith("12", {
      stepDelta: -1,
      jump: false,
    });
  });

  it("굴리는 동안 띠를 지나는 항목마다 onIndexChange — 값은 아직 정하지 않는다", () => {
    const onIndexChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <Month onIndexChange={onIndexChange} onValueChange={onValueChange} />,
    );
    key(column("연도"), "End");
    // 200ms ease-out cubic 으로 가는 동안 지나간 항목을 센다
    act(() => {
      vi.advanceTimersByTime(MOVE_MS + 20);
    });
    expect(onIndexChange.mock.calls).toEqual([
      [6, "2027"],
      [7, "2028"],
      [8, "2029"],
      [9, "2030"],
      [10, "2031"],
    ]);
    expect(onValueChange).not.toHaveBeenCalled();
    settle();
    expect(onValueChange).toHaveBeenCalledWith("2031", {
      stepDelta: 5,
      jump: true,
    });
  });

  it("굴리는 동안 쓰는 쪽이 다시 그려도(onIndexChange 로 상태를 바꿔도) 멈춘 뒤 값이 정해진다", () => {
    // 칼럼의 도구(api)가 그릴 때마다 바뀌면 치우기 효과가 다시 돌아 기다리던 정하기를 지운다 — 그것을 막는다
    const onValueChange = vi.fn();
    function Haptic() {
      const [ticks, setTicks] = useState(0);
      return (
        <>
          <span data-testid="ticks">{ticks}</span>
          <Month
            onIndexChange={() => setTicks((t) => t + 1)}
            onValueChange={onValueChange}
          />
        </>
      );
    }
    render(<Haptic />);
    key(column("연도"), "ArrowDown");
    act(() => {
      vi.advanceTimersByTime(MOVE_MS + 20);
    });
    expect(container.querySelector("[data-testid=ticks]")!.textContent).toBe(
      "1",
    );
    settle();
    expect(onValueChange).toHaveBeenCalledWith("2027", {
      stepDelta: 1,
      jump: false,
    });
  });

  it("보이는 항목을 누르면 그 항목을 가운데로 — 멈춘 뒤 값을 정한다", () => {
    const onValueChange = vi.fn();
    render(<Month onValueChange={onValueChange} />);
    const year = column("연도");
    act(() =>
      year
        .querySelector<HTMLElement>(
          '[data-slot=wheel-picker-item][data-value="2028"]',
        )!
        .click(),
    );
    // 브라우저 smooth 가 아니라 200ms ease-out cubic 을 직접 그린다 — 중간에는 아직 가는 중, 200ms 뒤 도착
    act(() => {
      vi.advanceTimersByTime(MOVE_MS / 2);
    });
    expect(year.scrollTop).toBeGreaterThan(5 * 44);
    expect(year.scrollTop).toBeLessThan(7 * 44);
    act(() => {
      vi.advanceTimersByTime(MOVE_MS);
    });
    expect(year.scrollTop).toBe(7 * 44);
    settle();
    expect(onValueChange).toHaveBeenCalledWith("2028", {
      stepDelta: 2,
      jump: false,
    });
  });

  it("제어하는 value — 바깥에서 바꾸면 그 자리로 옮긴다", () => {
    render(<Month value="2026" />);
    const year = column("연도");
    render(<Month value="2030" />);
    expect(year.scrollTop).toBe(9 * 44);
    expect(year.getAttribute("aria-valuenow")).toBe("9");
    expect(
      year.querySelector<HTMLElement>("[data-selected]")!.dataset.value,
    ).toBe("2030");
  });

  it("제어하는 value — 사용자가 고른 값은 onValueChange 로만 알리고 번호는 쓰는 쪽이 정한다", () => {
    const onValueChange = vi.fn();
    render(<Month value="2026" onValueChange={onValueChange} />);
    const year = column("연도");
    key(year, "ArrowDown");
    settle();
    expect(onValueChange).toHaveBeenCalledWith("2027", {
      stepDelta: 1,
      jump: false,
    });
    expect(year.getAttribute("aria-valuenow")).toBe("5");
  });

  it("막힌 휠 — 초점이 가지 않고(tabIndex -1 · aria-disabled) 키 · 누르기로 움직이지 않는다", () => {
    const onValueChange = vi.fn();
    render(<Month disabled onValueChange={onValueChange} />);
    const wheel = container.querySelector<HTMLElement>(
      "[data-slot=wheel-picker]",
    )!;
    expect(wheel.hasAttribute("data-disabled")).toBe(true);
    const year = column("연도");
    expect(year.tabIndex).toBe(-1);
    expect(year.getAttribute("aria-disabled")).toBe("true");
    key(year, "ArrowDown");
    act(() =>
      year
        .querySelector<HTMLElement>(
          '[data-slot=wheel-picker-item][data-value="2028"]',
        )!
        .click(),
    );
    settle();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(year.scrollTop).toBe(5 * 44);
    // 값은 그대로 읽힌다
    expect(year.getAttribute("aria-valuetext")).toBe("2026년");
  });

  it("읽는 글을 바꿀 수 있다 — getAriaValueText, 없으면 항목의 ariaLabel", () => {
    render(
      <WheelPicker aria-label="시각 선택">
        <WheelPickerColumn
          aria-label="오전 오후"
          options={[
            { value: "am", label: "AM", ariaLabel: "오전" },
            { value: "pm", label: "PM", ariaLabel: "오후" },
          ]}
          defaultValue="pm"
        />
        <WheelPickerColumn
          aria-label="시"
          options={[{ value: "9", label: "9" }]}
          getAriaValueText={(v) => `${v}시`}
        />
      </WheelPicker>,
    );
    expect(column("오전 오후").getAttribute("aria-valuetext")).toBe("오후");
    expect(column("시").getAttribute("aria-valuetext")).toBe("9시");
  });

  it("키보드 링은 키로 들어올 때만 — 마우스로 누르면 숨기고 다음 키 입력에 다시 그린다(index.css focus-visible 과 같은 조건)", () => {
    trackInputModality();
    render(<Month />);
    const year = column("연도");
    const selected = () => year.querySelector("[data-selected]");
    act(() => {
      year.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerType: "mouse",
          button: 0,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(year);
    expect(ringTargets(year)).toEqual([]);
    act(() => {
      year.dispatchEvent(
        new PointerEvent("pointerup", { pointerType: "mouse", bubbles: true }),
      );
    });
    key(year, "ArrowDown");
    expect(ringTargets(year)).toEqual([selected()]);
    expect(ringTargets(year, "-outline-offset-2")).toEqual([selected()]);
    // 손가락으로 다른 곳을 누른 뒤 스크립트가 초점을 돌려줘도 링이 없다
    act(() => year.blur());
    pressPointer();
    act(() => year.focus());
    expect(ringTargets(year)).toEqual([]);
  });

  it("이름이 없으면 개발 중에 알린다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unnamed = { "aria-label": " " } as WheelPickerProps;
    render(
      <WheelPicker {...unnamed}>
        <WheelPickerColumn aria-label="연도" options={YEARS} />
      </WheelPicker>,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("휠에 이름이 없다"),
      expect.anything(),
    );
    warn.mockRestore();
  });
});
