// 주 보기 (I-wrap-b1 γ) — 시간 격자 구조는 그대로, 부품만 ds: 일정 칩은 button 이고 이름이 "제목 · 시간"이다.
// 시간 축은 날짜 · 시각 규칙("오전 1시"), 옛 색 · 글자 · 모서리 클래스와 펄스가 없다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("@/widgets/calendar/model/calendar-context", () => ({
  useCalendar: () => ({
    selectedDate: new Date(2026, 9, 21),
    workingHours: { start: 9, end: 18 },
    visibleHours: { start: 0, end: 24 },
  }),
}));

const { CalendarWeekView } = await import("./calendar-week-view");
const { CalendarWeekViewSkeleton } =
  await import("./calendar-week-view-skeleton");
const { i18n: appI18n } = await import("@/shared/i18n/config");

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  await appI18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const event = (id: number, over: Partial<IEvent> = {}): IEvent => ({
  id,
  startDate: "2026-10-20T10:00:00",
  endDate: "2026-10-20T11:30:00",
  title: `일정 ${id}`,
  description: "",
  color: "#2c70bf",
  isAllDay: false,
  sourceType: "calendar",
  eventType: null,
  calendarRowId: 1,
  calendarName: null,
  calendarColor: null,
  labelRowId: null,
  labelName: null,
  labelColor: null,
  location: null,
  rrule: null,
  recurrenceId: null,
  reminders: [],
  ...over,
});

const OLD_CLASSES =
  /(?:^|\s)(?:text-muted-foreground|bg-muted(?:\/\d+)?|bg-background|bg-accent|text-(?:xs|sm|base)|rounded-(?:md|lg)|rounded-r\d|animate-pulse)(?=\s|$)/;

const render = (
  single: IEvent[],
  multi: IEvent[] = [],
  onEventClick = vi.fn(),
) => {
  act(() =>
    root.render(
      <CalendarWeekView
        singleDayEvents={single}
        multiDayEvents={multi}
        onEventClick={onEventClick}
      />,
    ),
  );
  return onEventClick;
};

describe("주 보기 일정 칩", () => {
  it('div role=button 이 아니라 button 이고 이름이 "제목 · 시간" 이다', () => {
    render([event(1, { title: "팀 회의" })]);
    expect(container.querySelector("[role=button]")).toBeNull();
    const chip = container.querySelector<HTMLButtonElement>("button")!;
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.type).toBe("button");
    expect(chip.getAttribute("aria-label")).toMatch(
      /^10월 20일 \(화\) · 팀 회의 · 오전 10:00~오전 11:30/,
    );
  });

  it('칩 안 시각은 하루 패널과 같이 "오전 10:00~오전 11:30"(~ 앞뒤 붙임)이다', () => {
    render([event(1)]);
    const chip = container.querySelector("button")!;
    expect(chip.textContent).toContain("오전 10:00~오전 11:30");
    expect(chip.textContent).not.toMatch(/ - /);
  });

  it("월 칩과 같은 초점 링 · 글 · 모서리 · 색이다(같은 eventBadgeTone)", async () => {
    const { eventBadgeTone } = await import("@/widgets/calendar/lib/helpers");
    const e = event(1);
    render([e]);
    const chip = container.querySelector<HTMLElement>("button")!;
    for (const c of [
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-stroke-focus-ring",
      "rounded-sm",
      "text-t2",
      "font-medium",
    ])
      expect(chip.classList.contains(c)).toBe(true);
    const tone = eventBadgeTone(e);
    expect(chip.style.background).toBe(tone.bg);
    expect(chip.style.color).toBe(tone.fg);
  });

  it("누르면 일정과 누른 요소를 넘긴다", () => {
    const e = event(1);
    const onClick = render([e]);
    const chip = container.querySelector<HTMLButtonElement>("button")!;
    act(() => chip.click());
    expect(onClick).toHaveBeenCalledWith(e, chip);
  });

  it("여러 날 일정은 제목 조각 하나만 button 이다(나머지 조각은 보조 기술에 숨긴다)", () => {
    render(
      [],
      [
        event(2, {
          title: "출장",
          isAllDay: true,
          startDate: "2026-10-19T00:00:00",
          endDate: "2026-10-21T23:59:59",
        }),
      ],
    );
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute("aria-label")).toMatch(
      /^10월 19일 \(월\) · 출장 · 종일 · 10월 19일~21일/,
    );
    expect(container.querySelectorAll("[data-part]").length).toBe(3);
    expect(container.querySelectorAll("[data-part][aria-hidden]").length).toBe(
      2,
    );
  });

  it("이어지는 띠 조각 사이에 틈이 없다 — 사이 조각은 가로 여백이 0 이고 -ml-px 로 이웃에 겹친다", () => {
    render(
      [],
      [
        event(2, {
          isAllDay: true,
          startDate: "2026-10-19T00:00:00",
          endDate: "2026-10-22T23:59:59",
        }),
      ],
    );
    const parts = [...container.querySelectorAll<HTMLElement>("[data-part]")];
    expect(parts.map((p) => p.dataset.part)).toEqual([
      "first",
      "middle",
      "middle",
      "last",
    ]);
    for (const p of parts) {
      const margins = [...p.classList].filter((c) => /^-?m[lrx]-/.test(c));
      expect(margins.some((c) => c === "mx-x1")).toBe(false);
    }
    // 모서리 — 사이 조각은 각지고, 첫 조각은 오른쪽이, 끝 조각은 왼쪽이 각진다(둥근 모서리 클래스가 뒤에서 덮어쓰지 않는다)
    expect(parts[1]!.className).toContain("rounded-none");
    expect(parts[1]!.className).not.toMatch(/rounded-sm/);
    expect(parts[0]!.className).toContain("rounded-r-none");
    expect(parts[0]!.className).toMatch(/rounded-sm/);
    expect(parts[3]!.className).toContain("rounded-l-none");
    expect(parts[1]!.className).toContain("mx-0");
    expect(parts[1]!.className).toContain("-ml-px");
    expect(parts[3]!.className).not.toContain("ml-0");
  });

  it("바탕은 일정 색의 옅은 바탕 · 글은 그 짝의 contrast 다(월 칩과 같은 eventBadgeTone)", () => {
    render([event(1)]);
    const chip = container.querySelector<HTMLElement>("button")!;
    expect(chip.style.background).toMatch(/chart-\w+-weak/);
    expect(chip.style.color).toMatch(/chart-\w+-contrast/);
  });
});

describe("주 보기 이름 · 차례 · 처음 스크롤", () => {
  it("칩 이름 맨 앞에 날짜가 있다 — 같은 제목이 다른 날이면 이름이 다르다", () => {
    render([
      event(1, { title: "회의" }),
      event(2, {
        title: "회의",
        startDate: "2026-10-22T10:00:00",
        endDate: "2026-10-22T11:00:00",
      }),
    ]);
    const names = [...container.querySelectorAll("button")].map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(names[0]).toMatch(/^10월 20일 \(화\) · 회의/);
    expect(names[1]).toMatch(/^10월 22일 \(목\) · 회의/);
  });

  it("Tab 차례는 날 → 시작 시각 순이다(겹침 묶음 차례가 아니다)", () => {
    render([
      // 한 날에 겹치는 셋 — groupEvents 는 묶음 차례로 돌려준다
      event(1, {
        title: "B",
        startDate: "2026-10-20T10:30:00",
        endDate: "2026-10-20T12:00:00",
      }),
      event(2, {
        title: "A",
        startDate: "2026-10-20T10:00:00",
        endDate: "2026-10-20T11:00:00",
      }),
      event(3, {
        title: "C",
        startDate: "2026-10-20T10:45:00",
        endDate: "2026-10-20T11:30:00",
      }),
      event(4, {
        title: "D",
        startDate: "2026-10-19T15:00:00",
        endDate: "2026-10-19T16:00:00",
      }),
    ]);
    const titles = [...container.querySelectorAll("button")].map(
      (b) => b.getAttribute("aria-label")!.split(" · ")[1],
    );
    expect(titles).toEqual(["D", "A", "B", "C"]);
  });

  const scroller = () =>
    container.querySelector<HTMLElement>(".overflow-y-auto")!;

  it("처음 스크롤 — 일정이 없으면 오전 8시", () => {
    render([]);
    expect(scroller().scrollTop).toBe(8 * 96 - 12);
  });

  it("처음 스크롤 — 그 주 가장 이른 일정이 8시보다 이르면 그 시각", () => {
    render([
      event(1, {
        startDate: "2026-10-20T06:30:00",
        endDate: "2026-10-20T07:30:00",
      }),
    ]);
    expect(scroller().scrollTop).toBe(6 * 96 - 12);
  });

  it("처음 스크롤 — 0시가 첫 시각이고 일정이 0시면 0 아래로 가지 않는다", () => {
    render([
      event(1, {
        startDate: "2026-10-20T00:00:00",
        endDate: "2026-10-20T01:00:00",
      }),
    ]);
    expect(scroller().scrollTop).toBe(0);
  });

  it("처음 스크롤 — 일정이 8시 이후면 8시", () => {
    render([event(1)]);
    expect(scroller().scrollTop).toBe(8 * 96 - 12);
  });

  it("지난주에 시작한 여러 날 일정의 이번 주 첫 조각이 제목을 단 button 이다", () => {
    render(
      [],
      [
        event(5, {
          title: "긴 출장",
          isAllDay: true,
          startDate: "2026-10-15T00:00:00",
          endDate: "2026-10-20T23:59:59",
        }),
      ],
    );
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toBe("긴 출장");
    expect(buttons[0]!.getAttribute("aria-label")).toMatch(
      /^10월 18일 \(일\) · 긴 출장/,
    );
    expect(buttons[0]!.dataset.part).toBe("first");
  });
});

describe("주 보기 시간 축 · 클래스", () => {
  it('"오전 1시" — 0 을 붙이지 않는다', () => {
    render([]);
    const text = container.textContent ?? "";
    expect(text).toContain("오전 1시");
    expect(text).toContain("오후 1시");
    expect(text).not.toMatch(/오[전후] 0\d시/);
  });

  it("폰 안내(sm:hidden · weekView.*)와 hidden sm:flex 갈림이 없다", () => {
    render([]);
    expect(container.textContent).not.toContain("weekView");
    expect(container.innerHTML).not.toContain("sm:hidden");
    expect(container.innerHTML).not.toContain("sm:flex");
  });

  it("옛 색 · 글자 · 모서리 클래스와 rem 크기 클래스가 없다", () => {
    render(
      [event(1)],
      [
        event(2, {
          isAllDay: true,
          startDate: "2026-10-19T00:00:00",
          endDate: "2026-10-21T23:59:59",
        }),
      ],
    );
    const bad: string[] = [];
    container.querySelectorAll("[class]").forEach((el) => {
      const cls = el.getAttribute("class") ?? "";
      cls.split(/\s+/).forEach((c) => {
        if (OLD_CLASSES.test(c)) bad.push(c);
        if (/^(?:[\w-]+:)*(?:size|h|w|min-h|min-w)-\d+(?:\.\d+)?$/.test(c))
          bad.push(c);
      });
    });
    expect(bad).toEqual([]);
  });
});

describe("주 보기 스켈레톤", () => {
  it("펄스가 없고 ds Skeleton 이다", () => {
    act(() => root.render(<CalendarWeekViewSkeleton />));
    expect(container.innerHTML).not.toContain("animate-pulse");
    expect(container.innerHTML).not.toContain("bg-muted");
    expect(
      container.querySelectorAll("[data-slot=skeleton]").length,
    ).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain("sm:hidden");
  });
});
