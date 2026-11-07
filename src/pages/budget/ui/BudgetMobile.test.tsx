// 폰 예산 — 띠 셋 · 달 줄 · 금액 원까지 · 막대 경고 색 없음 · "여유" 셈 · 실패 · 예산 없음(I-08 5 ~ 17)
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
vi.mock("@/shared/ui/groo/primitives", () => ({
  Icon: () => <svg />,
}));

const q = (data: unknown, extra: object = {}) => ({
  data,
  isError: false,
  refetch: vi.fn(),
  ...extra,
});
const state = {
  budgets: q(undefined) as ReturnType<typeof q>,
  summary: q(undefined) as ReturnType<typeof q>,
  cats: q(undefined) as ReturnType<typeof q>,
  compliance: q(undefined) as ReturnType<typeof q>,
  prefs: q({ budgetAlertThreshold: 85 }) as ReturnType<typeof q>,
};
vi.mock("@/features/expense", () => ({
  useExpenseBudgets: () => state.budgets,
  useRangeSummary: () => state.summary,
  useExpenseCategories: () => state.cats,
  useBudgetCompliance: () => state.compliance,
}));
vi.mock("@/features/user", () => ({ useUserPreferences: () => state.prefs }));

const { BudgetMobile } = await import("./BudgetMobile");
const { setHiddenCardsLocal } =
  await import("@/shared/lib/groo/hide-amounts-core");

const now = new Date();
const budget = (
  rowId: number,
  categoryRowId: number | null,
  amount: number,
) => ({
  rowId,
  categoryRowId,
  categoryName: categoryRowId == null ? null : `카테고리 ${categoryRowId}`,
  budgetAmount: amount,
  budgetYear: now.getFullYear(),
  budgetMonth: now.getMonth() + 1,
});
const summary = (total: number, per: [number, number][] = []) => ({
  totalExpense: total,
  categoryBreakdown: per.map(([id, amount]) => ({
    categoryRowId: id,
    parentCategoryRowId: null,
    totalAmount: amount,
    expenseType: "EXPENSE",
  })),
});
const cat = (rowId: number) => ({
  rowId,
  categoryName: `카테고리 ${rowId}`,
  icon: "tag",
  color: null,
  expenseType: "EXPENSE",
  parentRowId: null,
});
const months = (limits: number[]) =>
  limits.map((limit, i) => ({
    year: now.getFullYear(),
    month: i + 1,
    totalLimit: limit,
    totalSpent: limit / 2,
    compliancePercent: limit > 0 ? 50 : 0,
  }));

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
  state.budgets = q([budget(1, null, 100_000_000), budget(2, 1, 800_000)]);
  state.summary = q(summary(12_345_678_901, [[1, 700_000]]));
  state.cats = q([cat(1)]);
  state.compliance = q(months([100, 100, 100, 100, 100, 100]));
  state.prefs = q({ budgetAlertThreshold: 85 });
});
afterEach(() => {
  act(() => setHiddenCardsLocal([]));
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<BudgetMobile />));
const bands = () => container.querySelectorAll(".screen-bands > *");
const section = (name: string) =>
  container.querySelector(`[data-section=${name}]`)!;

describe("폰 예산 띠 셋(I-08 5 ~ 7)", () => {
  it("띠 셋 — 이번 달 전체 · 카테고리 · 지난 달들, 사이 틈은 띠 수 − 1 = 둘", () => {
    render();
    expect(bands()).toHaveLength(3);
    expect(
      Array.from(bands()).map((b) => b.getAttribute("data-section")),
    ).toEqual(["month", "categories", "compliance"]);
    // 구역이 제 여백을 갖는다(flush) — 띠 안 테두리 상자 · 카드는 없다
    for (const b of Array.from(bands()))
      expect(b.getAttribute("data-band")).toBe("flush");
    expect(container.querySelector("[data-slot=card]")).toBeNull();
  });

  it("달 줄이 띠 ① 맨 위, 총 예산 · 페이스가 같은 띠 안", () => {
    render();
    const first = bands()[0]!;
    expect(first.firstElementChild?.getAttribute("data-slot")).toBe(
      "month-bar",
    );
    expect(first.querySelector("[data-section=total]")).not.toBeNull();
    expect(first.querySelector("[data-section=pace]")).not.toBeNull();
    expect(bands()[1]!.querySelector("[data-section=status]")).not.toBeNull();
    expect(bands()[1]!.querySelector("[data-section=list]")).not.toBeNull();
  });
});

describe("금액 원까지 · 막대 색(I-08 8 · 12 · 14)", () => {
  it("큰 금액이 한 덩어리로 원까지 — 줄임표 · 말줄임 클래스 없음", () => {
    render();
    const total = section("total");
    expect(total.textContent).toContain("12,345,678,901");
    expect(total.textContent).toContain("100,000,000");
    expect(total.querySelector(".truncate")).toBeNull();
  });

  it("지표 셋이 키-값 줄(폰은 한 줄에 하나) — 할당 가능은 + 부호 · 넘치면 U+2212 + critical", () => {
    render();
    const rows = section("total").querySelectorAll("[data-slot=kv-value]");
    expect(rows).toHaveLength(3);
    // 시험 언어는 한국어다(tests/vitest.setup.ts) — 돈은 "+99,200,000원"
    expect(rows[2]!.textContent).toBe("+99,200,000원");
    expect(rows[2]!.className).toContain("text-fg-brand");
    state.budgets = q([budget(1, null, 100_000), budget(2, 1, 800_000)]);
    render();
    const over = section("total").querySelectorAll("[data-slot=kv-value]")[2]!;
    expect(over.textContent).toBe("−700,000원");
    expect(over.className).toContain("text-fg-critical");
    // 할당 넘침 안내 상자
    expect(section("total").textContent).toContain("manager.overCap");
  });

  it("85 ~ 100% 에서 막대 경고 색이 없다 — 넘칠 때만 over", () => {
    state.summary = q(summary(95_000_000, [[1, 760_000]]));
    render();
    const meters = Array.from(container.querySelectorAll("[role=meter]"));
    expect(meters.length).toBeGreaterThan(0);
    for (const m of meters.filter(
      (x) => !x.closest("[data-section=compliance]"),
    ))
      expect(m.getAttribute("data-state")).toBe("enabled");
    state.summary = q(summary(120_000_000, [[1, 900_000]]));
    render();
    const over = container.querySelectorAll("[role=meter][data-state=over]");
    expect(over.length).toBe(3); // 총 예산 · 페이스 · 카테고리 줄
  });

  it("지출 페이스 — 막대 8 · 오늘 표시선은 장식(aria-hidden)", () => {
    render();
    const marker = section("pace").querySelector("[data-slot=pace-marker]")!;
    expect(marker.getAttribute("aria-hidden")).toBe("true");
    expect(section("pace").querySelector("[role=meter]")).not.toBeNull();
  });
});

describe("목록 짜임 · 페이스 값 글 · 한 줄 금액 쌓기(검수 12 · 10)", () => {
  it("카테고리 목록은 ul 하나 · li 줄 수만큼, 줄 아래 막대가 같은 li 안", () => {
    render();
    const list = section("list");
    expect(list.querySelectorAll("ul")).toHaveLength(1);
    const items = list.querySelectorAll("ul > li");
    expect(items).toHaveLength(1);
    expect(items[0]!.querySelector("[role=meter]")).not.toBeNull();
    // 줄은 위 맞춤, 뒤 두 줄은 한 요소 안에서 세로로 쌓인다
    expect(
      items[0]!.querySelector("[data-slot=list-content]")!.className,
    ).toContain("items-start");
    const suffix = items[0]!.querySelector("[data-slot=list-suffix]")!;
    expect(suffix.children).toHaveLength(1);
    expect(suffix.firstElementChild!.className).toContain("flex-col");
  });

  it("페이스 막대 값 글이 '{n}% 사용 · 이번 달 {m}% 지남'", () => {
    render();
    const meter = section("pace").querySelector("[role=meter]")!;
    expect(meter.getAttribute("aria-valuetext")).toContain("paceValue");
  });

  it("예산 이행률 — 표 · 사용률 글이 같은 정수다(B3 1A 진행률: 76.43 → 76%, 한 자리 아님)", () => {
    state.compliance = q(
      months([100, 100, 100, 100, 100, 100]).map((r) => ({
        ...r,
        compliancePercent: 76.43,
      })),
    );
    render();
    const cells = Array.from(section("compliance").querySelectorAll("td")).map(
      (td) => td.textContent,
    );
    expect(cells).toContain("76%");
    expect(cells.join("|")).not.toMatch(/76\.4/);
    const meter = section("pace").querySelector("[role=meter]")!;
    expect(meter.getAttribute("aria-valuetext")).toMatch(/"used":"\d+%"/);
  });

  it("이행률 100 을 넘으면 글에서 사라지지 않는다 — 100.3 → 101%, 99.6 → 99%", () => {
    state.compliance = q(
      months([100, 100, 100, 100, 100, 100]).map((r, i) => ({
        ...r,
        compliancePercent: i === 0 ? 100.3 : 99.6,
      })),
    );
    render();
    const cells = Array.from(section("compliance").querySelectorAll("td")).map(
      (td) => td.textContent,
    );
    expect(cells).toContain("101%");
    expect(cells).toContain("99%");
    expect(cells).not.toContain("100%");
  });

  it("키-값 스켈레톤 줄은 실제 줄(38 = py-x2)과 같고 달 줄 위는 12(pt-x3)", () => {
    state.summary = q(undefined);
    render();
    const skel = section("pace").querySelector("[aria-hidden] .py-x2");
    expect(skel).not.toBeNull();
    expect(
      container.querySelector("[data-slot=month-bar]")!.className,
    ).toContain("pt-x3");
  });
});

describe("예산 현황 — 여유 수는 알림 기준 이하인 카테고리 수(I-08 11 · 14)", () => {
  const spent78 = () => summary(1000, [[1, 624_000]]); // 800,000 중 78%
  const healthy = () =>
    section("status").querySelectorAll("[data-slot=kv-value]")[1]!.textContent;
  it("기준 85 에서 여유 1 · 기준 70 으로 내리면 여유 0", () => {
    state.summary = q(spent78());
    render();
    expect(healthy()).toContain('"count":1');
    state.prefs = q({ budgetAlertThreshold: 70 });
    render();
    expect(healthy()).toContain('"count":0');
  });
});

describe("불러오는 중 · 실패 · 예산 없음(I-08 15 · 17)", () => {
  it("요약 질의 실패 → 폰은 실패 상자 하나(띠 ①), 띠 ② 없음, 0원 없음", () => {
    state.summary = q(undefined, { isError: true });
    render();
    expect(
      container.querySelectorAll("[data-slot=result-section]"),
    ).toHaveLength(1);
    expect(section("month").textContent).toContain("manager.loadFailed");
    expect(section("month").textContent).not.toContain("0원");
    expect(container.querySelector("[data-section=categories]")).toBeNull();
    // 이행률은 따로 산다
    expect(section("compliance").querySelector("[role=meter]")).toBeNull();
    expect(section("compliance").textContent).not.toContain("loadFailed");
    // 서버 오류 원문을 그리지 않는다 — 다시 시도 버튼만
    const retry = section("month").querySelector(
      "button[type=button]:not([data-slot=month-bar] *)",
    );
    expect(retry).not.toBeNull();
    act(() => (retry as HTMLButtonElement).click());
    expect(state.summary.refetch).toHaveBeenCalled();
  });

  it("이행률 실패는 그 구역만", () => {
    state.compliance = q(undefined, { isError: true });
    render();
    expect(section("compliance").textContent).toContain(
      "loadFailed.compliance",
    );
    expect(section("total").textContent).toContain("12,345,678,901");
  });

  it("틀은 처음부터 — 질의가 오기 전에도 달 줄 · 구역 머리가 있다", () => {
    state.budgets = q(undefined);
    state.summary = q(undefined);
    state.cats = q(undefined);
    state.compliance = q(undefined);
    render();
    expect(container.querySelector("[data-slot=month-bar]")).not.toBeNull();
    expect(
      section("pace").querySelector("[data-slot=card-title]"),
    ).not.toBeNull();
    expect(
      container.querySelector("[aria-hidden] [data-slot=skeleton]"),
    ).not.toBeNull();
  });

  it("이번 달 예산이 없으면 띠 ① 은 달 줄 + 빈 안내, 띠 ② 없음, 이행률은 상한 있는 달이 있을 때만(Q3-B)", () => {
    state.budgets = q([]);
    state.compliance = q(months([0, 0, 0, 0, 0, 0]));
    render();
    expect(bands()).toHaveLength(1);
    expect(section("month").textContent).toContain("emptyMonthTitle");
    expect(section("month").textContent).toContain("manager.setBudget");
    state.compliance = q(months([0, 0, 0, 0, 0, 500_000]));
    render();
    expect(bands()).toHaveLength(2);
    expect(bands()[1]!.getAttribute("data-section")).toBe("compliance");
  });
});

describe("금액 가리기 — 카드별(I-08 8 · 12)", () => {
  it("budget.header 만 가리면 총 예산 구역만 ••••, 목록 줄은 보인다", () => {
    render();
    act(() => setHiddenCardsLocal(["budget.header"]));
    expect(section("total").textContent).not.toContain("12,345,678,901");
    expect(section("total").textContent).toContain("••••");
    expect(section("list").textContent).toContain("700,000");
    act(() => setHiddenCardsLocal(["budget.categories"]));
    expect(section("total").textContent).toContain("12,345,678,901");
    expect(section("list").textContent).not.toContain("700,000");
  });
});
