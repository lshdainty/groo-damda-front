// 반복 거래의 계좌 고르기는 받는 중 · 못 받음 · 받음을 가른다(B2-6) — 받는 중을 "계좌가 없어요" 로 보이지 않는다.
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";

import { AssetPickRow } from "./recurring-pickers";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const bank = {
  rowId: 3,
  assetName: "주거래",
  institution: null,
  assetType: "BANK_ACCOUNT",
} as unknown as Asset;

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
  window.history.replaceState(null, "");
  // 1280 미만(시트)
  window.matchMedia = ((query: string) => ({
    matches: false,
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
  await new Promise((r) => setTimeout(r, 100));
});

const render = (node: ReactNode) => act(() => root.render(node));
const openRow = async () => {
  act(() => {
    container.querySelector<HTMLButtonElement>("button")!.click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-body]")!;

const row = (o: Partial<Parameters<typeof AssetPickRow>[0]>) => (
  <AssetPickRow
    title="계좌"
    placeholder="고르기"
    surfaceTitle="계좌"
    assets={[]}
    value={null}
    onChange={() => {}}
    emptyText="noAssets"
    {...o}
  />
);

describe("반복 거래 계좌 고르기 — 받는 중 · 못 받음 · 받음", () => {
  it("받는 중이면 Skeleton — 빈 글이 아니다", async () => {
    render(row({ pending: true }));
    await openRow();
    expect(sheet().querySelector("[data-slot=pick-skeleton]")).not.toBeNull();
    expect(sheet().textContent).not.toContain("noAssets");
    expect(sheet().textContent).not.toContain("manager.loadFailed");
  });

  it("못 받았으면 실패 + [다시 시도] — 누르면 다시 받는다", async () => {
    const onRetry = vi.fn();
    render(row({ pending: true, failed: true, onRetry }));
    await openRow();
    expect(sheet().textContent).toContain("manager.loadFailed");
    expect(sheet().textContent).toContain("loadFailedDesc");
    expect(sheet().textContent).not.toContain("noAssets");
    const retry = Array.from(sheet().querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "retry",
    )!;
    act(() => retry.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("받았는데 비었으면 빈 글, 있으면 목록", async () => {
    render(row({}));
    await openRow();
    expect(sheet().textContent).toContain("noAssets");
    expect(sheet().querySelector("[data-slot=pick-skeleton]")).toBeNull();
    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    render(row({ assets: [bank] }));
    await openRow();
    expect(sheet().textContent).toContain("주거래");
    expect(sheet().textContent).not.toContain("noAssets");
  });
});
