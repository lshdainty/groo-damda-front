// 일정 편집이 **무엇을 보내는가** 를 고정한다 (QA #109 · #112).
//
// 이 화면의 저장 본문은 규칙 하나로 만든다 —
// **화면이 가진 칸은 지금 상태를 싣고, 비었으면 `null`.**
// 수정(PUT)은 세 갈래이므로(`Patch`: 키 없음=유지 · `null`=지움 · 값=교체, QA #96)
// 비운 칸을 `undefined` 로 빼면 서버가 "안 고쳤다" 로 읽어 옛 값이 그대로 남는다.
//
// 알림만 계약이 다르다 — 목록을 통째로 바꾸는 칸이라
// **미전달=미변경 · `[]`=전부 해제 · 리스트=교체**(`CalendarEventServiceImpl.syncReminders`).
//
// 반대편도 잠근다 — 채워 둔 값은 그대로 나가야 한다. 안 그러면 "일정은 늘 null 을
// 보낸다" 같은 잘못된 수정이 통과한다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  choice,
  click,
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
import type { EventLabel } from "@/entities/event-label";

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

/** 알림 15분·1일 전이 걸린 일정. 널 허용 칸은 전부 비어 있다. */
const event: CalendarEvent = {
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
  reminders: [
    {
      rowId: 1,
      eventRowId: 3,
      reminderType: "PUSH",
      minutesBefore: 15,
      isSent: false,
    },
    {
      rowId: 2,
      eventRowId: 3,
      reminderType: "PUSH",
      minutesBefore: 1440,
      isSent: false,
    },
  ],
  calendarRowId: null,
  calendarName: null,
  calendarColor: null,
  createAt: "2026-09-01T00:00:00",
  modifyAt: "2026-09-01T00:00:00",
};

const labels: EventLabel[] = [
  { rowId: 9, userRowId: 1, labelName: "출장", color: "#2c70bf", sortOrder: 0 },
];

/** 널 허용 칸이 전부 차 있는 일정 — 하나씩 비워 지워지는지 본다. */
const filled: CalendarEvent = {
  ...event,
  description: "분기 점검 항목 확인",
  location: "본사 3층",
  rrule: "FREQ=WEEKLY",
  labelRowId: 9,
  labelName: "출장",
  labelColor: "#2c70bf",
  reminders: [],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupFormDom();
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

async function submit(
  target: CalendarEvent,
  before?: () => void,
): Promise<CalendarEventFormValues> {
  let sent: CalendarEventFormValues | null = null;
  act(() =>
    root.render(
      <EventForm
        event={target}
        labels={labels}
        onSubmit={(v) => {
          sent = v;
        }}
        onClose={() => {}}
      />,
    ),
  );
  before?.();
  // react-hook-form 의 handleSubmit 은 비동기다 — 넘어가면 페이로드가 아직 없다.
  await act(async () => {
    lastButton("save").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
  if (!sent) throw new Error("onSubmit 이 불리지 않았다");
  return sent;
}

/** 장소 · 설명 — 줄을 눌러 한 단계 들어가 글을 바꾸고 "완료" 로 넣는다 */
function editStep(
  titleKey: "form.location" | "form.description",
  value: string,
) {
  click(row(titleKey));
  setValue(stepInput(), value);
  click(lastButton("done"));
}

/** 하나 고르기 시트 — 줄을 누르고 항목을 누르면 바로 넣고 닫힌다 */
function pick(titleKey: string, optionKey: string) {
  click(row(titleKey));
  click(choice(optionKey));
}

describe("알림 (QA #109)", () => {
  it("전부 끄면 빈 배열이 나간다 — 키를 빼면 옛 알림이 남는다", async () => {
    const sent = await submit(event, () => {
      click(row("form.reminder"));
      const on = [
        ...document.body.querySelectorAll<HTMLElement>("[role=checkbox]"),
      ].filter((c) => c.getAttribute("aria-checked") === "true");
      expect(on).toHaveLength(2); // 15분 · 1일
      for (const el of on) click(el);
      click(lastButton("done"));
    });
    expect(sent.reminderMinutes).toEqual([]);
  });

  it("고른 알림은 그대로 나간다", async () => {
    const sent = await submit(event);
    expect(sent.reminderMinutes).toEqual([15, 1440]);
  });

  it('고르는 동안 줄 값은 그대로이고 "완료" 에 들어간다', async () => {
    await submit(event, () => {
      click(row("form.reminder"));
      const first = document.body.querySelector<HTMLElement>(
        "[role=checkbox][aria-checked=false]",
      )!;
      click(first);
      expect(rowText("form.reminder")).not.toContain("reminder.5min");
      click(lastButton("done"));
      expect(rowText("form.reminder")).toContain("reminder.5min");
    });
  });
});

// desk-back #325 가 이 칸들을 `Optional` 로 옮겼다 — 그전엔 서버가 무조건 덮어써
// **우연히** 지워졌는데, 이제 안 보낸 칸은 유지다. 웹이 `|| undefined` 로 키째 빼는
// 바람에 비우고 저장해도 안 지워졌다.
describe("비운 칸은 지워진다 (QA #112)", () => {
  it("설명을 비우면 null 이 나간다 — 키를 빼면 옛 설명이 남는다", async () => {
    const sent = await submit(filled, () => editStep("form.description", ""));
    expect(sent).toHaveProperty("description", null);
  });

  it("장소를 비우면 null 이 나간다 — 키를 빼면 옛 장소가 남는다", async () => {
    const sent = await submit(filled, () => editStep("form.location", ""));
    expect(sent).toHaveProperty("location", null);
  });

  it("'반복 안 함' 을 고르면 null 이 나간다 — 키를 빼면 반복이 안 풀린다", async () => {
    const sent = await submit(filled, () => {
      expect(rowText("form.recurrence")).toContain("recurrence.weekly");
      pick("form.recurrence", "recurrence.none");
    });
    expect(sent).toHaveProperty("rrule", null);
  });

  it("'라벨 없음' 을 고르면 null 이 나간다 — 키를 빼면 옛 라벨이 붙어 있다", async () => {
    const sent = await submit(filled, () => pick("form.label", "form.noLabel"));
    expect(sent).toHaveProperty("labelRowId", null);
  });

  it("라벨이 없던 일정도 null 을 싣는다 — 키를 빼면 계약이 갈린다", async () => {
    const sent = await submit(event);
    expect(sent).toHaveProperty("labelRowId", null);
  });
});

describe("고른 값을 싣는다", () => {
  it("반복을 고르면 rrule 이 나간다", async () => {
    const sent = await submit(event, () =>
      pick("form.recurrence", "recurrence.monthly"),
    );
    expect(sent).toHaveProperty("rrule", "FREQ=MONTHLY");
  });

  it("라벨을 고르면 labelRowId 가 나간다", async () => {
    const sent = await submit(event, () => pick("form.label", "출장"));
    expect(sent).toHaveProperty("labelRowId", 9);
  });

  it('장소를 넣고 "완료" 하면 그 글이 나간다', async () => {
    const sent = await submit(event, () =>
      editStep("form.location", "치과 3층"),
    );
    expect(sent).toHaveProperty("location", "치과 3층");
  });
});

// 고른 줄을 다시 누르면 아무것도 안 바꾸고 닫힌다(select.md:91) — 안 그러면 원래 RRULE 이 덮인다
describe("고른 반복을 다시 눌러도 원래 규칙이 남는다", () => {
  it('BYDAY 가 든 매주 규칙에서 체크된 "매주" 를 다시 눌러도 그대로 나간다', async () => {
    const sent = await submit(
      { ...filled, rrule: "FREQ=WEEKLY;BYDAY=MO,WE" },
      () => pick("form.recurrence", "recurrence.weekly"),
    );
    expect(sent).toHaveProperty("rrule", "FREQ=WEEKLY;BYDAY=MO,WE");
  });

  it('다섯 밖 규칙("반복 안 함" 으로 보임)에서 "반복 안 함" 을 눌러도 규칙이 풀리지 않는다', async () => {
    const sent = await submit(
      { ...filled, rrule: "FREQ=HOURLY;INTERVAL=2" },
      () => pick("form.recurrence", "recurrence.none"),
    );
    expect(sent).toHaveProperty("rrule", "FREQ=HOURLY;INTERVAL=2");
  });

  it("다른 값을 고르면 그 값으로 바뀐다", async () => {
    const sent = await submit(
      { ...filled, rrule: "FREQ=WEEKLY;BYDAY=MO,WE" },
      () => pick("form.recurrence", "recurrence.monthly"),
    );
    expect(sent).toHaveProperty("rrule", "FREQ=MONTHLY");
  });
});

describe("채워 둔 값은 그대로 나간다", () => {
  it("손대지 않은 설명·장소·반복·라벨은 값 그대로다", async () => {
    const sent = await submit(filled);
    expect(sent).toMatchObject({
      description: "분기 점검 항목 확인",
      location: "본사 3층",
      rrule: "FREQ=WEEKLY",
      labelRowId: 9,
    });
  });

  it("색은 늘 지금 값이 나간다 — 비울 칸이 없어 지울 일도 없다", async () => {
    const sent = await submit(filled);
    expect(sent.color).toBe("#2c70bf");
  });
});

// 이 칸만 서버가 `Optional` 이 아니다 — 맨 `Long` 이라 "null 이면 안 옮긴다" 로 읽는다
// (`CalendarEventServiceImpl.updateEvent`). 키를 빼든 null 을 싣든 결과가 같고,
// 화면에도 '캘린더 없음' 이 없어 비울 수가 없다. 그래서 미전달 그대로 둔다.
describe("캘린더는 미전달 그대로다", () => {
  it("고를 캘린더가 없으면 값을 지어내지 않는다", async () => {
    const sent = await submit(filled);
    expect(sent.calendarRowId).toBeUndefined();
  });
});

// 일정마다 고르는 색 칸은 없다(사용자 결정 2026-09-25) — 화면은 라벨·캘린더 색으로 칠해서
// 고른 색이 한 번도 보이지 않았다(QA 30 12).
describe("색상 칸 (QA 30 12)", () => {
  it("일정 폼에 색상 칸이 없다", async () => {
    act(() =>
      root.render(
        <EventForm
          event={null}
          labels={labels}
          onSubmit={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    await tick();
    expect(document.body.textContent).not.toContain("form.color");
  });
});
