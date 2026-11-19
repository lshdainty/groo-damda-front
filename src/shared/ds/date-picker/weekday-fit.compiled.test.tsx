// 일곱 칸 요일 머리 — React Compiler 를 거친 코드로 본다(groo-design #250 · #256 · #258).
//   · 영어 두 글자 Su ~ Sa, 칸에 들지 않으면 한 글자 S ~ S, 줄을 바꾸지 않는다 — 판정은 ds 하나(useWeekdayNarrow · useWeekdayFit)
//   · 칸 안 글(요일 머리 · 날짜 숫자)은 글자 크기 설정을 따르지 않는다(`-static` — groo-design #260). 300%(처음부터 · 뜬 뒤)에서도
//     글 크기가 100% 와 같고 두 글자 · 한 글자 판정이 바뀌지 않는다. 머리 제목은 커진다
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
  changeTextScale,
  fontPx,
  fontPxAt100,
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
  TITLE,
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

describe("칸 안 글은 그대로 — 요일 · 날짜 숫자 -static, 칸 · 요일 줄 48 고정", () => {
  it("요일 · 날짜 숫자는 static 토큰(rem 토큰 · 옛 200% 상한 식 없음), 휠 자리 336 · 이어지는 달 최소 144 는 px", () => {
    expect(WEEKDAY).toContain("text-t4-static");
    expect(DAY).toContain("text-t5-static");
    expect(OUTSIDE).toContain("text-t5-static");
    for (const cls of [WEEKDAY, DAY, OUTSIDE, WHEEL, CONTINUOUS_SCROLL]) {
      expect(cls).not.toMatch(/(^| )text-t\d+( |$)/);
      expect(cls).not.toMatch(/--text-t\d+--line-height|_\*_2/);
    }
    // 48 + 6 × 48 · 48 + 2 × 48 — 글자 크기를 따라 늘지 않는다
    expect(WHEEL).toContain("h-[336px]");
    expect(CONTINUOUS_SCROLL).toContain("min-h-[144px]");
    // 머리 제목은 커지는 쪽(rem)
    expect(TITLE).toMatch(/(^| )text-t5( |$)/);
  });
});

describe("React Compiler 를 거친 useWeekdayFit — 글자 크기는 판정을 바꾸지 않고, 칸 폭이 바꾼다", () => {
  /** 열지도 폰 320 의 요일 칸 — (320 − 32 − 56 − 6 × 7) ÷ 7 = 27.1. 요일 글 t2-static(12) */
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
            <span key={i} className="relative whitespace-nowrap text-t2-static">
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

  it("100% 두 글자 → 뜬 뒤 300% 에도 두 글자 · 글 크기 그대로 → 칸이 좁아지면 한 글자", async () => {
    grid.cellWidth = HEAT_CELL;
    const row = await renderRow();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expectWeekdaysFit(row());
    // 300% — 요일 글은 12 그대로("We" 14.9 < 칸 27.1). rem 이면 36 이라 한 글자로 줄었다
    await changeTextScale(3);
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expectWeekdaysFit(row());
    const cell = row()!.querySelector("span")!;
    expect(fontPx(cell)).toBe(fontPxAt100(cell));
    // 칸이 좁아지면(창 폭) 한 글자 — 줄 관찰로 다시 잰다
    grid.cellWidth = 12;
    await changeTextScale(3);
    expect(shownIn(row())).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expectWeekdaysFit(row());
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

  /** 날짜 숫자 · 요일 글 크기가 100% 와 같고(칸 안 글), 두 자리 "28" 이 칸 안 · 머리 제목은 배율을 따라 커진다 */
  const expectGridStatic = (row: Element) => {
    const days = Array.from(container.querySelectorAll("[data-date]"));
    expect(days.length).toBeGreaterThan(27);
    for (const d of days) {
      expect(fontPx(d)).toBe(fontPxAt100(d));
      expect(textWidth("28", fontPx(d))).toBeLessThanOrEqual(grid.cellWidth);
    }
    for (const w of row.querySelectorAll("[data-slot=date-picker-weekday]"))
      expect(fontPx(w)).toBe(fontPxAt100(w));
    const title = container.querySelector("[data-slot=date-picker-title]");
    expect(title).not.toBeNull();
    expect(fontPx(title)).toBe(fontPxAt100(title) * grid.scale);
  };

  it("처음부터 300% — 요일 두 글자 · 날짜 숫자 글 크기가 100% 와 같고 칸 안 · 제목만 커진다", async () => {
    grid.cellWidth = PICKER_CELL;
    grid.scale = 3;
    const row = await renderPicker();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expectWeekdaysFit(row());
    expectGridStatic(row());
  });

  it("뜬 뒤 100% → 300% — 요일 두 글자 그대로 · 날짜 숫자 글 크기가 100% 와 같다", async () => {
    grid.cellWidth = PICKER_CELL;
    const row = await renderPicker();
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    await changeTextScale(3);
    expect(shownIn(row())).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expectWeekdaysFit(row());
    expectGridStatic(row());
  });

  it("칸이 두 글자보다 좁으면(320 보다 좁은 화면) 한 글자 — 글자 크기와 무관", async () => {
    grid.cellWidth = 15;
    const row = await renderPicker();
    expect(shownIn(row())).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    await changeTextScale(3);
    expect(shownIn(row())).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expectWeekdaysFit(row());
  });
});

describe("React Compiler 를 거친 ChartHeatmap — 폰 320 열지도(그대로 두는 쪽)", () => {
  it("300%(뜬 뒤)에도 요일 두 글자 · 시간대 라벨 · 칸 글 크기가 100% 와 같고, 칸이 좁으면 narrowLabel", async () => {
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
          rows: [{ key: "r", label: "Evening", sub: "18–24" }],
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
    expect(shownIn(heat())).toEqual(two);
    expectWeekdaysFit(heat());
    const texts = [
      ...container.querySelectorAll("[data-slot=chart-heatmap-column]"),
      ...container.querySelectorAll("[data-slot=chart-heatmap-row] span"),
      ...container.querySelectorAll("[data-slot=chart-heatmap-cell]"),
    ];
    expect(texts.length).toBe(7 + 2 + 7);
    for (const el of texts) expect(fontPx(el)).toBe(fontPxAt100(el));
    // 칸이 좁아지면(창 폭) 한 글자
    grid.cellWidth = 12;
    await changeTextScale(3);
    expect(shownIn(heat())).toEqual(one);
  });
});
