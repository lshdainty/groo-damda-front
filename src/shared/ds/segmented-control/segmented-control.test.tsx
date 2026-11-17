// Segmented Control 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cn } from "@/shared/lib/cn";

import { SegmentedControl, SegmentedControlItem } from "./segmented-control";
import {
  SEGMENTED_LABEL,
  segmentedControlItemVariants,
  segmentedControlVariants,
} from "./segmented-control-variants";

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
  vi.useRealTimers();
});

function render(node: ReactNode) {
  act(() => root.render(node));
  return container.firstElementChild as HTMLElement;
}

const radios = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("[role=radio]"));
const radio = (name: string) => radios().find((r) => r.textContent === name)!;
const pill = () =>
  container.querySelector<HTMLElement>(
    "[data-slot=segmented-control-indicator]",
  )!;

const TodoView = (props: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  disabledWeek?: boolean;
}) => (
  <SegmentedControl
    aria-label="할 일 보기"
    defaultValue={props.defaultValue}
    value={props.value}
    onValueChange={props.onValueChange}
  >
    <SegmentedControlItem value="today">오늘</SegmentedControlItem>
    <SegmentedControlItem value="week" disabled={props.disabledWeek}>
      이번 주
    </SegmentedControlItem>
    <SegmentedControlItem value="all">전체</SegmentedControlItem>
  </SegmentedControl>
);

describe("SegmentedControl", () => {
  it("트랙은 radiogroup + 이름, 칸은 라디오 — 고른 칸만 aria-checked · tabIndex 0", () => {
    const track = render(<TodoView defaultValue="week" />);
    expect(track.getAttribute("role")).toBe("radiogroup");
    expect(track.getAttribute("aria-label")).toBe("할 일 보기");
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("누르면 그 칸을 고르고 onValueChange 로 알린다 — 고른 칸을 다시 눌러도 그대로다", () => {
    const onValueChange = vi.fn();
    render(<TodoView defaultValue="today" onValueChange={onValueChange} />);
    act(() => radio("전체").click());
    expect(radio("전체").getAttribute("aria-checked")).toBe("true");
    expect(radio("오늘").tabIndex).toBe(-1);
    expect(radio("전체").tabIndex).toBe(0);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("all");
    act(() => radio("전체").click());
    expect(radio("전체").getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("값을 밖에서 쥐면 그 값을 따른다 — 알약도 따라간다", () => {
    const Controlled = () => {
      const [view, setView] = useState("today");
      return (
        <>
          <TodoView value={view} onValueChange={setView} />
          <button type="button" onClick={() => setView("all")}>
            전체로
          </button>
        </>
      );
    };
    render(<Controlled />);
    expect(pill().style.getPropertyValue("--segmented-index")).toBe("0");
    act(() =>
      container.querySelector<HTMLButtonElement>("button:not([role])")!.click(),
    );
    expect(radio("전체").getAttribute("aria-checked")).toBe("true");
    expect(radio("전체").tabIndex).toBe(0);
    expect(pill().style.getPropertyValue("--segmented-index")).toBe("2");
  });

  it("고른 알약은 칸 수로 나누고 고른 칸 번호만큼 옮긴다 — 고른 칸이 없으면 숨긴다", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<TodoView defaultValue="week" />);
    expect(pill().getAttribute("aria-hidden")).toBe("true");
    expect(pill().style.getPropertyValue("--segmented-count")).toBe("3");
    expect(pill().style.getPropertyValue("--segmented-index")).toBe("1");
    expect(pill().hidden).toBe(false);

    // 값이 없으면(개발 중 경고) 알약을 숨긴다 — 기본값은 처음 그릴 때만 읽으므로 새로 그린다
    act(() => root.unmount());
    root = createRoot(container);
    render(<TodoView />);
    expect(pill().hidden).toBe(true);
  });

  it("화살표로 옮기면 바로 고른다 — 막힌 칸은 건너뛰고 끝에서 처음으로 돈다", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(
      <TodoView
        defaultValue="today"
        onValueChange={onValueChange}
        disabledWeek
      />,
    );
    act(() => radio("오늘").focus());
    act(() => {
      radio("오늘").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      vi.runAllTimers();
    });
    // 막힌 "이번 주" 를 건너뛴다
    expect(document.activeElement).toBe(radio("전체"));
    expect(radio("전체").getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenLastCalledWith("all");
    act(() => {
      radio("전체").dispatchEvent(
        new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }),
      );
      radio("전체").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
      vi.runAllTimers();
    });
    expect(document.activeElement).toBe(radio("오늘"));
    expect(radio("오늘").getAttribute("aria-checked")).toBe("true");
  });

  it("막힌 칸은 누를 수 없고, 트랙에 disabled 를 주면 칸이 모두 막힌다", () => {
    const onValueChange = vi.fn();
    render(
      <TodoView
        defaultValue="today"
        onValueChange={onValueChange}
        disabledWeek
      />,
    );
    expect(radio("이번 주").disabled).toBe(true);
    act(() => radio("이번 주").click());
    expect(onValueChange).not.toHaveBeenCalled();

    act(() =>
      root.render(
        <SegmentedControl aria-label="할 일 보기" defaultValue="today" disabled>
          <SegmentedControlItem value="today">오늘</SegmentedControlItem>
          <SegmentedControlItem value="all">전체</SegmentedControlItem>
        </SegmentedControl>,
      ),
    );
    expect(radios().every((r) => r.disabled)).toBe(true);
  });

  it("알림 점은 안 고른 칸에만 — 보조 기술에는 “새 소식” 을 덧붙이고, 고르면 사라진다", () => {
    render(
      <SegmentedControl aria-label="할 일 보기" defaultValue="today">
        <SegmentedControlItem value="today">오늘</SegmentedControlItem>
        <SegmentedControlItem value="done" notification>
          완료
        </SegmentedControlItem>
      </SegmentedControl>,
    );
    const done = radio("완료새 소식");
    const dot = done.querySelector(
      "[data-slot=segmented-control-notification]",
    )!;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(done.textContent).toBe("완료새 소식");
    act(() => done.click());
    expect(
      done.querySelector("[data-slot=segmented-control-notification]"),
    ).toBeNull();
    expect(done.textContent).toBe("완료");
  });

  it("누르는 순간 칸을 재서 글이 줄 기준 길이를 넘긴다 — 포인터 · Space", () => {
    const onPointerDown = vi.fn();
    render(
      <SegmentedControl aria-label="할 일 보기" defaultValue="today">
        <SegmentedControlItem value="today" onPointerDown={onPointerDown}>
          오늘
        </SegmentedControlItem>
        <SegmentedControlItem value="all">전체</SegmentedControlItem>
      </SegmentedControl>,
    );
    const today = radio("오늘");
    const all = radio("전체");
    act(() => {
      today.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    // jsdom 은 크기가 0 이라 바닥값 24 — max(높이, 폭 ÷ 4, 24)
    expect(today.style.getPropertyValue("--press-basis")).toBe("24");
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    act(() => {
      all.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    expect(all.style.getPropertyValue("--press-basis")).toBe("24");
  });

  it("이름 · 값이 없거나 칸이 2 ~ 4개가 아니면 개발 중에 경고한다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <SegmentedControl>
        <SegmentedControlItem value="a">하나</SegmentedControlItem>
      </SegmentedControl>,
    );
    const messages = warn.mock.calls.map(([m]) => String(m));
    expect(messages.some((m) => m.includes("칸이 1개다"))).toBe(true);
    expect(messages.some((m) => m.includes("이름이 없다"))).toBe(true);
    expect(
      messages.some((m) => m.includes("value 도 defaultValue 도 없다")),
    ).toBe(true);
  });

  it("이름과 값이 있으면 경고하지 않는다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<TodoView defaultValue="today" />);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("320 보다 좁은 화면(Layout 지원 폭)", () => {
  /** 화면 폭을 정해 matchMedia 를 흉내 낸다 — jsdom 은 레이아웃이 없다 */
  const viewport = (width: number) => {
    window.matchMedia = ((query: string) => {
      const max = /max-width:\s*([\d.]+)px/.exec(query);
      return {
        matches: max ? width <= Number(max[1]) : false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      };
    }) as unknown as typeof window.matchMedia;
  };
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });
  const label = (name: string) =>
    radio(name).querySelector<HTMLElement>(
      "[data-slot=segmented-control-label]",
    )!;

  it("320 이상(320 · 360)은 그대로다 — 낱말 단위 줄바꿈 · 칸 최소 폭 없음 · 미끄러지는 알약", () => {
    for (const width of [320, 360]) {
      viewport(width);
      const track = render(<TodoView defaultValue="week" />);
      expect(track.hasAttribute("data-narrow")).toBe(false);
      expect(track.className).toBe(cn(segmentedControlVariants()));
      expect(radio("이번 주").className).toBe(
        cn(segmentedControlItemVariants()),
      );
      expect(label("이번 주").className).toBe(SEGMENTED_LABEL);
      expect(label("이번 주").className).toContain(
        "[overflow-wrap:break-word]",
      );
      expect(pill().hidden).toBe(false);
      act(() => root.render(null));
    }
  });

  it("320 미만(201)은 낱말 안에서 꺾지 않고 줄 전체를 가로로 스크롤한다 — 고른 칸이 알약을 칠한다", () => {
    viewport(201);
    const track = render(<TodoView defaultValue="week" />);
    expect(track.getAttribute("data-narrow")).toBe("true");
    // 줄 전체 가로 스크롤 · 스크롤바 숨김
    expect(track.className).toContain("overflow-x-auto");
    expect(track.className).toContain("[scrollbar-width:none]");
    // 칸은 가장 긴 낱말 + 좌우 여백 아래로 줄지 않는다
    expect(radio("이번 주").className).toContain("min-w-min");
    expect(radio("이번 주").className).not.toContain("min-w-0");
    // 낱말 안에서 꺾지 않는다(낱말 사이 줄바꿈 break-keep 은 그대로)
    expect(label("이번 주").className).toContain("[overflow-wrap:normal]");
    expect(label("이번 주").className).not.toContain(
      "[overflow-wrap:break-word]",
    );
    expect(label("이번 주").className).toContain("break-keep");
    // 칸 폭이 고르지 않을 수 있어 미끄러지는 알약 대신 고른 칸이 칠한다
    expect(pill().hidden).toBe(true);
    expect(radio("이번 주").className).toContain(
      "data-[state=checked]:bg-bg-layer-default",
    );
    // 고르기 · 키보드는 그대로다
    act(() => radio("전체").click());
    expect(radio("전체").getAttribute("aria-checked")).toBe("true");
  });
});
