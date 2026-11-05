// 알림 줄 끝 ⋮ → "삭제" → 확인창 → 지움 (알림 지우기 결정 B, 2026-10-22).
// 1280 이상 Menu · 미만 Menu Sheet 둘 다 같은 줄(위험 "삭제" 하나)이고, 줄을 고르면 메뉴가 먼저 닫힌 뒤 확인창이 뜬다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Notification } from "@/entities/notification";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  wide: true,
  mutate: vi.fn(),
  confirmFail: vi.fn(),
  pending: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: { title?: string }) =>
      o?.title !== undefined ? `${k}:${o.title}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("../model/useNotifications", () => ({
  useDeleteNotification: () => ({
    mutateAsync: state.mutate,
    isPending: state.pending,
  }),
}));
vi.mock("@/shared/lib/confirm-fail", () => ({
  useConfirmFail: () => state.confirmFail,
}));
// 확인창 껍데기는 shared/ui/groo/alert-confirm 의 몫이다 — 여기서는 어떤 글과 동작으로 부르는지만 본다
vi.mock("@/shared/ui/groo/alert-confirm", () => ({
  AlertConfirm: (p: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => Promise<unknown> | void;
    onError?: () => void;
    onClose: () => void;
  }) => (
    <div role="alertdialog">
      <h2>{p.title}</h2>
      <p>{p.message}</p>
      <button type="button" data-testid="cancel" onClick={p.onClose}>
        cancel
      </button>
      <button
        type="button"
        data-testid="confirm"
        onClick={async () => {
          try {
            await p.onConfirm();
            p.onClose();
          } catch {
            p.onClose();
            p.onError?.();
          }
        }}
      >
        {p.confirmLabel}
      </button>
    </div>
  ),
}));

const { NotificationMoreMenu } = await import("./NotificationMoreMenu");

const notification: Notification = {
  rowId: 7,
  userRowId: 1,
  notificationType: "BUDGET_ALERT",
  title:
    "식비 예산을 120% 썼어요 — 이번 달 남은 날은 아껴 쓰는 편이 좋아요 (두 줄을 넘는 긴 제목)",
  message: "메시지",
  referenceType: null,
  referenceId: null,
  isRead: false,
  readAt: null,
  createAt: "2026-10-21T00:00:00",
};

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
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.hasPointerCapture = () => false;
  }
  window.history.replaceState(null, "");
  state.mutate = vi.fn().mockResolvedValue(undefined);
  state.confirmFail = vi.fn();
  state.pending = false;
  window.matchMedia = ((query: string) => ({
    matches: state.wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
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

const render = () =>
  act(() => root.render(<NotificationMoreMenu notification={notification} />));
const tick = (ms = 0) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
const trigger = () =>
  container.querySelector<HTMLButtonElement>("[data-slot=notification-more]")!;
const openMenu = async () => {
  if (state.wide) {
    act(() => {
      trigger().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  } else {
    await click(trigger());
  }
  await tick();
};
const surface = () =>
  document.querySelector<HTMLElement>(
    state.wide ? "[data-slot=menu-content]" : "[data-slot=menu-sheet-content]",
  );
const row = () =>
  document.querySelector<HTMLElement>(
    state.wide ? "[data-slot=menu-item]" : "[data-slot=menu-sheet-item]",
  );

describe.each([
  ["1280 이상 Menu", true],
  ["1280 미만 Menu Sheet", false],
])("NotificationMoreMenu — %s", (_n, wide) => {
  beforeEach(() => {
    state.wide = wide;
  });

  it("⋮ 의 이름은 '{알림 제목} 더보기' 이고 열면 위험 줄 '삭제' 하나뿐이다", async () => {
    render();
    expect(trigger().getAttribute("aria-label")).toBe(
      `more:${notification.title}`,
    );
    await openMenu();
    expect(surface()).not.toBeNull();
    const rows = Array.from(
      document.querySelectorAll(
        wide ? "[data-slot=menu-item]" : "[data-slot=menu-sheet-item]",
      ),
    );
    expect(rows.map((r) => r.textContent)).toEqual(["delete"]);
    expect(row()!.getAttribute("data-tone")).toBe("critical");
  });

  it("시트의 제목은 알림 제목이다 — 메뉴에는 머리가 없다", async () => {
    render();
    await openMenu();
    if (wide) expect(surface()!.textContent).not.toContain("식비 예산");
    else expect(surface()!.textContent).toContain("식비 예산");
  });

  it("삭제를 고르면 메뉴가 닫힌 뒤 확인창 '알림 삭제' 가 뜨고, 아직 지우지 않았다", async () => {
    render();
    await openMenu();
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    await click(row()!);
    await tick(1100);
    const dlg = document.querySelector("[role=alertdialog]")!;
    expect(dlg).not.toBeNull();
    expect(dlg.textContent).toContain("deleteTitle");
    expect(dlg.textContent).toContain("deleteDescription");
    expect(dlg.getAttribute("data-danger")).not.toBeNull();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("취소하면 지우지 않고 확인창만 닫힌다", async () => {
    render();
    await openMenu();
    await click(row()!);
    await tick(1100);
    await click(document.querySelector("[data-testid=cancel]")!);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("삭제를 누르면 그 알림의 rowId 로 지운다 — 성공하면 확인창이 닫힌다", async () => {
    render();
    await openMenu();
    await click(row()!);
    await tick(1100);
    await click(document.querySelector("[data-testid=confirm]")!);
    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate.mock.calls[0]![0]).toBe(7);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(state.confirmFail).not.toHaveBeenCalled();
  });

  it("지우기가 실패하면 확인창을 닫고 critical 스낵바 + 다시 시도(고정 글)를 띄운다", async () => {
    state.mutate = vi.fn().mockRejectedValue(new Error("x"));
    render();
    await openMenu();
    await click(row()!);
    await tick(1100);
    await click(document.querySelector("[data-testid=confirm]")!);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(state.confirmFail).toHaveBeenCalledTimes(1);
    expect(state.confirmFail.mock.calls[0]![0].message).toBe("deleteFailed");
  });
});
