// 폰 가계부(ExpenseMobile) — 실제 화면을 띄운 채로 I-07 7 · 8 · 11 · 12 · 14 · 16 을 잠근다.
// 번역은 CSV 원본에서 읽는다(키 이름이 아니라 사용자가 읽는 글로 본다). 고정한 오늘 + 데이터의 날짜도 함께 고정한다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/entities/expense";
import { SnackbarProvider } from "@/shared/ds/snackbar";

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
  /** 이 달(2026-10) 거래 */
  list: [] as unknown[],
  /** 다른 달은 아직 받는 중이다 */
  otherMonthLoading: false,
  failed: false,
  /** 이체 목록은 거래보다 늦게 온다 */
  transfersLoading: false,
  incomeSum: 450_000,
  expenseSum: 12_000,
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
  useSearchParams: () => [new URLSearchParams(st.search), () => {}],
}));

const query = (data: unknown, loading = false) => ({
  // react-query 처럼 — 처음 불러오기 실패면 값이 없다
  data: loading || st.failed ? undefined : data,
  isLoading: loading,
  isError: st.failed,
  refetch: async () => {},
});
vi.mock("@/features/expense", () => ({
  useExpenses: (p: { startDate: string }) => {
    const other = !p.startDate.startsWith("2026-10");
    return query(other ? [] : st.list, other ? st.otherMonthLoading : false);
  },
  useRangeSummary: (start: string) =>
    query(
      {
        totalIncome: st.incomeSum,
        totalExpense: st.expenseSum,
        categoryBreakdown: [],
      },
      !start.startsWith("2026-10") && st.otherMonthLoading,
    ),
  useExpenseCategories: () => ({ data: [] }),
  useDeleteExpense: () => ({ mutateAsync: async () => ({}), isPending: false }),
  useLedgerResultToast: () => () => {},
}));
vi.mock("@/features/asset", () => ({
  // 이체 줄 통화(1e49f429) — 모르면 원화로 찍힌다
  useAssetCurrencyOf: () => () => null,
  useAssets: () => ({ data: { assets: [] } }),
  useAsset: () => ({ data: { rowId: 1, assetName: "생활비 통장" } }),
  useAssetTransfers: () => query({ transfers: [] }, st.transfersLoading),
}));
vi.mock("@/widgets/add-tx", () => ({ AddTxSheet: () => null }));
vi.mock("@/widgets/expense-detail/ui/TxDetailDialog", () => ({
  TxDetailDialog: () => null,
}));
vi.mock("@/widgets/expense-detail/ui/TransferDetailDialog", () => ({
  TransferDetailDialog: () => null,
}));

const { ExpenseMobile, ExpenseMobileSkeleton } =
  await import("./ExpenseMobile");
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
  // 요일 · 월 이름 · 돈 꼴이 한국어로 나오게 — 번역 mock 은 언어를 정하지 않는다
  await i18n.changeLanguage("ko");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00"));
  st.search = "";
  st.list = [
    tx(1, 15, 12_000),
    tx(2, 14, 5_000),
    tx(3, 14, 450_000, {
      expenseType: "INCOME",
    }),
  ];
  st.otherMonthLoading = false;
  st.failed = false;
  st.transfersLoading = false;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const render = () =>
  act(() =>
    // 줄 밀기 확인창이 useConfirmFail(스낵바)을 쓴다 — 앱 맨 위처럼 공급자를 둔다
    root.render(
      <SnackbarProvider>
        <ExpenseMobile onAddTx={() => {}} />
      </SnackbarProvider>,
    ),
  );
const byName = (name: string) =>
  Array.from(container.querySelectorAll<HTMLElement>("button")).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent) === name,
  );
const click = (el: HTMLElement | undefined) => {
  expect(el, "누를 단추가 있다").toBeTruthy();
  act(() => el!.click());
};

describe("머리 — 단추 · 요약 · 달력 (I-07 7 · 8 · 11)", () => {
  it("월 이동 · 거르기 · 추가는 이름이 있는 아이콘 단추다 — 개수 배지가 없다", () => {
    render();
    for (const name of ["이전 달", "다음 달", "필터", "거래 추가"])
      expect(byName(name), name).toBeTruthy();

    // 걸린 조건은 아래 칩 줄이 말한다 — 거르기 단추 안에 숫자가 없다
    st.search = "assetId=1";
    render();
    expect(byName("필터")!.textContent).toBe("");
    expect(byName("필터")!.querySelector("span")).toBeNull();
  });

  it('"소비 요약" 과 "월 달력" 은 하나만 펼친다', () => {
    render();
    const summary = () => byName("소비 요약")!;
    const month = () => byName("월 달력")!;
    const rows = () => container.querySelectorAll("[data-slot=list-item]");
    const before = rows().length;

    click(summary());
    expect(summary().getAttribute("aria-expanded")).toBe("true");
    expect(month().getAttribute("aria-expanded")).toBe("false");
    expect(rows().length).toBe(before + 3);

    click(month());
    expect(month().getAttribute("aria-expanded")).toBe("true");
    expect(summary().getAttribute("aria-expanded")).toBe("false");
    expect(rows().length).toBe(before);

    click(summary());
    expect(summary().getAttribute("aria-expanded")).toBe("true");
    expect(month().getAttribute("aria-expanded")).toBe("false");
  });

  it("펼친 요약은 카드 · 그림자 없이 보기만 하는 List 줄 셋이다 — 수입 + · 지출 −", () => {
    render();
    click(byName("소비 요약"));
    const section = container.querySelector<HTMLElement>(
      "ul[data-slot=list]:not([class*=gutter])",
    );
    const lists = Array.from(
      container.querySelectorAll<HTMLElement>("ul[data-slot=list]"),
    );
    const summary = lists.find((l) => l.textContent?.includes("합계"));

    expect(section).not.toBeNull();
    expect(summary, "요약 목록").toBeTruthy();
    expect(summary!.closest("[data-slot=card]")).toBeNull();
    expect(summary!.className).not.toMatch(/shadow|animate/);
    expect(summary!.textContent).toContain("+450,000");
    expect(summary!.textContent).toContain("−12,000");
    // 화면 끝까지 — ds List 는 w-full 이라 음수 여백만으로는 왼쪽으로 밀리기만 한다(오른쪽 48 모자람). 폭을 +2×gutter 로 준다
    const list = container.querySelector("ul[data-slot=list]")!;
    expect(list.className).toContain(
      "w-[calc(100%+2*var(--spacing-global-gutter))]",
    );
    expect(list.className).toContain("-mx-global-gutter");
  });

  it("오는 날 글자는 fg-neutral-subtle 이고 불투명도로 흐리지 않는다", () => {
    render();
    const num = (d: string) =>
      Array.from(container.querySelectorAll<HTMLElement>("button span")).find(
        (s) => s.textContent === d && s.className.includes("rounded-full"),
      )!;
    // 오늘 15 일(목) 이후 — 한 주만 보인다: 11 ~ 17
    const future = num("17");
    const past = num("13");

    expect(future.className).toContain("text-fg-neutral-subtle");
    expect(future.className).not.toMatch(/opacity/);
    expect(future.style.opacity).toBe("");
    expect(past.className).not.toContain("text-fg-neutral-subtle");
  });

  it("머리는 Scroll Auto Hide 다 — 옛 접힘(max-h · compact)이 아니다", () => {
    render();
    const head = container.querySelector("[data-scroll-auto-hide]");

    expect(head).not.toBeNull();
    expect(head!.textContent).toContain("소비 요약");
    expect(container.querySelector("[data-ledger-collapse]")).toBeNull();
  });
});

describe("고정 덩어리 — 달 줄 + (주 달력 또는 칩 줄)", () => {
  it("평소: 주 달력 · 꺾쇠가 머리 안 남는 부분(Keep)이고 총액 · [소비 요약] 은 숨는 부분이다", () => {
    render();
    const pin = container.querySelector<HTMLElement>(
      "[data-scroll-auto-hide]",
    )!;
    const keep = pin.querySelector<HTMLElement>("[data-ledger-keep]")!;
    expect(keep.querySelector('[aria-label="월 달력"]')).not.toBeNull();
    expect(keep.textContent).not.toContain("소비 요약");
    expect(pin.textContent).toContain("소비 요약");
    expect(
      container.querySelector("[data-ledger-bar]")!.className.split(" "),
    ).toContain("sticky");
  });

  it("거르기 중: 칩 줄이 Keep 으로 남고(sticky Pin 안, 위에 숨는 부분 없음) 달 줄도 남는다", () => {
    st.search = "assetId=1";
    render();
    const pin = container.querySelector<HTMLElement>(
      "[data-scroll-auto-hide]",
    )!;
    const keep = pin.querySelector<HTMLElement>("[data-ledger-keep]")!;
    expect(pin.className.split(" ")).toContain("sticky");
    // 칩 줄 — 걸린 자산 이름이 Keep 안에 있다
    expect(keep.textContent).toContain("생활비 통장");
    // 숨는 부분이 없다 — Keep 이 Pin 의 첫 자식
    expect(pin.firstElementChild).toBe(keep);
    expect(pin.textContent).not.toContain("소비 요약");
    expect(container.querySelector("[data-ledger-bar]")).not.toBeNull();
  });
});

describe("날짜 묶음 (I-07 14)", () => {
  it("머리는 h2 · List Header(t4 · 500)이고 그날 합계는 머리 안에 있다", () => {
    render();
    const headers = container.querySelectorAll<HTMLElement>(
      "[data-slot=list-header]",
    );

    expect(headers.length).toBe(2);
    const h = headers[0]!;
    expect(h.className).toContain("text-t4");
    expect(h.className).toContain("font-medium");
    expect(h.querySelector("h2")?.textContent).toContain("10월 15일 (목)");
    expect(h.querySelector("h2")?.textContent).toContain("오늘");
    // 합계는 h2 밖이라 머리말 이름에 섞이지 않는다
    expect(h.querySelector("h2")?.textContent).not.toContain("12,000");
    expect(h.textContent).toContain("12,000");
  });

  it("날짜 글은 요일 형식이다 — 올해 '10월 14일 (수)' + 어제, 할 일 원장과 같은 꼴(옛 '26. 10. 14(수)' 이 아니다)", () => {
    render();
    const h2 = Array.from(container.querySelectorAll("h2")).map(
      (e) => e.textContent ?? "",
    );
    expect(h2[1]).toContain("10월 14일 (수)");
    expect(h2[1]).toContain("어제");
    expect(h2.join(" ")).not.toMatch(/\d{2}\. \d+\. \d+\(/);
  });

  it("다른 해면 표준 + 요일 '2026년 10월 15일 (목)' — 오늘 · 어제는 붙지 않는다", () => {
    vi.setSystemTime(new Date("2027-01-05T12:00:00"));
    st.search = "month=2026-10";
    render();
    const h2 = Array.from(container.querySelectorAll("h2")).map(
      (e) => e.textContent ?? "",
    );
    expect(h2[0]).toContain("2026년 10월 15일 (목)");
    expect(h2[0]).not.toContain("오늘");
  });

  it("영어는 'E, MMM d' — 'Thu, Oct 15'", async () => {
    await i18n.changeLanguage("en");
    render();
    expect(container.querySelector("h2")?.textContent).toContain("Thu, Oct 15");
  });

  it("지출 합계는 fg-neutral · 수입은 fg-brand + '+' 다", () => {
    render();
    const headers = container.querySelectorAll<HTMLElement>(
      "[data-slot=list-header]",
    );
    const second = headers[1]!;
    const out = second.querySelector("span.text-fg-neutral");
    const inc = second.querySelector("span.text-fg-brand");

    expect(out?.textContent).toContain("5,000");
    expect(inc?.textContent).toContain("+450,000");
  });
});

describe("비어 있음 · 실패 · 불러오기 (I-07 16)", () => {
  it("이 달 거래가 0건이면 '거래가 없어요' + 설명, 버튼은 없다", () => {
    st.list = [];
    render();
    const result = container.querySelector("[data-slot=result-section]");

    expect(result?.textContent).toContain("10월 거래가 없어요");
    expect(result?.querySelector("button")).toBeNull();
  });

  it("걸러서 0건이면 '조건에 맞는 거래가 없어요' + 깔때기 아이콘 · 버튼 없음", () => {
    st.list = [];
    st.search = "assetId=1";
    render();
    const result = container.querySelector<HTMLElement>(
      "[data-slot=result-section]",
    );

    expect(result?.textContent).toContain("조건에 맞는 거래가 없어요");
    expect(result?.textContent).toContain("조건을 바꾸거나 지워보세요.");
    expect(result?.querySelector("svg.lucide-funnel-x")).not.toBeNull();
    expect(result?.querySelector("button")).toBeNull();
  });

  it("불러오지 못하면 실패로 그린다 — 오류 원문을 화면에 내지 않고 '다시 시도' 가 있다", () => {
    st.failed = true;
    render();
    const result = container.querySelector<HTMLElement>(
      "[data-slot=result-section]",
    );

    expect(result?.textContent).toContain("거래를 불러오지 못했어요");
    expect(result?.textContent).not.toMatch(/Error|undefined|500/);
    expect(result?.querySelector("button")).not.toBeNull();
    // 0원 · 빈 달로 거짓말하지 않는다
    expect(container.textContent).not.toContain("거래가 없어요");
  });

  it("달을 옮기면 달 이름은 바로 바뀌고 숫자 · 목록 자리만 기다린다 — 옛 달 숫자를 남기지 않는다", () => {
    render();
    expect(container.textContent).toContain("10월");
    expect(container.textContent).toContain("12,000원");

    st.otherMonthLoading = true;
    click(byName("이전 달"));

    expect(container.textContent).toContain("9월");
    expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
    // 옛 달(10월)의 합계 · 거래가 9월 머리 아래 남아 있지 않다
    expect(container.textContent).not.toContain("12,000원");
    expect(
      container.querySelectorAll("[data-slot=list-header] h2").length,
    ).toBe(0);
  });
});

describe("알림 · 검색에서 들어온 줄 (I-07 6 · ?txId=)", () => {
  it("그 줄을 List 강조 바탕으로 알리고 가운데로 옮긴다 — 이체 목록이 늦게 와 줄이 나중에 그려져도", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    st.search = "txId=2";
    st.transfersLoading = true;
    render();
    // 아직 줄이 없다 — 옮길 곳이 없다
    expect(scrollIntoView).not.toHaveBeenCalled();

    // 이체 목록이 도착한다 — 거래 수는 그대로지만 줄이 그려진다(예전엔 여기서 한 번도 옮기지 못했다)
    st.transfersLoading = false;
    render();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    // ds List 의 강조 바탕(brand-weak · 누름 brand-weak-pressed) — 손으로 짠 before: 바탕이 아니다
    const hl = container
      .querySelector('[class*="bg-bg-brand-weak"]')
      ?.closest("[data-slot=list-item]");
    expect(hl?.textContent).toContain("가게2");
    expect(container.innerHTML).toContain("bg-bg-brand-weak-pressed");
    expect(container.innerHTML).not.toContain("before:bg-bg-brand-weak");
    expect(container.innerHTML).not.toContain("brand-subtle");
  });
});

describe("검수 고침 — 요약 0 원 · 실패 틀 · 빼기 부호", () => {
  it("요약을 펼친 채 달을 옮기면 받는 동안 0 원 줄을 그리지 않고 [소비 요약] 을 막는다", () => {
    render();
    click(byName("소비 요약"));
    st.otherMonthLoading = true;
    click(byName("이전 달"));

    const summary = byName("소비 요약")!;
    expect(summary.hasAttribute("disabled")).toBe(true);
    // 펼친 줄이 보이므로 펼침 상태를 그대로 말한다(막힘은 disabled 가 말한다)
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    const lists = Array.from(
      container.querySelectorAll<HTMLElement>("ul[data-slot=list]"),
    ).filter((l) => l.textContent?.includes("합계"));
    for (const l of lists) expect(l.textContent).not.toMatch(/[+−]0원|0원/);
  });

  it("불러오지 못해도 머리 · 주 달력은 그대로 그린다(틀 먼저) — 합계는 비고 [소비 요약] 은 막힌다", () => {
    st.failed = true;
    render();

    for (const name of ["이전 달", "다음 달", "필터", "거래 추가", "월 달력"])
      expect(byName(name), name).toBeTruthy();
    expect(byName("소비 요약")!.hasAttribute("disabled")).toBe(true);
    expect(
      container.querySelector("[data-slot=result-section]"),
    ).not.toBeNull();
  });

  it("빼기는 U+2212 다 — 그날 합계 · 칸 금액", () => {
    render();
    const head = container.querySelector("[data-slot=list-header]")!;
    expect(head.textContent).toContain("−12,000");
    expect(head.textContent).not.toContain("-12,000");
    const cell = container.querySelector("button[data-sel]")!;
    expect(container.textContent).toContain("−5,000");
    expect(cell).toBeTruthy();
  });
});

describe("첫 진입 스켈레톤 — 실제 달력과 같은 주 · 같은 칸", () => {
  const renderSkel = (month?: string) =>
    act(() => root.render(<ExpenseMobileSkeleton month={month} />));
  const cells = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-slot=ledger-cell], div.group\\/cell",
      ),
    );

  it("이 달이면 오늘이 든 주를 그리고 오는 날(16 · 17)만 옅게 한다", () => {
    renderSkel("2026-10");
    const days = cells().map((c) => c.querySelector("span"));
    expect(days.map((d) => d?.textContent)).toEqual([
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
    ]);
    const subtle = days
      .filter((d) => d?.className.includes("text-fg-neutral-subtle"))
      .map((d) => d?.textContent);
    expect(subtle).toEqual(["16", "17"]);
  });

  it("?month= 가 다른 달이면 그 달 첫 주 — 달 밖 자리는 숫자 없는 빈 칸이다", () => {
    renderSkel("2026-09");
    const cs = cells();
    // 2026-09 는 화요일 시작 — 일 · 월 빈 칸, 1 ~ 5
    expect(cs.map((c) => c.querySelector("span")?.textContent ?? "")).toEqual([
      "",
      "",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("오는 달이면 첫 주 전체가 옅다", () => {
    renderSkel("2026-11");
    const subtle = cells().map((c) =>
      c.querySelector("span")?.className.includes("text-fg-neutral-subtle"),
    );
    expect(subtle).toEqual(Array(7).fill(true));
  });
});
