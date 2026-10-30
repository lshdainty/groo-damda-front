// 프리셋 칩은 **지금 탭의 종류만** 보여 준다.
//
// 종전엔 종류와 무관하게 사용 많은 순 8개였다(AddTxSheet.tsx:343-346). 지출 탭에서
// 수입 프리셋을 누르면 `applyPreset` 이 탭을 통째로 바꿔 버렸다 — 고르는 사람은
// "지출 하나를 빨리 넣으려고" 누른 것이라, 화면이 다른 탭으로 건너뛰는 건 사고다.
//
// 이체 탭에도 이제 칩이 뜬다(전엔 이체만 통째로 숨겼다). 그래서 필터가 없으면
// 이체 탭에 지출 프리셋이 뜨는, 반대 방향의 같은 사고가 난다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { ExpenseCategory } from "@/entities/expense";
import type { ExpenseTemplate } from "@/entities/expense-template";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let catFail = false;
const catCalls: unknown[] = [];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/features/expense", () => ({
  // 저장 뒤 토스트(D4·D9) — 이 파일은 그 갈래를 보지 않는다.
  useLedgerResultToast: () => () => {},
  useReplaceExpense: () => ({ mutate: () => {}, isPending: false }),
  useExpenseCategories: (opts?: unknown) => {
    catCalls.push(opts);
    return catFail
      ? {
          data: undefined,
          isLoading: false,
          isError: true,
          errorUpdateCount: 1,
          refetch: () => {},
        }
      : {
          data: [category],
          isLoading: false,
          isError: false,
          errorUpdateCount: 0,
        };
  },
  useExpenseTemplates: () => ({ data: templates, isLoading: false }),
  useCreateExpense: () => ({ mutate: () => {}, isPending: false }),
  useUpdateExpense: () => ({ mutate: () => {}, isPending: false }),
  useCreateExpenseTemplate: () => ({ mutate: () => {}, isPending: false }),
  useTouchExpenseTemplate: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({ data: { assets: [] }, isLoading: false }),
  useCreateTransfer: () => ({ mutate: () => {}, isPending: false }),
  useUpdateTransfer: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/sms", () => ({
  SmsPasteField: () => null,
  useCommitSms: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock("@/features/expense-split", () => ({
  useExpenseSplits: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/features/expense-split/ui/SplitTxDialog", () => ({
  SplitTxDialog: () => null,
}));
vi.mock("@/features/user", () => ({ useDefaultCurrency: () => "KRW" }));

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

const preset = (
  rowId: number,
  templateName: string,
  expenseType: ExpenseTemplate["expenseType"],
): ExpenseTemplate => ({
  rowId,
  userRowId: 1,
  templateName,
  categoryRowId: expenseType === "TRANSFER" ? null : 11,
  categoryName: expenseType === "TRANSFER" ? null : "식비",
  assetRowId: null,
  assetName: null,
  toAssetRowId: expenseType === "TRANSFER" ? 4 : null,
  toAssetName: expenseType === "TRANSFER" ? "청약" : null,
  fee: null,
  interestAmount: null,
  expenseType,
  amount: null,
  description: null,
  merchant: null,
  paymentMethod: null,
  useCount: 10 - rowId,
  sortOrder: 0,
  lockAmount: "N",
  lastUsedAt: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
});

let templates: ExpenseTemplate[] = [
  preset(1, "점심", "EXPENSE"),
  preset(2, "월급", "INCOME"),
  preset(3, "적금 이체", "TRANSFER"),
];

const { AddTxSheet } = await import("./AddTxSheet");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <AddTxSheet onClose={() => {}} mobile={false} expense={null} />,
    ),
  );
});

const baseTemplates = templates;

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  templates = baseTemplates;
  catFail = false;
  catCalls.length = 0;
});

const chipNames = () =>
  templates
    .map((p) => p.templateName)
    .filter((name) =>
      [...document.body.querySelectorAll("button")].some((b) =>
        b.textContent?.includes(name),
      ),
    );

/** radix Tabs 는 `mousedown` 에서 바꾼다 — `click` 만 쏘면 아무 일도 안 일어난다. */
function switchTab(label: string) {
  const tab = [
    ...document.body.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.trim() === label);
  if (!tab) throw new Error(`탭을 찾지 못했다: ${label}`);
  act(() => tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
}

describe("프리셋 칩은 지금 탭의 종류만 보여 준다", () => {
  it("지출 탭 — 지출 프리셋만", () => {
    expect(chipNames()).toEqual(["점심"]);
  });

  it("수입 탭 — 수입 프리셋만", () => {
    switchTab("income");
    expect(chipNames()).toEqual(["월급"]);
  });

  it("이체 탭 — 이체 프리셋만. 칩 줄 자체는 뜬다(전엔 통째로 숨겼다)", () => {
    switchTab("addTx.transfer");
    expect(chipNames()).toEqual(["적금 이체"]);
  });
});

describe('"모두 보기" — 지금 종류의 프리셋이 칩 수(8)보다 많을 때만 (I-20 C 20)', () => {
  const rerender = () =>
    act(() =>
      root.render(
        <AddTxSheet onClose={() => {}} mobile={false} expense={null} />,
      ),
    );
  const showAll = () =>
    [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      b.textContent?.includes("addTx.presetShowAll"),
    );

  it("지출 프리셋 9개 — 지출 탭에서 보인다", () => {
    templates = Array.from({ length: 9 }, (_, i) =>
      preset(i + 1, `지출${i + 1}`, "EXPENSE"),
    );
    rerender();
    expect(showAll()).toBeTruthy();
  });

  it("지출 3 + 수입 6 — 전체는 9개여도 지출 탭에서는 보이지 않는다", () => {
    templates = [
      ...Array.from({ length: 3 }, (_, i) =>
        preset(i + 1, `지출${i + 1}`, "EXPENSE"),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        preset(i + 10, `수입${i + 1}`, "INCOME"),
      ),
    ];
    rerender();
    expect(showAll()).toBeUndefined();
  });

  it("누르면 같은 시트가 '프리셋 고르기' 로 들어가 지금 종류의 프리셋 모두를 보인다", () => {
    templates = Array.from({ length: 9 }, (_, i) =>
      preset(i + 1, `지출${i + 1}`, "EXPENSE"),
    );
    rerender();
    act(() => showAll()!.click());
    const text = document.body.textContent ?? "";
    expect(text).toContain("addTx.presetPickTitle");
    // 칩 8개 밖의 아홉째도 고를 수 있다
    expect(text).toContain("지출9");
    expect(
      document.body.querySelector("[data-slot=text-input-value]"),
    ).toBeTruthy();
  });
});

describe("카테고리 조회 실패 — 프리셋 고르기 (I-20 20-2 후속)", () => {
  it("조회는 silent 이고, 실패하면 프리셋 줄 대신 실패 한 벌 + 다시 시도", () => {
    templates = Array.from({ length: 9 }, (_, i) =>
      preset(i + 1, `지출${i + 1}`, "EXPENSE"),
    );
    catFail = true;
    act(() =>
      root.render(
        <AddTxSheet onClose={() => {}} mobile={false} expense={null} />,
      ),
    );
    expect(
      catCalls.every((a) => (a as { silent?: boolean })?.silent === true),
    ).toBe(true);
    const all = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent?.includes("addTx.presetShowAll"));
    act(() => all!.click());
    const text = document.body.textContent ?? "";
    expect(text).toContain("preset.categoryLoadFailed");
    expect(text).not.toContain("지출9");
  });
});

describe("고르기 [다시 시도] 뒤 화면 (T7)", () => {
  it("실패 한 벌 → [다시 시도] 로 refetch → 받으면 프리셋 줄이 보인다", () => {
    templates = Array.from({ length: 9 }, (_, i) =>
      preset(i + 1, `지출${i + 1}`, "EXPENSE"),
    );
    catFail = true;
    const rerender = () =>
      act(() =>
        root.render(
          <AddTxSheet onClose={() => {}} mobile={false} expense={null} />,
        ),
      );
    rerender();
    const all = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent?.includes("addTx.presetShowAll"));
    act(() => all!.click());
    expect(document.body.textContent).toContain("preset.categoryLoadFailed");
    const retry = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find(
      (b) =>
        b.textContent?.includes("다시 시도") ||
        b.textContent?.includes("retry"),
    );
    act(() => retry!.click());
    catFail = false;
    rerender();
    expect(document.body.textContent).not.toContain(
      "preset.categoryLoadFailed",
    );
    expect(document.body.textContent).toContain("지출9");
  });
});
