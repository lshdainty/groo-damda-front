// 로그인된 기기(I-12 23 ~ 35) — 실제 화면을 띄워 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: toastError, dismiss: () => {} }),
}));
const logout = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/model/useAuth", () => ({
  useAuth: () => ({ logout }),
}));
vi.mock("@/shared/hooks", () => ({
  useNow: () => Date.UTC(2026, 9, 23, 12, 0, 0),
}));

const sessions = vi.hoisted(() => ({
  q: {
    data: [] as unknown[],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isRefetching: false,
  },
  revoke: vi.fn(),
}));
vi.mock("@/features/session", () => ({
  useDeviceSessions: () => sessions.q,
  useRevokeDeviceMutation: () => ({
    mutateAsync: sessions.revoke,
    isPending: false,
    variables: undefined,
  }),
  useRevokeAllDevicesMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const { DevicesSection } = await import("./DevicesSection");

const LONG =
  "Windows 11 · Chrome 130 · 아주 긴 이름의 지어낸 기기 모델 이름 숲빛 노트북 열두 인치 확장판";
const device = (over: Record<string, unknown>) => ({
  sessionId: "s1",
  deviceLabel: "iPhone · Safari",
  deviceKind: "MOBILE",
  lastUsedAt: "2026-10-23T11:59:40",
  createAt: null,
  current: false,
  ...over,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  sessions.q = {
    data: [
      device({ current: true, deviceLabel: LONG }),
      device({ sessionId: "s2", deviceKind: "DESKTOP", lastUsedAt: null }),
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isRefetching: false,
  };
  sessions.revoke = vi.fn().mockResolvedValue(undefined);
  toastError.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const mount = (mobile: boolean) =>
  act(() => root.render(<DevicesSection mobile={mobile} />));

describe("DevicesSection", () => {
  it("폰: 안내 글 + List 줄(선 없음 · 말줄임 없음) + 현재 기기 배지 + 기기 이름이 든 로그아웃 이름", () => {
    mount(true);
    expect(container.textContent).toContain("sections.devices.desc");
    expect(container.querySelectorAll("[data-slot=list-item]")).toHaveLength(2);
    expect(container.querySelector("[data-slot=list-divider]")).toBeNull();
    const title = container.querySelector("[data-slot=list-title]")!;
    expect(title.className).not.toMatch(/truncate|nowrap|ellipsis/);
    const badge = container.querySelector("[data-slot=badge]")!;
    expect(badge.textContent).toBe("devices.current");
    const btn = container.querySelector(
      "[data-slot=list-suffix] button",
    ) as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toContain(LONG);
    // 모두 로그아웃: ghost critical large 화면 폭
    const all = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("devices.logoutAll"),
    )!;
    expect(all.className).toContain("min-h-[48px]");
    expect(all.className).toContain("text-fg-critical");
    expect(all.className).toContain("w-full");
  });

  it("데스크톱: 카드 하나 + 바닥 줄(선 + 오른쪽 small ghost critical), 안내 글은 본문에 없다", () => {
    mount(false);
    const card = container.querySelector("[data-slot=card]")!;
    expect(card.getAttribute("data-body")).toBe("list");
    expect(card.querySelector("[data-slot=divider]")).not.toBeNull();
    expect(container.textContent).not.toContain("sections.devices.desc");
    const all = [...card.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("devices.logoutAll"),
    )!;
    expect(all.className).toContain("min-h-[36px]");
  });

  it("실패 = Result Section failure + 다시 시도, 원문 없음 / 빈 = empty / 기기 0 이면 모두 로그아웃 없음", () => {
    sessions.q = { ...sessions.q, data: [], isError: true };
    mount(true);
    expect(
      container.querySelector("[data-slot=result-section]"),
    ).not.toBeNull();
    expect(container.textContent).toContain("devices.loadErrorHint");
    act(() => {
      [...container.querySelectorAll("button")]
        .find((b) => b.textContent === "common.retry")!
        .click();
    });
    expect(sessions.q.refetch).toHaveBeenCalled();
    expect(container.textContent).not.toContain("devices.logoutAll");

    // 카드 안 Result Section 은 카드의 바로 아래 자식 — 좌우 24 규칙이 걸리고, 바닥 여백은 pb-0 이 아니다
    sessions.q = { ...sessions.q, isError: true, data: [] };
    mount(false);
    const card = container.querySelector("[data-slot=card]")!;
    expect(card.firstElementChild?.getAttribute("data-slot")).toBe(
      "result-section",
    );
    expect(card.className).not.toContain("pb-0");

    sessions.q = { ...sessions.q, isError: false, data: [] };
    mount(false);
    expect(container.textContent).toContain("devices.empty");
    expect(container.querySelector("[data-slot=divider]")).toBeNull();
  });

  it("불러오는 중에는 Skeleton 줄 셋, 모두 로그아웃 없음", () => {
    sessions.q = { ...sessions.q, isLoading: true, data: [] };
    mount(true);
    expect(
      container.querySelector("[data-device-skeleton]")?.children,
    ).toHaveLength(3);
    expect(container.textContent).not.toContain("devices.logoutAll");
  });

  it("끊기 실패: 확인창이 닫히고 알림은 하나", async () => {
    sessions.revoke = vi.fn().mockRejectedValue(new Error("boom"));
    mount(true);
    await act(async () => {
      (
        container.querySelector("[data-slot=list-suffix] button") as HTMLElement
      ).click();
    });
    const dialog = () => document.querySelector("[role=alertdialog]");
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain("devices.logoutTitle");
    const confirm = [...dialog()!.querySelectorAll("button")].find((b) =>
      b.className.includes("bg-bg-critical-solid"),
    )!;
    await act(async () => {
      confirm.click();
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0]![0]).toMatchObject({
      message: "devices.logoutFailed",
      tone: "critical",
    });
    expect(dialog()).toBeNull();
    // [다시 시도] 는 묻지 않고 같은 끊기를 한 번 더 한다
    sessions.revoke.mockResolvedValue(undefined);
    await act(async () => {
      toastError.mock.calls[0]![0].action.onClick();
    });
    expect(sessions.revoke).toHaveBeenCalledTimes(2);
  });
});
