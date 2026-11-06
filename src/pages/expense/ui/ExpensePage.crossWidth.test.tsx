// 폭이 768 을 넘나들어도 가계부에서 연 상세 · 걸어 둔 필터가 남는다 — "폼은 갈림 밖"(I-wrap-b1 ε 9).
//
// 종전엔 상세 · 이체 상세 · 필터가 ExpenseMobile · ExpenseDesktop 각자의 state 였고 대화상자도 그 안에서
// 그려, 폭이 바뀌면 열린 상세가 닫혔다(390 → 844 실행 확인). 지금은 ExpensePage 가 들고 갈림 밖 한 자리에서 그린다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/entities/expense";
import type { ExpenseScreen } from "@/pages/expense/model/expense-screen";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const st = vi.hoisted(() => ({
  mobile: true,
  mounts: 0,
  unmounts: 0,
  detailMobile: [] as boolean[],
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: st.mobile, onAddTx: () => {} }),
  useSearchParams: () => [new URLSearchParams("month=2026-10"), () => {}],
}));
const q = { data: [], isLoading: false, isError: false };
vi.mock("@/features/expense", () => ({
  useExpenses: () => q,
  useRangeSummary: () => q,
  useExpenseCategories: () => q,
}));
vi.mock("@/features/asset", () => ({ useAssets: () => q }));
vi.mock("@/features/expense/ui/FilterDialog", () => ({
  FilterDialog: () => <div data-slot="filter-dialog" />,
}));
vi.mock("@/widgets/add-tx", () => ({ AddTxSheet: () => null }));
vi.mock("@/widgets/expense-detail/ui/TransferDetailDialog", () => ({
  TransferDetailDialog: () => null,
}));
vi.mock("@/widgets/expense-detail/ui/TxDetailDialog", () => ({
  TxDetailDialog: ({ mobile }: { mobile: boolean }) => {
    st.detailMobile.push(mobile);
    useEffect(() => {
      st.mounts += 1;
      return () => {
        st.unmounts += 1;
      };
    }, []);
    return <div role="dialog" />;
  },
}));
vi.mock("./ExpenseSwipeRow", () => ({ SwipeConfirmDialog: () => null }));
// 두 갈래는 상세를 여는 단추 · 필터를 여는 단추 · 걸린 필터만 보인다
const probe =
  (name: string) =>
  ({ screen }: { screen: ExpenseScreen }) => (
    <div data-view={name}>
      <button
        type="button"
        data-open-detail
        onClick={() => screen.setDetail({ rowId: 1 } as Expense)}
      />
      <button
        type="button"
        data-open-filter
        onClick={() => screen.setFilterOpen(true)}
      />
      <button
        type="button"
        data-set-filter
        onClick={() => screen.setFilterValue({ keyword: "커피" } as never)}
      />
      <span data-filter>{JSON.stringify(screen.filterValue)}</span>
    </div>
  );
vi.mock("./ExpenseMobile", () => ({
  ExpenseMobile: probe("mobile"),
  ExpenseMobileSkeleton: () => null,
}));
vi.mock("./ExpenseDesktop", () => ({
  ExpenseDesktop: probe("desktop"),
  ExpenseDesktopSkeleton: () => null,
}));

const { ExpensePage } = await import("./ExpensePage");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(st, { mounts: 0, unmounts: 0, detailMobile: [] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = (mobile: boolean) => {
  st.mobile = mobile;
  act(() => root.render(<ExpensePage />));
};
const click = (sel: string) =>
  act(() => container.querySelector<HTMLElement>(sel)!.click());

describe("폭이 바뀌어도 연 것 · 고른 것이 남는다 (I-wrap-b1 ε 9)", () => {
  it("폰에서 연 지출 상세가 넓은 화면 · 다시 폰에서도 열린 채 다시 붙지 않는다", () => {
    render(true);
    click("[data-open-detail]");
    expect(container.querySelector("[role=dialog]")).not.toBeNull();

    render(false);
    expect(
      container.querySelector("[data-view]")?.getAttribute("data-view"),
    ).toBe("desktop");
    render(true);

    expect(container.querySelector("[role=dialog]")).not.toBeNull();
    expect(st.mounts).toBe(1);
    expect(st.unmounts).toBe(0);
    // 표면 안 모양은 그때 폭을 따른다
    expect(st.detailMobile[st.detailMobile.length - 2]).toBe(false);
    expect(st.detailMobile[st.detailMobile.length - 1]).toBe(true);
  });

  it("폰에서 연 필터 시트 · 걸어 둔 필터가 넓은 화면에서도 남는다", () => {
    render(true);
    click("[data-set-filter]");
    click("[data-open-filter]");
    render(false);
    expect(container.querySelector("[data-slot=filter-dialog]")).not.toBeNull();
    expect(container.querySelector("[data-filter]")?.textContent).toContain(
      "커피",
    );
  });
});
