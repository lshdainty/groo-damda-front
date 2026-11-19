// 화면의 일곱 칸 격자 — 캘린더 월 격자(폰 · 데스크톱) · 가계부 · 할 일 달력(LedgerDow · LedgerCellNum · 칸 금액) · 별자리 7일 띠.
//   groo-design #256 — 요일 머리는 ds 요일 글(영어 두 글자 Su ~ Sa, 칸에 들지 않으면 한 글자)이고 판정은 ds `useWeekdayFit` 하나다.
//   groo-design #260 · #261 — 달력 · 캘린더 칸 안 글(요일 · 날짜 · 일정 이름 · "+N개" · 칸 아래 금액 · 표식)은 글자 크기 설정을 따르지
//   않는다(`-static`). 폰 320 · 300%(처음부터 · 뜬 뒤)에서 글 크기가 100% 와 같고 칸을 넘지 않는다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import i18next from "i18next";
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

import enDs from "@/locales/en/ds.json";
import koDs from "@/locales/ko/ds.json";
import {
  changeTextScale,
  fontPx,
  fontPxAt100,
  grid,
  installWeekGridHarness,
  shownWidth,
  textWidth,
} from "@/shared/ds/date-picker/weekday-fit.test-utils";
import { WEEKDAY_PROBE_SLOT } from "@/shared/ds/date-picker";
import {
  LedgerCellAmt,
  LedgerCellMoney,
  LedgerCellNum,
  LedgerDow,
} from "@/shared/ui/groo/ledger";
import type { IEvent } from "@/widgets/calendar/model/interfaces";
import { WeekPicker } from "@/widgets/constellation/ui/report-parts";
import type { ReportModel } from "@/widgets/constellation/model/use-report-model";

vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({ selectedDate: new Date(2026, 1, 15) }),
}));

const { WeekdayRow, CalendarMonthViewMobile } =
  await import("./calendar-month-view-mobile");
const { WeekdayHead } = await import("./calendar-month-view-desktop");
const { MonthChip, MonthChipSpacer, MonthMore } = await import("./month-chip");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(async () => {
  await i18next.init({
    lng: "en",
    fallbackLng: "ko",
    ns: ["ds", "calendar"],
    defaultNS: "ds",
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { ds: enDs }, ko: { ds: koDs } },
  });
});
afterAll(async () => {
  await i18next.changeLanguage("ko");
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installWeekGridHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const weekdayCells = () =>
  Array.from(
    container.querySelectorAll(`[data-slot=${WEEKDAY_PROBE_SLOT}]`),
  ).map((p) => p.parentElement!);
const shown = () =>
  weekdayCells().map((c) => {
    const clone = c.cloneNode(true) as Element;
    clone
      .querySelectorAll(`[data-slot=${WEEKDAY_PROBE_SLOT}]`)
      .forEach((p) => p.remove());
    return clone.textContent;
  });
const TWO = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** 글 크기가 100% 와 같다 — 그대로 두는 쪽(칸 안 글) */
const expectStatic = (els: Element[]) => {
  expect(els.length).toBeGreaterThan(0);
  for (const el of els) expect(fontPx(el)).toBe(fontPxAt100(el));
};

/** 요일 · 날짜 숫자(두 자리 "28")가 칸 안 · 한 줄이고 글 크기가 100% 와 같다 */
const expectFits = (numbers: Element[]) => {
  expect(weekdayCells()).toHaveLength(7);
  for (const cell of weekdayCells()) {
    expect(shownWidth(cell)).toBeLessThanOrEqual(grid.cellWidth);
    expect(cell.className).toContain("whitespace-nowrap");
    expect(fontPx(cell)).toBe(fontPxAt100(cell));
  }
  for (const n of numbers) {
    expect(fontPx(n)).toBe(fontPxAt100(n));
    expect(textWidth("28", fontPx(n))).toBeLessThanOrEqual(grid.cellWidth);
  }
};

describe("캘린더 폰 월 격자 — 320(칸 (320 − 4) ÷ 7 = 45.1)", () => {
  const renderMonth = () =>
    act(() =>
      root.render(
        <>
          <WeekdayRow />
          <CalendarMonthViewMobile
            singleDayEvents={[]}
            multiDayEvents={[]}
            onDayClick={() => {}}
          />
        </>,
      ),
    );
  const numbers = () =>
    Array.from(container.querySelectorAll("[data-slot=month-day-number]"));

  it("처음부터 300% — 요일 두 글자 Su ~ Sa(세 글자 아님) · 날짜 숫자 글 크기가 100% 와 같고 칸 안", () => {
    grid.cellWidth = (320 - 4) / 7;
    grid.scale = 3;
    renderMonth();
    expect(shown()).toEqual(TWO);
    expectFits(numbers());
  });

  it("뜬 뒤 100% → 300% — 요일 두 글자 그대로 · 날짜 숫자 글 크기가 100% 와 같다", async () => {
    grid.cellWidth = (320 - 4) / 7;
    renderMonth();
    expect(shown()).toEqual(TWO);
    await changeTextScale(3);
    expect(shown()).toEqual(TWO);
    expectFits(numbers());
    expect(numbers()).toHaveLength(28);
  });
});

describe("캘린더 데스크톱 요일 머리", () => {
  it("넓어도 세 글자(Sun)로 늘리지 않고 두 글자, 300% 에도 두 글자 · 칸이 좁아지면 한 글자", async () => {
    grid.cellWidth = 140;
    act(() => root.render(<WeekdayHead />));
    expect(shown()).toEqual(TWO);
    await changeTextScale(3);
    expect(shown()).toEqual(TWO);
    grid.cellWidth = 12;
    await changeTextScale(3);
    expect(shown()).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expectFits([]);
  });
});

describe("가계부 · 할 일 폰 달력(LedgerDow · LedgerCellNum) — 320(칸 (320 − 32 + 16) ÷ 7 = 43.4)", () => {
  const renderLedger = () =>
    act(() =>
      root.render(
        <>
          <LedgerDow />
          <div className="grid grid-cols-7">
            {[26, 27, 28].map((d) => (
              <LedgerCellNum key={d} data-testid="num">
                {d}
              </LedgerCellNum>
            ))}
          </div>
        </>,
      ),
    );
  const numbers = () =>
    Array.from(container.querySelectorAll("[data-testid=num]"));

  it("처음부터 300% · 뜬 뒤 100% → 300% — 요일 · 날짜 숫자가 칸 안", async () => {
    grid.cellWidth = (320 - 32 + 16) / 7;
    grid.scale = 3;
    renderLedger();
    expect(shown()).toEqual(TWO);
    expectFits(numbers());
    act(() => root.unmount());
    root = createRoot(container);
    installWeekGridHarness();
    grid.cellWidth = (320 - 32 + 16) / 7;
    renderLedger();
    await changeTextScale(3);
    expectFits(numbers());
    expect(numbers()).toHaveLength(3);
  });
});

describe("별자리 리포트 7일 띠(WeekPicker) — 320(칸 (320 − 48 + 24) ÷ 7 = 42.3)", () => {
  // 2026-02-15(일) ~ 21(토), 오늘은 21일 — 오늘 칸은 "오늘" 글이라 견본이 없다
  const days = Array.from({ length: 7 }, (_, i) => `2026-02-${15 + i}`);
  const m = {
    days,
    todayISO: "2026-02-21",
    sel: "2026-02-18",
    setSel: () => {},
    dayName: (ds: string) => ds,
    canPrev: true,
    canNext: false,
    prevWeek: () => {},
    nextWeek: () => {},
    rangeLabel: "",
    dateLabel: "",
    isToday: false,
    asOf: "",
  } as unknown as ReportModel;
  const numbers = () =>
    Array.from(
      container.querySelectorAll("button[data-day] > span:last-child"),
    );

  it("뜬 뒤 100% → 300% — 요일 두 글자 · 날짜 숫자 글 크기가 100% 와 같고 칸 안", async () => {
    grid.cellWidth = (320 - 48 + 24) / 7;
    act(() => root.render(<WeekPicker m={m} place="band" />));
    const labels = () =>
      weekdayCells().map((c) => c.querySelector(":scope > span")!.textContent);
    expect(labels()).toEqual(TWO.slice(0, 6));
    await changeTextScale(3);
    expect(weekdayCells()).toHaveLength(6);
    expect(labels()).toEqual(TWO.slice(0, 6));
    for (const cell of weekdayCells()) {
      const label = cell.querySelector(":scope > span")!;
      expect(shownWidth(label)).toBeLessThanOrEqual(grid.cellWidth);
    }
    expectStatic(weekdayCells().map((c) => c.querySelector(":scope > span")!));
    expect(numbers()).toHaveLength(7);
    expectStatic(numbers());
    for (const n of numbers())
      expect(textWidth("21", fontPx(n))).toBeLessThanOrEqual(grid.cellWidth);
  });
});

describe("칸 안 일정 · 칸 아래 표시 — 300% 에서도 글 크기가 100% 와 같다(#260 · #261)", () => {
  const event = {
    id: 1,
    startDate: "2026-02-15T10:00:00",
    endDate: "2026-02-15T11:00:00",
    title: "Dentist appointment",
    description: "",
    color: "#c73838",
    isAllDay: false,
    sourceType: "holiday",
  } as unknown as IEvent;

  const renderCell = () =>
    act(() =>
      root.render(
        <div className="grid grid-cols-7">
          <div>
            <MonthChip
              slot={{ event, part: "none", labelDays: 0 }}
              density="phone"
            />
            <MonthChipSpacer density="phone" />
            <MonthMore count={3} density="phone" />
          </div>
          <div>
            <LedgerCellMoney tone="expense">12,000</LedgerCellMoney>
            <LedgerCellAmt tone="income">•</LedgerCellAmt>
          </div>
        </div>,
      ),
    );
  const texts = () => [
    ...container.querySelectorAll(
      "[data-slot=month-chip], [data-slot=month-chip-spacer], [data-slot=month-more], [data-slot=ledger-cell-money]",
    ),
    container.querySelector("[data-slot=ledger-cell-money]")!
      .nextElementSibling!,
  ];

  it("처음부터 300% — 일정 이름 · +N개 · 칸 금액 · 표식", () => {
    grid.scale = 3;
    renderCell();
    expect(texts()).toHaveLength(5);
    expectStatic(texts());
  });

  it("뜬 뒤 100% → 300%", async () => {
    renderCell();
    await changeTextScale(3);
    expectStatic(texts());
  });
});
