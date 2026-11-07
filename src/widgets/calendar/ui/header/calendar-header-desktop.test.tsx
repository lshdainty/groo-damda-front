// 데스크톱 도구 줄 (I-09 14 · 15) — 보기 고르기는 이름이 보이는 Chip 하나 고르기 줄이다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const mocks = vi.hoisted(() => ({
  view: "month",
  setView: vi.fn(),
  setSelectedDate: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
}));
vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({
    selectedDate: new Date(2026, 9, 22),
    setSelectedDate: mocks.setSelectedDate,
    view: mocks.view,
    setView: mocks.setView,
  }),
}));
vi.mock("@/widgets/calendar/ui/header/calendar-source-toggle", () => ({
  CalendarSourceToggle: () => <span data-testid="source" />,
}));

const { CalendarHeaderDesktop } = await import("./calendar-header-desktop");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.setView.mockClear();
  mocks.setSelectedDate.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<CalendarHeaderDesktop />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("도구 줄", () => {
  it('보기 고르기는 radiogroup "보기" — 월 · 주 · 목록 셋, 이름이 보인다(일 · 연은 걷었다)', () => {
    const group = container.querySelector("[role=radiogroup]")!;
    expect(group.getAttribute("aria-label")).toBe("view.label");
    const radios = [...group.querySelectorAll("[role=radio]")];
    expect(radios.map((r) => r.textContent)).toEqual([
      "view.month",
      "view.week",
      "view.agenda",
    ]);
    // 아이콘만인 단추가 아니다 — 이름이 글로 보인다
    expect(radios.every((r) => (r.textContent ?? "").length > 0)).toBe(true);
    expect(radios[0]!.getAttribute("aria-checked")).toBe("true");
  });

  it("보기 칩을 누르면 그 보기로 바뀐다", () => {
    const radios = [...container.querySelectorAll<HTMLElement>("[role=radio]")];
    act(() => radios[2]!.click());
    expect(mocks.setView).toHaveBeenCalledWith("agenda");
  });

  it("옛 머리의 것이 없다 — 오늘 칩 상자 · 일정 수 배지 · 기간 글 · 세로 선", () => {
    expect(container.textContent).not.toContain("header.eventCount");
    expect(container.textContent).not.toMatch(/\d{4}\.\d{2}\.\d{2}/);
    expect(container.innerHTML).not.toContain("w-px");
  });

  it('달 보기에는 ‹ › 도 "오늘" 도 없다 — 달 글 하나뿐(I-27, 사용자 10-29)', () => {
    const buttons = [...container.querySelectorAll("button")];
    expect(
      buttons.some((b) => b.getAttribute("aria-label") === "header.prevWeek"),
    ).toBe(false);
    expect(
      buttons.some((b) => b.getAttribute("aria-label") === "header.nextWeek"),
    ).toBe(false);
    expect(container.textContent).not.toContain("today");
    expect(container.textContent).toContain("2026년 10월");
  });

  it("주 보기에서만 한 주씩 옮기는 ‹ › 가 달 글 뒤에 선다", () => {
    mocks.view = "week";
    act(() => root.render(<CalendarHeaderDesktop />));
    const prev = container.querySelector<HTMLElement>(
      "[aria-label='header.prevWeek']",
    )!;
    act(() => prev.click());
    expect(mocks.setSelectedDate).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("[aria-label='header.nextWeek']"),
    ).not.toBeNull();
    mocks.view = "month";
  });

  it("옛 일 보기 값이 들어와도 ‹ › 는 주 보기에만 있다(이전 날 · 다음 날 이름이 없다)", () => {
    mocks.view = "day";
    act(() => root.render(<CalendarHeaderDesktop />));
    expect(container.querySelector("[aria-label='header.prevDay']")).toBeNull();
    expect(container.querySelector("[aria-label='header.nextDay']")).toBeNull();
    mocks.view = "month";
  });
});
