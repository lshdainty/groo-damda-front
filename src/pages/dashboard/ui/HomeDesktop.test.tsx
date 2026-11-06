// 데스크톱 · 태블릿 홈 — 격자 · 카드 값 · 차트 타일 · 구역 안 실패(I-06 17 · 30 ~ 33)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => {} }));
vi.mock("@/shared/ui/groo/month-title", () => ({
  MonthTitle: ({
    month,
    max,
    onChange,
  }: {
    month: string;
    max?: string;
    onChange: (v: string) => void;
  }) => (
    <button
      data-testid="month-picker"
      data-month={month}
      data-max={max}
      onClick={() => onChange("2026-01")}
    />
  ),
}));

const q = (data: unknown, extra: object = {}) => ({
  data,
  isError: false,
  refetch: vi.fn(),
  ...extra,
});
const state = {
  summary: q(undefined) as ReturnType<typeof q>,
  asset: q(undefined) as ReturnType<typeof q>,
  monthly: q(undefined) as ReturnType<typeof q>,
  recent: q(undefined) as ReturnType<typeof q>,
  budgets: q(undefined) as ReturnType<typeof q>,
  cats: q(undefined) as ReturnType<typeof q>,
  recurring: q(undefined) as ReturnType<typeof q>,
};
vi.mock("@/features/dashboard", () => ({
  useDashboardSummary: () => state.summary,
}));
vi.mock("@/features/asset", () => ({ useAssetSummary: () => state.asset }));
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => state.recurring,
}));
const calls = {
  range: [] as [string, string][],
  expenses: [] as { startDate?: string; endDate?: string }[],
};
vi.mock("@/features/expense", () => ({
  useRangeSummary: (a: string, b: string) => {
    calls.range.push([a, b]);
    return state.monthly;
  },
  useExpenses: (params: { startDate?: string; endDate?: string }) => {
    calls.expenses.push(params);
    return state.recent;
  },
  useExpenseBudgets: () => state.budgets,
  useExpenseCategories: () => state.cats,
}));

const { HomeDesktop } = await import("./HomeDesktop");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  state.summary = q({
    todoSummary: { overDueCount: 0 },
    expenseSummary: { monthlyIncome: 0, monthlyExpense: 0 },
    upcomingEvents: [],
    recentTodos: [],
  });
  state.asset = q({
    netWorth: 100,
    totalAssets: 100,
    totalDebt: 0,
    lastMonthNetWorth: 0,
  });
  state.monthly = q({
    totalIncome: 1,
    totalExpense: 1,
    categoryBreakdown: [],
    monthlyBuckets: [],
  });
  calls.range.length = 0;
  calls.expenses.length = 0;
  state.recent = q([]);
  state.budgets = q([]);
  state.cats = q([]);
  state.recurring = q([]);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<HomeDesktop />));

describe("데스크톱 홈", () => {
  it("격자는 minmax(0, ·) 2 : 1 — 오른쪽 열 넘침을 막고 칸 사이 24 · 쌓은 카드 8", () => {
    render();
    const grid = container.querySelector(
      "[data-slot=home-desktop] .grid",
    ) as HTMLElement;
    expect(grid.className).toContain(
      "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
    );
    expect(grid.className).toContain("lg:gap-[var(--layout-gutter)]");
    for (const col of Array.from(grid.children))
      expect(col.className).toContain("gap-x2");
    // 본문 최대 720(태블릿) · 1040(1440 이상) 가운데
    const body = container.querySelector(
      "[data-slot=home-desktop] > div",
    ) as HTMLElement;
    expect(body.className).toContain("max-w-[var(--layout-max-low)]");
    expect(body.className).toContain("lg:max-w-[var(--layout-max-medium)]");
    // 여백 — 위 spacing-nav-to-title · 좌우 layout-margin · 아래 spacing-screen-bottom(숫자 눈금이 아니라 토큰 이름)
    const page = container.querySelector(
      "[data-slot=home-desktop]",
    ) as HTMLElement;
    for (const c of [
      "pt-nav-to-title",
      "px-[var(--layout-margin)]",
      "pb-screen-bottom",
    ])
      expect(page.className).toContain(c);
    expect(body.className).toContain("mx-auto");
  });

  it("카드는 ds Card — 순자산 hero · 목록 카드 4 · 옛 줄 사이 선 0", () => {
    render();
    expect(
      container.querySelectorAll("[data-slot=card][data-variant=hero]"),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll("[data-slot=card][data-body=list]"),
    ).toHaveLength(4);
    expect(container.querySelector("hr, [data-slot=list-divider]")).toBeNull();
  });

  it("수입 · 지출 지표 타일 둘 — 마지막 하나는 끌 수 없고 달 고르기가 있다", () => {
    render();
    const tiles = container.querySelectorAll<HTMLElement>(
      "[data-slot=chart-legend-tile]",
    );
    expect(tiles).toHaveLength(2);
    // 큰 글자 처리는 ds 가 한다 — 화면이 타일 폭을 덮지 않는다
    expect(
      container.querySelector("[data-slot=chart-legend-tiles]")!.className,
    ).not.toContain("min-w-max");
    act(() => tiles[0]?.click());
    const after = container.querySelectorAll<HTMLElement>(
      "[data-slot=chart-legend-tile]",
    );
    expect(after[0]?.getAttribute("aria-pressed")).toBe("false");
    // 하나 남으면 그 타일은 못 끈다
    act(() => after[1]?.click());
    expect(after[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(
      container.querySelector("[data-testid=month-picker]"),
    ).not.toBeNull();
  });

  it("수입 · 지출 카드 — 타일 ↔ 차트 8(타일 아래 8 · 본문 간격 0) · 차트 ↔ 안내 16", () => {
    render();
    const content = container.querySelector(
      "[data-slot=card-content]",
    ) as HTMLElement;
    expect(content.className).toContain("gap-0");
    expect(
      content.querySelector("[data-slot=chart-legend-list]")!.className,
    ).toContain("mb-x2");
    expect(
      Array.from(content.children).some((c) => c.className.includes("mt-x4")),
    ).toBe(true);
  });

  it("달을 골라도 '오늘 쓴 돈'은 늘 오늘 — 거래 질의가 오늘 하루이고 고른 달에 따라 바뀌지 않는다", () => {
    render();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(calls.expenses[calls.expenses.length - 1]).toEqual({
      startDate: today,
      endDate: today,
    });
    act(() =>
      (
        container.querySelector("[data-testid=month-picker]") as HTMLElement
      ).click(),
    );
    expect(calls.expenses[calls.expenses.length - 1]).toEqual({
      startDate: today,
      endDate: today,
    });
  });

  it("6개월 막대 · 전월 대비는 고른 달까지 — 범위가 고른 달 직전 5개월 첫날 ~ 고른 달 말일", () => {
    render();
    act(() =>
      (
        container.querySelector("[data-testid=month-picker]") as HTMLElement
      ).click(),
    );
    // 2026-01 을 골랐다 → 2025-08-01 ~ 2026-01-31
    expect(calls.range).toContainEqual(["2025-08-01", "2026-01-31"]);
  });

  it("도넛 합계 라벨 — 이번 달이 아니면 '{n}월 지출'", () => {
    state.monthly = q({
      totalIncome: 0,
      totalExpense: 100,
      monthlyBuckets: [],
      categoryBreakdown: [
        {
          categoryRowId: 1,
          categoryName: "식비",
          totalAmount: 100,
          parentCategoryRowId: null,
          expenseType: "EXPENSE",
        },
      ],
    });
    render();
    const total = () =>
      container.querySelector("[data-slot=home-donut-total]")?.textContent ??
      container.querySelector("[data-slot=chart-donut-center]")?.textContent ??
      "";
    expect(total()).toContain("summary.monthlyExpense");
    act(() =>
      (
        container.querySelector("[data-testid=month-picker]") as HTMLElement
      ).click(),
    );
    expect(total()).toContain("summary.monthExpenseN");
  });

  it("달 고르기는 화면 제목 줄 오른쪽 — 달 글 하나뿐(‹ › 없음), 카드 머리에는 없다(Q2-B · I-27)", () => {
    render();
    const right = container.querySelector(".page__head .right") as HTMLElement;
    expect(right.querySelector("[data-testid=month-picker]")).not.toBeNull();
    expect(right.querySelector("[aria-label='prevMonth']")).toBeNull();
    expect(right.querySelector("[aria-label='nextMonth']")).toBeNull();
    expect(
      container.querySelector(
        "[data-slot=card-header] [data-testid=month-picker]",
      ),
    ).toBeNull();
    // 홈은 미래 달을 이번 달로 되돌린다 — 달 글에 max(이번 달)를 넘긴다(사용자 10-29 (가))
    const title = right.querySelector("[data-testid=month-picker]")!;
    expect(title.getAttribute("data-max")).toMatch(/^\d{4}-\d{2}$/);
    expect(title.getAttribute("data-max")).toBe(
      title.getAttribute("data-month"),
    );
    // 고른 달이 같은 달 상태를 바꾼다 — 6개월 범위가 따라간다
    const before = calls.range.length;
    act(() =>
      (
        right.querySelector("[data-testid=month-picker]") as HTMLElement
      ).click(),
    );
    expect(calls.range.length).toBeGreaterThan(before);
  });

  it("한 질의가 실패하면 그 카드만 실패 — 0원 없음 · 다시 시도는 그 질의 하나만", () => {
    const refetch = vi.fn();
    state.monthly = q(undefined, { isError: true, refetch });
    render();
    expect(container.textContent).toContain("loadFailed.category");
    expect(container.textContent).toContain("loadFailed.month");
    // 실패한 카드 안에 0원이 없다 — 다른 카드(순자산 · 부채 0원 등)의 진짜 값은 따지지 않는다
    const failedCards = Array.from(
      container.querySelectorAll("[data-slot=card]"),
    ).filter((c) => /loadFailed\.(month|category)/.test(c.textContent ?? ""));
    expect(failedCards.length).toBe(2);
    for (const c of failedCards) expect(c.textContent).not.toMatch(/(^|\D)0원/);
    // [다시 시도] 는 ds 고정 글(한국어)이다
    const retry = Array.from(container.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("다시 시도"),
    );
    expect(retry.length).toBeGreaterThan(0);
    act(() => retry[0]?.click());
    expect(refetch).toHaveBeenCalled();
    expect(state.asset.refetch).not.toHaveBeenCalled();
  });
});
