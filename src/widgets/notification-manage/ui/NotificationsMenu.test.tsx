// 데스크톱 머리의 벨 + 알림 목록 — 1280 이상 Popover · 미만 Bottom Sheet(Q-017 17-3b B · popover.md "알림 목록").
// 모양(380 · 600 · 벨 아래 8 · s3 · 시트 바닥 붙음)은 크로미움에서 재고, 여기서는 구성 · 역할 · 동작을 고정한다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  items: [] as {
    rowId: number;
    title: string;
    message: string;
    isRead: boolean;
    notificationType: string;
    createAt: string;
  }[],
  wide: true,
  markRead: vi.fn(),
  markAll: vi.fn(),
}));

vi.mock("@/features/notification", () => ({
  // 줄 끝 ⋮ 는 features/notification 의 NotificationMoreMenu.test.tsx 가 잰다 — 여기서는 자리만 본다
  NotificationMoreMenu: ({
    notification,
  }: {
    notification: { title: string };
  }) => (
    <button
      type="button"
      data-slot="notification-more"
      aria-label={`${notification.title} 더보기`}
    />
  ),
  useNotifications: () => ({ data: state.items, isLoading: false }),
  useUnreadCount: () => ({
    data: state.items.filter((n) => !n.isRead).length,
  }),
  useMarkRead: () => ({ mutate: state.markRead, pendingIds: new Set() }),
  useMarkAllRead: () => ({ mutate: state.markAll, isPending: false }),
}));
vi.mock("@/shared/hooks", () => ({ useNow: () => Date.now() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: { count?: number | string }) =>
      o?.count !== undefined ? `${k}:${o.count}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { NotificationsMenu } = await import("./NotificationsMenu");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // 1280 이상(useWideSurface)만 켠다 — state.wide 로 가른다
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes("1280px") ? state.wide : false;
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  state.wide = true;
  state.markRead = vi.fn();
  state.markAll = vi.fn();
  state.items = [1, 2, 3].map((i) => ({
    rowId: i,
    title: `알림 ${i}`,
    message: "메시지",
    isRead: i === 3,
    notificationType: "SYSTEM",
    createAt: new Date().toISOString(),
  }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

const render = (onGoSettings = () => {}) =>
  act(() => root.render(<NotificationsMenu onGoSettings={onGoSettings} />));
const bell = () => container.querySelector<HTMLButtonElement>("button")!;
const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
const click = (el: Element | null | undefined) =>
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const buttonByText = (text: string) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text),
  );

describe("NotificationsMenu 벨", () => {
  it("안 읽은 알림이 있으면 벨 이름이 알림, 새 알림 있음 이다", () => {
    render();
    expect(bell().getAttribute("aria-label")).toBe("notificationsUnread");
  });

  it("다 읽었으면 그냥 알림 이다", () => {
    state.items = state.items.map((n) => ({ ...n, isRead: true }));
    render();
    expect(bell().getAttribute("aria-label")).toBe("notifications");
  });
});

describe.each([
  ["1280 이상 Popover", true],
  ["768~1279 Bottom Sheet", false],
])("NotificationsMenu %s", (_name, wide) => {
  beforeEach(() => {
    state.wide = wide;
  });

  it("벨을 누르면 제목 · 설명 · 닫기 · 목록 · 바닥이 열린다", () => {
    render();
    expect(dialog()).toBeNull();
    click(bell());
    const el = dialog()!;
    expect(el).not.toBeNull();
    expect(el.textContent).toContain("title");
    expect(el.textContent).toContain("popover.unreadPlain:2");
    expect(
      [...el.querySelectorAll("button")].some((b) =>
        /^(닫기|Close)$/.test(b.getAttribute("aria-label") ?? ""),
      ),
    ).toBe(true);
    expect(el.querySelector("ul[aria-labelledby]")).not.toBeNull();
    expect(buttonByText("prefs.title")).toBeDefined();
    expect(buttonByText("markAllRead")).toBeDefined();
  });

  it("안 읽은 줄만 버튼이다 — 읽은 줄은 보기만 하는 줄", () => {
    render();
    click(bell());
    const rows = [...dialog()!.querySelectorAll("li[data-notification-id]")];
    const hasButton = rows.map(
      (r) => !!r.querySelector("button[data-slot=list-body]"),
    );
    expect(hasButton).toEqual([true, true, false]);
  });

  it("줄마다 ⋮ 가 있고 줄 본문 버튼의 형제다 — 읽은 줄에도, 줄 버튼 안에는 없다", () => {
    render();
    click(bell());
    const rows = [...dialog()!.querySelectorAll("li[data-notification-id]")];
    expect(rows).toHaveLength(3);
    for (const [i, r] of rows.entries()) {
      const more = r.querySelector<HTMLElement>(
        "[data-slot=notification-more]",
      )!;
      expect(more.getAttribute("aria-label")).toBe(`알림 ${i + 1} 더보기`);
      expect(more.closest("[data-slot=list-body]")).toBeNull();
      expect(more.closest("[data-slot=list-suffix]")).not.toBeNull();
    }
  });

  it("안 읽은 줄을 누르면 읽음 처리하고 초점이 다음 안 읽은 줄로 간다", () => {
    render();
    click(bell());
    const first = dialog()!.querySelector<HTMLElement>(
      '[data-notification-id="1"] [data-slot=list-body]',
    )!;
    click(first);
    expect(state.markRead).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(
      dialog()!.querySelector(
        '[data-notification-id="2"] [data-slot=list-body]',
      ),
    );
  });

  it("모두 읽음 · 알림 설정이 바닥에서 동작한다", () => {
    const go = vi.fn();
    render(go);
    click(bell());
    click(buttonByText("markAllRead"));
    expect(state.markAll).toHaveBeenCalled();
    click(buttonByText("prefs.title"));
    expect(go).toHaveBeenCalled();
    // 시트는 내려가는 동안 남는다(exit 모션) — 닫힘 상태면 된다
    const d = dialog();
    expect(!d || d.getAttribute("data-state") === "closed").toBe(true);
  });

  it("다 읽었으면 모두 읽음이 막히고 설명이 새 알림 없음이다", () => {
    state.items = state.items.map((n) => ({ ...n, isRead: true }));
    render();
    click(bell());
    expect(dialog()!.textContent).toContain("popover.noNew");
    expect((buttonByText("markAllRead") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
