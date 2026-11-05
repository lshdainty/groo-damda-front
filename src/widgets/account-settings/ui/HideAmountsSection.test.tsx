// 금액 가리기(I-14 H 35 ~ 41 · J 46) — 5-B List 체크 줄. 기능·저장 규칙(고르는 동안 반영 안 함 · 푸는 저장만 본인 확인 ·
// 바뀐 채 나가면 확인)은 그대로 잠그고, 새 모양(탭 글에 숫자 0 · 전체 탭은 화면 이름 묶음 · 모두 선택은 지금 탭만)을 잠근다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  set: vi.fn(),
}));
vi.mock("@/shared/lib/groo/hide-amounts-core", () => ({
  useHiddenCards: () => store.saved,
  setHiddenCards: store.set,
}));
// 본인 확인 표면은 열림만 본다 — 맞았다고 치려면 data-verify 를 누른다
vi.mock("./HideAmountsUnlockSurface", () => ({
  HideAmountsUnlockSurface: ({
    open,
    onVerified,
  }: {
    open: boolean;
    onVerified: () => void;
  }) =>
    open ? (
      <button type="button" data-verify onClick={onVerified}>
        unlock
      </button>
    ) : null,
}));

const { HideAmountsSection } = await import("./HideAmountsSection");
const { cardsOfPage } = await import("@/shared/lib/groo/hide-amounts-cards");
const ASSET = cardsOfPage("asset").length;

let container: HTMLDivElement;
let root: Root;
const onBack = vi.fn();

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  store.saved = new Set();
  store.set.mockClear();
  onBack.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(mobile: boolean) {
  act(() =>
    root.render(<HideAmountsSection mobile={mobile} onBack={onBack} />),
  );
}
const q = (sel: string) => container.querySelector<HTMLElement>(sel);
const checks = () => [
  ...container.querySelectorAll<HTMLElement>('[role="checkbox"]'),
];
const btn = (text: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  );
const click = (el: HTMLElement | undefined) => {
  if (!el) throw new Error("없음");
  act(() => el.click());
};

describe("HideAmountsSection", () => {
  it("탭 글에 숫자가 없고 탭은 전체 + 화면 여덟이다", () => {
    render(true);
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(9);
    for (const t of tabs) expect(t.textContent).not.toMatch(/\d/);
  });

  it("전체 탭은 화면 이름마다 묶고, 화면 탭은 묶음 제목 없이 그 화면 줄만 보인다", () => {
    render(true);
    const heads = [...container.querySelectorAll("h4")].map(
      (h) => h.textContent,
    );
    expect(heads).toEqual([
      "hideAmounts.page.home",
      "hideAmounts.page.asset",
      "hideAmounts.page.ledger",
      "hideAmounts.page.stats",
      "hideAmounts.page.budget",
      "hideAmounts.page.stocks",
      "hideAmounts.page.dutchpay",
      "hideAmounts.page.etc",
    ]);
    // 「예정 결제」 는 홈 · 자산 묶음 아래 각자 하나 — 묶음(fieldset) = 거래 종류 1 + 화면 8
    expect(container.querySelectorAll("fieldset")).toHaveLength(9);
    const asset = [
      ...container.querySelectorAll<HTMLElement>('[role="tab"]'),
    ].find((t) => t.textContent === "hideAmounts.page.asset");
    click(asset);
    expect(container.querySelectorAll("h4")).toHaveLength(0);
    expect(checks().length).toBe(3 + ASSET);
  });

  it("모두 선택은 지금 탭만 고르고, 다 골랐으면 모두 해제가 된다", () => {
    render(true);
    const asset = [
      ...container.querySelectorAll<HTMLElement>('[role="tab"]'),
    ].find((t) => t.textContent === "hideAmounts.page.asset");
    click(asset);
    click(btn("hideAmounts.selectAll"));
    const on = checks().filter(
      (c) => c.getAttribute("aria-checked") === "true",
    );
    expect(on).toHaveLength(ASSET);
    expect(btn("hideAmounts.clearAll")).toBeTruthy();
    expect(q("h3[id$='screens']")?.textContent).toContain(
      `"selected":${ASSET}`,
    );
  });

  it("가리기만 늘리는 저장은 본인 확인 없이 반영하고 나간다", () => {
    render(true);
    click(checks()[0]);
    click(btn("save"));
    expect(q("[data-verify]")).toBeNull();
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("푸는 카드가 있는 저장은 본인 확인을 먼저 열고, 맞으면 그때 반영한다", () => {
    store.saved = new Set(["kind.expense"]);
    render(true);
    click(checks()[0]); // kind.expense 해제
    click(btn("save"));
    expect(store.set).not.toHaveBeenCalled();
    click(q("[data-verify]") ?? undefined);
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("바뀐 채 ← 를 누르면 나가기 확인이 뜨고, 안 바뀌었으면 바로 나간다", () => {
    render(true);
    click(q('button[aria-label="back"]') ?? undefined);
    expect(onBack).toHaveBeenCalledTimes(1);
    onBack.mockClear();
    click(checks()[0]);
    click(q('button[aria-label="back"]') ?? undefined);
    expect(onBack).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeTruthy();
  });

  it("데스크톱은 제목 줄 + 카드 바닥 [저장] 이고 바뀐 것이 없으면 막혀 있다", () => {
    render(false);
    expect(q("[data-manager-head]")?.textContent).toBe("hideAmounts.label");
    expect(btn("save")?.disabled).toBe(true);
    click(checks()[0]);
    expect(btn("save")?.disabled).toBe(false);
  });
});
