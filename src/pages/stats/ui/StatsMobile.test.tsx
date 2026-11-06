// 폰 통계 — 구역마다 띠 · 칩 탭 · 금액 원까지 · 도넛(가운데 글 없음 + 합계 줄) · 열지도 칸 글(112 규칙) · 구역별 실패(I-08 29 ~ 42)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
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
vi.mock("@/shared/ui/groo/primitives", () => ({
  Icon: () => <svg />,
}));
vi.mock("@/features/expense/ui/FixedBulk", () => ({
  FixedBulk: () => null,
}));

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
const { StatsMobile } = await import("./StatsMobile");
const { setHiddenCardsLocal } =
  await import("@/shared/lib/groo/hide-amounts-core");

const LONG = "카페·간식·디저트 모임 지출 항목";
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
let cellWidth = 35;
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
const render = () =>
  act(() =>
    root.render(
      <MemoryRouter>
        <StatsMobile />
      </MemoryRouter>,
    ),
  );
const bands = () => container.querySelectorAll(".screen-bands > *");
const clickTab = (name: string) => {
  const tab = Array.from(container.querySelectorAll("[role=tab]")).find((e) =>
    e.textContent?.includes(name),
  ) as HTMLElement;
  act(() => tab.click());
};

describe("폰 통계 틀(I-08 29 · 30)", () => {
  it("카테고리 탭 — 구역마다 띠 넷, 띠 안 테두리 상자 · 카드 없음", () => {
    render();
    expect(
      Array.from(bands()).map((b) => b.getAttribute("data-section")),
    ).toEqual(["donut", "merchants", "heatmap", "highlights"]);
    for (const b of Array.from(bands()))
      expect(b.getAttribute("data-band")).toBe("flush");
    expect(container.querySelector("[data-slot=card]")).toBeNull();
  });

  it("칩 탭 = Chip Tabs solid large, 탭 넷", () => {
    render();
    const list = container.querySelector("[data-slot=chip-tabs-list]")!;
    expect(list.getAttribute("data-variant")).toBe("solid");
    expect(list.getAttribute("data-size")).toBe("large");
    expect(
      container.querySelectorAll("[data-slot=chip-tabs-trigger]"),
    ).toHaveLength(4);
  });

  it("추이 · 비교 · 고정·변동 탭도 구역마다 띠", () => {
    render();
    clickTab("tab.trend");
    expect(
      Array.from(bands()).map((b) => b.getAttribute("data-section")),
    ).toEqual(
      ["trend", "rate", "savings", "catTrend"].slice(0, bands().length),
    );
    clickTab("tab.compare");
    expect(
      Array.from(bands()).map((b) => b.getAttribute("data-section")),
    ).toEqual(["summary", "metrics", "delta", "weekday"]);
    clickTab("tab.fixed");
    expect(
      Array.from(bands()).map((b) => b.getAttribute("data-section")),
    ).toEqual(["expense", "income", "trend", "categories"]);
  });
});

describe("금액은 원까지(I-08 32 · 39)", () => {
  it("도넛 합계 줄이 원까지 — 줄여 쓴 억 단위가 없다", () => {
    render();
    const total = container.querySelector("[data-slot=stats-donut-total]")!;
    expect(total.textContent).toContain("2,222,222,211원");
    expect(total.textContent).not.toMatch(/억|만/);
    // 폰은 가운데 글 없음 — 늘 목록 위 합계 줄
    expect(
      container.querySelector("[data-slot=chart-donut-center]"),
    ).toBeNull();
  });

  it("범례 이름이 줄바꿈(말줄임 없음) — 24자 이름 전체 + 금액 원까지", () => {
    render();
    const legend = container.querySelector("[data-slot=chart-donut-legend]")!;
    expect(legend.textContent).toContain(LONG);
    expect(legend.textContent).toContain("987,654,321원");
  });

  it("가리면 도넛 합계 · 범례 금액이 ••••", () => {
    act(() => setHiddenCardsLocal(["stats.category"]));
    render();
    const total = container.querySelector("[data-slot=stats-donut-total]")!;
    expect(total.textContent).toContain("••••");
    expect(total.textContent).not.toContain("2,222");
  });
});

describe("열지도 칸 글 — 칸 폭 112 규칙(I-08 34)", () => {
  it("칸 폭 35 — 칸에 글 없음(세기 색만), 값은 표로 보기", () => {
    cellWidth = 35;
    render();
    const cells = Array.from(
      container.querySelectorAll("[data-slot=chart-heatmap-cell]"),
    );
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(c.textContent?.replace("—", "")).toBe("");
    expect(
      container.querySelector("[data-slot=chart-data-table]")!.textContent,
    ).toContain("원");
  });

  it("칸 폭 117 — 칸 글이 원까지(줄임 글 없음)", () => {
    cellWidth = 117;
    render();
    const texts = Array.from(
      container.querySelectorAll("[data-slot=chart-heatmap-cell]"),
    )
      .map((c) => c.textContent ?? "")
      .filter((s) => s && s !== "—");
    expect(texts.length).toBeGreaterThan(0);
    for (const s of texts) expect(s).toMatch(/^[\d,]+원$/);
  });
});

describe("구역별 실패 · 원문 없음(I-08 41)", () => {
  it("가맹점 질의만 실패 — 그 구역에만 실패 상자, 다른 구역은 그대로", () => {
    state.merchants = q(undefined, { isError: true });
    render();
    const merchants = container.querySelector("[data-section=merchants]")!;
    expect(merchants.textContent).toContain("loadFailed.merchant");
    expect(merchants.textContent).not.toContain("server error");
    expect(
      container.querySelector("[data-section=donut]")!.textContent,
    ).toContain("2,222,222,211원");
    // 다시 시도는 그 질의만
    const retry = merchants.querySelector("button") as HTMLButtonElement;
    act(() => retry.click());
    expect(state.merchants.refetch).toHaveBeenCalledTimes(1);
    expect(state.range.refetch).not.toHaveBeenCalled();
  });

  it("합계 질의 실패 — 0원이 아니라 실패 상자", () => {
    state.range = q(undefined, { isError: true });
    render();
    const donut = container.querySelector("[data-section=donut]")!;
    expect(donut.textContent).toContain("loadFailed.category");
    expect(donut.textContent).not.toContain("0원");
  });
});

const boxes = () => container.querySelectorAll("[data-slot=result-section]");

describe("폰은 질의 하나 = 실패 상자 하나(I-08 41 · 08-1 과 같은 규칙)", () => {
  it("카테고리 탭 — 합계 질의 실패는 상자 하나(요약 띠는 숨음)", () => {
    state.range = q(undefined, { isError: true });
    render();
    expect(boxes()).toHaveLength(1);
    expect(
      container.querySelector("[data-section=donut]")!.textContent,
    ).toContain("loadFailed.category");
  });

  it("카테고리 탭 — 합계 · 가맹점이 둘 다 실패해도 상자는 각 질의마다 하나(둘)", () => {
    state.range = q(undefined, { isError: true });
    state.merchants = q(undefined, { isError: true });
    render();
    expect(boxes()).toHaveLength(2);
  });

  it("추이 · 비교 · 고정·변동 탭 — 합계 질의 실패는 상자 하나", () => {
    state.range = q(undefined, { isError: true });
    render();
    for (const tab of ["tab.trend", "tab.compare", "tab.fixed"]) {
      clickTab(tab);
      expect(boxes()).toHaveLength(1);
    }
  });

  it("비교 탭 — 거래 질의 실패는 요일 띠 하나가 말한다(지표 띠는 숨음)", () => {
    state.expenses = q(undefined, { isError: true });
    render();
    clickTab("tab.compare");
    expect(boxes()).toHaveLength(1);
    expect(
      container.querySelector("[data-section=weekday]")!.textContent,
    ).toContain("loadFailed.weekday");
  });
});

describe("통계 글 · 색 규칙", () => {
  it("지난 기간과 같으면 '0원 덜 썼어요' 대신 '같아요'", () => {
    render();
    clickTab("tab.compare");
    const summary = container.querySelector("[data-section=summary]")!;
    expect(summary.textContent).toContain("compare.same");
    expect(summary.textContent).not.toContain("compare.dirLess");
  });

  it("요일 비교 지난 기간은 chart-blue-weak", () => {
    render();
    clickTab("tab.compare");
    const dots = Array.from(
      container.querySelectorAll(
        "[data-section=weekday] [data-slot=chart-legend-dot]",
      ),
    );
    expect(dots.map((d) => d.className)).toEqual([
      expect.stringMatching(/bg-chart-blue(\s|$)/),
      expect.stringContaining("bg-chart-blue-weak"),
    ]);
  });

  it("저축률 가운데 %는 t9, 비율 막대 글은 차트 색 위 글자색(fg-neutral-inverted, 흰색 고정 아님)", () => {
    state.range = q({ ...summary(), fixedExpense: 1_000_000_000 });
    render();
    clickTab("tab.trend");
    expect(
      container.querySelector("[data-section=rate] .text-t9"),
    ).not.toBeNull();
    clickTab("tab.fixed");
    const bar = container.querySelector("[data-section=expense] [role=img]")!;
    expect(bar.innerHTML).toContain("text-fg-neutral-inverted");
    expect(bar.innerHTML).not.toContain("text-static-white");
  });

  it("칩 탭은 눌러서만 바뀐다 — 밀기 처리기 없음", () => {
    render();
    const panel = container.querySelector("[role=tabpanel]") as HTMLElement;
    expect(panel.style.touchAction).toBe("");
  });

  it("저축률 고리 — 가운데 글은 소수 없는 정수 %, 크기는 rem 이라 글자 크기를 따라 커진다", () => {
    render();
    clickTab("tab.trend");
    const ring = container.querySelector("[data-slot=stats-savings-ring]")!;
    expect(ring.className).toContain("size-[6.75rem]");
    expect(ring.querySelector("svg")!.getAttribute("viewBox")).toBe(
      "0 0 108 108",
    );
    const center = Array.from(ring.querySelectorAll("span")).find((e) =>
      /%/.test(e.textContent ?? ""),
    )!;
    expect(center.textContent).toMatch(/^\d+%$/);
    expect(center.className).toContain("text-t9");
    // 옆 안내 문장 — 문장 칸이 8em 보다 좁으면 고리 아래로 내려가는 줄바꿈 줄
    const insight = container.querySelector(
      "[data-slot=stats-savings-insight]",
    )!;
    expect(insight.className).toContain("min-w-[8em]");
    expect(insight.parentElement!.className).toContain("flex-wrap");
  });

  it("기간 버튼 — 뒤 꺾쇠 하나만(앞 아이콘 없음), 아이콘 16", () => {
    render();
    const btn = container.querySelector(
      "[data-section=donut] [data-slot=card-header] button",
    ) as HTMLElement;
    const svgs = btn.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(btn.lastElementChild).toBe(svgs[0]);
    expect(btn.className).toContain("[&_svg]:size-4");
  });

  it("요일 인사이트 — 요일마다 변화가 없으면 줄을 숨기지 않고 '비슷해요' 로 보인다", () => {
    render();
    clickTab("tab.compare");
    const weekday = container.querySelector("[data-section=weekday]")!;
    expect(weekday.textContent).toContain("compare.weekdayInsightSame");
    expect(weekday.textContent).not.toContain("compare.weekdayInsightUp");
    expect(weekday.textContent).not.toContain("compare.weekdayInsightDown");
  });

  it("고정 탭 월별 Segmented 자리 — 내용 폭(w-max)이고 넘치면 머리 아래로 내려가게 감싼다", () => {
    render();
    clickTab("tab.fixed");
    const seg = container.querySelector(
      "[data-section=trend] [data-slot=segmented-control]",
    ) as HTMLElement;
    const wrap = seg.parentElement as HTMLElement;
    expect(wrap.className).toContain("w-max");
    expect(wrap.className).toContain("max-w-full");
  });

  it("등락 %는 공용 formatChangeRate — 소수 둘째 자리(비교 요약 · 평균 전월 대비 · 카테고리 증감)", () => {
    state.prev = q({ ...summary(), totalExpense: 3_000_000_000 });
    render();
    // 평균 전월 대비 Delta(카테고리 탭 요약)
    expect(
      container.querySelector("[data-section=highlights]")!.textContent,
    ).toContain("30.41%");
    clickTab("tab.compare");
    expect(
      container.querySelector("[data-section=summary]")!.textContent,
    ).toContain("30.41%");
  });
});
