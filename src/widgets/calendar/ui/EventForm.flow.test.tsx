// 일정 폼의 날짜 · 시각 **고르기 흐름** (I-09 26 — 지난 `EventForm.typing.test.tsx` 를 바꿨다).
//
// 날짜 · 시각 칸은 이제 치는 칸이 아니라 조각 버튼이다 — 누르면 Date Picker · Time Picker 시트가 뜨고 "완료" 에 값이 들어간다.
// 그래서 지난 시험이 지키던 "키를 누르는 동안의 미완성 값이 시각에 이어 붙고 종료가 NaN 이 된다"(2026-09-28 QA) 는 일은
// 칸이 완성된 값만 받는 구조로 없어졌다. 대신 이 시험이 잠그는 것:
//   · 고르는 동안은 줄 값이 그대로이고 "완료" 에 들어간다
//   · 시작을 끝 뒤로 옮기면 끝이 밀린다(종일은 같은 날, 시각이 있으면 시작 + 1시간)
//   · 저장을 눌러야 오류를 알린다 — 제목이 비었거나 끝이 시작보다 빠르면 보내지 않는다
//   · 열린 표면(dialog) 수가 하나씩만 겹친다(폼 시트 + 고르기 시트)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  click,
  field,
  lastButton,
  row,
  rowText,
  setValue,
  setupFormDom,
  stepInput,
  tick,
} from "./event-form/test-utils";
import type {
  CalendarEvent,
  CalendarEventFormValues,
} from "@/entities/calendar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/user-calendar", () => ({
  useUserCalendars: () => ({ data: [] }),
}));

const { EventForm } = await import("./EventForm");

const timed: CalendarEvent = {
  rowId: 3,
  title: "정기 점검",
  description: null,
  eventType: "PERSONAL",
  color: "#2c70bf",
  startDate: "2026-09-10T10:00:00",
  endDate: "2026-09-10T11:00:00",
  isAllDay: false,
  labelRowId: null,
  labelName: null,
  labelColor: null,
  location: null,
  rrule: null,
  recurrenceId: null,
  isException: false,
  reminders: [],
  calendarRowId: null,
  calendarName: null,
  calendarColor: null,
  createAt: "2026-09-01T00:00:00",
  modifyAt: "2026-09-01T00:00:00",
};
const allDay: CalendarEvent = {
  ...timed,
  isAllDay: true,
  startDate: "2026-09-10T00:00:00",
  endDate: "2026-09-10T23:59:59",
};

let container: HTMLDivElement;
let root: Root;
let sent: CalendarEventFormValues[];
let closed: number;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupFormDom();
  sent = [];
  closed = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

const show = (event: CalendarEvent | null, date?: Date) =>
  act(() =>
    root.render(
      <EventForm
        event={event}
        selectedDate={date}
        onSubmit={(v) => sent.push(v)}
        onClose={() => closed++}
      />,
    ),
  );

const dialogs = () =>
  [...document.querySelectorAll("[role=dialog]")].filter(
    (d) => d.getAttribute("aria-hidden") !== "true",
  ).length;

/** 시작 날짜 조각 — 아래 이름은 "시작 날짜, 날짜 글" 이다 */
const piece = (key: string) =>
  [...document.body.querySelectorAll("button")].find((b) =>
    b.getAttribute("aria-label")?.startsWith(key),
  )!;

const pickDay = (iso: string) =>
  click(
    document.body.querySelector<HTMLButtonElement>(
      `button[data-date="${iso}"]`,
    )!,
  );

async function save() {
  await act(async () => {
    lastButton("save").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
}

describe("날짜 조각 → Date Picker 시트", () => {
  it("누르면 폼 위에 고르기 시트가 뜨고, 고르는 동안 줄 값은 그대로다", () => {
    show(timed);
    expect(dialogs()).toBe(1);
    const before = piece("form.startDay").textContent;
    click(piece("form.startDay"));
    expect(dialogs()).toBe(2);
    pickDay("2026-09-12");
    expect(piece("form.startDay").textContent).toBe(before);
  });

  it('"완료" 에 들어가고, 끝이 시작보다 앞서면 끝이 시작 + 1시간으로 밀린다', async () => {
    show(timed);
    click(piece("form.startDay"));
    pickDay("2026-09-12");
    click(lastButton("done"));
    await tick();
    expect(piece("form.startDay").getAttribute("aria-label")).toContain(
      "9월 12일",
    );
    // 종료도 12일 11:00 으로 따라왔다
    expect(piece("form.endDay").getAttribute("aria-label")).toContain(
      "9월 12일",
    );
    expect(piece("form.endTime").getAttribute("aria-label")).toContain("11:00");
  });

  it("종일은 시각 조각이 없고, 시작을 끝 뒤로 옮기면 끝이 같은 날로 따라온다", async () => {
    show(allDay);
    expect(
      document.body.querySelector("[aria-label^='form.startTime']"),
    ).toBeNull();
    click(piece("form.startDay"));
    pickDay("2026-09-14");
    click(lastButton("done"));
    await tick();
    expect(piece("form.endDay").getAttribute("aria-label")).toContain(
      "9월 14일",
    );
  });

  it("끝은 시작을 밀지 않는다 — 끝만 앞으로 옮기면 저장에서 오류로 알린다", async () => {
    show(timed);
    click(piece("form.endDay"));
    pickDay("2026-09-08");
    click(lastButton("done"));
    await tick();
    await save();
    expect(sent).toHaveLength(0);
    expect(document.body.textContent).toContain("form.endBeforeStart");
  });
});

describe("날짜 시트는 한 달이다 (date-picker.md:61 · :110)", () => {
  it("시작 날짜 시트가 이어지는 달이 아니라 한 달의 달력이다", () => {
    show(timed);
    click(piece("form.startDay"));
    expect(document.querySelectorAll("[role=grid]")).toHaveLength(1);
  });
});

describe("저장은 켜 두고 누를 때 알린다 (field.md:86)", () => {
  it("저장 버튼은 끄지 않는다 — 제목이 비어도, 끝이 시작보다 빨라도", async () => {
    show(timed);
    setValue(field("title"), "");
    expect(lastButton("save").disabled).toBe(false);
  });

  it("제목이 비어 있으면 누를 때 칸 아래 오류가 뜨고 보내지 않는다", async () => {
    show(null, new Date(2026, 8, 10));
    expect(document.body.textContent).not.toContain("form.titleRequired");
    await save();
    expect(sent).toHaveLength(0);
    expect(document.body.textContent).toContain("form.titleRequired");
  });

  it("제목을 채우면 그대로 나간다", async () => {
    show(null, new Date(2026, 8, 10));
    setValue(field("title"), "새 일정");
    await save();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      title: "새 일정",
      startDate: "2026-09-10",
    });
  });
});

describe("시트 안 한 단계 (I-09 29)", () => {
  it("장소 줄을 누르면 시트가 겹치지 않고 그 시트의 머리가 바뀐다 — 열린 표면 하나", () => {
    show(timed);
    click(row("form.location"));
    expect(dialogs()).toBe(1);
    expect(
      document.querySelector("[data-slot=bottom-sheet-title]")?.textContent,
    ).toBe("form.location");
    expect(
      document.querySelector("[data-slot=bottom-sheet-back]"),
    ).not.toBeNull();
    // 바닥 [저장] 은 이 단계에서 감춘다
    expect(
      [...document.body.querySelectorAll("button")].some(
        (b) => b.textContent === "save",
      ),
    ).toBe(false);
  });

  it('"완료" 는 친 글을 넣고 줄 칸으로 돌아간다', () => {
    show(timed);
    click(row("form.location"));
    setValue(stepInput(), "치과 3층");
    click(lastButton("done"));
    expect(rowText("form.location")).toContain("치과 3층");
    expect(closed).toBe(0);
  });

  const asking = () =>
    document.body.textContent?.includes("작성한 내용이 사라져요");
  const leaveBtn = (label: string) =>
    [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === label,
    )!;
  const back = () =>
    click(
      document.querySelector<HTMLElement>("[data-slot=bottom-sheet-back]")!,
    );
  const esc = () =>
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

  // 친 글이 들어올 때와 같으면 묻지 않는다 · 다르면 묻는다(bottom-sheet.md:109 · :187, 10-29 17-1 Q3)
  it("← 는 글을 안 바꿨으면 묻지 않고 줄 칸으로 돌아간다", async () => {
    show({ ...timed, location: "본사" });
    click(row("form.location"));
    back();
    await tick();
    expect(asking()).toBeFalsy();
    expect(rowText("form.location")).toContain("본사");
    expect(closed).toBe(0);
  });

  it("← 는 글을 바꿨으면 먼저 묻고 [계속 작성] 이면 그 단계에 남는다", async () => {
    show({ ...timed, location: "본사" });
    click(row("form.location"));
    setValue(stepInput(), "버려질 글");
    back();
    await tick();
    expect(asking()).toBe(true);
    click(leaveBtn("계속 작성"));
    await tick();
    expect(
      document.querySelector("[data-slot=bottom-sheet-back]"),
    ).not.toBeNull();
    expect(stepInput().value).toBe("버려질 글");
  });

  it("← 로 물었을 때 [나가기] 는 친 글을 버리고 돌아간다 — 이전 값 그대로", async () => {
    show({ ...timed, location: "본사" });
    click(row("form.location"));
    setValue(stepInput(), "버려질 글");
    back();
    await tick();
    click(leaveBtn("나가기"));
    await tick();
    expect(rowText("form.location")).toContain("본사");
    expect(rowText("form.location")).not.toContain("버려질 글");
    expect(closed).toBe(0);
  });

  it('"완료" 는 묻지 않고 친 글을 넣는다', async () => {
    show(timed);
    click(row("form.location"));
    setValue(stepInput(), "치과 3층");
    click(lastButton("done"));
    await tick();
    expect(asking()).toBeFalsy();
    expect(rowText("form.location")).toContain("치과 3층");
  });

  it("Esc 도 같다 — 안 바꿨으면 한 단계만 돌아가고, 바꿨으면 묻는다. 시트는 닫지 않는다", async () => {
    show(timed);
    click(row("form.description"));
    esc();
    await tick();
    expect(asking()).toBeFalsy();
    expect(rowText("form.description")).toBeTruthy();
    click(row("form.description"));
    setValue(stepInput(), "쓰던 설명");
    esc();
    await tick();
    expect(asking()).toBe(true);
    expect(closed).toBe(0);
  });

  it("기기 뒤로 가기(popstate)도 같다 — 바꿨으면 묻는다", async () => {
    show(timed);
    click(row("form.description"));
    setValue(stepInput(), "쓰던 설명");
    await act(async () => {
      window.history.back();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(asking()).toBe(true);
    expect(closed).toBe(0);
  });

  // 검수 M1 — 물어서 닫지 않았으면 칸을 다시 쌓아야 한다. 안 쌓으면 두세 번째 뒤로 가기가 칸을 소진해 묻지 않고 페이지를 떠난다
  it("기기 뒤로 가기 → [계속 작성] 을 세 번 반복해도 매번 묻고 폼은 열려 있다", async () => {
    show(timed);
    click(row("form.description"));
    setValue(stepInput(), "쓰던 설명");
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        window.history.back();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });
      expect(asking()).toBe(true);
      expect(closed).toBe(0);
      click(leaveBtn("계속 작성"));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });
      expect(asking()).toBeFalsy();
      expect(
        document.querySelector("[data-slot=bottom-sheet-back]"),
      ).not.toBeNull();
      expect(stepInput().value).toBe("쓰던 설명");
    }
  });

  it("안 바꿨으면 뒤로 가기 한 번에 단계만 닫고 묻지 않는다 — 칸을 더 쌓지 않는다", async () => {
    show(timed);
    click(row("form.description"));
    await act(async () => {
      window.history.back();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(asking()).toBeFalsy();
    expect(document.querySelector("[data-slot=bottom-sheet-back]")).toBeNull();
    expect(closed).toBe(0);
  });
});

describe("폼 시트는 바깥으로 닫히지 않는다 (I-09 21)", () => {
  it("딤을 눌러도 닫히지 않는다", () => {
    show(timed);
    const dim = document.querySelector<HTMLElement>(
      "[data-slot=bottom-sheet-overlay]",
    )!;
    act(() => {
      dim.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      dim.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(closed).toBe(0);
  });

  it("바뀐 값이 없으면 닫기가 바로 닫는다", () => {
    show(timed);
    click(
      document.querySelector<HTMLElement>("[data-slot=bottom-sheet-close]")!,
    );
    expect(closed).toBe(1);
  });

  it("바뀐 값이 있으면 닫기 전에 묻는다", async () => {
    show(timed);
    setValue(field("title"), "다른 제목");
    click(
      document.querySelector<HTMLElement>("[data-slot=bottom-sheet-close]")!,
    );
    await tick();
    expect(closed).toBe(0);
    expect(document.body.textContent).toContain("작성한 내용이 사라져요");
  });

  it("수정 폼 바닥에는 [삭제] 와 [저장] 이 있고, 삭제는 부르는 쪽에 넘긴다", () => {
    let deleted = 0;
    act(() =>
      root.render(
        <EventForm
          event={timed}
          onSubmit={() => {}}
          onClose={() => {}}
          onDelete={() => deleted++}
        />,
      ),
    );
    click(lastButton("delete"));
    expect(deleted).toBe(1);
    expect(lastButton("save")).toBeTruthy();
  });
});
