// 금액 보기 인증 표면(I-14 44) — 칸에 값이 있는 채 닫으면 ds `dirty` 로 묻는다. 비어 있으면 묻지 않는다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/user", () => ({
  useVerifyPasswordMutation: () => ({ isPending: false, mutate: () => {} }),
}));
vi.mock("@/shared/ds/overlay", () => ({ useWideSurface: () => true }));
// ds 대화상자는 넘겨받은 dirty 만 읽는다
vi.mock("@/shared/ds/dialog", () => ({
  ResponsiveDialog: ({
    dirty,
    children,
  }: {
    dirty?: boolean;
    children: React.ReactNode;
  }) => <div data-dirty={String(!!dirty)}>{children}</div>,
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

const { HideAmountsUnlockSurface } = await import("./HideAmountsUnlockSurface");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("HideAmountsUnlockSurface dirty", () => {
  it("값이 없으면 묻지 않고, 값을 치면 묻는다", () => {
    act(() =>
      root.render(
        <HideAmountsUnlockSurface
          open
          onOpenChange={() => {}}
          onVerified={() => {}}
        />,
      ),
    );
    const dirty = () =>
      container.querySelector("[data-dirty]")?.getAttribute("data-dirty");
    expect(dirty()).toBe("false");
    const input = container.querySelector<HTMLInputElement>(
      "input[type=password]",
    )!;
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      set.call(input, "abc");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(dirty()).toBe("true");
  });
});
