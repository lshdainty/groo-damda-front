// 예산 경고 기준 — 끄는 동안 머리 값 "N%" 도 슬라이더와 함께 따라가고, 저장이 끝나면 서버 값으로 돌아온다(slider.yaml 10-09).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  Trans: ({ i18nKey }: { i18nKey?: string }) => i18nKey ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const mut = vi.hoisted(() => ({
  isError: false,
  variables: null as Record<string, unknown> | null,
}));
let settle: (() => void) | null = null;
let fail: (() => void) | null = null;
const mutate = vi.fn(
  (_v: unknown, opts?: { onSettled?: () => void; onError?: () => void }) => {
    settle = opts?.onSettled ?? null;
    fail = opts?.onError ?? null;
  },
);
const snackbarShow = vi.hoisted(() => vi.fn());
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show: snackbarShow }),
}));

vi.mock("@/features/user", () => ({
  useUserPreferences: () => ({
    data: { budgetAlertThreshold: 85, pushEnabled: true },
    isLoading: false,
  }),
  useUpdateUserPreferences: () => ({
    mutate,
    isPending: false,
    isError: mut.isError,
    variables: mut.variables,
  }),
  useCurrentUser: () => ({ data: { userEmail: "a@example.com" } }),
}));

const { NotificationsManager } = await import("./NotificationsManager");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  mutate.mockClear();
});

const thumb = () => container.querySelector<HTMLElement>("[role=slider]")!;
const head = () =>
  Array.from(container.querySelectorAll("span")).find(
    (s) =>
      /^\d+%$/.test(s.textContent ?? "") && s.className.includes("font-bold"),
  )!;

describe("예산 경고 기준 슬라이더", () => {
  it("끄는 동안 머리 값이 따라가고 손을 뗄 때 한 번 저장 — 저장이 끝나면 서버 값으로", () => {
    act(() => root.render(<NotificationsManager mobile={false} />));
    expect(head().textContent).toBe("85%");
    act(() => {
      thumb().focus();
      thumb().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(thumb().getAttribute("aria-valuenow")).toBe("90");
    expect(head().textContent).toBe("90%");
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({ budgetAlertThreshold: 90 });
    // 저장 중에도 슬라이더는 막히지 않는다
    expect(thumb().hasAttribute("data-disabled")).toBe(false);
    act(() => settle?.());
    expect(head().textContent).toBe("85%");
  });

  it("저장이 실패하면 값을 되돌리고 슬라이더 아래 Field 오류 글로 알린다 — 다시 끌면 사라진다", () => {
    act(() => root.render(<NotificationsManager mobile={false} />));
    const press = () =>
      act(() => {
        thumb().focus();
        thumb().dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        );
      });
    const error = () =>
      container.querySelector<HTMLElement>("[data-slot=field-error]");
    expect(error()).toBeNull();
    press();
    expect(head().textContent).toBe("90%");
    // 실패 → 서버 값(85)으로 돌아오고 오류 글이 슬라이더 바로 아래에 뜬다
    act(() => {
      fail?.();
      settle?.();
    });
    expect(head().textContent).toBe("85%");
    expect(error()).not.toBeNull();
    // Field 오류 꼴 — 보이는 글은 숨기고 polite 로 한 번 읽힌다(alert 아님), circle-alert 16 이 앞에, 손잡이가 설명으로 이음
    expect(error()!.getAttribute("role")).toBeNull();
    expect(error()!.getAttribute("aria-hidden")).toBe("true");
    expect(error()!.textContent).toBe("saveError");
    expect(error()!.querySelector("svg")?.getAttribute("width")).toBe("16");
    expect(thumb().getAttribute("aria-describedby")).toBe(error()!.id);
    // 보이는 곳은 한 곳(스낵바는 스위치 · 값 줄 저장 실패 몫이다)
    expect(container.querySelectorAll("[data-slot=field-error]")).toHaveLength(
      1,
    );
    // 다시 끌면 오류 글이 걷힌다
    press();
    expect(error()).toBeNull();
  });
});

describe("스위치 저장 실패 (I-15 덧붙임 14-1 M1)", () => {
  it("실패하면 critical 스낵바 고정 글을 띄운다 — 서버 글 없이, [다시 시도] 없이", () => {
    act(() => root.render(<NotificationsManager mobile={false} />));
    const sw = container.querySelector<HTMLElement>("[role=switch]")!;
    act(() => sw.click());
    const opts = mutate.mock.calls[mutate.mock.calls.length - 1]![1] as {
      onError?: () => void;
    };
    act(() => opts.onError?.());
    expect(snackbarShow).toHaveBeenCalledWith({
      message: "settingsSaveFailed",
      tone: "critical",
    });
  });
});
