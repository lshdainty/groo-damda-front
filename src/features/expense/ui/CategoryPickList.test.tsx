// 카테고리 고르기 본문(I-20 C 19) — 하위가 있는 상위는 목록 제목(고를 수 없다), 하위와 하위 없는 최상위만 고르는 줄.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpenseCategory } from "@/entities/expense";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { CategoryPickList } = await import("./CategoryPickList");

const cat = (
  rowId: number,
  categoryName: string,
  o: Partial<ExpenseCategory> = {},
): ExpenseCategory =>
  ({
    rowId,
    categoryName,
    icon: "tag",
    color: "#2c70bf",
    expenseType: "EXPENSE",
    sortOrder: rowId,
    parentRowId: null,
    hasChildren: false,
    ...o,
  }) as ExpenseCategory;

const cats = [
  cat(1, "식비"),
  cat(2, "교통", { hasChildren: true }),
  cat(3, "버스", { parentRowId: 2 }),
  cat(4, "월급", { expenseType: "INCOME" }),
];

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (kind: "EXPENSE" | "INCOME", selected: number | null = null) => {
  const onPick = vi.fn();
  act(() =>
    root.render(
      <CategoryPickList
        categories={cats}
        kind={kind}
        selectedRowId={selected}
        onPick={onPick}
      />,
    ),
  );
  return onPick;
};
const rows = () =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-slot=list-body]"));

describe("카테고리 고르기", () => {
  it("하위가 있는 상위는 제목이고 고르는 줄이 아니다", () => {
    mount("EXPENSE");
    expect(rows().map((r) => r.textContent)).toEqual(["식비", "버스"]);
    expect(container.querySelector("h3")?.textContent).toBe("교통");
  });

  it("지금 종류의 카테고리만 — 수입이면 수입 것만", () => {
    mount("INCOME");
    expect(rows().map((r) => r.textContent)).toEqual(["월급"]);
  });

  it("누르면 그 카테고리를 고르고, 고른 줄은 aria-current", () => {
    const onPick = mount("EXPENSE", 3);
    expect(rows()[1]!.getAttribute("aria-current")).toBe("true");
    act(() => rows()[0]!.click());
    expect(onPick).toHaveBeenCalledWith(1);
  });
});
