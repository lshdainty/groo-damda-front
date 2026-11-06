// 폭이 768 을 넘나들어도 통계에서 고른 탭 · 열어 둔 기간 고르기가 남는다 — "폼은 갈림 밖"(I-wrap-b1 ε 9).
// 종전엔 탭 · 기간 · 열림이 StatsMobile · StatsDesktop 각자의 useStatsModel 안에 있어, 폭이 바뀌면 "카테고리" 탭 · 이번 달 · 닫힘으로 돌아갔다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
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
const ctx = vi.hoisted(() => ({ mobile: true }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ mobile: ctx.mobile }),
}));
const wide = vi.hoisted(() => ({ on: false }));
vi.mock("@/shared/ds/overlay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/overlay")>()),
  useWideSurface: () => wide.on,
}));
vi.mock("@/shared/ui/groo/primitives", () => ({
  Icon: () => <svg />,
}));
// 고정 정리 화면은 여기서 열림 · 닫힘만 본다(고른 체크는 FixedBulk.test) — 견본이 자기가 받은 값을 보인다
const fbMounts = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/features/expense/ui/FixedBulk", async () => {
  const React = await import("react");
  return {
    FixedBulk: ({
      mobile,
      onClose,
    }: {
      mobile: boolean;
      onClose: () => void;
    }) => {
      // 마운트 횟수 — 폭이 768 · 1280 을 넘나들어도 다시 붙지 않아야 고른 체크가 남는다
      React.useEffect(() => {
        fbMounts.n += 1;
      }, []);
      return (
        <div data-testid="fixed-bulk" data-mobile={String(mobile)}>
          <button type="button" onClick={onClose}>
            close
          </button>
        </div>
      );
    },
  };
});

type Q = {
  data?: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
};
const q = (data: unknown, extra: Partial<Q> = {}): Q => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...extra,
});
let rangeCalls = 0;
const state = {
  prev: undefined as ReturnType<typeof q> | undefined,
  range: q(undefined),
  merchants: q(undefined),
  heatmap: q(undefined),
  cats: q(undefined),
  expenses: q(undefined),
  trend: q(undefined),
};
vi.mock("@/features/expense", () => ({
  // 훅은 렌더마다 두 번 부른다 — 첫째 이번 기간, 둘째 이전 기간
  useRangeSummary: () =>
    rangeCalls++ % 2 === 0 ? state.range : (state.prev ?? state.range),
  useMerchantSummary: () => state.merchants,
  useExpenseHeatmap: () => state.heatmap,
  useExpenseCategories: () => state.cats,
  useExpenses: () => state.expenses,
  useMonthlyTrend: () => state.trend,
}));

const { i18n } = await import("@/shared/i18n/config");
const { StatsPage } = await import("./StatsPage");
const { setHiddenCardsLocal } =
  await import("@/shared/lib/groo/hide-amounts-core");

const LONG = "카페 · 간식 · 디저트 모임 지출 항목";
const now = new Date();
const bucket = (month: number) => ({
  year: now.getFullYear(),
  month,
  totalIncome: 4_500_000_000,
  totalExpense: 3_912_345_678,
  fixedIncome: 0,
  fixedExpense: 0,
  categoryExpenses: [],
});
const summary = () => ({
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  totalIncome: 4_500_000_000,
  totalExpense: 3_912_345_678,
  fixedIncome: 0,
  fixedExpense: 0,
  categoryBreakdown: [
    [1, "식비", 1_234_567_890],
    [2, LONG, 987_654_321],
  ].map(([id, name, amt]) => ({
    categoryRowId: id,
    categoryName: name,
    totalAmount: amt,
    parentCategoryRowId: null,
    parentCategoryName: null,
    expenseType: "EXPENSE",
  })),
  monthlyBuckets: [bucket(now.getMonth()), bucket(now.getMonth() + 1)],
});
const heatCells = () =>
  Array.from({ length: 12 }, (_, i) => ({
    dayOfWeek: (i % 7) + 1,
    hour: 12,
    totalAmount: 36_000_000 * (i + 1),
  }));

let container: HTMLDivElement;
let root: Root;
const cellWidth = 35;
beforeEach(async () => {
  // 테스트 기본 로케일은 en 이다 — 금액이 "원" 으로 나오는지 보려면 ko 로 고정한다
  await i18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // 열지도 칸 폭은 ResizeObserver 콜백에서 잰다 — 첫 칸의 폭을 정해 주고 관찰을 시작하면 콜백을 한 번 부른다
  globalThis.ResizeObserver = class {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe(el: Element) {
      this.cb([{ target: el, contentRect: { width: 300, height: 200 } }]);
    }
    unobserve() {}
    disconnect() {}
  } as never;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const w =
        this.getAttribute("data-slot") === "chart-heatmap-cell" ? cellWidth : 0;
      return {
        width: w,
        height: w,
        top: 0,
        left: 0,
        right: w,
        bottom: w,
        x: 0,
        y: 0,
        toJSON() {},
      };
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  rangeCalls = 0;
  state.prev = undefined;
  state.range = q(summary());
  state.merchants = q({
    merchants: [
      {
        merchant: "숲길 커피 중앙점 아주 긴 가맹점 이름 테스트 지점 2호점",
        totalAmount: 123_456_789,
        count: 20,
      },
      { merchant: "다온배달", totalAmount: 90_000_000, count: 9 },
    ],
  });
  state.heatmap = q(heatCells());
  state.cats = q([]);
  state.expenses = q([]);
  state.trend = q([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  act(() => setHiddenCardsLocal([]));
  act(() => root.unmount());
  container.remove();
});
const nav = { here: "", go: (() => {}) as NavigateFunction };
const Where = () => {
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    nav.here = loc.pathname;
    nav.go = navigate;
  });
  return null;
};
const tree = () => (
  <MemoryRouter initialEntries={["/desk/stats"]}>
    <Where />
    <Routes>
      <Route path="/desk/stats" element={<StatsPage />}>
        <Route path="fixed" element={null} />
      </Route>
    </Routes>
  </MemoryRouter>
);
const render = (mobile: boolean) => {
  ctx.mobile = mobile;
  act(() => root.render(tree()));
};
const go = (to: string, state?: unknown) => act(() => nav.go(to, { state }));
const clickTab = (name: string) => {
  const tab = Array.from(container.querySelectorAll("[role=tab]")).find((e) =>
    e.textContent?.includes(name),
  ) as HTMLElement;
  act(() => tab.click());
};

const selectedTab = () =>
  Array.from(container.querySelectorAll("[role=tab]"))
    .find((e) => e.getAttribute("aria-selected") === "true")
    ?.textContent?.trim();
const periodButton = () =>
  container.querySelector<HTMLElement>("button[aria-haspopup=dialog]");

describe("폭이 바뀌어도 고른 것이 남는다 (I-wrap-b1 ε 9)", () => {
  it("폰에서 고른 탭이 넓은 화면 · 다시 폰에서도 그대로다", () => {
    render(true);
    clickTab("tab.trend");
    expect(selectedTab()).toBe("tab.trend");

    render(false);
    expect(container.querySelector("[data-slot=stats-desktop]")).not.toBeNull();
    expect(selectedTab()).toBe("tab.trend");
    render(true);
    expect(selectedTab()).toBe("tab.trend");
  });

  it("폰에서 연 기간 고르기가 넓은 화면에서도 열려 있다", () => {
    render(true);
    const btn = periodButton();
    if (!btn) throw new Error("기간 버튼을 찾지 못했다");
    act(() => btn.click());
    expect(periodButton()?.getAttribute("aria-expanded")).toBe("true");

    render(false);
    expect(periodButton()?.getAttribute("aria-expanded")).toBe("true");
  });

  it("고정 정리 열림은 주소가 든다 — 주소로 바로 열어도 열리고, 폭이 넘나들어도 열려 있다", () => {
    render(true);
    expect(container.querySelector("[data-testid=fixed-bulk]")).toBeNull();
    go("/desk/stats/fixed");
    const open = () =>
      container.querySelector<HTMLElement>("[data-testid=fixed-bulk]");
    expect(open()?.dataset.mobile).toBe("true");
    // 1280 미만에서는 페이지가 통계를 대신한다
    expect(container.querySelector("[role=tab]")).toBeNull();
    render(false);
    expect(open()?.dataset.mobile).toBe("false");
    render(true);
    expect(open()).not.toBeNull();
  });

  it("1280 이상에서는 통계가 뒤에 남고 그 위에 뜬다", () => {
    wide.on = true;
    try {
      render(false);
      go("/desk/stats/fixed");
      expect(
        container.querySelector("[data-slot=stats-desktop]"),
      ).not.toBeNull();
      expect(
        container.querySelector("[data-testid=fixed-bulk]"),
      ).not.toBeNull();
    } finally {
      wide.on = false;
    }
  });

  it("통계에서 연 뒤 닫으면 한 걸음 뒤로, 주소로 바로 온 뒤 닫으면 통계로 바꿔 간다", () => {
    render(true);
    go("/desk/stats/fixed", { fromStats: true });
    act(() =>
      container
        .querySelector<HTMLElement>("[data-testid=fixed-bulk] button")!
        .click(),
    );
    expect(nav.here).toBe("/desk/stats");
    // 주소로 바로 온 경우 — 상태가 없다
    go("/desk/stats/fixed");
    act(() =>
      container
        .querySelector<HTMLElement>("[data-testid=fixed-bulk] button")!
        .click(),
    );
    expect(nav.here).toBe("/desk/stats");
    expect(container.querySelector("[data-testid=fixed-bulk]")).toBeNull();
  });

  it("고른 탭 · 기간은 고정 정리를 다녀와도 남는다", () => {
    render(true);
    clickTab("tab.trend");
    go("/desk/stats/fixed", { fromStats: true });
    go("/desk/stats");
    expect(selectedTab()).toBe("tab.trend");
  });

  it("768 · 1280 을 넘나들어도 고정 정리는 다시 붙지 않는다(한 번만 마운트)", () => {
    fbMounts.n = 0;
    render(true);
    go("/desk/stats/fixed", { fromStats: true });
    render(false);
    wide.on = true;
    try {
      render(false);
      wide.on = false;
      render(true);
    } finally {
      wide.on = false;
    }
    expect(fbMounts.n).toBe(1);
  });
});
