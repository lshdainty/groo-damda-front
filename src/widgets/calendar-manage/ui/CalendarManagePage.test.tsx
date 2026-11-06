// 캘린더 관리 페이지 (I-09b 21 ~ 31) — 소유자 · 공유받은 · 기본 캘린더의 구성, 틀린 id → 부모로 replace,
// 이름은 줄에서 열리는 폼이고 저장은 이름만 보낸다, 멤버 ⋮ 는 내보낼 수 있는 줄에만.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
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
  navType: "",
  hasPrev: false,
  roleCalls: [] as unknown[],
  failList: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.name ? `${k}:${o.name}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
vi.mock("@/shared/ds/top-navigation/top-navigation-context", () => ({
  hasPreviousEntry: () => state.hasPrev,
}));
vi.mock("@/shared/lib/confirm-fail", () => ({
  useConfirmFail: () => () => {},
  useToggleFail: () => () => {},
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
      data: state.failList ? undefined : state.cals,
      isSuccess: !state.failList,
      isFetching: false,
      isError: state.failList,
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
    useChangeCalendarMemberRole: () => ({
      mutateAsync: async (v: unknown) => {
        state.roleCalls.push(v);
      },
      isPending: false,
    }),
    useRemoveCalendarMember: idle,
  };
});

const { CalendarManagePage } = await import("./CalendarManagePage");

let container: HTMLDivElement;
let root: Root;

function Probe() {
  const loc = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    state.where = loc.pathname + loc.search;
    state.navType = navType;
  });
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.cals = [];
  state.members = [];
  state.updateCalls = [];
  state.deleted = [];
  state.roleCalls = [];
  state.hasPrev = false;
  state.failList = false;
  state.navType = "";
  // 멤버 메뉴는 Menu Sheet(vaul)로 열린다 — vaul 이 matchMedia 를 부른다
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
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

const LIST = "/desk/settings?section=calendar-share";
function render(id: number | null, mobile = true, withList = false) {
  const manage = `/desk/settings?section=calendar-manage&calendar=${id}`;
  act(() =>
    root.render(
      <MemoryRouter
        initialEntries={withList ? [LIST, manage] : [manage]}
        initialIndex={withList ? 1 : 0}
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

  it('멤버 줄 끝에는 ⋮ 가 없고 내보낼 수 있는 줄만 누르는 줄(이름 "{이름} 관리")이다', () => {
    state.cals = [cal(2)];
    state.members = [
      member(1, 1, "OWNER"),
      member(2, 7, "EDIT"),
      member(3, 8, "READ"),
    ];
    render(2);
    expect(container.querySelectorAll("[data-slot=badge]").length).toBe(3);
    expect(
      container.querySelectorAll("svg.lucide-ellipsis-vertical").length,
    ).toBe(0);
    const manage = [...container.querySelectorAll("button")].filter((b) =>
      b.getAttribute("aria-label")?.startsWith("shareSection.manageOf"),
    );
    expect(manage.length).toBe(2);
  });

  it("멤버 줄을 누르면 메뉴가 열리고 권한 바꾸기는 반대 권한을 보낸다", async () => {
    state.cals = [cal(2)];
    state.members = [member(1, 1, "OWNER"), member(2, 7, "EDIT")];
    render(2);
    const row = [...container.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.startsWith("shareSection.manageOf"),
    ) as HTMLButtonElement;
    act(() => row.click());
    const item = [
      ...document.body.querySelectorAll("button, [role=menuitem]"),
    ].find(
      (b) => b.textContent?.trim() === "shareSection.changeTo.READ",
    ) as HTMLElement;
    // Menu Sheet 는 닫힌 뒤 onSelect 를 부른다 — 닫힘 애니메이션이 없는 jsdom 에서는 1초 뒤의 안전 타이머가 부른다
    await act(async () => {
      item.click();
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(state.roleCalls).toEqual([
      { id: 2, memberId: 2, permission: "READ" },
    ]);
  });

  it('초대 코드가 없는 캘린더 — "코드 없음" 과 [새로 만들기] 만, [복사] 는 없다', () => {
    state.cals = [cal(1, { isDefault: true, inviteCode: null })];
    state.members = [member(1, 1, "OWNER")];
    render(1);
    expect(container.textContent).toContain("shareSection.codeNone");
    const labels = [...container.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toContain("shareSection.regenCode");
    expect(labels).not.toContain("shareSection.copyCode");
  });

  it("캘린더 목록을 못 받으면 Result Section 과 [다시 시도] — 서버 글은 없다", () => {
    state.failList = true;
    render(2);
    expect(
      container.querySelector("[data-slot=result-section]"),
    ).not.toBeNull();
    expect(container.textContent).toContain("shareSection.loadFailed");
    // [다시 시도] 는 ds 고정 글이다(react-i18next 목을 타지 않는다)
    expect(container.textContent).toContain("다시 시도");
  });

  it("캘린더 삭제 — 앞 화면(목록)이 있으면 history 뒤로(목록이 두 번 남지 않는다)", async () => {
    state.cals = [cal(2)];
    state.members = [member(1, 1, "OWNER")];
    state.hasPrev = true;
    render(2, true, true);
    const del = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("deleteCalendar"),
    ) as HTMLButtonElement;
    act(() => del.click());
    const ok = [...document.body.querySelectorAll("button")]
      .filter((b) => b.textContent?.trim() === "delete")
      .pop() as HTMLButtonElement;
    await act(async () => {
      ok.click();
    });
    expect(state.deleted).toEqual([2]);
    expect(state.where).toBe(LIST);
    expect(state.navType).toBe("POP");
  });

  it("캘린더 삭제 — 기록이 없을 때(바로 들어옴)만 부모로 replace", async () => {
    state.cals = [cal(2)];
    state.members = [member(1, 1, "OWNER")];
    state.hasPrev = false;
    render(2);
    const del = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("deleteCalendar"),
    ) as HTMLButtonElement;
    act(() => del.click());
    const ok = [...document.body.querySelectorAll("button")]
      .filter((b) => b.textContent?.trim() === "delete")
      .pop() as HTMLButtonElement;
    await act(async () => {
      ok.click();
    });
    expect(state.where).toBe(LIST);
    expect(state.navType).toBe("REPLACE");
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
        b.getAttribute("aria-label")?.startsWith("shareSection.manageOf"),
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
    expect(state.navType).toBe("REPLACE");
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
