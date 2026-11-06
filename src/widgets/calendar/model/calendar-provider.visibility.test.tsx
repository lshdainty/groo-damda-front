// 캘린더 그리드 필터 — 프로바이더가 내려 주는 `isCalendarVisible` 이 판정한다
// (`CalendarContainer` 가 이걸로 일정을 거른다).
//
// **기본 캘린더는 늘 보이는 것으로 친다.** 목록(소스 드롭다운)에선 켠 것으로 보이는데
// 필터만 예전 값을 따라 숨기면, 켜진 캘린더의 일정이 화면에서 빠지는 상태가 된다.
// 두 자리가 같은 규칙(`entities/user-calendar` 의 `isCalendarShown`)을 보게 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserCalendar } from "@/entities/user-calendar";
import { useCalendar } from "./calendar-context";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const mocks = vi.hoisted(() => ({
  calendars: [] as UserCalendar[],
  toggle: undefined as
    undefined | ((id: number, o: { onError: () => void }) => void),
  snack: [] as Array<{ message: string; tone?: string; action?: unknown }>,
}));

vi.mock("@/features/user-calendar", () => ({
  useUserCalendars: () => ({ data: mocks.calendars }),
  useToggleCalendarVisibility: () => ({
    mutate: (id: number, o: { onError: () => void }) => mocks.toggle?.(id, o),
    pendingIds: new Set<number>(),
  }),
}));

vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: { message: string }) => mocks.snack.push(o),
    dismiss: () => {},
  }),
}));

vi.mock("@/shared/i18n/config", () => ({ i18n: { t: (k: string) => k } }));

const { CalendarProvider } = await import("./calendar-provider");

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

/** 판정 결과를 DOM 으로 뽑는다 — 렌더 밖으로 값을 실어 나르지 않는다. */
const Probe = ({ ids }: { ids: number[] }) => {
  const { isCalendarVisible, toggleCalendarVisibility } = useCalendar();
  return (
    <ul>
      {ids.map((id) => (
        <li key={id} data-row={id}>
          {isCalendarVisible(id) ? "보임" : "숨김"}
          <button
            data-toggle={id}
            onClick={() => toggleCalendarVisibility(id)}
          />
        </li>
      ))}
    </ul>
  );
};

let container: HTMLDivElement;
let root: Root;

const render = (ids: number[]) =>
  act(() =>
    root.render(
      <CalendarProvider events={[]}>
        <Probe ids={ids} />
      </CalendarProvider>,
    ),
  );

const verdict = (rowId: number) =>
  container.querySelector(`li[data-row="${rowId}"]`)?.textContent;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.calendars = [];
  mocks.toggle = undefined;
  mocks.snack = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("그리드 필터의 보임 판정", () => {
  it("끈 캘린더의 일정은 거른다", () => {
    mocks.calendars = [calendar(2, "숨긴캘린더", { isVisible: false })];
    render([2]);
    expect(verdict(2)).toBe("숨김");
  });

  it("기본 캘린더는 꺼진 값이 남아 있어도 보인다", () => {
    mocks.calendars = [
      calendar(1, "업무", { isDefault: true, isVisible: false }),
    ];
    render([1]);
    expect(verdict(1)).toBe("보임");
  });

  it("목록에 없는 캘린더는 보이는 것으로 친다", () => {
    mocks.calendars = [calendar(1, "업무", { isDefault: true })];
    render([99]);
    expect(verdict(99)).toBe("보임");
  });
});

describe("가시성 토글 실패", () => {
  it("실패하면 값은 그대로(서버 목록) · critical 스낵바 한 문장 · 다시 시도 없음", () => {
    mocks.calendars = [calendar(2, "업무")];
    mocks.toggle = (_id, o) => o.onError();
    render([2]);
    act(() =>
      container.querySelector<HTMLElement>("[data-toggle='2']")!.click(),
    );
    expect(verdict(2)).toBe("보임");
    expect(mocks.snack).toEqual([
      { message: "calendar:filter.visibilityFailed", tone: "critical" },
    ]);
  });
});
