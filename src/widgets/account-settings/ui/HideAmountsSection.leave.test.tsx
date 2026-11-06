// 금액 가리기 — 바꾼 채 떠나는 모든 길이 묻는다(I-wrap-b2b 단계 5): 브라우저 · 안드로이드 뒤로 · 사이드바(셸 이동) ·
// 폰 ← · 설정 구역 바꾸기는 공용 가드. 바꾼 게 없으면 묻지 않고, 저장이 나가 있으면(busy) 묻지도 떠나지도 않는다.
// "‹ 계정" 은 SettingsFrames.test 가 같은 가드로 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnackbarProvider } from "@/shared/ds/snackbar";
import { LeaveGuardProvider } from "@/shared/ui/groo/leave-guard";
import { useLinkClick } from "@/widgets/layout/lib/use-link-click";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) =>
      p ? `${k}${JSON.stringify(p)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/top-navigation", () => ({
  TopNavigation: ({ children }: { children: React.ReactNode }) => (
    <header data-slot="top-navigation">{children}</header>
  ),
  TopNavigationBackButton: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" aria-label="back" onClick={onClick} />
  ),
  TopNavigationTitle: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
}));
vi.mock("@/shared/ui/groo/manager-layout", () => ({
  ManagerHead: ({ title }: { title: string }) => (
    <h1 data-manager-head>{title}</h1>
  ),
}));

const store = vi.hoisted(() => ({
  saved: new Set<string>(),
  set: vi.fn(async (_cards?: Set<string>) => true),
}));
vi.mock("@/shared/lib/groo/hide-amounts-core", () => ({
  useHiddenCards: () => store.saved,
  setHiddenCards: store.set,
}));
// 본인 확인 표면은 열림만 본다 — 맞았다고 치려면 data-verify 를 누른다
vi.mock("./HideAmountsUnlockSurface", () => ({
  HideAmountsUnlockSurface: ({
    open,
    onOpenChange,
    onVerified,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVerified: () => void;
  }) =>
    open ? (
      <>
        <button type="button" data-verify onClick={onVerified}>
          unlock
        </button>
        <button type="button" data-cancel onClick={() => onOpenChange(false)}>
          cancel
        </button>
      </>
    ) : null,
}));

const { HideAmountsSection } = await import("./HideAmountsSection");

let container: HTMLDivElement;
let root: Root;
const onBack = vi.fn();

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.history.replaceState(null, "");
  store.saved = new Set();
  store.set.mockClear();
  store.set.mockImplementation(async () => true);
  onBack.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 30));
});

/** 사이드바 한 칸 — 셸의 이동과 같은 길(useLinkClick → 공용 가드) */
function SideLink() {
  const link = useLinkClick();
  const { pathname } = useLocation();
  return (
    <>
      <a href="/desk/expense" data-side onClick={link("/desk/expense")}>
        가계부
      </a>
      <p data-where>{pathname}</p>
    </>
  );
}

function render(mobile: boolean) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/desk/settings"]}>
        <LeaveGuardProvider>
          <SnackbarProvider>
            <SideLink />
            <HideAmountsSection mobile={mobile} onBack={onBack} />
          </SnackbarProvider>
        </LeaveGuardProvider>
      </MemoryRouter>,
    ),
  );
}
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const where = () => container.querySelector("[data-where]")!.textContent;
const asked = () =>
  document.body.textContent?.includes("hideAmounts.discardTitle") ?? false;
const checks = () => [
  ...container.querySelectorAll<HTMLElement>('[role="checkbox"]'),
];
const docBtn = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
const touch = () => act(() => checks()[0]!.click());
const side = () =>
  act(() => {
    container
      .querySelector<HTMLElement>("[data-side]")!
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
  });
const browserBack = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

describe("금액 가리기 — 바꾼 채 떠나기", () => {
  it("사이드바 이동: 묻고, [나가기] 면 간다", async () => {
    render(false);
    touch();
    side();
    await tick();
    expect(asked()).toBe(true);
    expect(where()).toBe("/desk/settings");
    act(() => docBtn("hideAmounts.discardConfirm")!.click());
    await tick();
    expect(where()).toBe("/desk/expense");
  });

  it("브라우저 뒤로 가기: 묻는다 — [나가기] 면 계정으로(onBack)", async () => {
    render(false);
    touch();
    await tick();
    browserBack();
    await tick();
    expect(asked()).toBe(true);
    expect(onBack).not.toHaveBeenCalled();
    act(() => docBtn("hideAmounts.discardConfirm")!.click());
    await tick();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("폰 ← : 묻는다", async () => {
    render(true);
    touch();
    act(() =>
      container.querySelector<HTMLButtonElement>("[aria-label=back]")!.click(),
    );
    await tick();
    expect(asked()).toBe(true);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("바꾼 게 없으면 묻지 않고 바로 간다(사이드바 · 뒤로 가기 칸도 쌓지 않는다)", async () => {
    render(false);
    expect(window.history.state?.grooOverlayBack).toBeUndefined();
    side();
    await tick();
    expect(asked()).toBe(false);
    expect(where()).toBe("/desk/expense");
  });

  it("저장이 나가 있는 동안(busy)은 사이드바 · 뒤로 가기 · ← 를 받지 않는다 — 묻지도 떠나지도 않는다", async () => {
    let resolve!: (ok: boolean) => void;
    store.set.mockImplementation(
      () =>
        new Promise<boolean>((r) => {
          resolve = r;
        }),
    );
    render(true);
    touch();
    act(() => docBtn("save")!.click());
    await tick();
    side();
    browserBack();
    act(() =>
      container.querySelector<HTMLButtonElement>("[aria-label=back]")!.click(),
    );
    await tick();
    expect(asked()).toBe(false);
    expect(where()).toBe("/desk/settings");
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => resolve(false));
  });
});
