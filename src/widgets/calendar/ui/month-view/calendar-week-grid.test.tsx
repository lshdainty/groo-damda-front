// 화면의 일곱 칸 격자 — 캘린더 월 격자(폰 · 데스크톱) · 가계부 · 할 일 달력(LedgerDow · LedgerCellNum).
//   groo-design #256 — 요일 머리는 ds 요일 글(영어 두 글자 Su ~ Sa, 칸에 들지 않으면 한 글자)이고 판정은 ds `useWeekdayFit` 하나다.
//   groo-design #258 — 요일 머리 · 날짜 숫자는 글자 크기 200% 에서 멈춘다(WEEK_GRID_TEXT). 폰 320 · 300%(처음부터 · 뜬 뒤)에서 칸을 넘지 않는다.
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
  grid,
  installWeekGridHarness,
  shownWidth,
  textWidth,
} from "@/shared/ds/date-picker/weekday-fit.test-utils";
import { WEEKDAY_PROBE_SLOT } from "@/shared/ds/date-picker";
import { LedgerCellNum, LedgerDow } from "@/shared/ui/groo/ledger";
import { WeekPicker } from "@/widgets/constellation/ui/report-parts";
import type { ReportModel } from "@/widgets/constellation/model/use-report-model";

vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({ selectedDate: new Date(2026, 1, 15) }),
}));

const { WeekdayRow, CalendarMonthViewMobile } =
  await import("./calendar-month-view-mobile");
const { WeekdayHead } = await import("./calendar-month-view-desktop");

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

/** 요일 · 날짜 숫자(두 자리 "28")가 칸 안 · 한 줄 */
const expectFits = (numbers: Element[]) => {
  expect(weekdayCells()).toHaveLength(7);
  for (const cell of weekdayCells()) {
    expect(shownWidth(cell)).toBeLessThanOrEqual(grid.cellWidth);
    expect(cell.className).toContain("whitespace-nowrap");
  }
  for (const n of numbers)
    expect(textWidth("28", fontPx(n))).toBeLessThanOrEqual(grid.cellWidth);
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

  it("처음부터 300% — 요일 두 글자 Su ~ Sa(세 글자 아님) · 날짜 숫자가 200% 에서 멈춰 칸 안", () => {
    grid.cellWidth = (320 - 4) / 7;
    grid.scale = 3;
    renderMonth();
    expect(shown()).toEqual(TWO);
    expectFits(numbers());
  });

  it("뜬 뒤 100% → 300% — 요일 · 날짜 숫자가 칸을 넘지 않는다", async () => {
    grid.cellWidth = (320 - 4) / 7;
    renderMonth();
    expect(shown()).toEqual(TWO);
    await changeTextScale(3);
    expectFits(numbers());
    expect(numbers()).toHaveLength(28);
  });
});

describe("캘린더 데스크톱 요일 머리", () => {
  it("넓어도 세 글자(Sun)로 늘리지 않고 두 글자, 칸이 좁으면 뜬 뒤 300% 에서 한 글자", async () => {
    grid.cellWidth = 140;
    act(() => root.render(<WeekdayHead />));
    expect(shown()).toEqual(TWO);
    grid.cellWidth = 30;
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

  it("뜬 뒤 100% → 300% — 요일 두 글자 · 날짜 숫자가 칸 안", async () => {
    grid.cellWidth = (320 - 48 + 24) / 7;
    act(() => root.render(<WeekPicker m={m} place="band" />));
    const labels = () =>
      weekdayCells().map((c) => c.querySelector(":scope > span")!.textContent);
    expect(labels()).toEqual(TWO.slice(0, 6));
    await changeTextScale(3);
    expect(weekdayCells()).toHaveLength(6);
    for (const cell of weekdayCells()) {
      const label = cell.querySelector(":scope > span")!;
      expect(shownWidth(label)).toBeLessThanOrEqual(grid.cellWidth);
    }
    expect(numbers()).toHaveLength(7);
    for (const n of numbers())
      expect(textWidth("21", fontPx(n))).toBeLessThanOrEqual(grid.cellWidth);
  });
});
