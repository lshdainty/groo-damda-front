// 영어 요일 — groo-design #250(date-picker.md ⓔ Weekday). 영어는 두 글자 Su Mo Tu We Th Fr Sa 로 맞추고, 칸에 들지 않는 폭 · 글자 크기
// 에서만 한 글자 S M T W T F S 로 줄인다. 요일 글은 줄을 바꾸지 않는다. 예전엔 늘 Intl narrow(S M T W T F S)였다.
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

import { DatePicker } from "./date-picker";
import { datePickerLabels } from "./date-picker-dates";
import { WEEKDAY } from "./date-picker-variants";
import { WEEK_GRID_TEXT } from "@/shared/ds/week-grid-text";
import { WEEKDAY_PROBE_SLOT } from "./weekday-fit";

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

it("요일 글 두 벌 — 영어 두 글자 · 한 글자, 한국어는 둘 다 한 글자(사전에서)", async () => {
  expect(datePickerLabels().weekdays).toEqual([
    "Su",
    "Mo",
    "Tu",
    "We",
    "Th",
    "Fr",
    "Sa",
  ]);
  expect(datePickerLabels().weekdaysNarrow).toEqual([
    "S",
    "M",
    "T",
    "W",
    "T",
    "F",
    "S",
  ]);
  await i18next.changeLanguage("ko");
  expect(datePickerLabels().weekdays).toEqual(
    datePickerLabels().weekdaysNarrow,
  );
  expect(datePickerLabels().weekdays[0]).toBe("일");
  await i18next.changeLanguage("en");
});

describe("영어 요일 — 두 글자, 칸에 들지 않을 때만 한 글자", () => {
  let container: HTMLDivElement;
  let root: Root;
  /** 칸 폭 · 두 글자 견본 폭(어림) */
  let cellWidth = 0;
  let probeWidth = 0;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const slot = this.dataset.slot;
        const width =
          slot === "date-picker-weekday"
            ? cellWidth
            : slot === WEEKDAY_PROBE_SLOT
              ? probeWidth
              : 0;
        return {
          width,
          height: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON() {},
        } as DOMRect;
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const shown = () =>
    Array.from(
      container.querySelectorAll(
        "[data-slot=date-picker-weekdays] [data-slot=date-picker-weekday] > span:first-child",
      ),
    ).map((s) => s.textContent);

  // 폰 320 시트의 달력 폭 272 → 칸 38.9. 글자 200%(text-t4 14 → 28) 두 글자 "We" 어림 2 × 0.62 × 28 = 34.7
  it("폰 320 · 글자 200% — 두 글자가 칸에 들면 Su Mo Tu We Th Fr Sa, 한 줄(줄을 바꾸지 않는다)", () => {
    cellWidth = 272 / 7;
    probeWidth = 2 * 0.62 * 28;
    act(() => root.render(<DatePicker today={new Date(2026, 10, 18)} />));
    expect(shown()).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    // 요일 글은 줄을 바꾸지 않는다
    expect(WEEKDAY).toContain("whitespace-nowrap");
    // 읽는 이름은 그대로 요일 이름
    expect(
      container
        .querySelector("[data-slot=date-picker-weekday]")
        ?.getAttribute("aria-label"),
    ).toBe("Sunday");
  });

  it("칸에 두 글자가 들지 않는 폭 · 글자 크기 — 한 글자 S M T W T F S", () => {
    cellWidth = 30;
    probeWidth = 2 * 0.62 * 42; // 300%
    act(() => root.render(<DatePicker today={new Date(2026, 10, 18)} />));
    expect(shown()).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
  });

  // 요일 글은 200% 에서 멈춘다(date-picker.md "글자 크기 설정", #252) — 320 · 300% 면 text-t4 가 42 라 한 글자 "W"(26)도 칸(38.9)에
  // 거의 차고 두 글자(52)는 넘는다. 상한(28)이면 두 글자 34.7 이 칸에 든다
  it("폰 320 · 글자 300% — 요일 글은 200%(28) 에서 멈춰 두 글자가 칸 안 · 한 줄", () => {
    // 상한 — rem 토큰과 static 토큰 × 2 가운데 작은 값(글자 · 줄 높이 모두)
    expect(WEEKDAY).toContain(WEEK_GRID_TEXT.t4);
    expect(WEEK_GRID_TEXT.t4).toContain(
      "text-[length:min(var(--text-t4),calc(var(--text-t4-static)_*_2))]",
    );
    expect(WEEK_GRID_TEXT.t4).toContain(
      "leading-[min(var(--text-t4--line-height),calc(var(--text-t4-static--line-height)_*_2))]",
    );
    expect(WEEKDAY).not.toMatch(/(^| )text-t4( |$)/);
    // 견본 폭 = 두 글자 × 0.62 × min(14 × 3, 28)
    const font = Math.min(14 * 3, 14 * 2);
    cellWidth = 272 / 7;
    probeWidth = 2 * 0.62 * font;
    act(() => root.render(<DatePicker today={new Date(2026, 10, 18)} />));
    expect(shown()).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    expect(probeWidth).toBeLessThanOrEqual(cellWidth);
    expect(WEEKDAY).toContain("whitespace-nowrap");
  });
});
