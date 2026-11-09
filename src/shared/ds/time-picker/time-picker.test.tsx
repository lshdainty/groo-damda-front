// Time Picker 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
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

import { TimePicker, type TimePickerProps } from "./time-picker";
import {
  formatTimeValue,
  roundToStep,
  type TimeValue,
} from "./time-picker-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// jsdom 에는 스크롤이 없다 — Wheel Picker 테스트와 같은 방법(scrollTo 가 바로 옮기고 scroll 을 알린다)
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

const render = (node: ReactNode) => act(() => root.render(node));
const settle = () =>
  act(() => {
    vi.advanceTimersByTime(400);
  });
const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  });
const col = (name: "period" | "hour" | "minute") =>
  container.querySelector<HTMLDivElement>(`[data-column=${name}]`)!;
const text = (name: "period" | "hour" | "minute") =>
  col(name).getAttribute("aria-valuetext");
const NOW = new Date(2026, 9, 15, 9, 13);

// 제어하는 쓰는 쪽 — onValueChange 가 받은 값을 그대로 다시 준다(draft)
function Controlled({
  initial,
  onChange,
  ...props
}: Omit<TimePickerProps, "value" | "onValueChange"> & {
  initial?: TimeValue;
  onChange?: (v: TimeValue) => void;
}) {
  const [value, setValue] = useState<TimeValue | undefined>(initial);
  return (
    <TimePicker
      aria-label="시작 시각"
      {...props}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("roundToStep · formatTimeValue", () => {
  it("분 간격으로 시각 전체를 반올림한다 — 9:58 → 10:00, 23:58 → 0:00 으로 돈다", () => {
    expect(roundToStep({ hour: 9, minute: 58 }, 5)).toEqual({
      hour: 10,
      minute: 0,
    });
    expect(roundToStep({ hour: 23, minute: 58 }, 5)).toEqual({
      hour: 0,
      minute: 0,
    });
    expect(roundToStep({ hour: 9, minute: 13 }, 15)).toEqual({
      hour: 9,
      minute: 15,
    });
    expect(roundToStep({ hour: 9, minute: 13 }, 30)).toEqual({
      hour: 9,
      minute: 0,
    });
    // 간격에 맞는 값은 그대로(같은 객체)
    const same = { hour: 12, minute: 30 };
    expect(roundToStep(same, 5)).toBe(same);
  });

  it("Date 는 다음 날로 넘어가고 초는 버린다", () => {
    const rounded = roundToStep(new Date(2026, 11, 31, 23, 58, 40), 5);
    expect(rounded.getFullYear()).toBe(2027);
    expect(rounded.getMonth()).toBe(0);
    expect(rounded.getDate()).toBe(1);
    expect(rounded.getHours()).toBe(0);
    // 13분 40초는 13분으로 셈해 15 간격에서 15분
    expect(roundToStep(new Date(2026, 9, 15, 9, 13, 40), 15).getMinutes()).toBe(
      15,
    );
  });

  it("칸 표기는 오전 · 오후 12시간, 0 을 채우지 않는 시 + 두 자리 분 — 자정은 오전 12, 정오는 오후 12", () => {
    expect(formatTimeValue({ hour: 0, minute: 0 })).toBe("오전 12:00");
    expect(formatTimeValue({ hour: 12, minute: 0 })).toBe("오후 12:00");
    expect(formatTimeValue({ hour: 11, minute: 59 })).toBe("오전 11:59");
    expect(formatTimeValue({ hour: 15, minute: 5 })).toBe("오후 3:05");
    expect(formatTimeValue({ hour: 23, minute: 30 })).toBe("오후 11:30");
    expect(formatTimeValue(new Date(2026, 9, 15, 0, 5))).toBe("오전 12:05");
    expect(formatTimeValue(undefined)).toBe("");
    expect(formatTimeValue(null)).toBe("");
  });
});

describe("TimePicker — 구조 · 접근성", () => {
  it("칼럼은 오전·오후 → 시 → 분, 이름 있는 group 안의 spinbutton 이고 읽는 값은 단위 글자 없이 '오후' · '3' · '00'", () => {
    render(
      <TimePicker
        aria-label="시작 시각"
        minuteStep={5}
        value={{ hour: 15, minute: 0 }}
      />,
    );
    const wheel = container.querySelector("[data-slot=wheel-picker]")!;
    expect(wheel.getAttribute("role")).toBe("group");
    expect(wheel.getAttribute("aria-label")).toBe("시작 시각");
    const cols = [...container.querySelectorAll("[role=spinbutton]")];
    expect(cols.map((c) => c.getAttribute("aria-label"))).toEqual([
      "오전/오후",
      "시",
      "분",
    ]);
    expect(text("period")).toBe("오후");
    expect(text("hour")).toBe("3");
    expect(text("minute")).toBe("00");
    // 번호 — 오전·오후 0/1, 시 0 ~ 11(1 ~ 12), 분 0 ~ 11(5 간격)
    expect(col("period").getAttribute("aria-valuemax")).toBe("1");
    expect(col("period").getAttribute("aria-valuenow")).toBe("1");
    expect(col("hour").getAttribute("aria-valuemax")).toBe("11");
    expect(col("hour").getAttribute("aria-valuenow")).toBe("2");
    expect(col("minute").getAttribute("aria-valuemax")).toBe("11");
    // 칼럼마다 Tab 자리 하나
    for (const c of cols) expect((c as HTMLElement).tabIndex).toBe(0);
  });

  it("이름은 칸 라벨을 가리킬 수 있다(aria-labelledby) · 아무것도 없으면 '시간 선택'", () => {
    render(
      <>
        <span id="lbl">종료 시각</span>
        <TimePicker aria-labelledby="lbl" />
      </>,
    );
    const wheel = container.querySelector("[data-slot=wheel-picker]")!;
    expect(wheel.getAttribute("aria-labelledby")).toBe("lbl");
    render(<TimePicker />);
    expect(
      container
        .querySelector("[data-slot=wheel-picker]")!
        .getAttribute("aria-label"),
    ).toBe("시간 선택");
  });

  it("글 한 벌을 바꿀 수 있다 — labels", () => {
    render(
      <TimePicker
        aria-label="Start"
        value={{ hour: 15, minute: 0 }}
        labels={{ am: "AM", pm: "PM", hour: "Hour", minute: "Minute" }}
      />,
    );
    expect(text("period")).toBe("PM");
    expect(col("hour").getAttribute("aria-label")).toBe("Hour");
    expect(col("minute").getAttribute("aria-label")).toBe("Minute");
  });

  it("시 칼럼은 1 ~ 12(0 을 채우지 않는다)·반복, 오전·오후는 두 칸·반복 없음, 분은 간격대로 두 자리", () => {
    render(
      <TimePicker
        aria-label="t"
        minuteStep={5}
        value={{ hour: 9, minute: 15 }}
      />,
    );
    const labelsOf = (name: "period" | "hour" | "minute") => {
      const seen: string[] = [];
      for (const item of col(name).querySelectorAll(
        "[data-slot=wheel-picker-item]",
      )) {
        const v = item.getAttribute("data-value")!;
        if (!seen.includes(v)) seen.push(v);
      }
      return seen;
    };
    expect(labelsOf("hour")).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    );
    expect(labelsOf("period")).toEqual(["am", "pm"]);
    expect(
      col("period").querySelectorAll("[data-slot=wheel-picker-item]"),
    ).toHaveLength(2);
    expect(labelsOf("minute")).toHaveLength(12);
    expect(text("minute")).toBe("15");
  });

  it("분 간격마다 칼럼의 칸 수 — 1 → 60 · 5 → 12 · 10 → 6 · 15 → 4 · 30 → 2, 알 수 없는 값은 기본 1(60)", () => {
    const counts: [number, number][] = [
      [1, 60],
      [5, 12],
      [10, 6],
      [15, 4],
      [30, 2],
    ];
    for (const [step, count] of counts) {
      render(
        <TimePicker
          aria-label="t"
          minuteStep={step as 1}
          value={{ hour: 9, minute: 0 }}
        />,
      );
      expect(Number(col("minute").getAttribute("aria-valuemax")) + 1).toBe(
        count,
      );
    }
    render(
      <TimePicker
        aria-label="t"
        minuteStep={7 as 5}
        value={{ hour: 9, minute: 0 }}
      />,
    );
    expect(Number(col("minute").getAttribute("aria-valuemax")) + 1).toBe(60);
  });

  it("간격을 안 주면 1분이다 — 9시 13분이 그대로 보인다(카드 결제 시각 같은 정확한 값)", () => {
    render(<TimePicker aria-label="t" value={{ hour: 9, minute: 13 }} />);
    expect(Number(col("minute").getAttribute("aria-valuemax")) + 1).toBe(60);
    expect(text("minute")).toBe("13");
  });

  it("막힌 휠 — 값은 그대로, 칼럼에 초점이 가지 않는다", () => {
    const onValueChange = vi.fn();
    render(
      <TimePicker
        aria-label="t"
        disabled
        value={{ hour: 15, minute: 30 }}
        onValueChange={onValueChange}
      />,
    );
    expect(col("hour").tabIndex).toBe(-1);
    expect(col("hour").getAttribute("aria-disabled")).toBe("true");
    key(col("hour"), "ArrowDown");
    settle();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(text("hour")).toBe("3");
  });

  it("autoFocus 면 처음 그릴 때 시 칼럼에 초점을 둔다", async () => {
    vi.useRealTimers();
    render(<TimePicker aria-label="t" autoFocus />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(col("hour"));
  });
});

describe("TimePicker — 값 규칙", () => {
  it("값이 없으면 지금을 분 간격에 맞춰 반올림한 자리를 짚기만 한다 — onValueChange 를 부르지 않는다", () => {
    const onValueChange = vi.fn();
    render(
      <TimePicker aria-label="t" now={NOW} onValueChange={onValueChange} />,
    );
    // 9시 13분 → 기본 1분 간격이라 반올림 없이 그대로
    expect(text("period")).toBe("오전");
    expect(text("hour")).toBe("9");
    expect(text("minute")).toBe("13");
    expect(onValueChange).not.toHaveBeenCalled();
    render(
      <TimePicker
        aria-label="t"
        now={NOW}
        minuteStep={30}
        onValueChange={onValueChange}
      />,
    );
    expect(text("minute")).toBe("00");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("간격에 안 맞는 값은 가장 가까운 칸으로 반올림해 보이되 그것만으로 알리지 않는다 — 23:58 은 오전 12:00", () => {
    const onValueChange = vi.fn();
    render(
      <TimePicker
        aria-label="t"
        minuteStep={5}
        value={{ hour: 23, minute: 58 }}
        onValueChange={onValueChange}
      />,
    );
    expect(text("period")).toBe("오전");
    expect(text("hour")).toBe("12");
    expect(text("minute")).toBe("00");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("분 휠이 55 → 00 을 넘어도 시는 그대로다(10시 55분 → 10시 00분)", () => {
    const onChange = vi.fn();
    render(
      <Controlled
        minuteStep={5}
        initial={{ hour: 10, minute: 55 }}
        onChange={onChange}
      />,
    );
    key(col("minute"), "ArrowDown");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 10, minute: 0 });
    expect(text("hour")).toBe("10");
    expect(text("minute")).toBe("00");
  });

  it("분 휠이 00 → 55 로 거꾸로 넘어도 시는 그대로다", () => {
    const onChange = vi.fn();
    render(
      <Controlled
        minuteStep={5}
        initial={{ hour: 10, minute: 0 }}
        onChange={onChange}
      />,
    );
    key(col("minute"), "ArrowUp");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 10, minute: 55 });
  });

  it("시 휠이 11 → 12 를 넘으면 오전 · 오후가 따라 바뀐다(오전 11 → 오후 12)", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 11, minute: 30 }} onChange={onChange} />,
    );
    key(col("hour"), "ArrowDown");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 12, minute: 30 });
    expect(text("period")).toBe("오후");
    expect(text("hour")).toBe("12");
  });

  it("오후 11 → 오전 12(자정)로, 거꾸로 오전 12 → 오후 11 로 — 하루를 넘어 돈다", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 23, minute: 0 }} onChange={onChange} />,
    );
    key(col("hour"), "ArrowDown");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 0, minute: 0 });
    expect(text("period")).toBe("오전");
    expect(text("hour")).toBe("12");
    key(col("hour"), "ArrowUp");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 23, minute: 0 });
    expect(text("period")).toBe("오후");
  });

  it("오후 12 에서 거꾸로 11 로 가면 오전 11 — 정오 경계", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 12, minute: 0 }} onChange={onChange} />,
    );
    key(col("hour"), "ArrowUp");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 11, minute: 0 });
    expect(text("period")).toBe("오전");
    expect(text("hour")).toBe("11");
  });

  it("시를 11 → 10 처럼 오전 · 오후가 안 걸리는 칸으로 옮기면 그대로 오전", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 11, minute: 0 }} onChange={onChange} />,
    );
    key(col("hour"), "ArrowUp");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 10, minute: 0 });
    expect(text("period")).toBe("오전");
  });

  it("오전 · 오후를 바꾸면 시 · 분은 그대로 12시간을 더하거나 뺀다", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 9, minute: 45 }} onChange={onChange} />,
    );
    key(col("period"), "ArrowDown");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 21, minute: 45 });
    expect(text("hour")).toBe("9");
    expect(text("minute")).toBe("45");
    key(col("period"), "ArrowUp");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 9, minute: 45 });
  });

  it("자정(오전 12) 에서 오후로 바꾸면 정오(오후 12) — 12시간을 더한다", () => {
    const onChange = vi.fn();
    render(<Controlled initial={{ hour: 0, minute: 0 }} onChange={onChange} />);
    key(col("period"), "End");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 12, minute: 0 });
    expect(text("hour")).toBe("12");
    expect(text("period")).toBe("오후");
  });

  it("오전·오후는 두 칸에서 멈춘다 — 오전에서 ↑ 는 그대로", () => {
    const onChange = vi.fn();
    render(<Controlled initial={{ hour: 9, minute: 0 }} onChange={onChange} />);
    key(col("period"), "ArrowUp");
    settle();
    expect(onChange).not.toHaveBeenCalled();
    expect(text("period")).toBe("오전");
  });

  it("굴리는 동안은 알리지 않고 멈춘 뒤 한 번만 — 값을 안 줘도(제어하지 않아도) 휠이 따라간다", () => {
    const onValueChange = vi.fn();
    render(
      <TimePicker
        aria-label="t"
        minuteStep={5}
        now={NOW}
        onValueChange={onValueChange}
      />,
    );
    key(col("minute"), "ArrowDown");
    expect(onValueChange).not.toHaveBeenCalled();
    settle();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith({ hour: 9, minute: 20 });
    expect(text("minute")).toBe("20");
  });

  it("Home · End — 시는 1 · 12(첫 · 끝 항목)", () => {
    render(<Controlled initial={{ hour: 9, minute: 0 }} />);
    key(col("hour"), "Home");
    settle();
    expect(text("hour")).toBe("1");
    key(col("hour"), "End");
    settle();
    expect(text("hour")).toBe("12");
  });

  it("Home · End — 오전 · 오후를 그대로 두고 1 · 12 로 간다(지나간 칸을 세지 않는다 — 03-C 3A)", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 15, minute: 30 }} onChange={onChange} />,
    );
    // 오후 3 → End → 오후 12(12:30) · Home → 오후 1(13:30)
    key(col("hour"), "End");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 12, minute: 30 });
    expect(text("hour")).toBe("12");
    expect(text("period")).toBe("오후");
    key(col("hour"), "Home");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 13, minute: 30 });
    expect(text("hour")).toBe("1");
    expect(text("period")).toBe("오후");
  });

  it("오전 9 에서 End → 오전 12(0:30) · Home → 오전 1(1:30)", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 9, minute: 30 }} onChange={onChange} />,
    );
    key(col("hour"), "End");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 0, minute: 30 });
    expect(text("hour")).toBe("12");
    expect(text("period")).toBe("오전");
    key(col("hour"), "Home");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 1, minute: 30 });
    expect(text("period")).toBe("오전");
  });

  it("화살표로 넘기면 jump 가 아니다 — 11 → 12 에서 오전 · 오후가 넘어간다", () => {
    const onChange = vi.fn();
    render(
      <Controlled initial={{ hour: 11, minute: 0 }} onChange={onChange} />,
    );
    key(col("hour"), "ArrowDown");
    settle();
    expect(onChange).toHaveBeenLastCalledWith({ hour: 12, minute: 0 });
    expect(text("period")).toBe("오후");
  });
});
