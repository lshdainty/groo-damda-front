// 캘린더 관리 페이지 (I-09b 21 ~ 31) — 소유자 · 공유받은 · 기본 캘린더의 구성, 틀린 id → 부모로 replace,
// 이름은 줄에서 열리는 폼이고 저장은 이름만 보낸다, 멤버 ⋮ 는 내보낼 수 있는 줄에만.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  cals: [] as unknown[],
  members: [] as unknown[],
  updateCalls: [] as unknown[],
  deleted: [] as number[],
  where: "",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.name ? `${k}:${o.name}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
vi.mock("@/shared/lib/confirm-fail", () => ({
  useConfirmFail: () => () => {},
}));
vi.mock("@/features/user", () => ({
  useCurrentUser: () => ({ data: { rowId: 1 }, isLoading: false }),
}));
vi.mock("@/features/user-calendar", () => {
  const idle = () => ({
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
  });
  return {
    useUserCalendars: () => ({
      data: state.cals,
      isSuccess: true,
      isFetching: false,
      isError: false,
      isLoading: false,
      refetch: () => {},
    }),
    useCalendarMembers: () => ({
      data: state.members,
      isError: false,
      refetch: () => {},
    }),
    useUpdateUserCalendar: () => ({
      mutate: (v: unknown) => state.updateCalls.push(v),
      mutateAsync: async (v: unknown) => {
        state.updateCalls.push(v);
      },
      isPending: false,
    }),
    useDeleteUserCalendar: () => ({
      mutateAsync: async (id: number) => {
        state.deleted.push(id);
      },
      isPending: false,
    }),
    useRegenerateCalendarInviteCode: idle,
    useChangeCalendarMemberRole: idle,
    useRemoveCalendarMember: idle,
  };
});

const { CalendarManagePage } = await import("./CalendarManagePage");

let container: HTMLDivElement;
let root: Root;

function Probe() {
  const loc = useLocation();
  useEffect(() => {
    state.where = loc.pathname + loc.search;
  });
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.cals = [];
  state.members = [];
  state.updateCalls = [];
  state.deleted = [];
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const cal = (rowId: number, o: Record<string, unknown> = {}) => ({
  rowId,
  calendarName: `캘린더 ${rowId}`,
  color: "#2d8060",
  isDefault: false,
  isOwner: true,
  myRole: "OWNER",
  inviteCode: "AB12CD34",
  memberCount: 3,
  ...o,
});
const member = (rowId: number, userRowId: number, permission: string) => ({
  rowId,
  userRowId,
  userName: `멤버 ${rowId}`,
  userEmail: `m${rowId}@example.com`,
  permission,
});

function render(id: number | null, mobile = true) {
  act(() =>
    root.render(
      <MemoryRouter
        initialEntries={[
          `/desk/settings?section=calendar-manage&calendar=${id}`,
        ]}
      >
        <Probe />
        <CalendarManagePage mobile={mobile} calendarId={id} />
      </MemoryRouter>,
    ),
  );
}

describe("캘린더 관리 페이지", () => {
  it("소유자 — 이름 · 색상 줄, 초대 코드, 멤버, 캘린더 삭제 줄이 차례로 있다(꺾쇠 없음)", () => {
    state.cals = [cal(2)];
    state.members = [member(1, 1, "OWNER"), member(2, 7, "EDIT")];
    render(2);
    const heads = [
      ...container.querySelectorAll("[data-slot=list-header]"),
    ].map((e) => e.textContent?.trim());
    expect(heads).toEqual([
      "shareSection.calendarGroup",
      "inviteCode",
      "shareSection.members · 2",
    ]);
    expect(container.textContent).toContain("AB12CD34");
    expect(container.textContent).toContain("deleteCalendar");
    // 이름 · 색상 줄은 시트 · 팝오버를 여는 줄 — 꺾쇠를 달지 않는다(list.md:122)
    expect(container.querySelectorAll("svg.lucide-chevron-right").length).toBe(
      0,
    );
  });

  it("멤버 줄의 ⋮ 는 내보낼 수 있는 줄(소유자도 나도 아닌 줄)에만 있고 권한 배지는 모두 있다", () => {
    state.cals = [cal(2)];
    state.members = [
      member(1, 1, "OWNER"),
      member(2, 7, "EDIT"),
      member(3, 8, "READ"),
    ];
    render(2);
    expect(container.querySelectorAll("[data-slot=badge]").length).toBe(3);
    const more = [...container.querySelectorAll("button")].filter((b) =>
      b.getAttribute("aria-label")?.startsWith("shareSection.moreOf"),
    );
    expect(more.length).toBe(2);
  });

  it("공유받은 캘린더 — 멤버만 있다(이름 · 색 · 초대 코드 · 삭제 · 나가기 없음)", () => {
    state.cals = [cal(4, { isOwner: false, myRole: "READ", inviteCode: null })];
    state.members = [member(1, 9, "OWNER"), member(2, 1, "READ")];
    render(4);
    const heads = [
      ...container.querySelectorAll("[data-slot=list-header]"),
    ].map((e) => e.textContent?.trim());
    expect(heads).toEqual(["shareSection.members · 2"]);
    expect(container.textContent).not.toContain("deleteCalendar");
    expect(
      [...container.querySelectorAll("button")].some((b) =>
        b.getAttribute("aria-label")?.startsWith("shareSection.moreOf"),
      ),
    ).toBe(false);
  });

  it("기본 캘린더 — 삭제 줄이 없다", () => {
    state.cals = [cal(1, { isDefault: true })];
    state.members = [member(1, 1, "OWNER")];
    render(1);
    expect(container.textContent).not.toContain("deleteCalendar");
  });

  it("목록에 없는 id 는 부모(캘린더 관리·공유)로 replace 한다", () => {
    state.cals = [cal(2)];
    render(99999);
    expect(state.where).toBe("/desk/settings?section=calendar-share");
  });

  it("이름 줄 → 이름 폼이 열리고 저장은 이름만 보낸다", async () => {
    state.cals = [cal(2)];
    state.members = [member(1, 1, "OWNER")];
    render(2);
    const nameRow = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("name"),
    ) as HTMLButtonElement;
    expect(nameRow, "이름 줄").not.toBeUndefined();
    act(() => nameRow.click());
    const input = document.body.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("캘린더 2");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(input, "새 이름");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "save",
    ) as HTMLButtonElement;
    await act(async () => {
      save.click();
    });
    expect(state.updateCalls).toEqual([
      { id: 2, data: { calendarName: "새 이름" } },
    ]);
  });
});
