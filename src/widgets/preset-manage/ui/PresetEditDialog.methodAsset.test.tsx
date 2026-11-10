import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { ExpenseCategory } from "@/entities/expense";
import type { ExpenseTemplate } from "@/entities/expense-template";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const assetState = vi.hoisted(() => ({
  loaded: true,
  removed: [] as number[],
  /** 자산 조회 실패 — 받은 목록 없이 */
  fail: false,
  refetched: 0,
}));
const saveState = vi.hoisted(() => ({ fail: false }));
const catState = vi.hoisted(() => ({ fail: false, args: [] as unknown[] }));
const sent = vi.hoisted(() => ({
  update: null as Record<string, unknown> | null,
  create: null as Record<string, unknown> | null,
}));

// 라벨 키를 그대로 흘려보낸다 — 여기서 보는 건 페이로드뿐이다.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: (opts?: unknown) => {
    catState.args.push(opts);
    return catState.fail
      ? {
          data: undefined,
          isLoading: false,
          isError: true,
          errorUpdateCount: 1,
          refetch: () => {},
        }
      : {
          data: categories,
          isLoading: false,
          isError: false,
          errorUpdateCount: 0,
        };
  },
  useExpenseTemplates: () => ({ data: [], isLoading: false }),
  useCreateExpenseTemplate: () => ({
    mutate: (
      data: Record<string, unknown>,
      opts?: { onError?: () => void },
    ) => {
      sent.create = data;
      if (saveState.fail) opts?.onError?.();
    },
    isPending: false,
  }),
  useUpdateExpenseTemplate: () => ({
    mutate: (
      { data }: { id: number; data: Record<string, unknown> },
      opts?: { onError?: () => void },
    ) => {
      sent.update = data;
      if (saveState.fail) opts?.onError?.();
    },
    isPending: false,
  }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: assetState.loaded
      ? {
          assets: [asset, savings, card, loan].filter(
            (a) => !assetState.removed.includes(a.rowId),
          ),
        }
      : undefined,
    isLoading: !assetState.loaded && !assetState.fail,
    isError: assetState.fail,
    isFetching: false,
    refetch: async () => {
      assetState.refetched += 1;
      return { data: undefined };
    },
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

/** 식비(하위 없음) · 교통(하위 버스) — 하위가 있는 상위는 고를 수 없다 */
const categories: ExpenseCategory[] = [
  category,
  {
    ...category,
    rowId: 13,
    categoryName: "교통",
    sortOrder: 1,
    hasChildren: true,
  },
  {
    ...category,
    rowId: 14,
    categoryName: "버스",
    sortOrder: 2,
    parentRowId: 13,
  },
];

const asset: Asset = {
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

/** 받는 계좌 후보. */
const savings: Asset = {
  ...asset,
  rowId: 4,
  assetName: "청약",
  assetType: "SAVINGS",
  institution: "국민",
};

/** 이자 칸이 뜨는 유일한 조건 — 받는 자산이 대출. */
const loan: Asset = {
  ...asset,
  rowId: 6,
  assetName: "대출",
  assetType: "LOAN",
  institution: null,
};

/** 이체 후보에서 빠져야 하는 카드. */
const card: Asset = {
  ...asset,
  rowId: 5,
  assetName: "체크",
  assetType: "CHECK_CARD",
  institution: "국민",
};

const { PresetEditDialog } = await import("./PresetEditDialog");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  assetState.loaded = true;
  assetState.removed = [];
  assetState.fail = false;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  sent.update = null;
  sent.create = null;
  window.history.replaceState(null, "");
  // 폭 1280 미만(시트) — 고르기는 폼 시트 위 고르기 시트다
  window.matchMedia = ((query: string) => ({
    matches: query.includes("never-wide"),
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

function render(preset: ExpenseTemplate | null) {
  act(() =>
    root.render(<PresetEditDialog preset={preset} onClose={() => {}} />),
  );
}

const tick = (ms = 0) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const click = (el: Element | undefined | null) => {
  if (!el) throw new Error("누를 요소를 찾지 못했다");
  return act(async () => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
};

/** 폼 줄 — 제목으로 찾는다 */
const rowOf = (title: string) =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot=list-item]"),
  ).find(
    (li) => li.querySelector("[data-slot=list-title]")?.textContent === title,
  )!;
const valueOf = (title: string) =>
  rowOf(title).querySelector("[data-slot=list-suffix]")?.textContent;
const rowButton = (title: string) =>
  rowOf(title).querySelector<HTMLElement>("[data-slot=list-body]");
/**
 * 지금 열린 맨 위 표면 — 고르기 시트는 고른 뒤 닫히는 동안(vaul 이 내려가는 시간, data-state=closed) 문서에 남는다. 문서 전체를
 * 뒤지면 닫히는 앞 시트(보내는 계좌)의 줄을 눌러 버린다 — 열린 표면 안에서만 찾는다
 */
const topSurface = (): ParentNode =>
  Array.from(
    document.querySelectorAll("[role=dialog]:not([data-state=closed])"),
  ).slice(-1)[0] ?? document;
/** 고르기 시트 안의 줄 */
const pickItem = (text: string) =>
  Array.from(
    topSurface().querySelectorAll<HTMLElement>("[data-slot=list-body]"),
  ).find((b) => b.textContent?.includes(text));
const pickItemTitles = () =>
  Array.from(
    topSurface().querySelectorAll<HTMLElement>("[data-slot=list-body]"),
  ).map((b) => b.querySelector("[data-slot=list-title]")?.textContent);

/** 줄을 눌러 고르기 시트를 열고 항목을 고른다 */
async function pick(rowTitle: string, itemText: string) {
  await click(rowButton(rowTitle));
  await tick();
  await click(pickItem(itemText));
  await tick();
}

describe("프리셋 폼 — 결제 수단에 맞는 계좌 · 카드만 나온다 (사용자 결정 11-10)", () => {
  it("줄 순서는 결제 수단 → 계좌 · 카드다", () => {
    render(null);
    const rows = Array.from(
      document.querySelectorAll("[data-slot=list-title]"),
    ).map((e) => e.textContent);
    expect(rows.indexOf("paymentMethodLabel")).toBeGreaterThan(-1);
    expect(rows.indexOf("paymentMethodLabel")).toBeLessThan(
      rows.indexOf("accountCard"),
    );
  });

  it("종류가 수입이면 줄 이름이 수입 방식 · 입금 계좌, 지출은 결제 수단 · 계좌 · 카드다", () => {
    render({
      rowId: 9,
      templateName: "월급",
      expenseType: "INCOME",
      amount: 0,
    } as unknown as ExpenseTemplate);
    const names = () =>
      Array.from(document.querySelectorAll("[data-slot=list-title]")).map(
        (e) => e.textContent,
      );
    expect(names()).toContain("addTx.incomeMethod");
    expect(names()).toContain("addTx.depositAccount");
    expect(names()).not.toContain("paymentMethodLabel");
    expect(names()).not.toContain("accountCard");
    act(() => root.unmount());
    root = createRoot(container);
    render(null);
    expect(names()).toContain("paymentMethodLabel");
    expect(names()).toContain("accountCard");
    expect(names()).not.toContain("addTx.incomeMethod");
    expect(names()).not.toContain("addTx.depositAccount");
  });

  it("카드를 고르면 계좌 시트에 카드만 나온다", async () => {
    render(null);
    await pick("paymentMethodLabel", "form.paymentMethod.CARD");
    await click(rowButton("accountCard"));
    await tick();
    expect(pickItemTitles()).toEqual(["preset.noAccount", "체크"]);
  });

  it("계좌를 고른 뒤 결제 수단을 안 맞는 것으로 바꾸면 계좌가 비워진다", async () => {
    render(null);
    await pick("accountCard", "주거래");
    expect(valueOf("accountCard")).toContain("주거래");
    await pick("paymentMethodLabel", "form.paymentMethod.CARD");
    expect(valueOf("accountCard")).toBe("preset.noAccount");
  });

  it("수입이면 맞는 계좌가 없을 때 입금 계좌 문구가 뜬다", async () => {
    assetState.removed = [5];
    render({
      rowId: 9,
      templateName: "월급",
      expenseType: "INCOME",
      amount: 0,
    } as unknown as ExpenseTemplate);
    await pick("addTx.incomeMethod", "form.paymentMethod.CARD");
    await click(rowButton("addTx.depositAccount"));
    await tick();
    expect(document.body.textContent).toContain("addTx.noPickableDepositAsset");
    expect(document.body.textContent).not.toContain("addTx.noPickableAsset");
  });

  it("맞는 계좌 · 카드가 없으면 시트에 안내가 뜬다", async () => {
    assetState.removed = [5];
    render(null);
    await pick("paymentMethodLabel", "form.paymentMethod.CARD");
    await click(rowButton("accountCard"));
    await tick();
    expect(document.body.textContent).toContain("addTx.noPickableAsset");
  });
});
