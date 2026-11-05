// 폰 홈 — 띠 수 · 구역 사이 틈 · 빈 구역 · 실패(I-06 5 · 8 · 33)
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
};
vi.mock("@/features/dashboard", () => ({
  useDashboardSummary: () => state.summary,
}));
vi.mock("@/features/asset", () => ({ useAssetSummary: () => state.asset }));
vi.mock("@/features/expense", () => ({
  useRangeSummary: () => state.monthly,
  useExpenses: () => state.recent,
  useExpenseBudgets: () => state.budgets,
  useExpenseCategories: () => state.cats,
}));

const { HomeMobile } = await import("./HomeMobile");
const { setHiddenCardsLocal } =
  await import("@/shared/lib/groo/hide-amounts-core");

const summary = (events: number, todos: number) => ({
  todoSummary: { overDueCount: 0 },
  expenseSummary: { monthlyIncome: 0, monthlyExpense: 0 },
  upcomingEvents: Array.from({ length: events }, (_, i) => ({
    rowId: i,
    title: `일정 ${i}`,
    color: "",
    daysUntil: i + 1,
    startDate: "2026-10-23T10:00:00",
  })),
  recentTodos: Array.from({ length: todos }, (_, i) => ({
    rowId: i,
    title: `할 일 ${i}`,
    status: "PENDING",
    priority: "HIGH",
    dueDate: null,
  })),
});

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
  state.asset = q({
    netWorth: 100,
    totalAssets: 100,
    totalDebt: 0,
    lastMonthNetWorth: 0,
  });
  state.monthly = q({ totalIncome: 1, totalExpense: 1, categoryBreakdown: [] });
  state.recent = q([]);
  state.budgets = q([]);
  state.cats = q([]);
});
afterEach(() => {
  act(() => setHiddenCardsLocal([]));
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<HomeMobile />));
const bands = () => container.querySelectorAll(".screen-bands > *");

describe("폰 홈 띠 — 구역마다 따로(사용자 10-23)", () => {
  it.each([
    [1, 1, 7],
    [1, 0, 6],
    [0, 1, 6],
    [0, 0, 5],
  ])("일정 %i · 할 일 %i → 띠 %i (사이 틈 = 띠 수 − 1)", (e, t, n) => {
    state.summary = q(summary(e, t));
    render();
    expect(bands()).toHaveLength(n);
    // 순자산(hero)이 첫 띠 — 흰 띠로 칠하지 않고 .screen-bands 직계다
    expect(bands()[0]?.getAttribute("data-variant")).toBe("hero");
    // 나머지는 구역 하나 = 띠 하나(자식이 제 여백을 갖는다)
    for (const band of Array.from(bands()).slice(1))
      expect(band.getAttribute("data-band")).toBe("flush");
    expect(
      Array.from(bands())
        .slice(1)
        .map((b) => b.getAttribute("data-section")),
    ).toEqual(
      [
        "month",
        "category",
        "budget",
        e > 0 ? "events" : null,
        t > 0 ? "todos" : null,
        "today",
      ].filter(Boolean),
    );
  });

  it("일정 · 할 일이 같이 실패해도 띠마다 실패 하나씩 — 제목 · 설명 · 다시 시도(그 질의만)", () => {
    const refetch = vi.fn();
    state.summary = q(undefined, { isError: true, refetch });
    render();
    const events = container.querySelector("[data-section=events]")!;
    const todos = container.querySelector("[data-section=todos]")!;
    expect(events.textContent).toContain("loadFailed.events");
    expect(todos.textContent).toContain("loadFailed.todos");
    expect(events.textContent).toContain("loadFailedDesc");
    const retry = Array.from(events.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Try again"),
    );
    act(() => retry?.click());
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(state.monthly.refetch).not.toHaveBeenCalled();
  });

  it('구역 머리는 제목 + 동작 "전체 보기"(꺾쇠 없음)이고 연체 배지는 heading 밖이다', () => {
    state.summary = q({ ...summary(1, 1), todoSummary: { overDueCount: 23 } });
    render();
    expect(container.querySelectorAll("h2").length).toBeGreaterThanOrEqual(6);
    expect(container.querySelector("[data-slot=card-action] svg")).toBeNull();
    const todos = container.querySelector("[data-section=todos]")!;
    const badge = todos.querySelector("[data-slot=badge]")!;
    expect(badge).not.toBeNull();
    expect(badge.closest("h2")).toBeNull();
    // 읽는 글은 "연체 23건"
    expect(badge.textContent).toContain("todo.overdueSr");
  });

  it("순자산이 실패하면 0원 대신 흰 띠 + 머리 + 실패 — hero 를 쓰지 않고 다른 구역은 그대로", () => {
    state.summary = q(summary(1, 1));
    const refetch = vi.fn();
    state.asset = q(undefined, { isError: true, refetch });
    render();
    expect(container.textContent).toContain("loadFailed.netWorth");
    expect(container.textContent).toContain("loadFailedDesc");
    expect(container.textContent).not.toContain("0원");
    expect(container.querySelector("[data-variant=hero]")).toBeNull();
    expect(container.querySelector("[data-section=events]")).not.toBeNull();
    const retry = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Try again"),
    );
    act(() => retry?.click());
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(state.monthly.refetch).not.toHaveBeenCalled();
  });

  it("눈 단추 — 이름 고정 · aria-pressed 없음(toggle.md:102) · ds Toggle 클래스(px 40 / 44 / 20)", () => {
    state.summary = q(summary(0, 0));
    render();
    const eye = container.querySelector(
      "[aria-label=hideAmountsSettings]",
    ) as HTMLElement;
    expect(eye).not.toBeNull();
    expect(eye.hasAttribute("aria-pressed")).toBe(false);
    // 상자 · 누르는 영역 · 아이콘은 px(글자 200% 에서 커지지 않는다 — Q1-A)
    expect(eye.className).toContain("size-[40px]");
    expect(eye.className).toContain("before:size-[44px]");
    expect(eye.className).toContain("[&_svg]:size-[20px]");
    expect(eye.className).not.toMatch(/(^| )size-(10|11|5)( |$)/);
    expect(eye.className).toContain("text-static-white");
    expect(eye.className).not.toMatch(/rounded-full|bg-white/);
  });

  it("순자산 두 칸 — 위 바깥 20 · 안쪽 위 16 · 첫 칸 오른쪽 16 · 둘째 칸 왼쪽 16 · 오른쪽 0", () => {
    state.summary = q(summary(0, 0));
    render();
    const hero = container.querySelector("[data-variant=hero]")!;
    const split = hero.querySelector(".grid.grid-cols-2")!;
    expect(split.className).toContain("mt-x5");
    expect(split.className).toContain("pt-x4");
    const [first, second] = Array.from(split.children);
    expect(first!.className).toContain("pr-x4");
    expect(second!.className).toContain("pl-x4");
    expect(second!.className).toContain("last:pr-0");
  });

  it('예산 막대 — role=meter · 이름 · 가림 시 금액 "••••"', () => {
    state.summary = q(summary(0, 0));
    state.budgets = q([
      { rowId: 1, categoryRowId: 1, categoryName: "식비", budgetAmount: 800 },
    ]);
    state.cats = q([
      {
        rowId: 1,
        categoryName: "식비",
        color: null,
        icon: null,
        expenseType: "EXPENSE",
      },
    ]);
    state.monthly = q({
      totalIncome: 0,
      totalExpense: 1000,
      categoryBreakdown: [
        {
          categoryRowId: 1,
          categoryName: "식비",
          totalAmount: 1000,
          parentCategoryRowId: null,
          expenseType: "EXPENSE",
        },
      ],
    });
    render();
    const meter = container.querySelector(
      "[data-section=budget] [role=meter]",
    )!;
    expect(meter.getAttribute("aria-label")).toContain("budgetName");
    expect(meter.getAttribute("aria-label")).toContain("800");
    expect(meter.getAttribute("aria-valuetext")).toMatch(/200/);
    act(() => setHiddenCardsLocal(["home.budget"]));
    const hidden = container.querySelector(
      "[data-section=budget] [role=meter]",
    )!;
    expect(hidden.getAttribute("aria-label")).not.toContain("800");
    expect(hidden.getAttribute("aria-label")).toContain("••••");
    expect(
      container.querySelector(
        "[data-section=budget] [data-slot=progress-amount]",
      )!.textContent,
    ).toBe("•••• / ••••");
  });

  it("오늘 합계 — 가림 카드 home.todaySpend 로 가린다", () => {
    state.summary = q(summary(0, 0));
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    state.recent = q([
      {
        rowId: 7,
        expenseType: "EXPENSE",
        amount: 12345,
        expenseDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00`,
        merchant: "가게",
        categoryName: "식비",
        refundedAt: null,
      },
    ]);
    render();
    const head = () =>
      container.querySelector("[data-section=today] [data-slot=card-header]")!;
    expect(head().textContent).toContain("12,345");
    act(() => setHiddenCardsLocal(["home.todaySpend"]));
    expect(head().textContent).not.toContain("12,345");
    expect(head().textContent).toContain("••••");
    // 다른 카드만 가리면 머리 합계는 보인다
    act(() => setHiddenCardsLocal(["ledger.txList"]));
    expect(head().textContent).toContain("12,345");
  });
});
