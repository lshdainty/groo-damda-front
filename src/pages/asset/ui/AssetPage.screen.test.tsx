// 자산 화면(I-05 05-3 · 54 ~ 63) — 실제 화면을 띄운 채로 본다: 눈 단추 이름 · 카드 한도 막대 · 선 차트 · 구성 도넛 · 저축 목표 · 카드별 실패 · 칸.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { i18n } from "@/shared/i18n/config";
import { MINUS } from "@/shared/lib/groo/format";

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
const outlet = { mobile: false };
vi.mock("react-router-dom", () => ({
  useNavigate: () => () => {},
  useOutletContext: () => outlet,
}));
vi.mock("lucide-react/dynamic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lucide-react/dynamic")>()),
  DynamicIcon: () => <span />,
}));
vi.mock("@/features/stock/model/useStockMaster", () => ({
  useStockSymbolName: () => ({ data: undefined }),
}));

const q = (data: unknown, extra: object = {}) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...extra,
});
const state = {
  invest: new Map() as Map<number, unknown>,
  priceFailed: false as boolean,
  /** 연동 보유가 있는 자산 — holdingsOf 가 연동 줄 하나를 돌려준다 */
  linked: new Set<number>(),
  assets: q(undefined) as ReturnType<typeof q>,
  summary: q(undefined) as ReturnType<typeof q>,
  trend: q(undefined) as ReturnType<typeof q>,
  recurring: q(undefined) as ReturnType<typeof q>,
  goals: q(undefined) as ReturnType<typeof q>,
};
vi.mock("@/features/asset", () => ({
  useAssets: () => state.assets,
  useAssetSummary: () => state.summary,
  useNetWorthTrend: () => state.trend,
  useInvestValuation: () => state.invest,
  useInvestValuationState: () => ({
    map: state.invest,
    priceFailed: state.priceFailed ?? false,
    priceFailShows: state.priceFailed ? "lastBalance" : null,
    pricesRetrying: false,
    retryPrices: () => {},
  }),
  holdingsOf: (a: { rowId: number }) =>
    state.linked.has(a.rowId) ? [{ linked: true, tossSymbol: "005930" }] : [],
}));
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => state.recurring,
}));
vi.mock("@/features/savingGoal", () => ({
  useSavingGoals: () => state.goals,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const { AssetPage } = await import("./AssetPage");
const { setHiddenCardsLocal } =
  await import("@/shared/lib/groo/hide-amounts-core");

const asset = (
  rowId: number,
  assetName: string,
  assetType: string,
  balance: number,
  extra: object = {},
) => ({
  rowId,
  userRowId: 1,
  assetName,
  assetType,
  balance,
  cashBalance: balance,
  holdingBalance: 0,
  currency: "KRW",
  exchangeRate: 1,
  color: null,
  institution: null,
  memo: null,
  sortOrder: rowId,
  isIncludedInTotal: "Y",
  isAmountHidden: "N",
  cardCatalog: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
  ...extra,
});
const goal = (rowId: number, target: number, current: number) => ({
  rowId,
  userRowId: 1,
  title: `목표 ${rowId}`,
  description: null,
  targetAmount: target,
  currentAmount: current,
  currency: "KRW",
  deadlineDate: null,
  icon: null,
  color: null,
  linkedAssetRowId: null,
  sortOrder: rowId,
  isAchieved: "N",
  achievedAt: null,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
});

const origLang = i18n.language;
beforeAll(async () => {
  await i18n.changeLanguage("ko");
});
afterAll(async () => {
  await i18n.changeLanguage(origLang);
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
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  }
  outlet.mobile = false;
  state.invest = new Map();
  state.assets = q({
    assets: [
      asset(1, "주거래", "BANK_ACCOUNT", 1_000_000),
      asset(2, "증권", "INVESTMENT", 500_000),
      asset(3, "카드 75", "CREDIT_CARD", -7_500_000, {
        creditLimit: 10_000_000,
      }),
      asset(4, "카드 95", "CREDIT_CARD", -9_500_000, {
        creditLimit: 10_000_000,
      }),
      asset(5, "카드 넘침", "CREDIT_CARD", -12_345_678, {
        creditLimit: 10_000_000,
      }),
      asset(6, "대출", "LOAN", -230_000_000),
    ],
  });
  state.summary = q({
    netWorth: 1_000_000,
    changeAmount: 0,
    changePercent: 0,
    lastMonthNetWorth: 1_000_000,
  });
  state.trend = q(
    Array.from({ length: 12 }, (_, i) => ({
      year: 2026,
      month: i + 1,
      netWorth: -3_000_0000 + i * 1_000_000,
    })),
  );
  state.recurring = q([]);
  state.goals = q({
    goals: [goal(1, 9_999_999_999, 1_234_567_890), goal(2, 4_900, 100)],
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => setHiddenCardsLocal([]));
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<AssetPage />));
const text = () => container.textContent ?? "";

describe("순자산 요약(55)", () => {
  it("눈 단추의 이름은 '금액 가리기 설정' 으로 고정이고 aria-pressed 가 없다", () => {
    render();
    const eye = container.querySelector(
      'button[aria-label="hideAmountsSettings"]',
    );
    expect(eye).not.toBeNull();
    expect(eye!.hasAttribute("aria-pressed")).toBe(false);
  });

  it("불러오는 중 금액 자리는 '—' 가 아니라 Skeleton 이다", () => {
    state.summary = q(undefined, { isLoading: true });
    render();
    expect(text()).not.toContain("—");
    expect(container.querySelector("[data-slot=skeleton]")).not.toBeNull();
  });

  it("순자산 증감률은 소수 둘째 자리 — 이전 달 대비 11.11%(예전 11.1%)", () => {
    state.summary = q({
      netWorth: 1_000_000,
      changeAmount: 100_000,
      changePercent: 0,
      lastMonthNetWorth: 900_000,
    });
    render();
    expect(text()).toContain("11.11%");
    expect(text()).not.toMatch(/11\.1%/);
  });

  it("지표 셋(계좌 · 투자 · 카드)이 있다", () => {
    render();
    expect(text()).toContain("tab.accountDeposit");
    expect(text()).toContain("cardBalance");
    expect(container.querySelectorAll("dl dt")).toHaveLength(3);
  });

  it("폰은 지표 셋이 한 줄에 하나(키-값 줄)다", () => {
    outlet.mobile = true;
    render();
    expect(container.querySelectorAll("dl")).toHaveLength(0);
    expect(
      container.querySelectorAll("[data-slot=kv-value]").length,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("카드 한도 막대(56)", () => {
  const meters = () =>
    Array.from(container.querySelectorAll("[role=meter]")).filter((m) =>
      /cardLimitName/.test(m.getAttribute("aria-label") ?? ""),
    );

  it("75% · 95% 에서도 채움은 fg-brand 그대로(경고 색 없음), 넘치면 over + 'N원 초과'", () => {
    render();
    const [m75, m95, over] = meters();
    expect(m75!.getAttribute("data-state")).toBe("enabled");
    expect(m95!.getAttribute("data-state")).toBe("enabled");
    expect(
      m95!.querySelector("[data-slot=progress-fill]")!.className,
    ).toContain("bg-fg-brand");
    expect(over!.getAttribute("data-state")).toBe("over");
    expect(text()).toContain("2,345,678원 초과");
  });

  it("막대에 이름 · 값 글이 있다(role=meter)", () => {
    render();
    for (const m of meters()) {
      expect(m.getAttribute("aria-label")).toBeTruthy();
      expect(m.getAttribute("aria-valuetext")).toBeTruthy();
    }
  });

  it("카드 묶음 합계는 빼기(U+2212)로, 합계 색은 중립이다", () => {
    render();
    expect(text()).toContain(`${MINUS}29,345,678원`);
  });
});

describe("순자산 추이 차트(57)", () => {
  it("영역 채움이 없고(선 + 점) 표로 보기에 12 달이 있다", () => {
    render();
    const chart = container.querySelector("[data-slot=chart]")!;
    expect(chart.className).toContain("[&_.recharts-line-dots]:block");
    expect(chart.querySelector(".recharts-area-area")).toBeNull();
    const rows = container.querySelectorAll("table tbody tr");
    expect(rows.length).toBeGreaterThanOrEqual(12);
  });

  it("툴팁 · 표의 음수는 U+2212 이고 ASCII 하이픈이 아니다", () => {
    render();
    const table = container.querySelector("table")!;
    expect(table.textContent).toContain(`${MINUS}`);
    expect(table.textContent).not.toMatch(/-\d/);
  });
});

describe("구성 도넛(58)", () => {
  it("조각은 현금 · 투자뿐 — 범례에 카드 · 대출이 없다", () => {
    render();
    const legend = container.querySelector("#asset-composition-legend")!;
    expect(legend.querySelectorAll("li")).toHaveLength(2);
    expect(legend.textContent).not.toContain("group.card");
    expect(legend.textContent).not.toContain("assetType.loan");
  });

  it("빚은 목록 줄 둘 — 이름 + 금액, 색 네모 없음", () => {
    render();
    const debts = container.querySelector("[data-slot=asset-donut-debts]")!;
    expect(debts.querySelectorAll("li")).toHaveLength(2);
    expect(debts.textContent).toContain(`${MINUS}29,345,678원`);
    expect(debts.textContent).toContain(`${MINUS}230,000,000원`);
    expect(debts.querySelector("[data-slot=chart-donut-swatch]")).toBeNull();
  });

  it("합계는 자산(조각의 합)이다 — 순자산이 아니다", () => {
    render();
    expect(
      container
        .querySelector("[aria-describedby=asset-composition-legend]")!
        .getAttribute("aria-label"),
    ).toContain("1,500,000원");
  });
});

describe("저축 목표(60)", () => {
  it("목표 금액이 원까지 나온다 — 줄임(만 · 억)이 없다", () => {
    render();
    expect(text()).toContain("1,234,567,890원 / 9,999,999,999원");
    expect(text()).toContain("100원 / 4,900원");
    const goalsText = Array.from(container.querySelectorAll("li"))
      .filter((l) => /목표 \d/.test(l.textContent ?? ""))
      .map((l) => l.textContent)
      .join("");
    expect(goalsText).not.toMatch(/만|억/);
  });
});

describe("카드마다 따로 불러오고 실패한다(62)", () => {
  it("연동 투자 자산의 시세를 못 받으면 그 자산이 든 카드에만 Callout '시세를 불러오지 못했어요 · 보이는 값은 시세가 아닌 마지막 잔액' — 금액은 그대로(단계 4)", () => {
    state.linked = new Set([2]);
    state.priceFailed = true;
    render();
    const bands = [
      ...document.querySelectorAll("[data-slot=price-stale-callout]"),
    ];
    expect(bands).toHaveLength(1);
    expect(bands[0]!.textContent).toContain("detail.priceFail");
    expect(bands[0]!.textContent).toContain("detail.priceStaleBalance");
    // 보이는 내용이 있으면 실패 Result Section 을 쓰지 않는다(result-section.md:53)
    expect(document.querySelector("[data-slot=price-fail-band]")).toBeNull();
    expect(text()).toContain("증권");
    state.priceFailed = false;
    state.linked = new Set();
  });

  it("시세 실패여도 연동 자산이 없으면 띠를 두지 않는다", () => {
    state.priceFailed = true;
    render();
    expect(
      document.querySelector("[data-slot=price-stale-callout]"),
    ).toBeNull();
    state.priceFailed = false;
  });

  it("받아 둔 값이 있는 채 다시 받다 실패하면(추이 · 다가오는 지출 · 목표 · 자산 · 요약) 내용을 그대로 둔다 — 실패 자리로 바꾸지 않는다", () => {
    for (const k of [
      "trend",
      "recurring",
      "goals",
      "assets",
      "summary",
    ] as const)
      state[k] = { ...state[k], isError: true };
    render();
    expect(text()).not.toContain("loadFailed.");
    expect(text()).toContain("주거래");
    expect(text()).toContain("목표 1");
  });

  it("추이가 실패하면 그 자리만 실패 + 다시 시도, 나머지는 그대로다", () => {
    state.trend = q(undefined, { isError: true });
    render();
    expect(text()).toContain("loadFailed.trend");
    expect(text()).not.toContain("loadFailed.goals");
    expect(text()).toContain("주거래");
    expect(text()).toContain("목표 1");
  });

  it("저축 목표 · 예정 결제가 실패해도 화면 전체가 스켈레톤으로 돌아가지 않는다", () => {
    state.goals = q(undefined, { isError: true });
    state.recurring = q(undefined, { isError: true });
    render();
    expect(text()).toContain("loadFailed.goals");
    expect(text()).toContain("loadFailed.upcoming");
    expect(text()).toContain("주거래");
    expect(text()).not.toContain("서버 오류");
  });

  it("목록이 실패하면 데스크톱은 카드마다 실패 상자 + 오류 원문은 없다", () => {
    state.assets = q(undefined, { isError: true });
    render();
    expect(text()).toContain("loadFailed.assets");
    expect(text()).toContain("loadFailed.composition");
  });

  it("폰은 질의 하나 = 실패 상자 하나 — 요약 띠에만, 묶음 띠는 없다(08-1 규칙)", () => {
    outlet.mobile = true;
    state.assets = q(undefined, { isError: true });
    render();
    expect(
      container.querySelectorAll("[data-slot=result-section]"),
    ).toHaveLength(1);
    // 한 상자의 글은 앱과 같은 "자산을 불러오지 못했어요"(loadFailed.assets)
    expect(text()).toContain("loadFailed.assets");
    expect(text()).not.toContain("loadFailed.summary");
    const bands = Array.from(
      container.querySelectorAll(".screen-bands > *"),
    ).map((b) => b.getAttribute("data-section"));
    expect(bands).toEqual(["summary", "goals"]);
  });

  it("새로 고치는 중에도 제목(h1)의 이름은 '자산' 이다 — 원은 장식이고 진행 알림은 role=status 한 곳", () => {
    state.assets = q(state.assets.data, { isFetching: true });
    render();
    const h1 = container.querySelector("h1")!;
    expect(h1.textContent).toBe("assets");
    const spinner = h1.querySelector("[data-slot=progress-circle]");
    expect(spinner).not.toBeNull();
    expect(spinner!.closest("[aria-hidden=true]")).not.toBeNull();
    const status = container.querySelectorAll("[role=status]");
    expect(
      Array.from(status).filter((n) => n.textContent === "refreshing"),
    ).toHaveLength(1);
    expect(h1.closest("[role=status]")).toBeNull();
  });

  it("불러오는 중에도 제목 · 카드 틀은 그린다", () => {
    state.assets = q(undefined, { isLoading: true });
    state.goals = q(undefined, { isLoading: true });
    render();
    expect(text()).toContain("savingGoals");
    expect(text()).toContain("composition");
    expect(
      container.querySelectorAll("[data-slot=skeleton]").length,
    ).toBeGreaterThan(0);
  });
});

describe("빈 화면(61) · 칸(63)", () => {
  it("자산이 없으면 카드 안 Result Section medium(처음) + 첫 버튼", () => {
    state.assets = q({ assets: [] });
    render();
    const rs = container.querySelector("[data-slot=result-section]")!;
    expect(rs.getAttribute("data-size")).toBe("medium");
    expect(rs.textContent).toContain("emptyTitle");
    expect(rs.textContent).toContain("emptyCta");
  });

  it("폰 빈 화면은 띠 안 large 다", () => {
    outlet.mobile = true;
    state.assets = q({ assets: [] });
    render();
    expect(
      container
        .querySelector("[data-slot=result-section]")!
        .getAttribute("data-size"),
    ).toBe("large");
  });

  it("데스크톱 칸: 768 ~ 1279 한 칸 720 가운데 · 1280 이상 두 칸 1.4fr 1fr · 칸 사이 24 · 카드 사이 8", () => {
    render();
    const wrap = container.querySelector("[data-slot=asset-desktop] > div")!;
    expect(wrap.className).toContain("max-w-[var(--layout-max-low)]");
    expect(wrap.className).toContain("lg:max-w-[var(--layout-max-medium)]");
    const grid = wrap.querySelector(".grid")!;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain(
      "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]",
    );
    expect(grid.className).toContain("lg:gap-[var(--layout-gutter)]");
    expect(grid.className).toContain("gap-x2");
  });
});

describe("폰 띠(74)", () => {
  it("구역마다 띠 하나 — 요약 · 계좌 · 투자 · 카드 · 대출 · 저축 목표, 띠 사이 8 만 틈이다", () => {
    outlet.mobile = true;
    render();
    const names = Array.from(
      container.querySelectorAll(".screen-bands > *"),
    ).map((b) => b.getAttribute("data-section"));
    expect(names).toEqual([
      "summary",
      "accounts",
      "investments",
      "cards",
      "loans",
      "goals",
    ]);
    expect(container.querySelector(".screen-bands")!.className).not.toMatch(
      /pt-|mt-/,
    );
  });
});

describe("투자 등락 가림(I-05 56)", () => {
  const rowDelta = () =>
    container.querySelector(
      '[aria-label="group.invest"] [data-slot=delta], ul [data-slot=delta]',
    );
  beforeEach(() => {
    state.invest = new Map([
      [2, { value: 500_000, changePct: 3.2, changeAmt: 16_000 }],
    ]);
  });

  it("가림이 꺼져 있으면 등락 % 와 금액이 보인다", () => {
    render();
    const d = Array.from(
      container.querySelectorAll("[data-slot=delta-value]"),
    ).map((n) => n.textContent);
    expect(
      d.some((t) => /3\.20%/.test(t ?? "") && /16,000원/.test(t ?? "")),
    ).toBe(true);
  });

  it("투자 카드를 가리면 줄은 두고 값만 '•••' 로 가린다", () => {
    act(() => setHiddenCardsLocal(["asset.investments"]));
    render();
    const d = Array.from(container.querySelectorAll("[data-slot=delta]"));
    const invest = d.find((n) => n.textContent?.includes("•••"));
    expect(invest).toBeDefined();
    expect(invest!.querySelector("[data-slot=delta-value]")!.textContent).toBe(
      "▲ •••",
    );
    expect(text()).not.toContain("3.20%");
    expect(text()).not.toContain("16,000원");
    expect(rowDelta()).not.toBeNull();
  });

  it("이 자산만 가려도 같다", () => {
    state.assets = q({
      assets: [
        asset(2, "증권", "INVESTMENT", 500_000, { isAmountHidden: "Y" }),
      ],
    });
    render();
    expect(text()).not.toContain("3.20%");
    expect(text()).toContain("•••");
  });
});

describe("저축 목표 기한 없음(I-05 60)", () => {
  it("기한이 없으면 '기한 없음' 키를 쓴다 — 옛 '상시' 가 아니다", () => {
    render();
    expect(text()).toContain("savingGoal.noDeadline · ");
    expect(text()).not.toContain("anytime");
  });
});
