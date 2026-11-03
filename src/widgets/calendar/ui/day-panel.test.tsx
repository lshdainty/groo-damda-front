// 그날 패널 · 그날 목록 카드 (I-09 16 · 17)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEvent } from "@/widgets/calendar/model/interfaces";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) =>
      o?.count != null ? `${k}:${o.count}` : k,
    i18n: { language: "ko" },
  }),
}));

const { DayPanel } = await import("./day-panel");
const { i18n: appI18n } = await import("@/shared/i18n/config");

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await appI18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0, 0));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const event = (id: number, over: Partial<IEvent> = {}): IEvent => ({
  id,
  startDate: "2026-10-22T10:00:00",
  endDate: "2026-10-22T11:00:00",
  title: `일정 ${id}`,
  description: "",
  color: "#2c70bf",
  isAllDay: false,
  sourceType: "calendar",
  eventType: null,
  calendarRowId: 1,
  calendarName: "내 캘린더",
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

const render = (
  events: IEvent[],
  loading = false,
  date = new Date(2026, 9, 22),
) => {
  const fns = { onAdd: vi.fn(), onTapEvent: vi.fn() };
  act(() =>
    root.render(
      <DayPanel date={date} events={events} loading={loading} {...fns} />,
    ),
  );
  return fns;
};

describe("그날 패널", () => {
  it('머리 날 · 오늘이면 "오늘" · 일정 수 · "추가"', () => {
    render([event(1), event(2)]);
    const panel = container.querySelector("[data-slot=day-panel]")!;
    expect(panel.querySelector("h2")!.textContent).toContain("10월 22일 (목)");
    expect(panel.querySelector("h2")!.textContent).toContain("panel.today");
    expect(panel.textContent).toContain("panel.count:2");
  });

  it('오늘이 아니면 "오늘" 표시가 없다', () => {
    render([], false, new Date(2026, 9, 23));
    expect(container.querySelector("h2")!.textContent).not.toContain(
      "panel.today",
    );
  });

  it('"추가" 를 누르면 그 날로 폼을 연다', () => {
    const fns = render([]);
    const add = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "add",
    )!;
    act(() => add.click());
    expect(fns.onAdd).toHaveBeenCalledTimes(1);
  });

  it("빈 날은 해요체 한 줄 안내 · 줄 목록이 없다", () => {
    render([]);
    expect(
      container.querySelector("[data-slot=day-panel-empty]")!.textContent,
    ).toBe("noEvents");
    expect(container.querySelector("[data-slot=list-item]")).toBeNull();
  });

  it("일정 줄을 누르면 상세로 간다 · 공휴일 줄은 보기만 한다", () => {
    const fns = render([
      event(1, { sourceType: "holiday", title: "한글날", isAllDay: true }),
      event(2),
    ]);
    const rows = container.querySelectorAll("[data-slot=list-item]");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector("button")).toBeNull();
    act(() => rows[1]!.querySelector<HTMLButtonElement>("button")!.click());
    expect(fns.onTapEvent).toHaveBeenCalledTimes(1);
  });

  it("불러오는 중에는 줄 자리만 스켈레톤이다(머리는 그대로)", () => {
    render([], true);
    expect(container.querySelector("h2")).not.toBeNull();
    expect(container.querySelector("[data-slot=day-panel-empty]")).toBeNull();
  });
});

describe("그날 패널 상세 단계 (I-09b 15 · 2-A)", () => {
  const detail = (over: Partial<IEvent> = {}, canEdit = true) => {
    const fns = {
      onAdd: vi.fn(),
      onTapEvent: vi.fn(),
      onBack: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    };
    const e = event(2, { title: "분기 회고", location: "본사", ...over });
    act(() =>
      root.render(
        <DayPanel
          date={new Date(2026, 9, 22)}
          events={[e]}
          loading={false}
          detail={e}
          canEdit={canEdit}
          {...fns}
        />,
      ),
    );
    return { fns, e };
  };
  const panel = () => container.querySelector("[data-slot=day-panel]")!;
  const byText = (text: string) =>
    [...panel().querySelectorAll("button")].find(
      (b) => b.textContent === text,
    ) as HTMLButtonElement;

  it('머리는 "‹ 10월 22일 (목)" 글 단추 — 눌러 목록으로 돌아간다. 목록 머리(추가 · 일정 수)는 없다', () => {
    const { fns } = detail();
    const back = panel().querySelector<HTMLButtonElement>("button")!;
    expect(back.textContent).toBe("10월 22일 (목)");
    expect(back.getAttribute("aria-label")).toBe("panel.backToList");
    expect(back.className).toContain("font-bold");
    expect(panel().querySelector("svg")).not.toBeNull();
    expect(panel().textContent).not.toContain("panel.count");
    act(() => back.click());
    expect(fns.onBack).toHaveBeenCalledTimes(1);
  });

  it("본문은 같은 상세 본문 부품(패널 자리) — 제목 · 장소 줄이 보이고 제목이 초점을 받는다", () => {
    detail();
    expect(
      panel().querySelector("[data-slot=event-detail-head]")!.className,
    ).toContain("pr-x5");
    expect(panel().textContent).toContain("분기 회고");
    expect(panel().textContent).toContain("본사");
    expect(document.activeElement).toBe(
      panel().querySelector("[data-slot=event-detail-title]"),
    );
  });

  it("본문만 스크롤하고 끝 흐림이 늘 켜져 있다 — 머리 · 바닥은 스크롤 밖", () => {
    detail();
    const fog = panel().querySelector("[data-slot=scroll-fog]")!;
    expect(fog.getAttribute("data-use")).toBe("overlayBody");
    expect(fog.className).toContain("overflow-y-auto");
    expect(
      fog.contains(panel().querySelector("[data-slot=day-panel-footer]")),
    ).toBe(false);
  });

  it("바닥 [삭제][수정] — 위에 1px 선, 누르면 그 일정을 알린다", () => {
    const { fns, e } = detail();
    const footer = panel().querySelector("[data-slot=day-panel-footer]")!;
    expect(footer.className).toContain("border-t");
    act(() => byText("delete").click());
    expect(fns.onDelete).toHaveBeenCalledWith(e);
    act(() => byText("edit").click());
    expect(fns.onEdit).toHaveBeenCalledWith(e);
  });

  it("읽기 전용이면 바닥 자체가 없다", () => {
    detail({}, false);
    expect(panel().querySelector("[data-slot=day-panel-footer]")).toBeNull();
  });

  it("패널 안에서 Esc 는 목록으로", () => {
    const { fns } = detail();
    act(() => {
      panel().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(fns.onBack).toHaveBeenCalledTimes(1);
  });
});
