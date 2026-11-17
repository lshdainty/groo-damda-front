// Date Picker 의 동작 — 모양 · 색은 scripts/check-ds-spec.mjs 가 크로미움에서 스펙 값과 맞춘다.
// 날짜 계산은 로컬 시간대 기준이다 — TZ=Asia/Seoul · TZ=UTC 두 번 돌려 월 · 일 경계가 어디서나 같음을 본다.
import { Fragment, act, useState, type ReactNode } from "react";
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

import { DatePicker } from "./date-picker";
import { DATE_PICKER_CONTINUOUS_SHEET_BODY } from "./date-picker-variants";
import {
  addDays,
  addMonths,
  dayKey,
  formatDateValue,
  formatRangeValue,
  getPresetRange,
  parseDayKey,
  weeksInMonth,
  weekStart,
  type DatePresetName,
  type DateRange,
} from "./date-picker-dates";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// jsdom 에는 스크롤 · ResizeObserver 가 없다 — Wheel Picker 테스트와 같은 방법(scrollTo 가 바로 옮기고 scroll 을 알린다)
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
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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

// 부를 때마다 새로 세운다 — 앞 판의 상태(보이는 달 · 초점)가 다음 판으로 넘어가지 않게
let renders = 0;
const render = (node: ReactNode) =>
  act(() => root.render(<Fragment key={renders++}>{node}</Fragment>));
const last = <T,>(list: readonly T[]) => list[list.length - 1] as T;
const settle = () =>
  act(() => {
    vi.advanceTimersByTime(400);
  });
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const TODAY = d(2026, 10, 15);
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
const click = (el: Element | null) => act(() => (el as HTMLElement).click());
const day = (y: number, m: number, dd: number) =>
  container.querySelector<HTMLButtonElement>(
    `button[data-date="${dayKey(d(y, m, dd))}"]`,
  )!;
const title = () =>
  container.querySelector<HTMLButtonElement>("[data-slot=date-picker-title]")!;
const live = () =>
  container.querySelector("[data-slot=date-picker-live]")!.textContent;
const grids = () => [...container.querySelectorAll<HTMLElement>("[role=grid]")];
const dayButtons = (grid: Element) => [...grid.querySelectorAll("button")];
const tabStops = () =>
  [
    ...container.querySelectorAll<HTMLButtonElement>("button[data-date]"),
  ].filter((b) => b.tabIndex === 0);
const nameOf = (dd: Date) =>
  `${dd.getFullYear()}년 ${dd.getMonth() + 1}월 ${dd.getDate()}일 ${"일월화수목금토"[dd.getDay()]}요일`;

// ── 날짜 계산 ────────────────────────────────────────────────
describe("날짜 도구 — 월 · 일 경계(로컬 시간대)", () => {
  it("한 달 더하기는 같은 날, 없으면 말일 — 1/31 + 1달 = 2/28(윤년 2/29), 3/31 − 1달 = 2/28", () => {
    expect(dayKey(addMonths(d(2027, 1, 31), 1))).toBe("2027-02-28");
    expect(dayKey(addMonths(d(2028, 1, 31), 1))).toBe("2028-02-29");
    expect(dayKey(addMonths(d(2027, 3, 31), -1))).toBe("2027-02-28");
    expect(dayKey(addMonths(d(2026, 10, 31), 1))).toBe("2026-11-30");
    expect(dayKey(addMonths(d(2026, 12, 31), 2))).toBe("2027-02-28");
    // 한 해 — 윤일에서 평년으로
    expect(dayKey(addMonths(d(2028, 2, 29), 12))).toBe("2029-02-28");
    expect(dayKey(addMonths(d(2028, 2, 29), -12))).toBe("2027-02-28");
    expect(dayKey(addMonths(d(2028, 2, 29), 48))).toBe("2032-02-29");
  });

  it("하루 더하기는 월말 · 연말 · 윤일을 넘고 항상 그 날 0시다", () => {
    expect(dayKey(addDays(d(2026, 10, 31), 1))).toBe("2026-11-01");
    expect(dayKey(addDays(d(2026, 12, 31), 1))).toBe("2027-01-01");
    expect(dayKey(addDays(d(2028, 2, 28), 1))).toBe("2028-02-29");
    expect(dayKey(addDays(d(2027, 2, 28), 1))).toBe("2027-03-01");
    expect(dayKey(addDays(d(2026, 1, 1), -1))).toBe("2025-12-31");
    // 서머타임이 있는 시간대에서도 하루는 하루다(자정에 닿는다)
    const r = addDays(d(2026, 3, 8), 1);
    expect([r.getHours(), r.getMinutes()]).toEqual([0, 0]);
  });

  it("그 달의 주 수 — 2026년 2월은 4주, 8월은 6주(토요일에 시작하는 31일)", () => {
    expect(weeksInMonth(2026, 1)).toBe(4);
    expect(weeksInMonth(2026, 7)).toBe(6);
    expect(weeksInMonth(2026, 9)).toBe(5);
    expect(weeksInMonth(2028, 1)).toBe(5);
  });

  it("주는 일요일부터", () => {
    expect(dayKey(weekStart(d(2026, 10, 15)))).toBe("2026-10-11");
    expect(dayKey(weekStart(d(2026, 10, 11)))).toBe("2026-10-11");
    expect(dayKey(weekStart(d(2026, 10, 17)))).toBe("2026-10-11");
  });

  it("키 글은 로컬 연 · 월 · 일이다 — 문자열을 UTC 로 읽지 않는다(parseDayKey)", () => {
    const first = new Date(2026, 0, 1, 0, 0, 0);
    expect(dayKey(first)).toBe("2026-01-01");
    const parsed = parseDayKey("2026-01-01")!;
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]).toEqual(
      [2026, 0, 1],
    );
    expect([parsed.getHours(), parsed.getMinutes()]).toEqual([0, 0]);
    // 달력에 없는 날 · 모양이 틀린 글
    expect(parseDayKey("2026-02-30")).toBeUndefined();
    expect(parseDayKey("2027-02-29")).toBeUndefined();
    expect(parseDayKey("2028-02-29")).toBeDefined();
    expect(parseDayKey("2026-1-1")).toBeUndefined();
  });
});

describe("getPresetRange — 달력 단위(date-picker.md '빠른 기간')", () => {
  const range = (name: DatePresetName, today: Date) => {
    const r = getPresetRange(name, today);
    return [dayKey(r.start), dayKey(r.end)];
  };

  it("스펙 표(오늘이 2026년 10월 2일) 그대로", () => {
    const t = d(2026, 10, 2);
    expect(range("thisWeek", t)).toEqual(["2026-09-27", "2026-10-03"]);
    expect(range("thisMonth", t)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(range("lastMonth", t)).toEqual(["2026-09-01", "2026-09-30"]);
    expect(range("last7Days", t)).toEqual(["2026-09-26", "2026-10-02"]);
    expect(range("last30Days", t)).toEqual(["2026-09-03", "2026-10-02"]);
    expect(range("last3Months", t)).toEqual(["2026-08-01", "2026-10-31"]);
    expect(range("last6Months", t)).toEqual(["2026-05-01", "2026-10-31"]);
    expect(range("last1Year", t)).toEqual(["2025-11-01", "2026-10-31"]);
    expect(range("thisYear", t)).toEqual(["2026-01-01", "2026-12-31"]);
  });

  it("연초 — 지난 달은 작년 12월, 최근 3개월 · 1년은 작년으로 넘어간다", () => {
    const t = d(2026, 1, 5);
    expect(range("lastMonth", t)).toEqual(["2025-12-01", "2025-12-31"]);
    expect(range("last3Months", t)).toEqual(["2025-11-01", "2026-01-31"]);
    expect(range("last1Year", t)).toEqual(["2025-02-01", "2026-01-31"]);
    expect(range("last30Days", t)).toEqual(["2025-12-07", "2026-01-05"]);
  });

  it("윤년 2월 29일 — 이번 달은 29일까지, 지난 달은 1월 31일까지, 최근 1년은 작년 3월부터", () => {
    const t = d(2028, 2, 29);
    expect(range("thisMonth", t)).toEqual(["2028-02-01", "2028-02-29"]);
    expect(range("lastMonth", t)).toEqual(["2028-01-01", "2028-01-31"]);
    expect(range("last1Year", t)).toEqual(["2027-03-01", "2028-02-29"]);
    expect(range("last7Days", t)).toEqual(["2028-02-23", "2028-02-29"]);
  });

  it("월말 — 3월 31일의 지난 달은 2월 전체(말일이 28일이어도), 12월 31일의 이번 주는 일요일부터", () => {
    expect(range("lastMonth", d(2027, 3, 31))).toEqual([
      "2027-02-01",
      "2027-02-28",
    ]);
    // 2026-12-31 은 목요일 — 이번 주는 12/27(일) ~ 1/2(토), 해를 넘는다
    expect(range("thisWeek", d(2026, 12, 31))).toEqual([
      "2026-12-27",
      "2027-01-02",
    ]);
  });

  it("일요일 · 토요일에 주의 경계가 맞는다", () => {
    expect(range("thisWeek", d(2026, 10, 11))).toEqual([
      "2026-10-11",
      "2026-10-17",
    ]);
    expect(range("thisWeek", d(2026, 10, 17))).toEqual([
      "2026-10-11",
      "2026-10-17",
    ]);
  });

  it("오늘에 시각이 있어도 그 날로 셈한다 — 23:59 · 00:00", () => {
    const late = new Date(2026, 9, 31, 23, 59, 59);
    expect(range("thisMonth", late)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(range("last7Days", late)).toEqual(["2026-10-25", "2026-10-31"]);
  });
});

describe("칸에 넣는 글 — International Design v106", () => {
  it("하루 — 올해는 '10월 15일 (목)', 다른 해는 연도를 붙인다", () => {
    expect(formatDateValue(d(2026, 10, 15), TODAY)).toBe("10월 15일 (목)");
    expect(formatDateValue(d(2027, 1, 3), TODAY)).toBe("2027년 1월 3일 (일)");
    expect(formatDateValue(d(2025, 12, 31), TODAY)).toBe(
      "2025년 12월 31일 (수)",
    );
    expect(formatDateValue(undefined, TODAY)).toBe("");
    expect(formatDateValue(null, TODAY)).toBe("");
  });

  it("기간 — 물결표를 앞뒤에 붙여 쓴다, 올해가 아닌 날이 끼면 양쪽에 연도, 끝이 없으면 빈 글", () => {
    expect(
      formatRangeValue({ start: d(2026, 10, 1), end: d(2026, 10, 31) }, TODAY),
    ).toBe("10월 1일~10월 31일");
    expect(
      formatRangeValue({ start: d(2026, 12, 28), end: d(2027, 1, 3) }, TODAY),
    ).toBe("2026년 12월 28일~2027년 1월 3일");
    expect(
      formatRangeValue({ start: d(2027, 1, 3), end: d(2027, 1, 4) }, TODAY),
    ).toBe("2027년 1월 3일~2027년 1월 4일");
    expect(formatRangeValue({ start: d(2026, 10, 1) }, TODAY)).toBe("");
    expect(formatRangeValue({}, TODAY)).toBe("");
    expect(formatRangeValue(undefined, TODAY)).toBe("");
  });
});

// ── 달력 ─────────────────────────────────────────────────────
describe("DatePicker — 구조 · 접근성", () => {
  it("이름 있는 group, 달마다 grid(제목으로 이름), 요일은 columnheader(이름 '일요일')", () => {
    render(<DatePicker today={TODAY} />);
    const group = container.querySelector("[data-slot=date-picker]")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("날짜 선택");
    const [grid] = grids();
    expect(grid?.getAttribute("aria-labelledby")).toBe(title().id);
    expect(grid?.getAttribute("aria-multiselectable")).toBeNull();
    const heads = [...container.querySelectorAll("[role=columnheader]")];
    expect(heads.map((h) => h.getAttribute("aria-label"))).toEqual([
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
    ]);
    expect(title().textContent).toBe("2026년 10월");
    expect(title().getAttribute("aria-expanded")).toBe("false");
  });

  it("칸 라벨을 가리킬 수 있다(aria-labelledby), 기간 · 여러 날은 aria-multiselectable", () => {
    render(
      <>
        <span id="lbl">일정 날짜</span>
        <DatePicker today={TODAY} aria-labelledby="lbl" selection="range" />
      </>,
    );
    const group = container.querySelector("[data-slot=date-picker]")!;
    expect(group.getAttribute("aria-labelledby")).toBe("lbl");
    expect(group.getAttribute("aria-label")).toBeNull();
    expect(grids()[0]?.getAttribute("aria-multiselectable")).toBe("true");
  });

  it("날짜 버튼 이름은 '2026년 10월 15일 목요일', 오늘은 aria-current=date", () => {
    render(<DatePicker today={TODAY} />);
    expect(day(2026, 10, 15).getAttribute("aria-label")).toBe(
      "2026년 10월 15일 목요일",
    );
    expect(day(2026, 10, 15).getAttribute("aria-current")).toBe("date");
    expect(day(2026, 10, 14).getAttribute("aria-current")).toBeNull();
    expect(nameOf(d(2026, 10, 15))).toBe("2026년 10월 15일 목요일");
  });

  it("한 달은 늘 6주 — 4주짜리 2026년 2월 · 6주짜리 2026년 8월 · 윤달 2028년 2월 모두 행 6, 칸 42", () => {
    for (const [y, m] of [
      [2026, 2],
      [2026, 8],
      [2028, 2],
      [2026, 10],
    ] as const) {
      render(<DatePicker today={d(y, m, 10)} />);
      const grid = grids()[0]!;
      const rows = grid.querySelectorAll(":scope > [role=row]:not(.sr-only)");
      // 요일 줄 1 + 날짜 6줄
      expect(rows).toHaveLength(7);
      expect(grid.querySelectorAll("[role=gridcell]")).toHaveLength(42);
    }
  });

  it("앞뒤 달 날짜는 흐리게 보이기만 한다 — 버튼이 아니고 숫자는 보조 기술에 숨기되 칸은 남겨 요일 짝을 지킨다", () => {
    render(<DatePicker today={d(2026, 10, 15)} />);
    const grid = grids()[0]!;
    // 2026-10-01 은 목요일 — 앞 달 4칸(9/27 ~ 9/30), 뒤 달 7칸(11/1 ~ 11/7)
    const outside = grid.querySelectorAll("[data-outside]");
    expect(outside).toHaveLength(11);
    for (const cell of outside) {
      expect(cell.getAttribute("role")).toBe("gridcell");
      expect(cell.querySelector("button")).toBeNull();
      const num = cell.querySelector("[data-slot=date-picker-outside]")!;
      expect(num.getAttribute("aria-hidden")).toBe("true");
    }
    expect(dayButtons(grid)).toHaveLength(31);
    // 앞 달 마지막 날 숫자 — 9월 30일
    expect(outside[3]?.textContent).toBe("30");
  });

  it("글 한 벌을 바꿀 수 있다 — labels", () => {
    render(
      <DatePicker
        today={TODAY}
        labels={{
          month: (y, m) => `${m}/${y}`,
          previousMonth: "Previous",
          nextMonth: "Next",
          day: (dd) => `D${dd.getDate()}`,
        }}
      />,
    );
    expect(title().textContent).toBe("10/2026");
    expect(day(2026, 10, 3).getAttribute("aria-label")).toBe("D3");
    expect(
      container
        .querySelector("[data-slot=date-picker-next]")!
        .getAttribute("aria-label"),
    ).toBe("Next");
  });

  it("보이는 달이 바뀌면 aria-live(polite)로 '2026년 11월' 을 읽는다", () => {
    render(<DatePicker today={TODAY} />);
    const region = container.querySelector("[data-slot=date-picker-live]")!;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(live()).toBe("2026년 10월");
    click(container.querySelector("[data-slot=date-picker-next]"));
    expect(live()).toBe("2026년 11월");
  });

  it("Tab 자리는 날짜 하나 — 고른 날, 없으면 오늘, 오늘이 안 보이면 1일", () => {
    render(<DatePicker today={TODAY} value={d(2026, 10, 3)} />);
    expect(tabStops().map((b) => b.dataset.date)).toEqual(["2026-10-03"]);
    render(<DatePicker today={TODAY} />);
    expect(tabStops().map((b) => b.dataset.date)).toEqual(["2026-10-15"]);
    render(<DatePicker today={TODAY} value={d(2026, 3, 9)} />);
    expect(tabStops().map((b) => b.dataset.date)).toEqual(["2026-03-09"]);
    // 오늘도 고른 날도 보이는 달에 없으면 그 달 1일
    render(
      <DatePicker
        key="far"
        today={TODAY}
        value={d(2026, 3, 9)}
        isDateDisabled={() => false}
      />,
    );
    click(container.querySelector("[data-slot=date-picker-next]"));
    expect(tabStops().map((b) => b.dataset.date)).toEqual(["2026-04-01"]);
  });

  it("autoFocus 면 처음 그릴 때 고른 날(없으면 오늘)에 초점을 둔다", async () => {
    vi.useRealTimers();
    render(<DatePicker today={TODAY} autoFocus />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(day(2026, 10, 15));
    render(
      <DatePicker key="v" today={TODAY} value={d(2026, 10, 3)} autoFocus />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(day(2026, 10, 3));
  });
});

describe("DatePicker — 달 옮기기", () => {
  it("이전 · 다음은 한 달씩, 해를 넘고 늘 6주라 칸 수가 그대로다", () => {
    render(<DatePicker today={d(2026, 12, 20)} />);
    const next = () =>
      click(container.querySelector("[data-slot=date-picker-next]"));
    const prev = () =>
      click(container.querySelector("[data-slot=date-picker-previous]"));
    next();
    expect(title().textContent).toBe("2027년 1월");
    expect(grids()[0]!.querySelectorAll("[role=gridcell]")).toHaveLength(42);
    prev();
    prev();
    expect(title().textContent).toBe("2026년 11월");
    expect(day(2026, 11, 30)).toBeTruthy();
  });

  it("윤년 2월은 29일까지 버튼이 있다 — 2028년은 29일, 2027년은 28일", () => {
    render(<DatePicker today={d(2028, 2, 10)} />);
    expect(dayButtons(grids()[0]!)).toHaveLength(29);
    expect(day(2028, 2, 29)).toBeTruthy();
    render(<DatePicker key="b" today={d(2027, 2, 10)} />);
    expect(dayButtons(grids()[0]!)).toHaveLength(28);
  });

  it("연도 범위 끝에서 이전 · 다음이 막힌다 — yearRange", () => {
    render(
      <DatePicker
        today={d(2026, 12, 20)}
        yearRange={{ start: 2026, end: 2027 }}
      />,
    );
    const prev = container.querySelector<HTMLButtonElement>(
      "[data-slot=date-picker-previous]",
    )!;
    const next = container.querySelector<HTMLButtonElement>(
      "[data-slot=date-picker-next]",
    )!;
    expect(prev.disabled).toBe(false);
    click(next);
    expect(title().textContent).toBe("2027년 1월");
    for (let i = 0; i < 11; i++) click(next);
    expect(title().textContent).toBe("2027년 12월");
    expect(next.disabled).toBe(true);
    for (let i = 0; i < 23; i++) click(prev);
    expect(title().textContent).toBe("2026년 1월");
    expect(prev.disabled).toBe(true);
  });

  it("제목을 누르면 연 · 월 휠이 날짜 자리에 뜨고(aria-expanded) 이전 · 다음은 막힌다, 다시 누르면 고른 달로 옮긴다", () => {
    render(<DatePicker today={TODAY} />);
    click(title());
    expect(title().getAttribute("aria-expanded")).toBe("true");
    const wheel = container.querySelector("[data-slot=date-picker-wheel]")!;
    expect(wheel).toBeTruthy();
    expect(title().getAttribute("aria-controls")).toBe(wheel.id);
    expect(grids()).toHaveLength(0);
    expect(
      container.querySelector<HTMLButtonElement>(
        "[data-slot=date-picker-next]",
      )!.disabled,
    ).toBe(true);
    // 월 칼럼에서 ↓ 두 번 — 10월 → 12월
    const month = wheel.querySelector<HTMLElement>('[aria-label="월"]')!;
    expect(month.getAttribute("aria-valuetext")).toBe("10월");
    key(month, "ArrowDown");
    key(month, "ArrowDown");
    settle();
    expect(month.getAttribute("aria-valuetext")).toBe("12월");
    click(title());
    expect(title().getAttribute("aria-expanded")).toBe("false");
    expect(title().textContent).toBe("2026년 12월");
    // 고른 달 1일이 Tab 자리
    expect(tabStops().map((b) => b.dataset.date)).toEqual(["2026-12-01"]);
  });

  it("연 휠에서 해를 옮기면 같은 달 · 다른 해로 간다", () => {
    render(<DatePicker today={TODAY} />);
    click(title());
    const year = container.querySelector<HTMLElement>(
      '[data-slot=date-picker-wheel] [aria-label="연도"]',
    )!;
    expect(year.getAttribute("aria-valuetext")).toBe("2026년");
    key(year, "ArrowDown");
    settle();
    click(title());
    expect(title().textContent).toBe("2027년 10월");
  });

  it("defaultWheelOpen 이면 휠이 열린 채 시작한다(견본 전용)", () => {
    render(<DatePicker today={TODAY} defaultWheelOpen />);
    expect(
      container.querySelector("[data-slot=date-picker-wheel]"),
    ).toBeTruthy();
    expect(title().getAttribute("aria-expanded")).toBe("true");
  });
});

// 제어하는 쓰는 쪽 — 받은 값을 그대로 다시 준다(draft)
function Single({
  initial,
  onChange,
  ...rest
}: {
  initial?: Date;
  onChange?: (v: Date) => void;
} & Partial<React.ComponentProps<typeof DatePicker>>) {
  const [value, setValue] = useState<Date | undefined>(initial);
  return (
    <DatePicker
      today={TODAY}
      {...(rest as object)}
      selection="single"
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}
function Range({
  initial,
  onChange,
  ...rest
}: {
  initial?: DateRange;
  onChange?: (v: DateRange) => void;
} & Partial<React.ComponentProps<typeof DatePicker>>) {
  const [value, setValue] = useState<DateRange | undefined>(initial);
  return (
    <DatePicker
      today={TODAY}
      {...(rest as object)}
      selection="range"
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("DatePicker — 하루 고르기", () => {
  it("누르면 고른다 — onValueChange 는 그 날의 0시 Date, 다시 눌러도 풀리지 않고 다시 부르지 않는다", () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    click(day(2026, 10, 20));
    expect(onChange).toHaveBeenCalledTimes(1);
    const got = onChange.mock.calls[0]![0] as Date;
    expect(dayKey(got)).toBe("2026-10-20");
    expect([got.getHours(), got.getMinutes(), got.getSeconds()]).toEqual([
      0, 0, 0,
    ]);
    expect(day(2026, 10, 20).dataset.selected).toBe("true");
    expect(
      day(2026, 10, 20)
        .closest("[role=gridcell]")!
        .getAttribute("aria-selected"),
    ).toBe("true");
    click(day(2026, 10, 20));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(day(2026, 10, 20).dataset.selected).toBe("true");
  });

  it("값에 시각이 들어 있어도 그 날로 본다 — 23:59 · 00:00", () => {
    render(<Single initial={new Date(2026, 9, 20, 23, 59, 59)} />);
    expect(day(2026, 10, 20).dataset.selected).toBe("true");
    render(<Single key="b" initial={new Date(2026, 9, 21, 0, 0, 0)} />);
    expect(day(2026, 10, 21).dataset.selected).toBe("true");
    expect(day(2026, 10, 20).dataset.selected).toBeUndefined();
  });

  it("앞뒤 달 날짜를 눌러도 아무 일이 없다(버튼이 아니라 누를 수 없다)", () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    const outside = container.querySelector(
      "[data-outside] [data-slot=date-picker-outside]",
    )!;
    click(outside);
    expect(onChange).not.toHaveBeenCalled();
    expect(title().textContent).toBe("2026년 10월");
  });

  it("오늘을 고르면 고른 모양 + 굵기는 남는다", () => {
    render(<Single initial={TODAY} />);
    const btn = day(2026, 10, 15);
    expect(btn.dataset.selected).toBe("true");
    expect(btn.dataset.today).toBe("true");
    expect(btn.className).toContain("font-bold");
    expect(btn.className).toContain("text-fg-neutral-inverted");
    expect(
      btn.querySelector("[data-slot=date-picker-day-visual]")!.className,
    ).toContain("bg-bg-neutral-inverted");
  });

  it("고를 수 있는 범위 — min · max 밖은 막힌 날(aria-disabled · 취소선 · 초점은 간다), 눌러도 · Enter 도 무시", () => {
    const onChange = vi.fn();
    render(
      <Single
        onChange={onChange}
        min={d(2026, 10, 10)}
        max={d(2026, 10, 20)}
      />,
    );
    for (const dd of [9, 21, 1, 31]) {
      const btn = day(2026, 10, dd);
      expect(btn.getAttribute("aria-disabled")).toBe("true");
      expect(btn.dataset.disabled).toBe("true");
      expect(
        btn.querySelector("[data-slot=date-picker-day]")!.className,
      ).toContain("line-through");
      click(btn);
      key(btn, "Enter");
      key(btn, " ");
    }
    expect(onChange).not.toHaveBeenCalled();
    // 양 끝 날은 고른다 — min · max 를 포함
    click(day(2026, 10, 10));
    click(day(2026, 10, 20));
    expect(onChange).toHaveBeenCalledTimes(2);
    // 막힌 날도 키보드 초점은 간다(tabIndex 가 -1 이어도 focus 가능)
    day(2026, 10, 9).focus();
    expect(document.activeElement).toBe(day(2026, 10, 9));
    expect(day(2026, 10, 9).getAttribute("aria-disabled")).toBe("true");
  });

  it("min · max 가 시각을 가져도 그 날 단위로 비교한다 — max 가 20일 23:59 면 20일은 고른다", () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} max={new Date(2026, 9, 20, 23, 59)} />);
    click(day(2026, 10, 20));
    click(day(2026, 10, 21));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("isDateDisabled — 그 밖의 막힌 날(주말 등)", () => {
    const onChange = vi.fn();
    render(
      <Single
        onChange={onChange}
        isDateDisabled={(dd) => dd.getDay() === 0 || dd.getDay() === 6}
      />,
    );
    click(day(2026, 10, 17)); // 토
    click(day(2026, 10, 18)); // 일
    expect(onChange).not.toHaveBeenCalled();
    click(day(2026, 10, 19)); // 월
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("오늘인데 막힌 날은 원 없이 굵은 숫자 + 취소선", () => {
    render(<Single max={d(2026, 10, 10)} />);
    const btn = day(2026, 10, 15);
    expect(btn.dataset.disabled).toBe("true");
    expect(btn.className).toContain("font-bold");
    expect(
      btn.querySelector("[data-slot=date-picker-day-visual]")!.className,
    ).not.toContain("bg-bg-neutral-weak");
    expect(
      btn.querySelector("[data-slot=date-picker-day]")!.className,
    ).toContain("line-through");
  });
});

describe("DatePicker — 기간 고르기", () => {
  const picked = (onChange: ReturnType<typeof vi.fn>) =>
    onChange.mock.calls.map((c) => {
      const r = c[0] as DateRange;
      return [r.start && dayKey(r.start), r.end && dayKey(r.end)];
    });

  it("첫 탭이 시작, 시작 뒤의 날이 끝 — { start } 다음 { start, end }", () => {
    const onChange = vi.fn();
    render(<Range onChange={onChange} />);
    click(day(2026, 10, 5));
    click(day(2026, 10, 9));
    expect(picked(onChange)).toEqual([
      ["2026-10-05", undefined],
      ["2026-10-05", "2026-10-09"],
    ]);
  });

  it("시작보다 앞을 누르면 그날이 새 시작이다(둘을 바꾸지 않는다)", () => {
    const onChange = vi.fn();
    render(<Range onChange={onChange} />);
    click(day(2026, 10, 9));
    click(day(2026, 10, 5));
    expect(picked(onChange)).toEqual([
      ["2026-10-09", undefined],
      ["2026-10-05", undefined],
    ]);
  });

  it("같은 날을 두 번 누르면 하루짜리 기간 — 띠가 없다", () => {
    const onChange = vi.fn();
    render(<Range onChange={onChange} />);
    click(day(2026, 10, 9));
    click(day(2026, 10, 9));
    expect(picked(onChange)).toEqual([
      ["2026-10-09", undefined],
      ["2026-10-09", "2026-10-09"],
    ]);
    expect(container.querySelector("[data-slot=date-picker-band]")).toBeNull();
    expect(day(2026, 10, 9).dataset.selected).toBe("true");
  });

  it("기간이 완성된 뒤 다시 누르면 새로 시작한다", () => {
    const onChange = vi.fn();
    render(<Range onChange={onChange} />);
    click(day(2026, 10, 5));
    click(day(2026, 10, 9));
    click(day(2026, 10, 20));
    expect(last(picked(onChange))).toEqual(["2026-10-20", undefined]);
    // 시작만 고른 동안은 띠가 없다 — 끝을 고르기 전에 미리 칠하지 않는다
    expect(container.querySelector("[data-slot=date-picker-band]")).toBeNull();
  });

  it("띠 — 시작은 원 가운데부터 오른쪽, 사이는 칸 폭 전체, 끝은 왼쪽부터 원 가운데까지. 사이 칸은 aria-selected", () => {
    render(<Range initial={{ start: d(2026, 10, 5), end: d(2026, 10, 9) }} />);
    const band = (dd: number) =>
      day(2026, 10, dd).closest("[role=gridcell]")!.getAttribute("data-band");
    expect(band(5)).toBe("start");
    expect(band(6)).toBe("middle");
    expect(band(8)).toBe("middle");
    expect(band(9)).toBe("end");
    expect(band(4)).toBeNull();
    expect(band(10)).toBeNull();
    expect(day(2026, 10, 7).dataset.inRange).toBe("true");
    expect(
      day(2026, 10, 7)
        .closest("[role=gridcell]")!
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      container.querySelectorAll("[data-slot=date-picker-band]"),
    ).toHaveLength(5);
    // 시작 · 끝 칸의 띠는 한쪽 절반만
    const startBand = day(2026, 10, 5)
      .closest("[role=gridcell]")!
      .querySelector("[data-slot=date-picker-band]")!;
    expect(startBand.className).toContain("left-1/2");
    const endBand = day(2026, 10, 9)
      .closest("[role=gridcell]")!
      .querySelector("[data-slot=date-picker-band]")!;
    expect(endBand.className).toContain("right-1/2");
  });

  it("기간이 달을 넘는다 — 10월 28일 ~ 11월 3일: 10월 달력에서는 31일까지 띠, 뒤 달 흐린 날에는 띠가 없다 · 11월로 넘기면 1일부터", () => {
    render(<Range initial={{ start: d(2026, 10, 28), end: d(2026, 11, 3) }} />);
    expect(
      day(2026, 10, 28).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("start");
    expect(
      day(2026, 10, 31).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("middle");
    // 앞뒤 달 칸에는 띠 · 고름을 그리지 않는다
    for (const cell of container.querySelectorAll("[data-outside]")) {
      expect(cell.querySelector("[data-slot=date-picker-band]")).toBeNull();
      expect(cell.getAttribute("data-band")).toBeNull();
    }
    click(container.querySelector("[data-slot=date-picker-next]"));
    expect(
      day(2026, 11, 1).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("middle");
    expect(
      day(2026, 11, 3).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("end");
    expect(
      day(2026, 11, 4).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBeNull();
  });

  it("해를 넘는 기간 · 윤일을 지나는 기간 — 12월 28일 ~ 1월 3일, 2월 28일 ~ 3월 1일(2028)", () => {
    render(
      <Range
        initial={{ start: d(2026, 12, 28), end: d(2027, 1, 3) }}
        today={d(2026, 12, 10)}
      />,
    );
    expect(
      day(2026, 12, 31).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("middle");
    render(
      <Range
        key="leap"
        initial={{ start: d(2028, 2, 28), end: d(2028, 3, 1) }}
        today={d(2028, 2, 10)}
      />,
    );
    expect(
      day(2028, 2, 29).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("middle");
  });

  it("기간이 열리는 달 — 값이 있으면 시작이 든 달, 없으면 오늘이 든 달", () => {
    render(<Range initial={{ start: d(2026, 3, 9), end: d(2026, 3, 12) }} />);
    expect(title().textContent).toBe("2026년 3월");
    render(<Range key="empty" />);
    expect(title().textContent).toBe("2026년 10월");
  });

  it("읽기 전용 시작일 — 시작은 그대로, 뒤의 날만 끝이 되고 앞은 막힌 날, 이름 끝에 '읽기 전용 시작일'", () => {
    const onChange = vi.fn();
    render(
      <Range
        onChange={onChange}
        readOnlyStart
        initial={{ start: d(2026, 10, 10) }}
      />,
    );
    const start = day(2026, 10, 10);
    expect(start.dataset.readonly).toBe("true");
    expect(start.getAttribute("aria-disabled")).toBe("true");
    expect(start.getAttribute("aria-label")).toBe(
      "2026년 10월 10일 토요일, 읽기 전용 시작일",
    );
    click(start);
    click(day(2026, 10, 5));
    expect(onChange).not.toHaveBeenCalled();
    expect(day(2026, 10, 5).dataset.disabled).toBe("true");
    click(day(2026, 10, 14));
    expect(picked(onChange)).toEqual([["2026-10-10", "2026-10-14"]]);
    // 끝을 고른 뒤 같은 날 · 시작 앞은 계속 무시
    click(day(2026, 10, 3));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("미완성 기간의 시작이 막힌 날이어도 시작 원 위에는 취소선을 긋지 않는다", () => {
    render(<Range initial={{ start: d(2026, 10, 5) }} max={d(2026, 10, 3)} />);
    const label = day(2026, 10, 5).querySelector(
      "[data-slot=date-picker-day]",
    )!;
    expect(label.className).not.toContain("line-through");
    // 완성된 기간이면 막힌 날의 취소선은 그대로
    render(
      <Range
        key="c"
        initial={{ start: d(2026, 10, 5), end: d(2026, 10, 8) }}
        max={d(2026, 10, 3)}
      />,
    );
    expect(
      day(2026, 10, 6).querySelector("[data-slot=date-picker-day]")!.className,
    ).toContain("line-through");
    // 막힌 날이 기간 안에 있어도 띠는 그대로
    expect(
      day(2026, 10, 6).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("middle");
  });
});

describe("DatePicker — 여러 날", () => {
  function Multi({
    initial = [],
    onChange,
    max,
  }: {
    initial?: Date[];
    onChange?: (v: Date[]) => void;
    max?: number;
  }) {
    const [value, setValue] = useState<Date[]>(initial);
    return (
      <DatePicker
        today={TODAY}
        selection="multiple"
        maxSelectionCount={max}
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    );
  }
  const keys = (onChange: ReturnType<typeof vi.fn>) =>
    (last(onChange.mock.calls)[0] as Date[]).map(dayKey);

  it("누를 때마다 고르고 풀린다 — 늘 날짜 순 · 겹침 없음 · 띠로 잇지 않는다", () => {
    const onChange = vi.fn();
    render(<Multi onChange={onChange} />);
    click(day(2026, 10, 20));
    click(day(2026, 10, 5));
    click(day(2026, 10, 12));
    expect(keys(onChange)).toEqual(["2026-10-05", "2026-10-12", "2026-10-20"]);
    click(day(2026, 10, 12));
    expect(keys(onChange)).toEqual(["2026-10-05", "2026-10-20"]);
    expect(container.querySelector("[data-slot=date-picker-band]")).toBeNull();
    expect(day(2026, 10, 12).dataset.selected).toBeUndefined();
    expect(grids()[0]!.getAttribute("aria-multiselectable")).toBe("true");
  });

  it("값에 겹친 날 · 시각이 있어도 한 날로 센다", () => {
    render(
      <Multi
        initial={[
          new Date(2026, 9, 5, 9),
          new Date(2026, 9, 5, 23),
          d(2026, 10, 6),
        ]}
      />,
    );
    expect(container.querySelectorAll("button[data-selected]")).toHaveLength(2);
  });

  it("최대 개수에 닿으면 고르지 않은 날이 막힌 날이 된다 — 고른 날은 풀 수 있다", () => {
    const onChange = vi.fn();
    render(<Multi max={2} onChange={onChange} initial={[d(2026, 10, 5)]} />);
    click(day(2026, 10, 6));
    expect(keys(onChange)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(day(2026, 10, 7).dataset.disabled).toBe("true");
    click(day(2026, 10, 7));
    expect(onChange).toHaveBeenCalledTimes(1);
    click(day(2026, 10, 5));
    expect(keys(onChange)).toEqual(["2026-10-06"]);
    expect(day(2026, 10, 7).dataset.disabled).toBeUndefined();
  });
});

describe("DatePicker — 빠른 기간", () => {
  const PRESETS = [
    "thisWeek",
    "thisMonth",
    "lastMonth",
    "last3Months",
    "thisYear",
  ] as const;
  const chip = (text: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("[role=radio]")].find(
      (b) => b.textContent === text,
    )!;

  it("칩 줄은 이름 있는 radiogroup, 누르면 그 기간을 칠하고 시작이 든 달로 옮긴다", () => {
    const onChange = vi.fn();
    render(<Range presets={PRESETS} onChange={onChange} />);
    const group = container.querySelector("[data-slot=date-picker-presets]")!;
    expect(group.getAttribute("role")).toBe("radiogroup");
    expect(group.getAttribute("aria-label")).toBe("빠른 기간");
    expect(
      [...group.querySelectorAll("[role=radio]")].map((b) => b.textContent),
    ).toEqual(["이번 주", "이번 달", "지난 달", "최근 3개월", "올해"]);
    click(chip("지난 달"));
    const r = last(onChange.mock.calls)[0] as { start: Date; end: Date };
    expect([dayKey(r.start), dayKey(r.end)]).toEqual([
      "2026-09-01",
      "2026-09-30",
    ]);
    // 시작이 든 달(9월)로 옮겼고 Tab 자리는 시작
    expect(title().textContent).toBe("2026년 9월");
    expect(tabStops().map((b) => b.dataset.date)).toEqual(["2026-09-01"]);
    expect(chip("지난 달").getAttribute("aria-checked")).toBe("true");
  });

  it("최근 3개월은 석 달 전체 — 8월 1일부터 10월 31일까지, 앞으로의 날도 든다", () => {
    const onChange = vi.fn();
    render(<Range presets={PRESETS} onChange={onChange} />);
    click(chip("최근 3개월"));
    const r = last(onChange.mock.calls)[0] as { start: Date; end: Date };
    expect([dayKey(r.start), dayKey(r.end)]).toEqual([
      "2026-08-01",
      "2026-10-31",
    ]);
  });

  it("달력에서 다른 날을 누르면 칩 고름이 풀린다", () => {
    render(<Range presets={PRESETS} />);
    click(chip("이번 달"));
    expect(chip("이번 달").getAttribute("aria-checked")).toBe("true");
    click(day(2026, 10, 7));
    expect(chip("이번 달").getAttribute("aria-checked")).toBe("false");
  });

  it("처음 그릴 때 값이 어느 칩의 범위와 같으면 그 칩이 골라져 있다 — 값이 바뀌면 풀린다", () => {
    render(
      <Range
        presets={PRESETS}
        initial={{ start: d(2026, 10, 1), end: d(2026, 10, 31) }}
      />,
    );
    expect(chip("이번 달").getAttribute("aria-checked")).toBe("true");
    click(day(2026, 10, 3));
    expect(chip("이번 달").getAttribute("aria-checked")).toBe("false");
  });

  it("고를 수 있는 범위 밖에 걸친 기간의 칩은 막는다 — 잘라서 넣지 않는다", () => {
    const onChange = vi.fn();
    render(
      <Range
        presets={PRESETS}
        onChange={onChange}
        min={d(2026, 10, 1)}
        max={d(2026, 10, 20)}
      />,
    );
    // 이번 달(1 ~ 31)은 max 20 을 넘는다 · 이번 주(11 ~ 17)는 안
    expect(chip("이번 달").disabled).toBe(true);
    expect(chip("지난 달").disabled).toBe(true);
    expect(chip("최근 3개월").disabled).toBe(true);
    expect(chip("올해").disabled).toBe(true);
    expect(chip("이번 주").disabled).toBe(false);
    click(chip("이번 달"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("사이에 막힌 날이 있는 기간의 칩은 괜찮다 — 시작 · 끝이 고를 수 있으면 된다", () => {
    render(
      <Range presets={PRESETS} isDateDisabled={(dd) => dd.getDay() === 0} />,
    );
    // 이번 주는 일요일 시작이라 시작이 막힌 날 → 막힌다. 이번 달(10/1 목 ~ 10/31 토)은 시작 · 끝이 평일 · 토 → 괜찮다
    expect(chip("이번 주").disabled).toBe(true);
    expect(chip("이번 달").disabled).toBe(false);
  });

  it("scroll 은 한 줄 가로 스크롤 · wrap 은 줄바꿈 — 시트(continuous)는 scroll, 그 밖은 wrap", () => {
    render(<Range presets={PRESETS} visibleRange="continuous" />);
    expect(
      container
        .querySelector("[data-slot=date-picker-presets]")!
        .getAttribute("data-layout"),
    ).toBe("scroll");
    expect(container.querySelector("[data-slot=chip-scroll-row]")).toBeTruthy();
    render(<Range key="w" presets={PRESETS} />);
    expect(
      container
        .querySelector("[data-slot=date-picker-presets]")!
        .getAttribute("data-layout"),
    ).toBe("wrap");
    render(<Range key="s" presets={PRESETS} presetsLayout="scroll" />);
    expect(
      container
        .querySelector("[data-slot=date-picker-presets]")!
        .getAttribute("data-layout"),
    ).toBe("scroll");
  });

  it("하루 · 여러 날 달력에는 칩 줄이 없다", () => {
    render(<DatePicker today={TODAY} />);
    expect(
      container.querySelector("[data-slot=date-picker-presets]"),
    ).toBeNull();
  });
});

describe("DatePicker — 키보드(WAI-ARIA Grid)", () => {
  it("← → 하루 · ↑ ↓ 한 주 — 초점이 옮겨 가고 Tab 자리도 따라간다", () => {
    render(<Single />);
    const start = day(2026, 10, 15);
    start.focus();
    key(start, "ArrowRight");
    expect(document.activeElement).toBe(day(2026, 10, 16));
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement).toBe(day(2026, 10, 23));
    key(document.activeElement!, "ArrowUp");
    key(document.activeElement!, "ArrowLeft");
    expect(document.activeElement).toBe(day(2026, 10, 15));
    expect(tabStops().map((b) => b.dataset.date)).toEqual(["2026-10-15"]);
  });

  it("보이는 달 밖으로 옮기면 달이 따라 넘어가고 '2026년 11월' 을 읽는다 — 10월 31일에서 →", () => {
    render(<Single today={d(2026, 10, 31)} />);
    const start = day(2026, 10, 31);
    start.focus();
    key(start, "ArrowRight");
    expect(title().textContent).toBe("2026년 11월");
    expect(live()).toBe("2026년 11월");
    expect(document.activeElement).toBe(day(2026, 11, 1));
  });

  it("1월 1일에서 ← 는 작년 12월 31일, 2월 28일(평년)에서 → 는 3월 1일", () => {
    render(<Single today={d(2026, 1, 1)} />);
    day(2026, 1, 1).focus();
    key(day(2026, 1, 1), "ArrowLeft");
    expect(title().textContent).toBe("2025년 12월");
    expect(document.activeElement).toBe(day(2025, 12, 31));
    render(<Single key="b" today={d(2027, 2, 28)} />);
    day(2027, 2, 28).focus();
    key(day(2027, 2, 28), "ArrowRight");
    expect(document.activeElement).toBe(day(2027, 3, 1));
  });

  it("↑ 로 위 달에 닿는다 — 10월 3일에서 ↑ 는 9월 26일", () => {
    render(<Single today={d(2026, 10, 3)} />);
    day(2026, 10, 3).focus();
    key(day(2026, 10, 3), "ArrowUp");
    expect(title().textContent).toBe("2026년 9월");
    expect(document.activeElement).toBe(day(2026, 9, 26));
  });

  it("Home · End 는 그 주의 일요일 · 토요일", () => {
    render(<Single />);
    day(2026, 10, 15).focus();
    key(day(2026, 10, 15), "End");
    expect(document.activeElement).toBe(day(2026, 10, 17));
    key(document.activeElement!, "Home");
    expect(document.activeElement).toBe(day(2026, 10, 11));
  });

  it("PageUp · PageDown 은 한 달(같은 날, 없으면 말일) — 1월 31일 PageDown 은 2월 28일(윤년 29일)", () => {
    render(<Single today={d(2027, 1, 31)} />);
    day(2027, 1, 31).focus();
    key(day(2027, 1, 31), "PageDown");
    expect(title().textContent).toBe("2027년 2월");
    expect(document.activeElement).toBe(day(2027, 2, 28));
    key(document.activeElement!, "PageUp");
    // 말일에서 거꾸로 — 2월 28일 → 1월 28일(같은 날)
    expect(document.activeElement).toBe(day(2027, 1, 28));
    render(<Single key="leap" today={d(2028, 1, 31)} />);
    day(2028, 1, 31).focus();
    key(day(2028, 1, 31), "PageDown");
    expect(document.activeElement).toBe(day(2028, 2, 29));
  });

  it("Shift + PageUp · PageDown 은 한 해 — 윤일에서 평년으로는 2월 28일", () => {
    render(<Single today={d(2028, 2, 29)} />);
    day(2028, 2, 29).focus();
    key(day(2028, 2, 29), "PageDown", { shiftKey: true });
    expect(title().textContent).toBe("2029년 2월");
    expect(document.activeElement).toBe(day(2029, 2, 28));
    key(document.activeElement!, "PageUp", { shiftKey: true });
    expect(document.activeElement).toBe(day(2028, 2, 28));
  });

  it("Enter · Space 로 초점이 있는 날을 고른다 — 막힌 날은 무시", () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} max={d(2026, 10, 20)} />);
    const a = day(2026, 10, 16);
    a.focus();
    key(a, "Enter");
    expect(onChange).toHaveBeenCalledTimes(1);
    const b = day(2026, 10, 17);
    b.focus();
    key(b, " ");
    expect(onChange).toHaveBeenCalledTimes(2);
    const c = day(2026, 10, 25);
    c.focus();
    key(c, "Enter");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("연도 범위 밖으로는 옮겨 가지 않는다 — 범위 끝에서 →", () => {
    render(
      <Single today={d(2027, 12, 31)} yearRange={{ start: 2026, end: 2027 }} />,
    );
    day(2027, 12, 31).focus();
    key(day(2027, 12, 31), "ArrowRight");
    expect(title().textContent).toBe("2027년 12월");
    expect(document.activeElement).toBe(day(2027, 12, 31));
  });

  it("수식 키(Ctrl · Alt · Meta)와 함께면 건드리지 않는다", () => {
    render(<Single />);
    day(2026, 10, 15).focus();
    key(day(2026, 10, 15), "ArrowRight", { ctrlKey: true });
    key(day(2026, 10, 15), "ArrowRight", { metaKey: true });
    expect(document.activeElement).toBe(day(2026, 10, 15));
  });
});

describe("DatePicker — 두 달 나란히", () => {
  it("달력 두 개 · 달 이름은 달마다 가운데, 이전은 첫 달 · 다음은 둘째 달 — 한 달씩 옮긴다", () => {
    render(<Range visibleRange="twoMonths" />);
    expect(grids()).toHaveLength(2);
    const names = [
      ...container.querySelectorAll("[data-slot=date-picker-month-label]"),
    ].map((e) => e.textContent);
    expect(names).toEqual(["2026년 10월", "2026년 11월"]);
    expect(container.querySelector("[data-slot=date-picker-title]")).toBeNull();
    expect(live()).toBe("2026년 10월~2026년 11월");
    click(container.querySelector("[data-slot=date-picker-next]"));
    expect(
      [
        ...container.querySelectorAll("[data-slot=date-picker-month-label]"),
      ].map((e) => e.textContent),
    ).toEqual(["2026년 11월", "2026년 12월"]);
    click(container.querySelector("[data-slot=date-picker-previous]"));
    click(container.querySelector("[data-slot=date-picker-previous]"));
    expect(
      [
        ...container.querySelectorAll("[data-slot=date-picker-month-label]"),
      ].map((e) => e.textContent),
    ).toEqual(["2026년 9월", "2026년 10월"]);
  });

  it("두 달 모두 늘 6주 — 다른 달 날짜가 보이는 칸은 흐리게, 두 달이 만나는 자리에서 띠가 이어진다", () => {
    render(
      <Range
        visibleRange="twoMonths"
        initial={{ start: d(2026, 10, 28), end: d(2026, 11, 3) }}
      />,
    );
    for (const grid of grids()) {
      expect(grid.querySelectorAll("[role=gridcell]")).toHaveLength(42);
    }
    expect(
      day(2026, 10, 31).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("middle");
    expect(
      day(2026, 11, 1).closest("[role=gridcell]")!.getAttribute("data-band"),
    ).toBe("middle");
    // 날짜 버튼 이름이 달마다 겹치지 않는다 — 한 날짜 버튼은 한 번만
    expect(
      container.querySelectorAll('button[data-date="2026-10-31"]'),
    ).toHaveLength(1);
  });

  it("PageDown 은 두 달, 둘째 달로 옮겨 가면 두 달 창이 따라간다", () => {
    render(<Range visibleRange="twoMonths" today={d(2026, 10, 31)} />);
    day(2026, 10, 31).focus();
    key(day(2026, 10, 31), "PageDown");
    // 10월 31일 + 2달 = 12월 31일 — 12월이 보이는 창으로
    expect(document.activeElement).toBe(day(2026, 12, 31));
    expect(
      [
        ...container.querySelectorAll("[data-slot=date-picker-month-label]"),
      ].map((e) => e.textContent),
    ).toContain("2026년 12월");
  });

  it("마지막 연도의 마지막 두 달까지만 — 다음이 막힌다", () => {
    render(
      <Range
        visibleRange="twoMonths"
        today={d(2027, 11, 5)}
        yearRange={{ start: 2026, end: 2027 }}
      />,
    );
    const next = container.querySelector<HTMLButtonElement>(
      "[data-slot=date-picker-next]",
    )!;
    expect(next.disabled).toBe(true);
    expect(
      [
        ...container.querySelectorAll("[data-slot=date-picker-month-label]"),
      ].map((e) => e.textContent),
    ).toEqual(["2027년 11월", "2027년 12월"]);
  });
});

describe("DatePicker — 이어지는 달(continuous)", () => {
  it("머리 · 연 · 월 휠이 없고 요일 줄이 위에 붙는다 — 달마다 그 달의 주 수, 앞뒤 달 날짜는 비운다", () => {
    render(<Range visibleRange="continuous" today={d(2026, 2, 10)} />);
    expect(
      container.querySelector("[data-slot=date-picker-header]"),
    ).toBeNull();
    expect(container.querySelector("[data-slot=date-picker-title]")).toBeNull();
    const weekdays = container.querySelector(
      "[data-slot=date-picker-weekdays]",
    )!;
    expect(weekdays.className).toContain("sticky");
    const months = [
      ...container.querySelectorAll("[data-slot=date-picker-month]"),
    ];
    expect(months.length).toBeGreaterThanOrEqual(3);
    const feb = months.find((m) => m.querySelector("[data-month='2026-02']"))!;
    // 2026년 2월 — 일요일에 시작해 28일이라 딱 4주
    expect(
      feb.querySelectorAll("[data-month] > [role=row]:not(.sr-only)"),
    ).toHaveLength(4);
    expect(
      feb.querySelector("[data-slot=date-picker-month-label]")!.textContent,
    ).toBe("2026년 2월");
    // 앞뒤 달 날짜는 비운다 — 숫자가 없다
    expect(feb.querySelector("[data-slot=date-picker-outside]")).toBeNull();
    const mar = months.find((m) => m.querySelector("[data-month='2026-03']"))!;
    // 3월은 6주가 아니라 5주(일요일 시작 · 31일)
    expect(
      mar.querySelectorAll("[data-month] > [role=row]:not(.sr-only)"),
    ).toHaveLength(5);
    expect(feb.querySelectorAll("button")).toHaveLength(28);
  });

  it("달은 요일 줄 + 2주보다 낮아지지 않는다 — 시트가 낮으면 거기서 멈추고 시트 본문이 스크롤한다(Layout 지원 폭)", () => {
    render(<Range visibleRange="continuous" today={TODAY} />);
    const scroll = container.querySelector<HTMLElement>(
      "[data-slot=date-picker-scroll]",
    )!;
    // 요일 줄 max(48, t4 줄 높이) + 주 두 줄 max(48, t5 줄 높이 + 6) — 휠 자리(요일 줄 + 6주)와 같은 셈
    expect(scroll.className).toContain(
      "min-h-[calc(max(48px,var(--text-t4--line-height))_+_2_*_max(48px,calc(var(--text-t5--line-height)_+_6px)))]",
    );
    expect(scroll.className).not.toContain("min-h-0");
    // 남는 높이는 그대로 채운다
    expect(scroll.className).toContain("flex-1");
    expect(DATE_PICKER_CONTINUOUS_SHEET_BODY).toBe("overflow-x-hidden");
  });

  it("보이는 달 ± 2달만 그린다 — 수백 달을 한꺼번에 그리지 않는다, 아래 안개 96", () => {
    render(<Range visibleRange="continuous" today={TODAY} />);
    const count = container.querySelectorAll(
      "[data-slot=date-picker-month]",
    ).length;
    expect(count).toBeLessThan(12);
    expect(
      container.querySelector("[data-slot=date-picker-fog]")!.className,
    ).toContain("h-[96px]");
  });

  it("달마다 grid · 숨은 columnheader 줄(읽는 이름)이 있고 보이는 요일 줄은 보조 기술에서 숨긴다", () => {
    render(<Range visibleRange="continuous" today={TODAY} />);
    expect(
      container
        .querySelector("[data-slot=date-picker-weekdays]")!
        .getAttribute("aria-hidden"),
    ).toBe("true");
    const grid = container.querySelector("[data-month='2026-10']")!;
    expect(
      [...grid.querySelectorAll("[role=columnheader]")].map((h) =>
        h.getAttribute("aria-label"),
      ),
    ).toEqual([
      "일요일",
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
    ]);
    expect(grid.getAttribute("aria-labelledby")).toBe(
      grid.parentElement!.querySelector("[data-slot=date-picker-month-label]")!
        .id,
    );
  });

  it("키로 다음 달 날짜로 넘어가면 그 날로 초점이 간다 — 10월 31일 →", () => {
    render(<Range visibleRange="continuous" today={d(2026, 10, 31)} />);
    day(2026, 10, 31).focus();
    key(day(2026, 10, 31), "ArrowRight");
    expect(document.activeElement).toBe(day(2026, 11, 1));
  });

  it("기간을 고를 수 있다 — 두 달에 걸쳐서", () => {
    const onChange = vi.fn();
    render(<Range visibleRange="continuous" onChange={onChange} />);
    click(day(2026, 10, 28));
    click(day(2026, 11, 3));
    const r = last(onChange.mock.calls)[0] as DateRange;
    expect([dayKey(r.start!), dayKey(r.end!)]).toEqual([
      "2026-10-28",
      "2026-11-03",
    ]);
  });
});

describe("DatePicker — 큰 글자 · 눌림 색 (I-04 03-C 결정 1B · 2B)", () => {
  const cls = (el: Element | null) => el?.getAttribute("class") ?? "";

  it("머리 · 제목 · 요일 줄 · 칸은 높이 48 고정이 아니라 최소 48 이다 — 글이 크면 그만큼만 늘어난다", () => {
    render(<Single today={TODAY} />);
    const header = container.querySelector("[data-slot=date-picker-header]");
    expect(cls(header)).toContain("min-h-[48px]");
    expect(cls(header)).not.toMatch(/(^|\s)h-\[48px\]/);
    expect(cls(title())).toContain("min-h-[48px]");
    expect(cls(title())).not.toMatch(/(^|\s)h-\[48px\]/);
    const cell = container.querySelector("[data-slot=date-picker-cell]");
    expect(cls(cell)).toContain("min-h-[48px]");
    expect(cls(cell)).not.toMatch(/(^|\s)h-\[48px\]/);
    const weekdayRow = container.querySelector(
      "[data-slot=date-picker-weekday]",
    )!.parentElement;
    expect(cls(weekdayRow)).toContain("min-h-[48px]");
  });

  it("제목 셰브론은 20 px, 이전 · 다음은 40 px 다 — 글자 배율을 따르지 않는다", () => {
    render(<Single today={TODAY} />);
    expect(
      cls(container.querySelector("[data-slot=date-picker-title-icon]")),
    ).toContain("size-[20px]");
    for (const slot of ["previous", "next"]) {
      const b = container.querySelector(`[data-slot=date-picker-${slot}]`);
      expect(cls(b)).toContain("h-[40px]");
      expect(cls(b)).toContain("w-[40px]");
    }
  });

  it("두 달 · 이어지는 달의 달 이름 줄과 요일 줄도 최소 48 이다", () => {
    render(<Range visibleRange="twoMonths" today={TODAY} />);
    expect(
      cls(container.querySelector("[data-slot=date-picker-month-label]")),
    ).toContain("min-h-[48px]");
    render(<Range visibleRange="continuous" today={TODAY} />);
    expect(
      cls(container.querySelector("[data-slot=date-picker-weekdays]")),
    ).toContain("min-h-[48px]");
  });

  it("보통 날의 호버 · 누름 원은 투명 짝 bg-neutral-weak-alpha-pressed, 오늘 · 기간 사이 날은 불투명 bg-neutral-weak-pressed", () => {
    render(<Single today={TODAY} />);
    const visual = (b: Element) =>
      cls(b.querySelector("[data-slot=date-picker-day-visual]"));
    const plain = visual(day(2026, 10, 20));
    expect(plain).toContain(
      "group-active/day:bg-bg-neutral-weak-alpha-pressed",
    );
    expect(plain).toContain("group-hover/day:bg-bg-neutral-weak-alpha-pressed");
    expect(plain).not.toContain("layer-floating-pressed");
    const today = visual(day(2026, 10, 15));
    expect(today).toContain("group-active/day:bg-bg-neutral-weak-pressed");
    expect(today).not.toContain("weak-alpha-pressed");
  });

  it("날짜 버튼 · 앞뒤 달 숫자에 위아래 3 — 큰 글자에서 칸이 줄 높이 + 6 이 된다(스펙 #189)", () => {
    render(<Single today={TODAY} />);
    const btn = day(2026, 10, 20);
    expect(cls(btn)).toContain("py-[3px]");
    expect(cls(btn)).toContain("px-0");
    expect(cls(btn)).not.toContain(" p-0");
    expect(
      cls(container.querySelector("[data-slot=date-picker-outside]")),
    ).toContain("py-[3px]");
  });

  it("연 · 월 휠 자리는 요일 줄 + 6 × 칸을 셈한다 — 336 고정이 아니다", () => {
    render(<Single today={TODAY} />);
    act(() => title().click());
    const wheel = container.querySelector("[data-slot=date-picker-wheel]");
    expect(cls(wheel)).toContain(
      "h-[calc(max(48px,var(--text-t4--line-height))",
    );
    expect(cls(wheel)).not.toContain("h-[336px]");
  });

  it("이어지는 달은 높이를 재는 숨은 견본(이름 줄 · 칸 · 요일 줄)을 가진다", () => {
    render(<Range visibleRange="continuous" today={TODAY} />);
    const probe = container.querySelector("[data-slot=date-picker-probe]")!;
    expect(probe.getAttribute("aria-hidden")).toBe("true");
    expect(probe.children).toHaveLength(3);
    expect(cls(probe)).toContain("invisible");
  });
});
