// 거래 검색의 날짜 머리는 가계부 원장과 같은 요일 형식이다 — "11월 5일 (목) · 어제"(I-wrap-b1 ε 3).
// 종전엔 "26. 11. 5(목)" 이었다(날짜 규칙 밖 · 원장과 다름).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  data: [] as unknown[] | undefined,
  error: false,
  refetch: 0,
  opts: [] as unknown[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (k: string) =>
      ns === "ds" && k === "common.retry"
        ? "다시 시도"
        : ns === "expense" && k === "txm.today"
          ? "오늘"
          : ns === "expense" && k === "txm.yesterday"
            ? "어제"
            : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: true }),
  useSearchParams: () => [new URLSearchParams("q=커피"), () => {}],
}));
vi.mock("@/features/expense/model/useExpenses", () => ({
  useSearchExpenses: (_p: unknown, opts?: unknown) => {
    st.opts.push(opts);
    return {
      data: st.error ? undefined : st.data,
      isLoading: false,
      isFetching: false,
      isError: st.error,
      refetch: async () => {
        st.refetch += 1;
      },
    };
  },
}));
vi.mock("@/entities/expense", async (orig) => ({
  ...(await orig<typeof import("@/entities/expense")>()),
  ExpenseRow: ({ expense }: { expense: Expense }) => (
    <div data-row={expense.rowId} />
  ),
}));
vi.mock("@/widgets/expense-detail/ui/TxDetailDialog", () => ({
  TxDetailDialog: () => null,
}));
vi.mock("@/widgets/transaction-search", async () => {
  const m = await import("@/widgets/transaction-search/model/search-state");
  return { ...m, AdvancedFilter: () => null };
});

const { SearchPage } = await import("./SearchPage");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(st, { data: [], error: false, refetch: 0, opts: [] });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 6, 12, 0, 0));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const tx = (rowId: number, date: string) =>
  ({
    rowId,
    expenseDate: `${date}T09:00:00`,
    amount: 1000,
    expenseType: "EXPENSE",
  }) as unknown as Expense;

describe("검색 날짜 머리 (I-wrap-b1 ε 3)", () => {
  it('올해 "11월 5일 (목) · 어제" · 오늘 · 다른 해는 연도를 붙인다 — 옛 "26. 11. 5(목)" 이 없다', () => {
    st.data = [
      tx(1, "2026-11-06"),
      tx(2, "2026-11-05"),
      tx(3, "2026-10-29"),
      tx(4, "2025-11-05"),
    ];
    act(() => root.render(<SearchPage />));
    const heads = [...container.querySelectorAll("h2")].map((h) =>
      h.textContent?.replace(/\u00a0/g, " "),
    );
    expect(heads).toEqual([
      "11월 6일 (금) · 오늘",
      "11월 5일 (목) · 어제",
      "10월 29일 (목)",
      "2025년 11월 5일 (수)",
    ]);
    expect(container.textContent).not.toMatch(/\d{2}\. \d+\. \d+\(/);
  });
});

describe("검색 실패 (I-wrap-b1 ε · 앱 α 검수)", () => {
  it("그 자리 Result Section + [다시 시도] — 누르면 같은 조건으로 다시 받고, 서버 원문 토스트는 끈다", () => {
    st.error = true;
    act(() => root.render(<SearchPage />));
    const result = container.querySelector("[data-slot=result-section]");
    expect(result?.textContent).toContain("searchFailed");
    const retry = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "다시 시도",
    );
    if (!retry) throw new Error("[다시 시도] 가 없다");
    act(() => retry.click());
    expect(st.refetch).toBe(1);
    expect(st.opts[st.opts.length - 1]).toEqual({ silent: true });
  });
});
