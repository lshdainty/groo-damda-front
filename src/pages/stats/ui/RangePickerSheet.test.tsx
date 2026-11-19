// 통계 기간 고르기 — ds Date Picker 기간(칸 하나 · 빠른 기간 · 초기화 + 완료). 모양은 ds:check 가 잰다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { RangePickerSheet } = await import("./RangePickerSheet");
const { monthRangeOf, previousRange } = await import("./stats-range");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollTo = function () {};
  Element.prototype.scrollIntoView = function () {};
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 29, 13, 0, 0));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const buttons = () => [...document.querySelectorAll("button")];
const chips = () => [
  ...document.querySelectorAll<HTMLButtonElement>(
    "[data-slot=date-picker-presets] [role=radio]",
  ),
];
const byText = (s: string | RegExp) =>
  buttons().find((b) =>
    typeof s === "string"
      ? b.textContent?.trim() === s
      : s.test(b.textContent ?? ""),
  );

function mount(onConfirm = vi.fn()) {
  const initial = monthRangeOf(new Date(2026, 9, 29));
  act(() =>
    root.render(
      <RangePickerSheet
        open
        onOpenChange={() => {}}
        initial={initial}
        onConfirm={onConfirm}
        trigger={({ onClick }) => (
          <button type="button" onClick={onClick}>
            trigger
          </button>
        )}
      />,
    ),
  );
  return onConfirm;
}

describe("RangePickerSheet", () => {
  it("시트가 낮으면 달은 요일 줄 + 2주에서 멈추고 시트 본문이 스크롤한다 — 머리 · 바닥은 그대로(Layout 지원 폭)", () => {
    mount();
    const body = document.querySelector<HTMLElement>(
      "[data-slot=bottom-sheet-body]",
    )!;
    // 본문은 세로로 스크롤할 수 있다(예전엔 overflow-hidden 이라 줄어든 달이 13 만 남았다)
    expect(body.className).toContain("overflow-y-auto");
    expect(body.className).toContain("overflow-x-hidden");
    expect(body.className).not.toMatch(/(^|\s)overflow-hidden(\s|$)/);
    // 달력이 본문 높이를 채우는 건 그대로 — 보통 높이에서는 달 안에서 스크롤한다
    const picker = document.querySelector<HTMLElement>(
      "[data-slot=date-picker]",
    )!;
    expect(picker.className).toContain("h-full");
    const scroll = document.querySelector<HTMLElement>(
      "[data-slot=date-picker-scroll]",
    )!;
    expect(scroll.className).toContain("flex-1");
    expect(scroll.className).not.toContain("min-h-0");
    // 요일 줄 48 + 주 두 줄 48 × 2(칸 안 글은 static — #260)
    expect(scroll.className).toContain("min-h-[144px]");
    // 바닥은 본문 밖이라 스크롤에 밀려나지 않는다
    const footer = document.querySelector("[data-slot=bottom-sheet-footer]");
    expect(footer && !body.contains(footer)).toBe(true);
  });

  it("시작 · 종료 두 칸이 없다 — 날짜 입력칸 0, 바닥은 초기화 + 완료", () => {
    mount();
    expect(document.querySelectorAll("input").length).toBe(0);
    expect(byText("picker.reset")).toBeTruthy();
    expect(byText("picker.done")).toBeTruthy();
  });

  it("빠른 기간은 이번 주 · 이번 달 · 지난 달 · 최근 3개월 · 올해 다섯", () => {
    mount();
    expect(chips().map((c) => c.getAttribute("data-value") ?? c.value)).toEqual(
      ["thisWeek", "thisMonth", "lastMonth", "last3Months", "thisYear"],
    );
  });

  it("바꾸지 않고 완료 — 지금 기간 · 보기(월)를 그대로 돌려준다", () => {
    const onConfirm = mount();
    act(() => byText("picker.done")!.click());
    const r = onConfirm.mock.calls[0]![0];
    expect(r.segMode).toBe("m");
    expect([r.from.getMonth(), r.from.getDate()]).toEqual([9, 1]);
    expect([r.to.getMonth(), r.to.getDate()]).toEqual([9, 31]);
  });

  it("최근 3개월 칩 → 완료 — 8월 1일 ~ 10월 31일, 직접", () => {
    const onConfirm = mount();
    act(() => chips()[3]!.click());
    act(() => byText("picker.done")!.click());
    const r = onConfirm.mock.calls[0]![0];
    expect(r.segMode).toBe("custom");
    expect([r.from.getMonth(), r.from.getDate()]).toEqual([7, 1]);
    expect([r.to.getMonth(), r.to.getDate()]).toEqual([9, 31]);
  });

  it("지난 달 칩 → 월 보기 9월, 이전 기간(비교)은 그 전달 8월", () => {
    const onConfirm = mount();
    act(() => chips()[2]!.click());
    act(() => byText("picker.done")!.click());
    const r = onConfirm.mock.calls[0]![0];
    expect(r.segMode).toBe("m");
    expect([r.from.getMonth(), r.from.getDate()]).toEqual([8, 1]);
    expect([r.to.getMonth(), r.to.getDate()]).toEqual([8, 30]);
    const prev = previousRange(r);
    expect([prev.from.getMonth(), prev.from.getDate()]).toEqual([7, 1]);
    expect([prev.to.getMonth(), prev.to.getDate()]).toEqual([7, 31]);
  });

  it("올해 칩 → 년 보기", () => {
    const onConfirm = mount();
    act(() => chips()[4]!.click());
    act(() => byText("picker.done")!.click());
    expect(onConfirm.mock.calls[0]![0].segMode).toBe("y");
  });

  it("초기화하면 완료가 막힌다 — 통계 기간은 비울 수 없다", () => {
    const onConfirm = mount();
    act(() => byText("picker.reset")!.click());
    const done = byText("picker.done") as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    act(() => done.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
