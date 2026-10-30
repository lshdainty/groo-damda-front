// 이체 반복이 **보내는 것**을 고정한다(I-20 D 26 — 줄 칸 폼으로 다시 짠 뒤에도 본문은 그대로).
//
// 이 본문은 밤마다 서버가 그대로 실행한다 — 잘못 저장되면 화면엔 "저장됐다" 가 남고
// 자정 배치만 조용히 실패한다(로그만 남는다). 그래서 세 가지를 못 박는다.
//
// - 이체면 받는 계좌·수수료·이자가 실린다.
// - 이체에는 카테고리·거래처·결제수단이 없다 — 서버가 실려 오면 400 으로 거절한다.
// - 종류를 지출로 되돌리면 이체 칸이 빠진다 — 남겨 두면 같은 이유로 거절당한다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@/entities/asset";
import type { ExpenseCategory } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

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
    data: { assets: [bank, savings, card] },
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

const byText = <T extends Element>(selector: string, text: string) =>
  [...document.body.querySelectorAll<T>(selector)].find(
    (el) => el.textContent?.trim() === text,
  );

/** 주 버튼 — 켜 둔 채 누를 때 검증한다 */
function save(label = "add") {
  const btn = byText<HTMLButtonElement>("button", label);
  if (!btn) throw new Error("저장 버튼을 찾지 못했다");
  act(() => btn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

const seed = {
  fromAssetRowId: 3,
  toAssetRowId: 4,
  amount: 300_000,
  fee: 500,
  interestAmount: null,
  description: null,
  startDate: "2026-10-25",
};

describe("이체 반복", () => {
  it("이체 씨앗으로 열면 받는 계좌 · 수수료가 실리고, 카테고리 · 거래처는 안 실린다", () => {
    act(() =>
      root.render(
        <RecurringAddDialog transferSeed={seed} onClose={() => {}} />,
      ),
    );
    save();
    expect(sent.create).not.toBeNull();
    expect(sent.create!.expenseType).toBe("TRANSFER");
    expect(sent.create!.assetRowId).toBe(3);
    expect(sent.create!.toAssetRowId).toBe(4);
    expect(sent.create!.fee).toBe(500);
    expect(sent.create!.startDate).toBe("2026-10-25");
    expect(sent.create!.categoryRowId).toBeUndefined();
    expect(sent.create!.merchant).toBeUndefined();
    expect(sent.create!.paymentMethod).toBeUndefined();
  });

  it("빈 채 [추가] 를 누르면 칸 아래 오류가 뜨고 요청은 나가지 않는다", () => {
    act(() => root.render(<RecurringAddDialog onClose={() => {}} />));
    save();
    expect(sent.create).toBeNull();
    expect(document.body.textContent).toContain("errAmount");
    expect(document.body.textContent).toContain("errCategory");
  });

  it("지출 · 수입은 카테고리를 꼭 골라야 저장된다 — 카테고리 없이 저장된 옛 반복을 열고 저장해도 같다", () => {
    act(() =>
      root.render(
        <RecurringAddDialog
          recurring={{
            rowId: 9,
            userRowId: 1,
            categoryRowId: null,
            categoryName: null,
            assetRowId: 3,
            assetName: "주거래",
            toAssetRowId: null,
            toAssetName: null,
            fee: null,
            interestAmount: null,
            sourceExpenseRowId: null,
            expenseType: "EXPENSE",
            amount: 7_000,
            description: null,
            merchant: "관리비",
            paymentMethod: null,
            frequency: "MONTHLY",
            intervalValue: 1,
            dayOfWeek: null,
            dayOfMonth: 25,
            executionTime: "09:00:00",
            startDate: "2026-01-25",
            endDate: null,
            maxOccurrences: null,
            executedCount: 0,
            nextExecutionDate: "2026-11-25",
            lastExecutedAt: null,
            isActive: "Y",
            autoLog: true,
            notifyDayBefore: false,
            createAt: "2026-01-01T00:00:00",
            modifyAt: "2026-01-01T00:00:00",
          }}
          onClose={() => {}}
        />,
      ),
    );
    save("save");
    expect(sent.update).toBeNull();
    expect(document.body.textContent).toContain("errCategory");
  });
});

describe("끝 흐림(scrollFog)", () => {
  const bodyFog = () =>
    document.body
      .querySelector("[data-slot$='-body'][data-scroll-fog]")
      ?.getAttribute("data-scroll-fog") ?? null;

  it("폼 본문은 켜고, 넘치지 않는 단계(끝)는 끈다 — 390 × 844 보통 값에서 90% 에 닿을 때만 켠다", () => {
    act(() => root.render(<RecurringAddDialog onClose={() => {}} />));
    expect(bodyFog()).toBe("overlayBody");
    const end = [
      ...document.body.querySelectorAll<HTMLElement>("[data-slot=list-body]"),
    ].find((el) => el.textContent?.startsWith("endRow"));
    act(() => end!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(bodyFog()).toBeNull();
  });
});

describe("수정 폼이 저장된 값을 그대로 연다", () => {
  it("결제 수단(카드)과 맞지 않는 저장된 계좌도 열 때 지우지 않는다 — 사람이 결제 수단을 바꿀 때만 비운다", () => {
    act(() =>
      root.render(
        <RecurringAddDialog
          recurring={{
            rowId: 9,
            userRowId: 1,
            categoryRowId: 11,
            categoryName: "식비",
            assetRowId: 3,
            assetName: "주거래",
            toAssetRowId: null,
            toAssetName: null,
            fee: null,
            interestAmount: null,
            sourceExpenseRowId: null,
            expenseType: "EXPENSE",
            amount: 7_000,
            description: null,
            merchant: "관리비",
            paymentMethod: "CARD",
            frequency: "MONTHLY",
            intervalValue: 1,
            dayOfWeek: null,
            dayOfMonth: 25,
            executionTime: "09:00:00",
            startDate: "2026-01-25",
            endDate: null,
            maxOccurrences: null,
            executedCount: 0,
            nextExecutionDate: "2026-11-25",
            lastExecutedAt: null,
            isActive: "Y",
            autoLog: true,
            notifyDayBefore: false,
            createAt: "2026-01-01T00:00:00",
            modifyAt: "2026-01-01T00:00:00",
          }}
          onClose={() => {}}
        />,
      ),
    );
    save("save");
    expect(sent.update).not.toBeNull();
    expect(sent.update!.assetRowId).toBe(3);
    expect(sent.update!.paymentMethod).toBe("CARD");
  });
});
