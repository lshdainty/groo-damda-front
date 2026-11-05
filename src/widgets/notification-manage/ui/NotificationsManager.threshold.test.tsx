// 예산 경고 기준 · 스위치 저장 — 끄는 동안 머리 값 "N%" 가 따라가고, 놓으면 한 번 저장한다(낙관적).
// 실패하면 서버 값으로 되돌리고 critical 스낵바 고정 글을 띄운다(I-15 덧붙임 14-1 M1 · 값 줄 · 슬라이더도 같다).
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

const snackbarShow = vi.hoisted(() => vi.fn());
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show: snackbarShow }),
}));

const save = vi.fn();
let onFail: (() => void) | null = null;
vi.mock("@/features/user", () => ({
  usePreferenceEditor: (fail: () => void) => {
    onFail = fail;
    return {
      pref: { budgetAlertThreshold: 85, pushEnabled: true },
      query: { isLoading: false, isError: false },
      save,
    };
  },
  useCurrentUser: () => ({
    data: { userEmail: "a@example.com" },
    isLoading: false,
  }),
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
  save.mockClear();
  snackbarShow.mockClear();
});

const thumb = () => container.querySelector<HTMLElement>("[role=slider]")!;
const head = () =>
  container.querySelector<HTMLElement>("[data-slot=slider-value]")!;

describe("예산 경고 기준 슬라이더", () => {
  it("끄는 동안 머리 값이 따라가고 손을 뗄 때 한 번 저장 — 값 글에 %가 붙는다", () => {
    act(() => root.render(<NotificationsManager mobile={false} />));
    expect(head().textContent).toBe("85%");
    act(() => {
      thumb().focus();
      thumb().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(head().textContent).toBe("90%");
    expect(thumb().getAttribute("aria-valuetext")).toBe("90%");
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toEqual({ budgetAlertThreshold: 90 });
    // 저장 중에도 슬라이더는 막히지 않는다
    expect(thumb().hasAttribute("data-disabled")).toBe(false);
  });

  it("양 끝 표식은 ds Slider 가 한 번만 그린다 — 50% · 100%", () => {
    act(() => root.render(<NotificationsManager mobile={false} />));
    const marks = Array.from(
      container.querySelectorAll("[data-slot=slider-marker]"),
    ).map((e) => e.textContent);
    expect(marks).toEqual(["50%", "100%"]);
  });
});

describe("저장 실패 (I-15 덧붙임 14-1 M1)", () => {
  it("스위치를 누르면 키 하나만 저장하고, 실패하면 critical 스낵바 고정 글 — 다시 시도 없이", () => {
    act(() => root.render(<NotificationsManager mobile={false} />));
    const sw = container.querySelector<HTMLElement>("[role=switch]")!;
    act(() => sw.click());
    expect(save).toHaveBeenCalledTimes(1);
    expect(Object.keys(save.mock.calls[0]![0])).toHaveLength(1);
    act(() => onFail?.());
    expect(snackbarShow).toHaveBeenCalledWith({
      message: "settingsSaveFailed",
      tone: "critical",
    });
  });
});
