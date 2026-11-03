// 일정 상세가 든 표면 (I-09b 5 · 7 · 8 · 9 · 18) — 그날 시트 안 한 단계(목록 → 상세 → 수정 폼), 태블릿 480 시트, 읽기 전용, 지운 뒤
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import {
  click,
  row as formRow,
  setValue,
  setupFormDom,
} from "../event-form/test-utils";

import type { CalendarEventFormValues } from "@/entities/calendar";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
}));

const updates = vi.hoisted(
  () => [] as { id: number; data: CalendarEventFormValues; silent?: boolean }[],
);
const mocks = vi.hoisted(() => ({
  updateError: false,
  failSave: false,
  resets: 0,
  me: 7,
  roles: { 1: "READ" } as Record<number, string>,
  calendars: [] as unknown[],
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({ data: { rowId: mocks.me } }),
}));
vi.mock("@/features/user-calendar", () => ({
  useUserCalendars: () => ({ data: mocks.calendars }),
}));
vi.mock("@/features/event-label", () => ({
  useEventLabels: () => ({ data: [] }),
}));
vi.mock("@/widgets/calendar/model/useCalendarEvents", () => ({
  useUpdateEvent: () => ({
    mutate: (
      v: { id: number; data: CalendarEventFormValues; silent?: boolean },
      o?: { onSuccess?: () => void },
    ) => {
      updates.push(v);
      if (!mocks.failSave) o?.onSuccess?.();
    },
    isPending: false,
    isError: mocks.updateError,
    reset: () => {
      mocks.resets++;
      mocks.updateError = false;
    },
  }),
}));

const { EventDetailSurface } = await import("./event-detail-surface");
const { i18n: appI18n } = await import("@/shared/i18n/config");

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await appI18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setupFormDom(false);
  __resetPointerBlockForTest();
  updates.length = 0;
  mocks.updateError = false;
  mocks.failSave = false;
  mocks.resets = 0;
  mocks.me = 7;
  mocks.calendars = [
    {
      rowId: 1,
      myRole: "READ",
      color: "#2c70bf",
      calendarName: "내 캘린더",
      isDefault: true,
      isVisible: true,
      isOwner: false,
    },
    {
      rowId: 2,
      myRole: "EDIT",
      color: "#5e60c8",
      calendarName: "팀",
      isDefault: false,
      isVisible: true,
      isOwner: false,
    },
  ];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  // 시트가 닫히며 되감는 히스토리 popstate 가 이 시험 안에서 다 도착하게 한다 — 다음 시험의 뒤로 가기 셈에 번지지 않게
  await new Promise((r) => setTimeout(r, 200));
});

const event = (id: number, over: Partial<IEvent> = {}): IEvent => ({
  id,
  userRowId: 7,
  startDate: "2026-10-22T10:00:00",
  endDate: "2026-10-22T11:00:00",
  title: `일정 ${id}`,
  description: "",
  color: "#2c70bf",
  isAllDay: false,
  sourceType: "calendar",
  eventType: "PERSONAL",
  calendarRowId: 1,
  calendarName: "내 캘린더",
  calendarColor: "#2c70bf",
  labelRowId: null,
  labelName: null,
  labelColor: null,
  location: null,
  rrule: null,
  recurrenceId: null,
  reminders: [],
  ...over,
});

const fns = () => ({
  onClose: vi.fn(),
  onAdd: vi.fn(),
  onRequestDelete: vi.fn(),
});

const phone = (events: IEvent[], f = fns()) => {
  const ui = (list: IEvent[]) => (
    <EventDetailSurface listDate={new Date(2026, 9, 22)} events={list} {...f} />
  );
  act(() => root.render(ui(events)));
  return { f, rerender: (list: IEvent[]) => act(() => root.render(ui(list))) };
};

const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]")!;
const dialogs = () => document.querySelectorAll("[role=dialog]");
const title = () =>
  sheet().querySelector("[data-slot=bottom-sheet-title]")!.textContent;
const rows = () => [...sheet().querySelectorAll("button[data-slot=list-body]")];
const press = (el: Element) => click(el);
const pressEsc = () =>
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
const footerButtons = () => [
  ...sheet().querySelectorAll("[data-slot=bottom-sheet-footer] button"),
];

describe("폰 그날 시트 — 목록 → 상세 (5)", () => {
  it('제목은 "M월 d일 (요)", 바닥 "일정 추가", 줄 사이 선 · 꺾쇠 없음, 공휴일 줄은 누르지 못한다', () => {
    phone([
      event(1, { sourceType: "holiday", title: "한글날", isAllDay: true }),
      event(2),
    ]);
    expect(title()).toBe("10월 22일 (목)");
    expect(footerButtons().map((b) => b.textContent)).toEqual(["addEvent"]);
    expect(sheet().querySelector("[data-slot=list-divider]")).toBeNull();
    expect(sheet().querySelector("[data-slot=list-suffix] svg")).toBeNull();
    expect(rows()).toHaveLength(1);
  });

  it("일정 줄을 누르면 같은 시트가 상세로 바뀐다 — 열린 대화상자 수 1, 머리 ← + 일정 상세", () => {
    phone([event(1), event(2)]);
    expect(dialogs()).toHaveLength(1);
    press(rows()[1]!);
    expect(dialogs()).toHaveLength(1);
    expect(title()).toBe("eventDetail");
    expect(
      sheet().querySelector("[data-slot=bottom-sheet-back]"),
    ).not.toBeNull();
    expect(sheet().textContent).toContain("일정 2");
    // 상세에는 일정 색 막대 · 옛 상세 Drawer 가 없다
    expect(document.querySelector("[data-vaul-drawer]")).not.toBeNull();
    expect(
      document.querySelectorAll("[data-slot=bottom-sheet-content]"),
    ).toHaveLength(1);
  });

  it("← 는 그날 목록으로 — 초점은 연 줄에 있다. 닫기는 시트 전체", () => {
    const { f } = phone([event(1), event(2)]);
    press(rows()[1]!);
    press(sheet().querySelector("[data-slot=bottom-sheet-back]")!);
    expect(title()).toBe("10월 22일 (목)");
    expect(dialogs()).toHaveLength(1);
    expect((document.activeElement as HTMLElement).dataset.eventKey).toBe(
      "2|2026-10-22",
    );
    expect(f.onClose).not.toHaveBeenCalled();
    press(rows()[0]!);
    press(sheet().querySelector("[data-slot=bottom-sheet-close]")!);
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc 는 상세에서 목록으로, 목록에서 닫기", () => {
    const { f } = phone([event(1)]);
    press(rows()[0]!);
    pressEsc();
    expect(title()).toBe("10월 22일 (목)");
    expect(f.onClose).not.toHaveBeenCalled();
    pressEsc();
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("수정 · 삭제 버튼은 서버가 허락하는 사람에게만 (7)", () => {
  const open = (e: IEvent) => {
    phone([e]);
    press(rows()[0]!);
  };
  it("읽기 전용 캘린더의 내가 만든 일정에는 있다", () => {
    open(event(1));
    expect(footerButtons().map((b) => b.textContent)).toEqual([
      "delete",
      "edit",
    ]);
  });
  it("읽기 전용 캘린더의 남이 만든 일정에는 바닥 자체가 없다", () => {
    open(event(1, { userRowId: 99 }));
    expect(sheet().querySelector("[data-slot=bottom-sheet-footer]")).toBeNull();
  });
  it("편집 가능 캘린더에서는 남이 만든 일정에도 있다", () => {
    open(event(1, { userRowId: 99, calendarRowId: 2 }));
    expect(footerButtons()).toHaveLength(2);
  });
});

describe("삭제 · 사라진 일정 (8)", () => {
  it("[삭제] 는 부르는 쪽 확인창을 요청한다 — 지워져 목록에서 빠지면 그날 목록 단계로", () => {
    const { f, rerender } = phone([event(1), event(2)]);
    press(rows()[0]!);
    press(footerButtons()[0]!);
    expect(f.onRequestDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
    // 서버가 지운 뒤 목록이 다시 온다
    rerender([event(2)]);
    expect(title()).toBe("10월 22일 (목)");
    expect(rows()).toHaveLength(1);
    expect(f.onClose).not.toHaveBeenCalled();
  });

  it("마지막 일정을 지우면 목록 단계가 빈 날 글을 보인다", () => {
    const { rerender } = phone([event(1)]);
    press(rows()[0]!);
    rerender([]);
    expect(
      sheet().querySelector("[data-slot=day-sheet-empty]")!.textContent,
    ).toBe("noEvents");
  });
});

describe("[수정] → 같은 시트가 수정 폼으로 (9)", () => {
  const toEdit = (events = [event(1, { rrule: "FREQ=WEEKLY" })]) => {
    const r = phone(events);
    press(rows()[0]!);
    press(footerButtons()[1]!);
    return r;
  };

  it("새 시트를 띄우지 않는다 — 열린 대화상자 수 1, 머리 일정 수정, 입력 폼 규칙", () => {
    toEdit();
    expect(dialogs()).toHaveLength(1);
    expect(title()).toBe("editEvent");
    expect(sheet().getAttribute("data-form")).not.toBeNull();
    // 바닥 [삭제][저장]
    expect(footerButtons().map((b) => b.textContent)).toEqual([
      "delete",
      "save",
    ]);
  });

  it("딤을 눌러도 닫히지 않는다 — 조회가 아니라 입력", () => {
    const { f } = toEdit();
    const overlay = document.querySelector("[data-slot=bottom-sheet-overlay]")!;
    act(() => {
      overlay.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(f.onClose).not.toHaveBeenCalled();
    expect(title()).toBe("editEvent");
  });

  it("바뀐 값이 있으면 Esc 가 먼저 묻고, [나가기] 면 상세로 돌아간다", () => {
    toEdit();
    setValue(
      sheet().querySelector<HTMLInputElement>("[name=title]")!,
      "바꾼 제목",
    );
    pressEsc();
    const alert = document.querySelector("[role=alertdialog]");
    expect(alert).not.toBeNull();
    const leave = [...alert!.querySelectorAll("button")].find(
      (b) => b.textContent === "나가기",
    )!;
    press(leave);
    expect(title()).toBe("eventDetail");
    // 바꾼 제목은 저장되지 않았다
    expect(sheet().textContent).toContain("일정 1");
    expect(updates).toHaveLength(0);
  });

  it("바뀐 값이 없으면 Esc 가 바로 상세로 돌아간다", () => {
    toEdit();
    pressEsc();
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(title()).toBe("eventDetail");
  });

  it("[저장] 은 반복 일정이면 연 회차를 싣고, 성공하면 상세로 돌아와 새 값을 보인다", async () => {
    const { rerender } = toEdit();
    setValue(
      sheet().querySelector<HTMLInputElement>("[name=title]")!,
      "바꾼 제목",
    );
    await act(async () => {
      (footerButtons()[1] as HTMLButtonElement).click();
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.id).toBe(1);
    // 실패는 폼 Callout 이 알린다 — 전역 토스트를 끈다
    expect(updates[0]!.silent).toBe(true);
    expect(updates[0]!.data.title).toBe("바꾼 제목");
    expect(updates[0]!.data.occurrenceStartDate).toBe("2026-10-22T10:00:00");
    expect(title()).toBe("eventDetail");
    // 다시 받은 목록의 새 값
    rerender([event(1, { rrule: "FREQ=WEEKLY", title: "바꾼 제목" })]);
    expect(sheet().textContent).toContain("바꾼 제목");
  });

  it("날짜를 옮겨 저장해 그 날 목록에 없으면 그날 목록 단계로", async () => {
    const { rerender } = toEdit([event(1)]);
    await act(async () => {
      (footerButtons()[1] as HTMLButtonElement).click();
    });
    rerender([]);
    expect(title()).toBe("10월 22일 (목)");
  });

  // M-7 — 한 단계 ← 규칙(09-2 후속 PR2)을 상세 → 수정 폼 단계에도 그대로: 단계에 들어올 때 값과 같으면 묻지 않고, 다르면 묻는다
  const asking = () => document.querySelector("[role=alertdialog]");
  const askBtn = (label: string) =>
    [...document.querySelectorAll("[role=alertdialog] button")].find(
      (b) => b.textContent === label,
    )!;
  // 확인창이 닫히는 것(Presence)을 기다린다
  const later = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
  const stepBack = () =>
    press(sheet().querySelector("[data-slot=bottom-sheet-back]")!);
  const titleInput = () =>
    sheet().querySelector<HTMLInputElement>("[name=title]")!;

  it("수정 폼 머리에 ← 가 있다 — 안 바꿨으면 묻지 않고 상세로 돌아간다", async () => {
    toEdit();
    expect(
      sheet().querySelector("[data-slot=bottom-sheet-back]"),
    ).not.toBeNull();
    stepBack();
    expect(asking()).toBeNull();
    expect(title()).toBe("eventDetail");
  });

  it("← 는 바꿨으면 먼저 묻는다 — [계속 작성] 이면 폼에 남고 친 값 그대로, [나가기] 면 상세", async () => {
    toEdit();
    setValue(titleInput(), "바꾼 제목");
    stepBack();
    expect(asking()).not.toBeNull();
    press(askBtn("계속 작성"));
    await later();
    expect(asking()).toBeNull();
    expect(title()).toBe("editEvent");
    expect(titleInput().value).toBe("바꾼 제목");
    stepBack();
    press(askBtn("나가기"));
    await later();
    expect(title()).toBe("eventDetail");
    expect(updates).toHaveLength(0);
  });

  it("바꿨다가 원래 값으로 되돌리면 묻지 않는다 — 들어올 때 값과 같다", async () => {
    toEdit();
    setValue(titleInput(), "바꾼 제목");
    setValue(titleInput(), "일정 1");
    stepBack();
    expect(asking()).toBeNull();
    expect(title()).toBe("eventDetail");
  });

  it("닫기 원은 안 바꿨으면 바로 시트 전체를 닫는다", async () => {
    const { f } = toEdit();
    press(sheet().querySelector("[data-slot=bottom-sheet-close]")!);
    expect(asking()).toBeNull();
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });

  it("바꾼 뒤 닫기 원은 묻는다 — [계속 작성] 이면 닫히지 않는다", async () => {
    const { f } = toEdit();
    setValue(titleInput(), "바꾼 제목");
    press(sheet().querySelector("[data-slot=bottom-sheet-close]")!);
    expect(asking()).not.toBeNull();
    press(askBtn("계속 작성"));
    await later();
    expect(f.onClose).not.toHaveBeenCalled();
    expect(title()).toBe("editEvent");
    press(sheet().querySelector("[data-slot=bottom-sheet-close]")!);
    press(askBtn("나가기"));
    await later();
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });

  it("장소 안 단계의 ← 는 글을 안 바꿨으면 묻지 않고 폼으로, 바꿨으면 묻는다 — 상세로 나가지 않는다", async () => {
    toEdit();
    press(formRow("form.location"));
    expect(title()).toBe("form.location");
    stepBack();
    expect(asking()).toBeNull();
    expect(title()).toBe("editEvent");
    press(formRow("form.location"));
    const input = sheet().querySelector<HTMLInputElement>("input")!;
    setValue(input, "쓰던 장소");
    stepBack();
    expect(asking()).not.toBeNull();
    press(askBtn("나가기"));
    await later();
    expect(title()).toBe("editEvent");
  });

  // 렌더에서만 보이던 회귀 — 폼 칸이 reset 보다 먼저 붙으면 RHF 가 등록을 비워 제목 칸이 빈 채로 열리고 친 값도 안 먹었다
  it("수정 폼은 일정의 제목 · 장소가 채워진 칸으로 열린다 — 빈 칸이 아니다", () => {
    toEdit([event(1, { title: "치과 정기 검진", location: "본사" })]);
    expect(titleInput().value).toBe("치과 정기 검진");
    expect(sheet().textContent).toContain("본사");
  });

  it("열자마자 친 제목이 저장 본문에 실린다", async () => {
    toEdit([event(1)]);
    setValue(titleInput(), "바뀐 제목");
    await act(async () => {
      (footerButtons()[1] as HTMLButtonElement).click();
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data.title).toBe("바뀐 제목");
  });

  // 칸이 reset 보다 먼저 붙으면 RHF 가 등록을 비워 빈 칸 · 안 먹는 값이 된다. 준비 표시(isSyncedWith)가 일정 객체로 가르므로 아래 경우 모두 새로 맞춰진 뒤에 칸이 그려진다
  const saveBtn = () => footerButtons()[1] as HTMLButtonElement;
  const clickSave = () =>
    act(async () => {
      saveBtn().click();
    });
  const openRow = (n: number) => press(rows()[n]!);
  const backToList = () => {
    stepBack(); // 폼 → 상세
    stepBack(); // 상세 → 목록
  };

  it("① 같은 일정을 [수정] → ← → 다시 [수정] 해도 채워진 칸이고, 고쳐 저장한 본문에 새 값이 실린다", async () => {
    toEdit([event(1, { title: "치과", location: "본사" })]);
    expect(titleInput().value).toBe("치과");
    stepBack();
    expect(title()).toBe("eventDetail");
    press(footerButtons()[1]!);
    expect(title()).toBe("editEvent");
    expect(titleInput().value).toBe("치과");
    setValue(titleInput(), "치과 재진");
    await clickSave();
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data.title).toBe("치과 재진");
    expect(updates[0]!.data.location).toBe("본사");
  });

  it("② 제목이 같은 다른 일정 A → B — B 의 값으로 채워지고 B 의 id 로 저장된다", async () => {
    phone([
      event(1, { title: "회의", location: "A동" }),
      event(2, { title: "회의", location: "B동" }),
    ]);
    openRow(0);
    press(footerButtons()[1]!);
    expect(sheet().textContent).toContain("A동");
    backToList();
    expect(title()).toBe("10월 22일 (목)");
    openRow(1);
    press(footerButtons()[1]!);
    expect(titleInput().value).toBe("회의");
    expect(sheet().textContent).toContain("B동");
    expect(sheet().textContent).not.toContain("A동");
    setValue(titleInput(), "회의 2");
    await clickSave();
    expect(updates).toHaveLength(1);
    expect(updates[0]!.id).toBe(2);
    expect(updates[0]!.data.location).toBe("B동");
  });

  it("② 제목을 고치다 나간 뒤 같은 일정을 다시 열면 원래 제목으로 채워진다(고치던 값이 아니다)", () => {
    toEdit([event(1, { title: "치과" })]);
    setValue(titleInput(), "고치다 만 제목");
    stepBack();
    press(askBtn("나가기"));
    expect(title()).toBe("eventDetail");
    press(footerButtons()[1]!);
    expect(titleInput().value).toBe("치과");
  });

  it("③ 저장이 실패한 채(폼에 남음) 다시 저장하면 두 번째 요청에도 고친 값이 실린다", async () => {
    toEdit([event(1, { title: "치과" })]);
    setValue(titleInput(), "치과 재진");
    mocks.failSave = true;
    await clickSave();
    expect(title()).toBe("editEvent");
    expect(titleInput().value).toBe("치과 재진");
    mocks.failSave = false;
    await clickSave();
    expect(updates).toHaveLength(2);
    expect(updates[1]!.data.title).toBe("치과 재진");
    expect(title()).toBe("eventDetail");
  });

  it("③ 저장 성공 뒤 상세 → 다시 [수정] 하면 채워진 칸이고 또 고쳐 저장된다", async () => {
    toEdit([event(1, { title: "치과" })]);
    setValue(titleInput(), "치과 재진");
    await clickSave();
    expect(title()).toBe("eventDetail");
    press(footerButtons()[1]!);
    expect(title()).toBe("editEvent");
    expect(titleInput().value).not.toBe("");
    setValue(titleInput(), "치과 삼진");
    await clickSave();
    expect(updates).toHaveLength(2);
    expect(updates[1]!.data.title).toBe("치과 삼진");
  });

  // W3 — 저장에 실패한 뒤 나갔다 다시 [수정] 하면 시도도 안 했는데 빨간 Callout 이 남던 것
  it("저장 실패 뒤 ← 로 나갔다 다시 [수정] 하면 지난 실패 알림이 없다", async () => {
    const { rerender } = toEdit([event(1)]);
    mocks.updateError = true;
    rerender([event(1)]);
    expect(sheet().querySelector("[role=alert]")).not.toBeNull();
    stepBack();
    expect(title()).toBe("eventDetail");
    press(footerButtons()[1]!);
    expect(mocks.resets).toBeGreaterThan(0);
    expect(title()).toBe("editEvent");
    expect(sheet().querySelector("[role=alert]")).toBeNull();
  });

  it("폼 바닥 [삭제] 는 삭제 확인을 요청한다", () => {
    const { f } = toEdit();
    press(footerButtons()[0]!);
    expect(f.onRequestDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });
});

// W2 — 상세 ↔ 수정 폼에서 시트(바탕 · 딤)가 다시 붙으면 시트가 바닥에서 다시 올라오고 딤이 0 에서 시작한다. 요소가 같아야 "같은 자리에서" 다.
describe("단계가 바뀌어도 시트는 같은 요소다 (I-09b 1-A · W2)", () => {
  const overlay = () =>
    document.querySelector("[data-slot=bottom-sheet-overlay]");
  const body = () => sheet().querySelector("[data-slot=bottom-sheet-body]");

  it("목록 → 상세 → 수정 폼 → 상세 → 목록 내내 시트 · 딤 요소가 그대로다", () => {
    phone([event(1)]);
    const sheetEl = sheet();
    const dim = overlay();
    press(rows()[0]!);
    expect(sheet()).toBe(sheetEl);
    expect(overlay()).toBe(dim);
    press(footerButtons()[1]!);
    expect(title()).toBe("editEvent");
    expect(sheet()).toBe(sheetEl);
    expect(overlay()).toBe(dim);
    press(sheet().querySelector("[data-slot=bottom-sheet-back]")!);
    expect(title()).toBe("eventDetail");
    expect(sheet()).toBe(sheetEl);
    expect(overlay()).toBe(dim);
    press(sheet().querySelector("[data-slot=bottom-sheet-back]")!);
    expect(sheet()).toBe(sheetEl);
    expect(overlay()).toBe(dim);
  });

  it("저장하고 상세로 돌아와도 시트는 그대로다", async () => {
    phone([event(1)]);
    press(rows()[0]!);
    const sheetEl = sheet();
    press(footerButtons()[1]!);
    setValue(sheet().querySelector<HTMLInputElement>("[name=title]")!, "바꾼");
    await act(async () => {
      (footerButtons()[1] as HTMLButtonElement).click();
    });
    expect(title()).toBe("eventDetail");
    expect(sheet()).toBe(sheetEl);
  });

  // W6 — 같은 본문 DOM 이면 목록에서 내린 scrollTop 이 상세까지 따라온다. 단계마다 본문은 새로 그린다
  it("단계가 바뀌면 본문(스크롤 상자)은 새 요소다 — 스크롤이 처음부터 시작한다", () => {
    phone([event(1)]);
    const listBody = body();
    press(rows()[0]!);
    const detailBody = body();
    expect(detailBody).not.toBe(listBody);
    press(footerButtons()[1]!);
    expect(body()).not.toBe(detailBody);
  });
});

describe("태블릿 480 시트 (18) — 돌아갈 목록이 없다", () => {
  const tablet = (e: IEvent[]) => {
    const f = fns();
    act(() =>
      root.render(
        <EventDetailSurface
          events={e}
          start={{ id: 1, day: "2026-10-22" }}
          {...f}
        />,
      ),
    );
    return f;
  };
  it("머리에 ← 가 없고 제목 일정 상세 · 닫기 원이 있다", () => {
    tablet([event(1)]);
    expect(title()).toBe("eventDetail");
    expect(sheet().querySelector("[data-slot=bottom-sheet-back]")).toBeNull();
    expect(
      sheet().querySelector("[data-slot=bottom-sheet-close]"),
    ).not.toBeNull();
  });
  it("Esc 는 시트를 닫는다", () => {
    const f = tablet([event(1)]);
    pressEsc();
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });
  it("[수정] 은 같은 시트가 폼으로 — 열린 대화상자 수 1", () => {
    tablet([event(1)]);
    press(footerButtons()[1]!);
    expect(dialogs()).toHaveLength(1);
    expect(title()).toBe("editEvent");
  });
  it("지워져 목록에서 사라지면 시트를 닫는다", () => {
    const f = tablet([event(1)]);
    act(() =>
      root.render(
        <EventDetailSurface
          events={[]}
          start={{ id: 1, day: "2026-10-22" }}
          {...f}
        />,
      ),
    );
    expect(f.onClose).toHaveBeenCalled();
  });
});

describe("1280 이상 주 · 일 · 목록 보기 — 가운데 대화상자 480 (17)", () => {
  const wideOpen = (
    over: Partial<IEvent> = {},
    wideDetail: "dialog" | "none" = "dialog",
  ) => {
    setupFormDom(true);
    const f = fns();
    act(() =>
      root.render(
        <EventDetailSurface
          events={[event(1, over)]}
          start={{ id: 1, day: "2026-10-22" }}
          wideDetail={wideDetail}
          {...f}
        />,
      ),
    );
    return f;
  };
  const dialog = () =>
    document.querySelector<HTMLElement>("[data-slot=dialog-content]");
  const btn = (text: string) =>
    [...dialog()!.querySelectorAll("button")].find(
      (b) => b.textContent === text,
    ) as HTMLButtonElement;

  it("칩 옆 팝오버가 아니라 대화상자다 — 제목 일정 상세 · 머리 닫기", () => {
    wideOpen();
    expect(
      document.querySelector("[data-radix-popper-content-wrapper]"),
    ).toBeNull();
    expect(dialog()).not.toBeNull();
    expect(
      dialog()!.querySelector("[data-slot=dialog-title]")!.textContent,
    ).toBe("eventDetail");
    expect(dialog()!.querySelector("[data-slot=dialog-close]")).not.toBeNull();
    expect(dialog()!.textContent).toContain("일정 1");
  });

  it("바닥 [삭제][수정] — 읽기 전용(남이 만든 읽기 전용 캘린더)이면 바닥이 없다", () => {
    wideOpen();
    expect(btn("delete")).toBeTruthy();
    expect(btn("edit")).toBeTruthy();
    act(() => root.unmount());
    root = createRoot(container);
    wideOpen({ userRowId: 99 });
    expect(dialog()!.querySelector("[data-slot=dialog-footer]")).toBeNull();
  });

  it("[삭제] 는 확인창을 요청한다", () => {
    const f = wideOpen();
    press(btn("delete"));
    expect(f.onRequestDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it('[수정] 은 이 대화상자가 닫히고 "자세히" 대화상자 480 — 열린 대화상자 수 1', () => {
    wideOpen();
    press(btn("edit"));
    expect(document.querySelectorAll("[role=dialog]")).toHaveLength(1);
    expect(
      dialog()!.querySelector("[data-slot=dialog-title]")!.textContent,
    ).toBe("editEvent");
    expect(dialog()!.querySelector('[name="title"]')).not.toBeNull();
  });

  it("월 보기(wideDetail none)는 그날 패널이 그리므로 표면을 그리지 않는다", () => {
    wideOpen({}, "none");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("Esc 로 닫힌다", () => {
    const f = wideOpen();
    pressEsc();
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });
});
