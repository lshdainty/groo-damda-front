// 일곱 칸 요일 머리 — React Compiler 를 거친 코드로 본다(groo-design #250 · #256 · #258).
//   · 영어 두 글자 Su ~ Sa, 칸에 들지 않으면 한 글자 S ~ S, 줄을 바꾸지 않는다 — 판정은 ds 하나(useWeekdayNarrow · useWeekdayFit)
//   · 페이지가 뜬 뒤 글자 크기를 바꿔도 다시 잰다(이음 QA 2026-11-19 — 날짜 고르기를 연 채 300% 로 키우면 Su Mo 가 남아 겹쳤다)
//   · 요일 머리 · 날짜 숫자는 200% 에서 멈춘다(WEEK_GRID_TEXT) — 320 · 300% 에서도 칸을 넘지 않는다
// vitest 는 컴파일러 없이 돌아 컴파일러가 값을 처음 한 번에 묶는 결함이 안 보인다 — 그래서 앱 빌드와 같은 플러그인으로 변환한 모듈을 부른다.
import { act, createElement, useRef } from "react";
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
  compiledBody,
  importCompiled,
} from "@/shared/lib/react-compiler.test-utils";
import {
  WEEK_GRID_LINE_HEIGHT,
  WEEK_GRID_TEXT,
  WEEK_GRID_TEXT_MAX_SCALE,
} from "@/shared/ds/week-grid-text";

import {
  changeTextScale,
  fontPx,
  grid,
  installWeekGridHarness,
  shownWidth,
  textWidth,
} from "./weekday-fit.test-utils";
import { WeekdayProbe } from "./weekday-probe";
import { WEEKDAY_PROBE_SLOT } from "./weekday-fit";
import {
  CONTINUOUS_SCROLL,
  DAY,
  OUTSIDE,
  WEEKDAY,
  WHEEL,
} from "./date-picker-variants";

type FitModule = typeof import("./weekday-fit");
type PickerModule = typeof import("./date-picker");
type HeatmapModule = typeof import("@/shared/ds/chart/chart-heatmap");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(async () => {
  await i18next.init({
    lng: "en",
    fallbackLng: "ko",
    ns: ["ds"],
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

/** 보이는 요일 글(견본 빼고) */
const shownIn = (row: Element | null) =>
  Array.from(row?.querySelectorAll(`[data-slot=${WEEKDAY_PROBE_SLOT}]`) ?? [])
    .map((p) => p.parentElement!)
    .map((cell) => {
      const clone = cell.cloneNode(true) as Element;
      clone
        .querySelectorAll(`[data-slot=${WEEKDAY_PROBE_SLOT}]`)
        .forEach((p) => p.remove());
      return clone.textContent;
    });

/** 요일 칸마다 보이는 글이 칸 안 · 한 줄(줄을 바꾸지 않는다) */
const expectWeekdaysFit = (row: Element | null) => {
  const cells = Array.from(
    row?.querySelectorAll(`[data-slot=${WEEKDAY_PROBE_SLOT}]`) ?? [],
  ).map((p) => p.parentElement!);
  expect(cells).toHaveLength(7);
  for (const cell of cells) {
    expect(shownWidth(cell)).toBeLessThanOrEqual(grid.cellWidth);
    expect(cell.closest("[class*=whitespace-nowrap]")).not.toBeNull();
  }
};

describe("상한 하나 — WEEK_GRID_TEXT", () => {
  it("모든 글자 · 줄 높이 식이 배율 200%(WEEK_GRID_TEXT_MAX_SCALE)로 멈추고, 날짜 고르기의 요일 · 날짜 숫자 · 높이 셈이 그 식을 쓴다", () => {
    expect(WEEK_GRID_TEXT_MAX_SCALE).toBe(2);
    const all = [
      ...Object.values(WEEK_GRID_TEXT),
      ...Object.values(WEEK_GRID_LINE_HEIGHT),
    ];
    for (const cls of all) {
      const scales = [...cls.matchAll(/_\*_(\d+)/g)].map((m) => Number(m[1]));
      expect(scales.length).toBeGreaterThan(0);
      expect(scales.every((x) => x === WEEK_GRID_TEXT_MAX_SCALE)).toBe(true);
    }
    expect(WEEKDAY).toContain(WEEK_GRID_TEXT.t4);
    expect(DAY).toContain(WEEK_GRID_TEXT.t5);
    expect(OUTSIDE).toContain(WEEK_GRID_TEXT.t5);
    for (const cls of [WEEKDAY, DAY, OUTSIDE])
      expect(cls).not.toMatch(/(^| )text-t[45]( |$)/);
    // 요일 줄 + 칸 높이로 세는 휠 자리 · 이어지는 달 최소 높이도 같은 상한
    for (const cls of [WHEEL, CONTINUOUS_SCROLL]) {
      expect(cls).toContain(WEEK_GRID_LINE_HEIGHT.t4);
      expect(cls).toContain(WEEK_GRID_LINE_HEIGHT.t5);
      expect(cls).not.toMatch(/calc\(var\(--text-t5--line-height\)/);
    }
  });
});

describe("React Compiler 를 거친 useWeekdayFit — 뜬 뒤 글자 크기를 바꾸면 다시 잰다", () => {
  /** 열지도 폰 320 의 요일 칸 — (320 − 32 − 56 − 6 × 7) ÷ 7 = 27.1. 요일 글 t2(12) · 200% 상한 */
  const HEAT_CELL = (320 - 32 - 56 - 6 * 7) / 7;

  const renderRow = async () => {
    const { module, code } = await importCompiled<FitModule>(
      "src/shared/ds/date-picker/weekday-fit.ts",
    );
    // 컴파일러가 이 훅들을 변환했다 — 변환 안 된 코드를 보는 시험이 아니다
    expect(code).toContain("react/compiler-runtime");
    expect(compiledBody(code, "useWeekdayNarrow")).toContain("_c(");
    const Row = () => {
      const ref = useRef<HTMLDivElement>(null);
      const wd = module.useWeekdayFit(ref);
      return (
        <div ref={ref} data-slot="row" className="grid grid-cols-7">
          {wd.weekdays.map((w, i) => (
            <span
              key={i}
              className={`relative whitespace-nowrap ${WEEK_GRID_TEXT.t2}`}
            >
              {w}
              <WeekdayProbe>{wd.full[i]}</WeekdayProbe>
            </span>
          ))}
        </div>
      );
    };
    await act(() => root.render(createElement(Row)));
    return () => container.querySelector("[data-slot=row]");
  };

  it("100% 두 글자 → 300% 로 키우면 한 글자 · 칸 안 · 한 줄 → 100% 로 되돌리면 두 글자", async () => {
    grid.cellWidth = HEAT_CELL;
    const row = await renderRow();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expectWeekdaysFit(row());
    // 300% — 요일 글 24(200% 상한), 두 글자 "We" 29.8 > 칸 27.1
    await changeTextScale(3);
    expect(shownIn(row())).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expectWeekdaysFit(row());
    await changeTextScale(1);
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
  });

  it("견본 관찰이 알림을 놓쳐도 글자 크기 판(useTickFontVersion)이 바뀌면 다시 잰다", async () => {
    grid.cellWidth = HEAT_CELL;
    const row = await renderRow();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    await changeTextScale(3, "font");
    expect(shownIn(row())).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
  });
});

describe("React Compiler 를 거친 DatePicker — 폰 320 · 글자 300%", () => {
  /** 폰 320 시트의 달력 폭 272 → 칸 38.9 */
  const PICKER_CELL = 272 / 7;

  const renderPicker = async () => {
    const { module, code } = await importCompiled<PickerModule>(
      "src/shared/ds/date-picker/date-picker.tsx",
    );
    expect(compiledBody(code, "WeekdayRow")).toContain("_c(");
    await act(() =>
      root.render(
        createElement(module.DatePicker, { today: new Date(2026, 1, 18) }),
      ),
    );
    return () =>
      container.querySelector("[data-slot=date-picker-weekdays]") as Element;
  };

  /** 날짜 숫자(두 자리 "28")가 칸 안 */
  const expectDaysFit = () => {
    const days = Array.from(container.querySelectorAll("[data-date]"));
    expect(days.length).toBeGreaterThan(27);
    for (const d of days)
      expect(textWidth("28", fontPx(d))).toBeLessThanOrEqual(grid.cellWidth);
  };

  it("처음부터 300% — 요일 두 글자 · 날짜 숫자가 200% 에서 멈춰 칸 안 · 한 줄", async () => {
    grid.cellWidth = PICKER_CELL;
    grid.scale = 3;
    const row = await renderPicker();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expectWeekdaysFit(row());
    expectDaysFit();
  });

  it("뜬 뒤 100% → 300% — 요일 · 날짜 숫자가 칸을 넘지 않는다", async () => {
    grid.cellWidth = PICKER_CELL;
    const row = await renderPicker();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    await changeTextScale(3);
    expectWeekdaysFit(row());
    expectDaysFit();
  });

  it("칸이 더 좁으면(320 보다 좁은 화면) 뜬 뒤 300% 에서 한 글자로 바뀐다", async () => {
    grid.cellWidth = 30;
    const row = await renderPicker();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    await changeTextScale(3);
    expect(shownIn(row())).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expectWeekdaysFit(row());
  });
});

describe("React Compiler 를 거친 ChartHeatmap — 폰 320 열지도 요일 머리", () => {
  it("narrowLabel 을 주면 뜬 뒤 300% 에서 한 글자 · 칸 안, 되돌리면 두 글자", async () => {
    const { module } = await importCompiled<HeatmapModule>(
      "src/shared/ds/chart/chart-heatmap.tsx",
    );
    grid.cellWidth = (320 - 32 - 56 - 6 * 7) / 7;
    const two = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const one = ["M", "T", "W", "T", "F", "S", "S"];
    await act(() =>
      root.render(
        createElement(module.ChartHeatmap, {
          label: "heat",
          rows: [{ key: "r", label: "Evening" }],
          columns: two.map((label, i) => ({
            key: String(i),
            label,
            narrowLabel: one[i],
          })),
          values: [[1, 2, 3, 4, 5, 6, 7]],
        }),
      ),
    );
    const heat = () => container.querySelector("[data-slot=chart-heatmap]");
    expect(shownIn(heat())).toEqual(two);
    expectWeekdaysFit(heat());
    await changeTextScale(3);
    expect(shownIn(heat())).toEqual(one);
    expectWeekdaysFit(heat());
    await changeTextScale(1);
    expect(shownIn(heat())).toEqual(two);
  });
});
