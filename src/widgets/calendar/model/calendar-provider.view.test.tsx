// 보기는 월 · 주 · 목록 셋이다 — 일 · 연을 걷었다(I-wrap-b1 γ). 옛 값(저장값 · 주소 · 링크가 들고 올 수 있는 "day" · "year")과
// 알 수 없는 값은 월로 떨어진다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendar } from "./calendar-context";
import { normalizeCalendarView } from "./types";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("@/features/user-calendar", () => ({
  useUserCalendars: () => ({ data: [] }),
  useToggleCalendarVisibility: () => ({
    mutate: () => {},
    pendingIds: new Set<number>(),
  }),
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
vi.mock("@/shared/i18n/config", () => ({ i18n: { t: (k: string) => k } }));

const { CalendarProvider } = await import("./calendar-provider");

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
});

const Probe = ({ next }: { next?: unknown }) => {
  const { view, setView } = useCalendar();
  return (
    <button
      data-view={view}
      onClick={() => setView(next as Parameters<typeof setView>[0])}
    />
  );
};
const viewOf = () => container.querySelector("button")!.dataset.view;

describe("normalizeCalendarView", () => {
  it.each([
    ["month", "month"],
    ["week", "week"],
    ["agenda", "agenda"],
    ["day", "month"],
    ["year", "month"],
    ["쓰레기", "month"],
    ["", "month"],
    [null, "month"],
    [undefined, "month"],
    [3, "month"],
  ])("%j → %s", (input, expected) => {
    expect(normalizeCalendarView(input)).toBe(expected);
  });
});

describe("CalendarProvider 의 보기", () => {
  it.each(["day", "year", "쓰레기"])(
    "처음 보기가 옛 값 %s 이면 월이다",
    (v) => {
      act(() =>
        root.render(
          <CalendarProvider events={[]} initialView={v as never}>
            <Probe />
          </CalendarProvider>,
        ),
      );
      expect(viewOf()).toBe("month");
    },
  );

  it.each(["week", "agenda"])("처음 보기 %s 는 그대로다", (v) => {
    act(() =>
      root.render(
        <CalendarProvider events={[]} initialView={v as never}>
          <Probe />
        </CalendarProvider>,
      ),
    );
    expect(viewOf()).toBe(v);
  });

  it.each(["day", "year"])("setView(%s) 도 월로 떨어진다", (v) => {
    act(() =>
      root.render(
        <CalendarProvider events={[]} initialView="week">
          <Probe next={v} />
        </CalendarProvider>,
      ),
    );
    expect(viewOf()).toBe("week");
    act(() => container.querySelector("button")!.click());
    expect(viewOf()).toBe("month");
  });
});
