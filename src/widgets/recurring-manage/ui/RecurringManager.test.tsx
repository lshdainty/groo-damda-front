// 반복 거래 관리(I-20 D 21 ~ 25) — 종류별 묶음(지출 → 수입 → 이체) · 묶음 머리 "이번 달" 합 · 줄 · 줄 누름 = 상세 · 줄 ⋮ 없음.
// 합은 규칙으로 센다(매주 · 매년 포함, 쉬는 반복 제외) — 셈 표 자체는 recurring-schedule.test.ts 가 본다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SwipeActionsProvider } from "@/shared/ds/swipe-actions";
import { MINUS } from "@/shared/lib/groo/format";
import type { RecurringTransaction } from "@/entities/recurring-transaction";
import type { TxKind } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  items: [] as RecurringTransaction[],
  isLoading: false,
  isError: false,
}));

vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => ({
    data: state.isError ? undefined : state.items,
    isLoading: state.isLoading,
    isError: state.isError,
    refetch: () => {},
  }),
  useToggleRecurringTransaction: () => ({ mutate: () => {}, isPending: false }),
  useDeleteRecurringTransaction: () => ({
    mutate: () => {},
    mutateAsync: () => Promise.resolve(),
    isPending: false,
  }),
}));
vi.mock("@/features/expense", () => ({
  useExpenseCategories: () => ({ data: [], isLoading: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {} }),
}));
// 추가·상세 다이얼로그는 자체 쿼리를 여럿 건다 — 여기선 목록만 본다.
vi.mock("@/features/recurring-transaction/ui/RecurringAddDialog", () => ({
  RecurringAddDialog: () => null,
}));
vi.mock("@/features/recurring-transaction/ui/RecurringDetailDialog", () => ({
  // 열렸는지만 본다 — 안의 내용은 이 다이얼로그의 자기 테스트가 본다.
  RecurringDetailDialog: (p: { item: { rowId: number } }) => (
    <div data-testid="recurring-detail" data-id={p.item.rowId} />
  ),
}));

const { RecurringManager } = await import("./RecurringManager");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  state.items = [];
  state.isLoading = false;
  state.isError = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const txOf = (
  amount: number,
  expenseType: TxKind = "EXPENSE",
): RecurringTransaction => ({
  rowId: 1,
  userRowId: 1,
  categoryRowId: null,
  categoryName: null,
  assetRowId: null,
  assetName: null,
  toAssetRowId: null,
  toAssetName: null,
  fee: null,
  interestAmount: null,
  sourceExpenseRowId: null,
  expenseType,
  amount,
  description: "구독",
  merchant: null,
  paymentMethod: null,
  frequency: "MONTHLY",
  intervalValue: 1,
  dayOfWeek: null,
  dayOfMonth: 1,
  executionTime: null,
  startDate: "2026-01-01",
  endDate: null,
  maxOccurrences: null,
  executedCount: 0,
  nextExecutionDate: "2099-01-01",
  lastExecutedAt: null,
  isActive: "Y",
  autoLog: false,
  notifyDayBefore: false,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
});

// 시험 시계 고정 — 이번 달 = 2026년 10월(데이터의 날짜도 이 달에 걸려 있다)
const NOW = new Date(2026, 9, 23);

function render(mobile: boolean): string {
  act(() =>
    root.render(
      <SwipeActionsProvider>
        <RecurringManager mobile={mobile} now={NOW} />
      </SwipeActionsProvider>,
    ),
  );
  return container.textContent ?? "";
}

const named = (id: number, over: Partial<RecurringTransaction>) => ({
  ...txOf(7_000),
  rowId: id,
  ...over,
});

describe.each([
  ["폰", true],
  ["데스크톱", false],
])("종류별 묶음 (%s)", (_label, mobile) => {
  it("묶음 차례는 지출 → 수입 → 이체 · 빈 묶음은 그리지 않는다", () => {
    state.items = [
      named(1, { expenseType: "TRANSFER", description: "이체줄" }),
      named(2, { expenseType: "INCOME", description: "수입줄" }),
      named(3, { description: "지출줄" }),
    ];
    render(mobile);
    const heads = [...container.querySelectorAll("h2")].map(
      (h) => h.textContent,
    );
    expect(heads).toEqual([
      'groupTitle{"kind":"kindExpense","count":1}',
      'groupTitle{"kind":"kindIncome","count":1}',
      'groupTitle{"kind":"kindTransfer","count":1}',
    ]);
    state.items = [named(3, { description: "지출줄" })];
    render(mobile);
    expect(container.querySelectorAll("h2")).toHaveLength(1);
  });

  it("지출 합은 U+2212 부호 · 수입 합은 + · 이체 묶음에는 합이 없다", () => {
    state.items = [
      named(1, {
        description: "지출줄",
        amount: 7_560,
        startDate: "2026-01-01",
      }),
      named(2, {
        expenseType: "INCOME",
        description: "수입줄",
        amount: 3_200_000,
      }),
      named(3, { expenseType: "TRANSFER", description: "이체줄" }),
    ];
    const out = render(mobile);
    expect(out).toContain(`monthLead ${MINUS}7,560원`);
    expect(out).toContain("monthLead +3,200,000원");
    expect(out.match(/monthLead/g)).toHaveLength(2);
  });

  it("쉬는 반복은 합에서 빼고 줄에 배지를 단다(흐리지 않는다)", () => {
    state.items = [
      named(1, { description: "쉬는줄", amount: 9_999, isActive: "N" }),
    ];
    const out = render(mobile);
    // 합이 0 이면 부호 없이 "0원"(앱과 같다)
    expect(out).toContain("monthLead 0원");
    expect(out).not.toContain(`${MINUS}0원`);
    expect(out).toContain("paused");
    const row = container.querySelector<HTMLElement>("[data-slot=list-item]")!;
    expect(row.style.opacity).toBe("");
  });

  it("목록이 없으면 빈 화면 · 실패하면 실패 화면", () => {
    state.items = [];
    expect(render(mobile)).toContain("emptyTitle");
    state.isError = true;
    expect(render(mobile)).toContain("loadFailed");
  });
});

describe("줄", () => {
  const rows = () => [
    ...container.querySelectorAll<HTMLElement>("[data-slot=list-body]"),
  ];

  it("줄 끝 ⋮ 가 없다 — 좁은 목록 줄은 누르면 상세로 들어간다(10-25 원칙)", () => {
    state.items = [txOf(7_000)];
    render(true);
    expect(container.querySelector("button[aria-label*='moreOf']")).toBeNull();
    expect(container.querySelector("[data-slot=menu-trigger]")).toBeNull();
  });

  it("줄을 누르면 상세가 열린다(폰 · 데스크톱 모두)", () => {
    for (const mobile of [true, false]) {
      state.items = [txOf(7_000)];
      render(mobile);
      const r = rows().find((el) => el.textContent?.includes("구독"));
      expect(r).toBeTruthy();
      act(() => r!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(
        document.body.querySelector("[data-testid='recurring-detail']"),
      ).not.toBeNull();
      act(() => root.render(<div />));
    }
  });

  it("지출 금액은 빨강이 아니라 fg-neutral · 수입은 fg-brand", () => {
    state.items = [
      named(1, { description: "지출줄" }),
      named(2, { expenseType: "INCOME", description: "수입줄" }),
    ];
    render(true);
    const amounts = [...container.querySelectorAll<HTMLElement>("span")].filter(
      (el) =>
        /^[−+]7,000원$/.test(el.textContent ?? "") &&
        el.className.includes("font-bold"),
    );
    expect(amounts.map((a) => a.className.includes("text-fg-neutral"))).toEqual(
      [true, false],
    );
    expect(amounts[1]!.className).toContain("text-fg-brand");
  });

  it("금액이 0 이면 부호 없이 '0원' — 지출 · 수입 모두(색은 종류를 따른다)", () => {
    state.items = [
      named(1, { description: "지출영", amount: 0 }),
      named(2, { expenseType: "INCOME", description: "수입영", amount: 0 }),
    ];
    render(true);
    const amounts = [...container.querySelectorAll<HTMLElement>("span")].filter(
      (el) =>
        /0원$/.test(el.textContent ?? "") && el.className.includes("font-bold"),
    );
    expect(amounts.map((a) => a.textContent)).toEqual(["0원", "0원"]);
    expect(amounts[1]!.className).toContain("text-fg-brand");
    expect(container.textContent).not.toMatch(/[−+]0원/);
  });
});
