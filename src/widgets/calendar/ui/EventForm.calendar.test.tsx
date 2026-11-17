// 일정 만들기·편집의 **캘린더 선택 목록**을 고정한다.
//
// 캘린더 목록에서 끈(숨긴) 캘린더는 "지금 안 본다" 는 뜻이라 새 일정을 넣을 자리가 아니다 —
// 그래서 고르는 목록에서 뺀다. 목록만 거르고 **기본 선택**을 그대로 두면 기본 캘린더가
// 숨겨져 있을 때 목록에 없는 값이 선택돼 있는 상태가 되므로 두 자리를 같이 잠근다.
//
// **예외가 하나 있다.** 편집 중인 일정이 이미 숨긴 캘린더에 있으면 그 캘린더 하나는 남긴다.
// 안 그러면 그 일정을 여는 순간 선택칸이 비고, 사용자가 캘린더를 건드리지도 않았는데
// 저장 때 다른 캘린더로 옮겨질 길이 열린다 — 안 건드린 값이 조용히 바뀌는 게 제일 나쁘다.
//
// 보임 판정은 `calendar-provider` 의 `isCalendarVisible` 과 **같은 규칙**이다(못 찾으면 보임).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  click,
  lastButton,
  row,
  rowText,
  setValue,
  setupFormDom,
} from "./event-form/test-utils";
import type {
  CalendarEvent,
  CalendarEventFormValues,
} from "@/entities/calendar";
import type { UserCalendar } from "@/entities/user-calendar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// `vi.mock` 은 import 위로 끌어올려진다 — 훅이 매 렌더 읽어 갈 상자를 같이 끌어올린다.
const mocks = vi.hoisted(() => ({ calendars: [] as UserCalendar[] }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/user-calendar", () => ({
  useUserCalendars: () => ({ data: mocks.calendars }),
}));

const { EventForm } = await import("./EventForm");

const calendar = (
  rowId: number,
  calendarName: string,
  over: Partial<UserCalendar> = {},
): UserCalendar => ({
  rowId,
  ownerRowId: 1,
  ownerName: "나",
  calendarName,
  color: "#2c70bf",
  sortOrder: rowId,
  isDefault: false,
  isVisible: true,
  inviteCode: null,
  isShared: false,
  isOwner: true,
  myRole: "OWNER",
  memberCount: 1,
  ...over,
});

const WORK = calendar(1, "업무", { isDefault: true });
const HIDDEN = calendar(2, "숨긴캘린더", { isVisible: false });
const PRIVATE = calendar(3, "개인");

/** 숨긴 캘린더(2번)에 든 일정. */
const eventInHidden: CalendarEvent = {
  rowId: 7,
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
  calendarRowId: 2,
  calendarName: "숨긴캘린더",
  calendarColor: "#2c70bf",
  createAt: "2026-09-01T00:00:00",
  modifyAt: "2026-09-01T00:00:00",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom 엔 ResizeObserver 가 없다 — radix ToggleGroup(roving focus)이 이걸 부른다.
  setupFormDom();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.calendars = [];
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

/** 줄에 보이는 값 = 지금 선택된 캘린더 */
const triggerText = () => rowText("form.calendar");

/** 캘린더 줄을 눌러 고르기 시트를 열고 항목(하나 고르기 줄)을 읽는다 */
function openCalendarOptions(): HTMLElement[] {
  click(row("form.calendar"));
  return [...document.body.querySelectorAll<HTMLElement>("[role='radio']")];
}

const optionTexts = () => openCalendarOptions().map((o) => o.textContent ?? "");

/** 열린 목록에서 고른 줄 — 체크 줄은 aria-checked 로 알린다 */
const checkedOptionText = () =>
  openCalendarOptions().find((o) => o.getAttribute("aria-checked") === "true")
    ?.textContent ?? null;

/** 제목은 필수라 저장이 안 나간다 */
function typeTitle(value: string) {
  const el = document.body.querySelector<HTMLInputElement>(`[name="title"]`);
  if (!el) throw new Error("제목 입력칸을 찾지 못했다");
  setValue(el, value);
}

let sent: CalendarEventFormValues | null;

function render(event: CalendarEvent | null) {
  sent = null;
  act(() =>
    root.render(
      <EventForm
        event={event}
        onSubmit={(v) => {
          sent = v;
        }}
        onClose={() => {}}
      />,
    ),
  );
}

async function save(): Promise<CalendarEventFormValues> {
  const btn = lastButton("save");
  // react-hook-form 의 handleSubmit 은 비동기다 — 넘어가면 페이로드가 아직 없다.
  await act(async () => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  if (!sent) throw new Error("onSubmit 이 불리지 않았다");
  return sent;
}

describe("새로 만들 때 — 숨긴 캘린더는 목록에 없다", () => {
  it("숨긴 캘린더가 고를 목록에서 빠진다", () => {
    mocks.calendars = [WORK, HIDDEN, PRIVATE];
    render(null);
    const texts = optionTexts();
    expect(texts).toHaveLength(2);
    expect(texts.join("|")).toContain("업무");
    expect(texts.join("|")).toContain("개인");
    expect(texts.join("|")).not.toContain("숨긴캘린더");
  });

  // 기본 캘린더가 없으면 목록 맨 앞이 잡힌다 — 그 자리가 숨긴 캘린더면 새 일정이 거기로 간다.
  it("맨 앞이 숨긴 캘린더여도 저장 본문엔 보이는 것이 실린다", async () => {
    mocks.calendars = [HIDDEN, PRIVATE];
    render(null);
    typeTitle("새 일정");
    expect((await save()).calendarRowId).toBe(3);
  });
});

describe("편집할 때 — 그 일정이 든 숨긴 캘린더 하나는 남는다", () => {
  it("숨긴 캘린더의 일정을 열면 그 캘린더가 목록에 남고 선택돼 있다", () => {
    mocks.calendars = [WORK, HIDDEN, PRIVATE];
    render(eventInHidden);
    const texts = optionTexts();
    // 남는 건 딱 그 하나 — 다른 숨긴 캘린더까지 돌아오면 거른 의미가 없다.
    expect(texts).toHaveLength(3);
    expect(texts.join("|")).toContain("숨긴캘린더");
    expect(checkedOptionText()).toContain("숨긴캘린더");
    expect(triggerText()).toContain("숨긴캘린더");
  });

  it("캘린더 칸을 건드리지 않고 저장하면 그 캘린더 그대로 나간다", async () => {
    mocks.calendars = [WORK, HIDDEN, PRIVATE];
    render(eventInHidden);
    expect((await save()).calendarRowId).toBe(2);
  });

  it("예외는 그 일정의 캘린더 하나뿐 — 다른 숨긴 캘린더는 그대로 빠진다", () => {
    const otherHidden = calendar(4, "다른숨김", { isVisible: false });
    mocks.calendars = [WORK, HIDDEN, PRIVATE, otherHidden];
    render(eventInHidden);
    expect(optionTexts().join("|")).not.toContain("다른숨김");
  });
});

describe("기본 캘린더는 꺼져 있어도 고를 수 있다", () => {
  // 규칙은 `entities/user-calendar` 의 `isCalendarShown` 하나다 — 목록·필터·이 폼이 같이 쓴다.
  // 기본 캘린더를 못 숨기게 막은 뒤로도 `isVisible='N'` 인 옛 행이 남아 있을 수 있는데,
  // 그 행을 여기서만 빼면 달력엔 보이는 캘린더가 일정 폼에선 사라진다.
  it("꺼져 있는 기본 캘린더도 목록에 남는다", () => {
    mocks.calendars = [
      calendar(1, "업무", { isDefault: true, isVisible: false }),
      PRIVATE,
    ];
    render(null);
    expect(optionTexts().join("|")).toContain("업무");
  });

  it("꺼져 있어도 기본 캘린더가 기본 선택으로 잡힌다", () => {
    mocks.calendars = [
      calendar(1, "업무", { isDefault: true, isVisible: false }),
      PRIVATE,
    ];
    render(null);
    expect(triggerText()).toContain("업무");
    expect(checkedOptionText()).toContain("업무");
  });

  it("저장 본문에도 그 기본 캘린더가 실린다", async () => {
    mocks.calendars = [
      calendar(1, "업무", { isDefault: true, isVisible: false }),
      PRIVATE,
    ];
    render(null);
    typeTitle("새 일정");
    expect((await save()).calendarRowId).toBe(1);
  });
});

describe("경계", () => {
  // `calendar-provider.tsx` 의 `isCalendarVisible` 과 같은 규칙 — 값이 없으면 보임이다.
  it("isVisible 이 비어 있으면 보이는 것으로 친다", () => {
    const unknown = {
      ...calendar(5, "값없음"),
      isVisible: undefined,
    } as unknown as UserCalendar;
    mocks.calendars = [unknown];
    render(null);
    expect(optionTexts().join("|")).toContain("값없음");
  });

  // 이미 있던 계약과 같은 자리다 — 고를 게 없으면 값을 지어내지 않는다. 줄은 남고 "불러오지 못했어요" 를 알린다(I-09 24).
  it("전부 숨겨도 줄은 남고 값은 지어내지 않는다", () => {
    mocks.calendars = [
      calendar(1, "업무", { isDefault: true, isVisible: false }),
    ];
    // 기본 캘린더는 꺼져 있어도 목록에 남으니(위) 고를 게 아예 없는 경우는 캘린더가 0 개일 때다
    mocks.calendars = [];
    render(null);
    expect(triggerText()).toContain("form.calendarLoadFailed");
  });
});

// 고르기 시트의 고른 줄 체크 — 스펙(select.md · DESIGN.md "선 굵기와 상태"): fg-neutral + 선 2.5(줄 값 색을 물려받아 옅고 가늘던 것)
describe("고르기 시트의 체크 표시", () => {
  it("고른 줄 뒤 체크는 선 2.5 · fg-neutral 이다", () => {
    mocks.calendars = [WORK, PRIVATE];
    render(null);
    click(row("form.calendar"));
    const checked = document.body.querySelector<HTMLElement>(
      "[role='radio'][aria-checked='true']",
    )!;
    const mark = checked.closest("li")!.querySelector("svg")!;
    expect(mark.getAttribute("stroke-width")).toBe("2.5");
    expect(mark.getAttribute("class")).toContain("text-fg-neutral");
    expect(mark.getAttribute("class")).not.toContain("subtle");
  });
});
