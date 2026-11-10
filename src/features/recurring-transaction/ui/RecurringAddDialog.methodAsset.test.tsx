import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { ExpenseCategory } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const assetState = vi.hoisted(() => ({ list: [] as Asset[] }));
const sent = vi.hoisted(() => ({
  create: null as Record<string, unknown> | null,
  update: null as Record<string, unknown> | null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: () => ({ data: [category], isLoading: false }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: { assets: assetState.list },
    isLoading: false,
  }),
}));
vi.mock("@/features/recurring-transaction", () => ({
  useCreateRecurringTransaction: () => ({
    mutate: (data: Record<string, unknown>) => {
      sent.create = data;
    },
    isPending: false,
  }),
  useUpdateRecurringTransaction: () => ({
    mutate: (arg: { data: Record<string, unknown> }) => {
      sent.update = arg.data;
    },
    isPending: false,
  }),
}));

const category: ExpenseCategory = {
  rowId: 11,
  categoryName: "식비",
  icon: null,
  color: "#2c70bf",
  expenseType: "EXPENSE",
  sortOrder: 0,
  parentRowId: null,
  hasChildren: false,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};

const bank: Asset = {
  rowId: 3,
  userRowId: 1,
  assetName: "주거래",
  assetType: "BANK_ACCOUNT",
  balance: 0,
  cashBalance: 0,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: "국민",
  memo: null,
  sortOrder: 0,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
};
const savings: Asset = {
  ...bank,
  rowId: 4,
  assetName: "청약",
  assetType: "SAVINGS",
};
const card: Asset = {
  ...bank,
  rowId: 5,
  assetName: "체크",
  assetType: "CHECK_CARD",
};

const { RecurringAddDialog } = await import("./RecurringAddDialog");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  sent.create = null;
  sent.update = null;
  assetState.list = [bank, savings, card];
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
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

const rowBtn = (key: string) =>
  [...document.body.querySelectorAll<HTMLElement>("button")].find((b) =>
    b.textContent?.startsWith(key),
  )!;
const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
const surface = () =>
  [
    ...document.querySelectorAll("[role=dialog]:not([data-state=closed])"),
  ].slice(-1)[0]!;
const choose = async (rowKey: string, text: string) => {
  await click(rowBtn(rowKey));
  const b = [...surface().querySelectorAll<HTMLElement>("button")].find((x) =>
    x.textContent?.includes(text),
  );
  await click(b!);
};

describe("반복 폼 — 결제 수단에 맞는 계좌 · 카드만 나온다 (사용자 결정 11-10)", () => {
  it("줄 순서는 결제 수단 → 계좌 · 카드다", () => {
    act(() => root.render(<RecurringAddDialog onClose={() => {}} />));
    const t = document.body.textContent ?? "";
    expect(t.indexOf("paymentMethodLabel")).toBeGreaterThan(-1);
    expect(t.indexOf("paymentMethodLabel")).toBeLessThan(
      t.indexOf("accountCard"),
    );
  });

  it("카드를 고르면 계좌 시트에 카드만 나온다", async () => {
    act(() => root.render(<RecurringAddDialog onClose={() => {}} />));
    await choose("paymentMethodLabel", "form.paymentMethod.CARD");
    await click(rowBtn("accountCard"));
    const text = surface().textContent ?? "";
    expect(text).toContain("체크");
    expect(text).not.toContain("주거래");
  });

  it("계좌를 고른 뒤 결제 수단을 안 맞는 것으로 바꾸면 계좌가 비워진다", async () => {
    act(() => root.render(<RecurringAddDialog onClose={() => {}} />));
    await choose("accountCard", "주거래");
    expect(rowBtn("accountCard").closest("li")?.textContent).toContain(
      "주거래",
    );
    await choose("paymentMethodLabel", "form.paymentMethod.CARD");
    expect(rowBtn("accountCard").closest("li")?.textContent).not.toContain(
      "주거래",
    );
  });

  it("맞는 계좌 · 카드가 없으면 시트에 같은 안내가 뜬다", async () => {
    assetState.list = [bank];
    act(() => root.render(<RecurringAddDialog onClose={() => {}} />));
    await choose("paymentMethodLabel", "form.paymentMethod.CARD");
    await click(rowBtn("accountCard"));
    expect(surface().textContent).toContain("addTx.noPickableAsset");
  });

  it("수입이면 맞는 계좌가 없을 때 입금 계좌 문구가 뜬다", async () => {
    assetState.list = [bank];
    act(() => root.render(<RecurringAddDialog onClose={() => {}} />));
    await click(rowBtn("income"));
    await choose("addTx.incomeMethod", "form.paymentMethod.CARD");
    await click(rowBtn("addTx.depositAccount"));
    expect(surface().textContent).toContain("addTx.noPickableDepositAsset");
    expect(surface().textContent).not.toContain("addTx.noPickableAsset");
  });
});
