// 데스크톱 · 태블릿 가계부(ExpenseDesktop) — 실제 화면을 띄운 채로 I-07 24 ~ 36 을 잠근다.
// 번역은 CSV 원본에서 읽는다(키 이름이 아니라 사용자가 읽는 글로 본다). 고정한 오늘 + 데이터의 날짜도 함께 고정한다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/entities/expense";
import { editAssetPath } from "@/entities/asset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function koCopy(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync("i18n/translations.csv", "utf-8").split(
    "\n",
  )) {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += c;
    }
    cells.push(cur);
    const [ns, key, ko] = cells;
    if ((ns === "expense" || ns === "common") && key)
      out[`${ns}:${key}`] = ko ?? "";
  }
  return out;
}
const COPY = koCopy();

const st = vi.hoisted(() => ({
  search: "",
  wide: true,
  list: [] as unknown[],
  failed: false,
  incomeSum: 450_000,
  expenseSum: 12_000,
  setSearch: [] as string[],
  fixedCalls: [] as { ids: number[]; isFixed: boolean; silent?: boolean }[],
  deleteCalls: [] as number[][],
  deleteFails: false,
  fixedFails: false,
  refund: null as number | null,
  toastOpts: [] as unknown[],
  detail: [] as number[],
  toasts: [] as string[],
  snacks: [] as {
    message: string;
    tone?: string;
    action?: { label: string; onClick: () => void };
  }[],
  closedCard: false,
  navigated: [] as string[],
}));

vi.mock(
  "@/shared/ui/groo/month-title",
  async () => import("@/shared/ui/groo/month-title.test-double"),
);
vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      const raw = COPY[`${ns ?? "common"}:${k}`];
      if (raw == null) return k;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        String(opts?.[name] ?? ""),
      );
    },
    i18n: { language: "ko" },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useSearchParams: () => [
    new URLSearchParams(st.search),
    (next: URLSearchParams | ((p: URLSearchParams) => URLSearchParams)) => {
      const n =
        typeof next === "function"
          ? next(new URLSearchParams(st.search))
          : next;
      st.setSearch.push(n.toString());
      st.search = n.toString();
    },
  ],
  useNavigate: () => (to: string) => {
    st.navigated.push(to);
  },
}));
const hide = vi.hoisted(() => ({ on: false }));
vi.mock("@/shared/lib/groo/hide-amounts-core", async (orig) => ({
  ...(await orig<typeof import("@/shared/lib/groo/hide-amounts-core")>()),
  useHideAmounts: () => hide.on,
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: (typeof st.snacks)[number]) => st.snacks.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (m: string, o?: unknown) => {
      st.toasts.push(m);
      st.toastOpts.push(o);
    },
    info: (m: string) => st.toasts.push(m),
    error: (m: string) => st.toasts.push(m),
  },
}));

const query = (data: unknown) => ({
  data,
  isLoading: false,
  isError: st.failed,
  refetch: async () => {},
});
vi.mock("@/features/expense", () => ({
  useExpenses: () => query(st.list),
  useRangeSummary: () =>
    query({
      totalIncome: st.incomeSum,
      totalExpense: st.expenseSum,
      categoryBreakdown: [],
    }),
  useExpenseCategories: () => ({
    data: [
      {
        rowId: 11,
        categoryName: "식비",
        parentRowId: null,
        sortOrder: 1,
      },
    ],
  }),
  useBulkMarkFixed: () => ({
    mutateAsync: async (v: {
      ids: number[];
      isFixed: boolean;
      silent?: boolean;
    }) => {
      st.fixedCalls.push(v);
      if (st.fixedFails) throw new Error("fail");
      return { updatedCount: v.ids.length };
    },
    isPending: false,
  }),
  useBulkDeleteExpenses: () => ({
    mutateAsync: async (ids: number[]) => {
      st.deleteCalls.push(ids);
      if (st.deleteFails) throw new Error("fail");
      return { deletedCount: ids.length, refundedAmount: st.refund };
    },
    isPending: false,
  }),
}));
vi.mock("@/features/asset", () => ({
  useAssets: () => ({
    data: {
      assets: [
        {
          rowId: 9,
          assetName: "생활비 통장",
          assetType: "BANK_ACCOUNT",
          institution: null,
        },
        // 닫힌 회차 시험용 — 10월 말까지 결제가 끝난 카드, 결제계좌는 9
        ...(st.closedCard
          ? [
              {
                rowId: 20,
                assetName: "시험 카드",
                assetType: "CREDIT_CARD",
                institution: null,
                paymentAssetRowId: 9,
                cardClosedThrough: "2026-10-31",
              },
            ]
          : []),
      ],
    },
  }),
  useAsset: () => ({ data: { rowId: 9, assetName: "생활비 통장" } }),
  useAssetTransfers: () => query({ transfers: [] }),
}));
vi.mock("@/widgets/add-tx", () => ({ AddTxSheet: () => null }));
vi.mock("@/widgets/expense-detail/ui/TxDetailDialog", () => ({
  TxDetailDialog: ({ expense }: { expense: Expense }) => {
    st.detail.push(expense.rowId);
    return null;
  },
}));
vi.mock("@/widgets/expense-detail/ui/TransferDetailDialog", () => ({
  TransferDetailDialog: () => null,
}));

const { ExpenseDesktop } = await import("./ExpenseDesktop");
const { BulkBar } = await import("./desktop/BulkBar");
const { i18n } = await import("@/shared/i18n/config");

const tx = (
  rowId: number,
  day: number,
  amount: number,
  o: Partial<Expense> = {},
): Expense => ({
  rowId,
  categoryRowId: 11,
  categoryName: "식비",
  assetRowId: 9,
  assetName: "생활비 통장",
  expenseType: "EXPENSE",
  amount,
  description: null,
  merchant: `가게${rowId}`,
  expenseDate: `2026-10-${String(day).padStart(2, "0")}T10:00:00`,
  paymentMethod: "CARD",
  installmentMonths: null,
  refundedAt: null,
  refundTransferRowId: null,
  originalAmount: null,
  originalCurrency: null,
  exchangeRate: null,
  calendarEventRowId: null,
  todoRowId: null,
  autoSource: null,
  createAt: "2026-10-01T10:00:00",
  modifyAt: "2026-10-01T10:00:00",
  ...o,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage("ko");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00"));
  st.search = "";
  st.wide = true;
  st.failed = false;
  st.setSearch = [];
  st.fixedCalls = [];
  st.deleteCalls = [];
  st.deleteFails = false;
  st.fixedFails = false;
  st.refund = null;
  st.toastOpts = [];
  st.detail = [];
  st.toasts = [];
  st.snacks = [];
  st.closedCard = false;
  st.navigated = [];
  hide.on = false;
  st.list = [
    tx(1, 15, 12_000),
    tx(2, 14, 5_000),
    tx(3, 14, 450_000, { expenseType: "INCOME" }),
    tx(4, 13, 1_200, { autoSource: "LOAN_INTEREST" }),
  ];
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width: 1280px") ? st.wide : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const render = () => act(() => root.render(<ExpenseDesktop />));
const buttons = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>("button"));
const byName = (name: string) =>
  buttons().find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent) === name,
  );
const byNameLike = (part: string) =>
  buttons().find((b) =>
    (b.getAttribute("aria-label") ?? b.textContent ?? "").includes(part),
  );
const click = (el: HTMLElement | undefined) => {
  expect(el, "누를 단추가 있다").toBeTruthy();
  act(() => el!.click());
};
const checks = () =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      "[data-slot=expense-list-card] [role=checkbox]",
    ),
  );

describe("틀 · 짝 2 (I-07 24 · 25)", () => {
  it("1280 이상은 작은 달력 + 목록, 요약 카드는 없다 — 큰 달력 · 보기 전환 · 알약 · 내보내기가 없다", () => {
    render();

    expect(container.querySelector("[data-slot=mini-calendar]")).not.toBeNull();
    expect(container.querySelector("[data-slot=summary-card]")).toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("가계부");
    // 옛 화면의 것이 남지 않는다
    for (const gone of ["목록", "달력", "전체", "내보내기"])
      expect(byName(gone), gone).toBeUndefined();
    expect(container.textContent).not.toContain("모든 거래 내역");
    expect(container.textContent).not.toContain("필터 중");
  });

  it("768 ~ 1279 는 위 요약 카드 + 아래 목록 — 작은 달력은 없다", () => {
    st.wide = false;
    render();

    expect(container.querySelector("[data-slot=summary-card]")).not.toBeNull();
    expect(container.querySelector("[data-slot=mini-calendar]")).toBeNull();
    // 접힌 주 달력은 한 주(7칸)만 — 펼치면 6주
    const days = () => container.querySelectorAll("[data-day]").length;
    const grid = () =>
      container.querySelectorAll("#expense-week-strip > div").length;
    expect(grid()).toBe(1 + 1);
    const expand = byName("월 달력")!;
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    click(expand);
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(grid()).toBe(1 + 6);
    expect(days()).toBeGreaterThan(7);
  });
});

describe("작은 달력 (I-07 26 · 27)", () => {
  it("막대는 장식(aria-hidden)이고, 날 버튼 이름에 그날 지출이 든다", () => {
    render();
    const bars = container.querySelectorAll("[data-slot=intensity-bar]");

    expect(bars.length).toBeGreaterThan(0);
    for (const b of bars) expect(b.getAttribute("aria-hidden")).toBe("true");
    expect(byName("10월 14일, 지출 5,000원"), "지출이 있는 날").toBeTruthy();
    expect(byName("10월 20일"), "지출이 없는 날은 날짜만").toBeTruthy();
  });

  it("앞뒤 달 칸은 누를 수 없다 — 버튼이 아니다", () => {
    render();
    const group = container.querySelector(
      "[data-slot=mini-calendar] [role=group]",
    )!;

    // 요일 7 + 6주 42칸 — 이 달 31칸만 버튼이고 앞뒤 달 11칸은 숨은 글이다
    expect(group.children).toHaveLength(7 + 42);
    expect(group.querySelectorAll("button[data-day]")).toHaveLength(31);
    expect(
      group.querySelectorAll("[aria-hidden]:not(button)").length,
    ).toBeGreaterThan(11);
    expect(container.querySelector('[data-day="2026-09-27"]')).toBeNull();
  });

  it("격자 역할(grid · row · gridcell)을 쓰지 않는다 — 날 버튼은 버튼 역할을 지킨다(화살표 이동을 짜지 않으므로)", () => {
    render();
    expect(
      container.querySelector(
        "[role=grid], [role=row], [role=gridcell], [role=columnheader]",
      ),
    ).toBeNull();
    const day = byName("10월 14일, 지출 5,000원")!;
    expect(day.tagName).toBe("BUTTON");
    expect(day.getAttribute("role")).toBeNull();

    st.wide = false;
    render();
    expect(
      container.querySelector(
        "[role=grid], [role=row], [role=gridcell], [role=columnheader]",
      ),
    ).toBeNull();
  });

  it("날을 누르면 목록의 그 날 묶음으로 옮긴다 — 거래가 없는 날은 아무 일도 없다", () => {
    render();
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    click(byName("10월 20일"));
    expect(scroll).not.toHaveBeenCalled();

    click(byName("10월 14일, 지출 5,000원"));
    expect(scroll).toHaveBeenCalledTimes(1);
    const el = scroll.mock.contexts[0] as HTMLElement;
    expect(el.getAttribute("data-day-group")).toBe("2026-10-14");
  });

  it("아래 수입 · 지출 · 합계는 그 달 서버 요약이다(부호 U+2212)", () => {
    render();
    const kv = Array.from(container.querySelectorAll("[data-kv]")).map(
      (e) => e.textContent,
    );

    expect(kv).toHaveLength(3);
    expect(kv[0]).toContain("+450,000");
    expect(kv[1]).toContain("−12,000");
    expect(kv[2]).toContain("+438,000");
  });

  it("달 이동은 주소의 month 를 고쳐 쓴다(뒤로 가기로 앞 달)", () => {
    render();
    click(byName("이전 달"));

    expect(st.setSearch[st.setSearch.length - 1]).toBe("month=2026-09");
  });
});

describe("목록 카드 (I-07 31)", () => {
  it("날짜 묶음 머리는 합계 없이 날짜 + 오늘 · 머리 n 은 보이는 줄 수", () => {
    render();
    const headers = container.querySelectorAll<HTMLElement>(
      "[data-slot=list-header]",
    );

    expect(headers).toHaveLength(3);
    expect(headers[0]!.textContent).toContain("10월 15일");
    expect(headers[0]!.textContent).toContain("오늘");
    for (const h of headers) {
      expect(h.tagName).toBe("H3");
      expect(h.textContent).not.toMatch(/\d,\d{3}/);
    }
    expect(container.querySelector("[data-slot=card-title]")?.textContent).toBe(
      "거래 4건",
    );
  });

  it("머리 요약은 필터가 없으면 그 달 서버 요약, 걸리면 거른 목록의 값이다", () => {
    render();
    const head = container.querySelector(
      "[data-slot=expense-list-card] [data-slot=card-header]",
    )!;

    expect(head.textContent).toContain("−12,000");
    expect(head.textContent).toContain("+450,000");
  });

  it("줄을 누르면 상세가 열린다", () => {
    render();
    const row = container.querySelector<HTMLElement>(
      "[data-slot=expense-list-card] button[data-slot=list-body]",
    )!;
    click(row);

    expect(st.detail).toContain(1);
  });

  it("실패하면 Result Section + 다시 시도, 머리 · 달력은 그대로 — 건수를 내지 않는다", () => {
    st.failed = true;
    render();

    expect(container.querySelector("[data-slot=card-title]")?.textContent).toBe(
      "거래",
    );
    expect(container.textContent).not.toMatch(/거래 \d+건/);

    expect(
      container.querySelector("[data-slot=result-section]")?.textContent,
    ).toContain("거래를 불러오지 못했어요");
    expect(container.querySelector("[data-slot=mini-calendar]")).not.toBeNull();
  });
});

describe("필터 바 (I-07 28 · 29 · 30)", () => {
  const bar = () =>
    container.querySelector<HTMLElement>('[aria-label="거래 거르기"]')!;

  it("조건마다 칩 — 1280 이상 small 32 · 미만 medium 36, ↺ 는 걸렸을 때만", () => {
    render();
    const chips = Array.from(bar().querySelectorAll<HTMLElement>("button"));

    expect(chips.map((c) => c.textContent)).toEqual([
      "기간",
      "거래 종류",
      "카테고리",
      "계좌·카드",
      "금액",
    ]);
    for (const c of chips) expect(c.className).toContain("min-h-[32px]");
    expect(byName("필터 지우기")).toBeUndefined();

    st.wide = false;
    render();
    for (const c of bar().querySelectorAll("button"))
      expect(c.className).toContain("min-h-[36px]");
  });

  it("조건 칩을 누르면 1280 이상은 Popover — 그 조건 하나만 · 머리는 조건 이름", () => {
    render();
    click(byName("거래 종류"));
    const pop = document.querySelector("[data-slot=popover-content]");

    expect(pop).not.toBeNull();
    expect(pop!.querySelector("h2")?.textContent).toBe("거래 종류");
    expect(pop!.textContent).not.toContain("카테고리");
    expect(
      Array.from(pop!.querySelectorAll("button")).map((b) => b.textContent),
    ).toEqual(expect.arrayContaining(["초기화", "완료"]));
  });

  it("미만은 Bottom Sheet — 폼이라 바깥을 눌러도 닫히지 않는다", () => {
    st.wide = false;
    render();
    click(byName("거래 종류"));

    expect(document.querySelector("[data-slot=popover-content]")).toBeNull();
    expect(
      document.querySelector("[data-slot=bottom-sheet-content]"),
    ).not.toBeNull();
  });

  it("완료로만 반영한다 — 지출만 고르면 칩이 짙게 · 값 요약, ↺ 가 생긴다", () => {
    render();
    click(byName("거래 종류"));
    const income = Array.from(
      document.querySelectorAll<HTMLElement>("[role=dialog] [role=checkbox]"),
    ).find((c) => c.textContent === "수입")!;
    click(income);
    // 아직 반영 전
    expect(byName("거래 종류")).toBeTruthy();
    click(buttons().find((b) => b.textContent === "완료"));

    const chip = byName("지출")!;
    expect(chip.hasAttribute("data-selected")).toBe(true);
    expect(byName("필터 지우기")).toBeTruthy();
    // 걸러진 목록 — 거래 수가 줄고 달 요약(kv)은 그대로
    expect(container.querySelector("[data-slot=card-title]")?.textContent).toBe(
      "거래 3건",
    );
    // 목록 머리 = 거른 목록으로 센 값, 달력 아래 kv = 그 달 값(필터와 무관)
    expect(
      container.querySelector(
        "[data-slot=expense-list-card] [data-slot=card-header]",
      )!.textContent,
    ).toContain("−18,200");
    expect(
      Array.from(container.querySelectorAll("[data-kv]"))[0]!.textContent,
    ).toContain("+450,000");
  });

  it("조건이 둘 이상이어야 맨 끝 '모두 일치' 칩이 생기고, 하나로 줄면 사라진다", () => {
    render();
    expect(byName("모두 일치")).toBeUndefined();
    const pick = (chipName: string, optionText: string) => {
      click(byName(chipName));
      const opt = Array.from(
        document.querySelectorAll<HTMLElement>("[role=dialog] [role=checkbox]"),
      ).find((c) => c.textContent?.includes(optionText))!;
      click(opt);
      click(buttons().find((b) => b.textContent === "완료"));
    };
    pick("거래 종류", "수입"); // 지출만
    expect(byName("모두 일치")).toBeUndefined();
    pick("카테고리", "식비");
    const match = byName("모두 일치")!;
    expect(match).toBeTruthy();
    expect(match.hasAttribute("data-selected")).toBe(true);
    // 칩 순서 — 맨 끝
    expect([...bar().querySelectorAll("button")].pop()!.textContent).toBe(
      "모두 일치",
    );

    // ↺ 로 모두 푼다
    click(byName("필터 지우기"));
    expect(byName("모두 일치")).toBeUndefined();
    expect(byName("필터 지우기")).toBeUndefined();
  });
});

describe("고르기 모드 · 일괄 작업 바 (I-07 33 ~ 36)", () => {
  const enter = () => click(byNameLike("고르기"));
  const bulk = () => container.querySelector("[data-slot=expense-bulk-bar]");

  it("[고르기] → [완료], 줄 앞에 체크 — 고를 수 없는 줄(시스템 거래)은 체크 없이 자리만", () => {
    render();
    expect(checks()).toHaveLength(0);
    enter();

    expect(byNameLike("완료")).toBeTruthy();
    // 거래 4건 중 시스템 거래(이자) 하나는 고를 수 없다
    expect(checks()).toHaveLength(3);
    expect(bulk()).toBeNull();
  });

  it("모드에서 줄을 누르면 체크가 바뀌고 상세는 열리지 않는다 — 고른 줄은 바탕이 없다", () => {
    render();
    enter();
    const first = checks()[0]!;
    const row = first.closest("label")!;
    click(row);

    expect(first.getAttribute("aria-checked")).toBe("true");
    expect(st.detail).toEqual([]);
    expect(row.closest("[data-slot=list-item]")!.className).not.toMatch(
      /bg-bg-brand/,
    );
  });

  it("바는 1개 이상 골랐을 때만 — 수 · 합계(수입 − 지출) · 고정으로 표시 · 삭제 · ✕", () => {
    render();
    enter();
    click(checks()[0]!); // 지출 12,000 (10-15)
    click(checks()[2]!); // 수입 450,000 (10-14)

    const b = bulk()!;
    expect(b).not.toBeNull();
    expect(b.textContent).toContain("2개 선택됨");
    expect(b.textContent).toContain("합계");
    expect(b.textContent).toContain("+438,000");
    expect(document.querySelector("[role=status]")!.textContent).toBe(
      "2개 선택됨",
    );
    expect(byName("고정으로 표시")).toBeTruthy();
    expect(byName("삭제")).toBeTruthy();

    // ✕ = 모두 풀기, 모드는 그대로
    click(byName("선택 해제"));
    expect(bulk()).toBeNull();
    expect(byNameLike("완료")).toBeTruthy();
    expect(
      checks().every((c) => c.getAttribute("aria-checked") === "false"),
    ).toBe(true);
  });

  it("달을 옮기면 고른 것을 모두 푼다 — 모드는 그대로(Q12-A)", () => {
    render();
    enter();
    click(checks()[0]!);
    expect(bulk()).not.toBeNull();
    click(byName("이전 달"));

    expect(bulk()).toBeNull();
    expect(byNameLike("완료")).toBeTruthy();
  });

  it("[고정으로 표시] 는 고른 거래로 isFixed true 를 보낸다 — 알림 · 고른 것을 푼다", async () => {
    render();
    enter();
    click(checks()[0]!);
    click(checks()[1]!);
    await act(async () => byName("고정으로 표시")!.click());

    expect(st.fixedCalls).toEqual([
      { ids: [1, 2], isFixed: true, silent: true },
    ]);
    expect(st.snacks).toEqual([{ message: "2건을 고정으로 바꿨어요." }]);
    expect(st.toasts).toEqual([]);
    expect(bulk()).toBeNull();
  });

  it("[삭제] → 확인창(criticalSolid) → 일괄 삭제 API 하나, 성공하면 닫고 푼다", async () => {
    render();
    enter();
    click(checks()[0]!);
    click(byName("삭제"));

    const dialog = document.querySelector("[role=alertdialog]")!;
    expect(dialog.textContent).toContain("거래 1건을 삭제할까요?");
    expect(dialog.textContent).toContain("삭제한 거래는 되돌릴 수 없어요.");
    expect(dialog.textContent).toContain("−12,000원이 10월에서 빠져요");
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "삭제",
    )!;
    expect(confirm.className).toContain("bg-bg-critical-solid");

    await act(async () => confirm.click());
    expect(st.deleteCalls).toEqual([[1]]);
    expect(st.snacks).toEqual([{ message: "1건을 삭제했어요." }]);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(bulk()).toBeNull();
  });

  it("✕ · 고정 표시 · 삭제 성공 뒤 바가 사라져도 초점은 [완료] 에 남는다(I-07 34)", async () => {
    vi.useRealTimers();
    render();
    enter();
    const done = byNameLike("완료")!;
    click(checks()[0]!);
    click(byName("선택 해제"));
    await act(
      async () => new Promise<void>((r) => requestAnimationFrame(() => r())),
    );
    expect(document.activeElement).toBe(done);

    click(checks()[0]!);
    (document.activeElement as HTMLElement).blur();
    await act(async () => byName("고정으로 표시")!.click());
    await act(
      async () => new Promise<void>((r) => requestAnimationFrame(() => r())),
    );
    expect(document.activeElement).toBe(done);
  });

  it("삭제가 성공해 확인창이 닫히고 바가 사라져도 초점은 [완료] 에 남는다(I-07 34)", async () => {
    vi.useRealTimers();
    render();
    enter();
    const done = byNameLike("완료")!;
    click(checks()[0]!);
    click(byName("삭제"));
    const confirm = Array.from(
      document.querySelectorAll("[role=alertdialog] button"),
    ).find((b) => b.textContent === "삭제") as HTMLElement;
    await act(async () => confirm.click());
    // 확인창이 닫히며 초점을 돌려받는 시간까지 기다린다
    await act(async () => new Promise<void>((r) => setTimeout(r, 100)));

    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(bulk()).toBeNull();
    expect(document.activeElement).toBe(done);
  });

  const openDeleteConfirm = async () => {
    render();
    enter();
    click(checks()[0]!);
    click(byName("삭제"));
    const confirm = Array.from(
      document.querySelectorAll("[role=alertdialog] button"),
    ).find((b) => b.textContent === "삭제") as HTMLElement;
    await act(async () => confirm.click());
  };
  const noticeButtons = () =>
    Array.from(document.querySelectorAll("[role=alertdialog] button"));

  it("환급이 있으면 삭제 뒤 알림 창(확인 하나 · neutralSolid)이 먼저 뜨고 스낵바는 아직 없다", async () => {
    st.refund = 12_000;
    await openDeleteConfirm();

    const dialog = document.querySelector("[role=alertdialog]")!;
    expect(dialog.textContent).toContain("미리 낸 돈이 돌아왔어요");
    expect(dialog.textContent).toContain(
      "미리 낸 돈 중 12,000원이 계좌로 돌아왔어요.",
    );
    const buttons = noticeButtons();
    expect(buttons.map((b) => b.textContent)).toEqual(["확인"]);
    expect(buttons[0]!.className).not.toContain("bg-bg-critical-solid");
    expect(dialog.textContent).not.toContain("삭제할까요");
    expect(st.snacks).toEqual([]);
    expect(st.toasts).toEqual([]);
  });

  it('알림 창의 [확인] 을 누르면 닫히고 그때 스낵바 "N건을 삭제했어요." 가 뜬다', async () => {
    st.refund = 12_000;
    await openDeleteConfirm();
    await act(async () => (noticeButtons()[0] as HTMLElement).click());

    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(st.snacks).toEqual([{ message: "1건을 삭제했어요." }]);
  });

  it("환급이 없으면(null · 0) 알림 창 없이 바로 스낵바", async () => {
    for (const refund of [null, 0]) {
      st.refund = refund;
      st.snacks = [];
      await openDeleteConfirm();
      expect(document.querySelector("[role=alertdialog]")).toBeNull();
      expect(st.snacks).toEqual([{ message: "1건을 삭제했어요." }]);
    }
  });

  it("닫힌 회차 카드 + 결제계좌가 있으면 [잔액 고치기] 액션이 붙는다 — 환급 0원이어도(조건은 환급과 무관)", async () => {
    st.closedCard = true;
    st.list = [tx(1, 15, 12_000, { assetRowId: 20 })];
    st.refund = 0;
    await openDeleteConfirm();
    expect(st.snacks).toHaveLength(1);
    expect(st.snacks[0]!.message).toBe("1건을 삭제했어요.");
    expect(st.snacks[0]!.action?.label).toBe("잔액 고치기");
  });

  it("환급 있음 + 닫힌 회차: 알림 [확인] 뒤 스낵바에 [잔액 고치기] 가 붙고, 누르면 통장 수정으로 간다", async () => {
    st.closedCard = true;
    st.list = [tx(1, 15, 12_000, { assetRowId: 20 })];
    st.refund = 5_000;
    await openDeleteConfirm();
    expect(st.snacks).toEqual([]);
    await act(async () => (noticeButtons()[0] as HTMLElement).click());
    expect(st.snacks[0]!.action?.label).toBe("잔액 고치기");
    st.snacks[0]!.action!.onClick();
    expect(st.navigated).toEqual([editAssetPath(9)]);
  });

  it("닫힌 회차가 아니면 [잔액 고치기] 가 없다", async () => {
    st.refund = 5_000;
    await openDeleteConfirm();
    await act(async () => (noticeButtons()[0] as HTMLElement).click());
    expect(st.snacks[0]!.action).toBeUndefined();
  });

  it("삭제 요청은 전역 오류 토스트를 끈다(silent) — 실패는 화면이 알린다", async () => {
    const { expenseApi } = await import("@/features/expense/api/expenseApi");
    const { apiClient } = await import("@/shared/api");
    const post = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { deletedCount: 1, refundedAmount: null } });
    await expenseApi.bulkDeleteExpenses([1]);
    expect(post).toHaveBeenCalledWith(
      "/v1/expenses/delete",
      { expenseIds: [1] },
      { silent: true },
    );
    post.mockRestore();
  });

  it("고정 표시가 실패하면 고른 것을 그대로 두고 critical 스낵바 + [다시 시도] — 누르면 같은 요청을 바로 보낸다", async () => {
    st.fixedFails = true;
    render();
    enter();
    click(checks()[0]!);
    await act(async () => byName("고정으로 표시")!.click());

    expect(bulk()).not.toBeNull();
    expect(st.toasts).toEqual([]);
    expect(st.snacks).toHaveLength(1);
    expect(st.snacks[0]).toMatchObject({
      message: "고정으로 표시하지 못했어요.",
      tone: "critical",
      action: { label: "다시 시도" },
    });
    st.fixedFails = false;
    await act(async () => st.snacks[0]!.action!.onClick());
    expect(st.fixedCalls).toEqual([
      { ids: [1], isFixed: true, silent: true },
      { ids: [1], isFixed: true, silent: true },
    ]);
    expect(st.snacks[1]).toEqual({ message: "1건을 고정으로 바꿨어요." });
    expect(bulk()).toBeNull();
  });

  it("삭제가 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도] — 다시 묻지 않고 같은 삭제를 바로 보낸다", async () => {
    st.deleteFails = true;
    await openDeleteConfirm();

    expect(st.deleteCalls).toEqual([[1]]);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(st.toasts).toEqual([]);
    // 아무것도 지워지지 않았다 — 고른 것은 그대로, 서버 글이 아니라 고정 문구
    expect(bulk()).not.toBeNull();
    expect(st.snacks).toHaveLength(1);
    expect(st.snacks[0]).toMatchObject({
      message: "거래를 삭제하지 못했어요.",
      tone: "critical",
      action: { label: "다시 시도" },
    });

    st.deleteFails = false;
    await act(async () => st.snacks[0]!.action!.onClick());
    expect(st.deleteCalls).toEqual([[1], [1]]);
    // 다시 묻지 않는다
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(st.snacks[1]).toEqual({ message: "1건을 삭제했어요." });
    expect(bulk()).toBeNull();
  });

  it("다시 시도가 또 실패하면 같은 critical 스낵바가 다시 뜬다", async () => {
    st.deleteFails = true;
    await openDeleteConfirm();
    await act(async () => st.snacks[0]!.action!.onClick());
    expect(st.deleteCalls).toEqual([[1], [1]]);
    expect(st.snacks).toHaveLength(2);
    expect(st.snacks[1]).toMatchObject({ tone: "critical" });
  });

  it("고정 표시 요청도 silent — 전역 토스트를 끈다", async () => {
    const { expenseApi } = await import("@/features/expense/api/expenseApi");
    const { apiClient } = await import("@/shared/api");
    const put = vi
      .spyOn(apiClient, "put")
      .mockResolvedValue({ data: { updatedCount: 1 } });
    await expenseApi.bulkMarkFixed([1], true, { silent: true });
    expect(put).toHaveBeenCalledWith(
      "/v1/expenses/fixed",
      { expenseIds: [1], isFixed: true },
      { silent: true },
    );
    // 옵션이 없으면(통계 고정 정리 등) 전역 오류 토스트가 그대로 뜬다 — silent 를 걸지 않는다
    put.mockClear();
    await expenseApi.bulkMarkFixed([1], true);
    expect(put).toHaveBeenCalledWith(
      "/v1/expenses/fixed",
      { expenseIds: [1], isFixed: true },
      undefined,
    );
    put.mockRestore();
  });
});

describe("일괄 작업 바 — 500건 상한 (I-07 36)", () => {
  it("501건이면 [고정으로 표시] · [삭제] 가 막히고 안내가 뜬다", () => {
    act(() =>
      root.render(
        <BulkBar
          count={501}
          sum={-1_000}
          overLimit
          busy={false}
          onMarkFixed={() => {}}
          onDelete={() => {}}
          onClear={() => {}}
        />,
      ),
    );

    expect(container.textContent).toContain("한 번에 500건까지 할 수 있어요");
    for (const name of ["고정으로 표시", "삭제"])
      expect((byName(name) as HTMLButtonElement).disabled, name).toBe(true);
    // 선택 해제는 막지 않는다
    expect((byName("선택 해제") as HTMLButtonElement).disabled).toBe(false);
  });

  it("0 개면 바를 그리지 않는다", () => {
    act(() =>
      root.render(
        <BulkBar
          count={0}
          sum={0}
          overLimit={false}
          busy={false}
          onMarkFixed={() => {}}
          onDelete={() => {}}
          onClear={() => {}}
        />,
      ),
    );
    expect(container.querySelector("[data-slot=expense-bulk-bar]")).toBeNull();
  });
});
