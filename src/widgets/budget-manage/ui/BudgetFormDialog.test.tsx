// 예산 폼 — 밑줄 금액 하나 · 제안 칩 · 카테고리 줄(→ 고르기) · 누를 때 검증 · 표면 경계(I-19 C · M 표)
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

const { BudgetFormDialog } = await import("./BudgetFormDialog");
const { i18n } = await import("@/shared/i18n/config");

const cat = (rowId: number, name: string) => ({
  rowId,
  categoryName: name,
  icon: "tag",
  color: "#2c70bf",
  expenseType: "EXPENSE",
  parentRowId: null,
});
const budget = (rowId: number, categoryRowId: number | null, amount: number) =>
  ({
    rowId,
    categoryRowId,
    categoryName: null,
    budgetAmount: amount,
    budgetYear: 2026,
    budgetMonth: 10,
  }) as never;

let container: HTMLDivElement;
let root: Root;
let wide = false;
beforeEach(async () => {
  await i18n.changeLanguage("ko");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
  wide = false;
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("1280px"),
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
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

const cats = [cat(1, "식비"), cat(2, "교통"), cat(3, "주거")] as never[];
const mount = (props: Partial<Parameters<typeof BudgetFormDialog>[0]> = {}) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  act(() =>
    root.render(
      <BudgetFormDialog
        kind="category"
        budget={null}
        month={10}
        categories={cats}
        existing={[budget(9, 2, 100_000)]}
        onClose={onClose}
        onSave={onSave}
        {...props}
      />,
    ),
  );
  return { onSave, onClose };
};
const input = () =>
  document.querySelector<HTMLInputElement>("[data-slot=text-input-value]")!;
const type = (el: HTMLInputElement, v: string) =>
  act(() => {
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (b) => b.textContent === text,
  )!;
const click = (el: Element) => act(() => (el as HTMLElement).click());

describe("총 예산", () => {
  it("제목 · 밑줄 칸 · 칩 넷 · 머리 카드 없음 · 손잡이 없음", () => {
    mount({ kind: "total" });
    expect(document.body.textContent).toContain('edit.totalTitle{"month":10}');
    expect(
      document
        .querySelector("[data-slot=text-input]")
        ?.getAttribute("data-variant"),
    ).toBe("underline");
    expect(
      document.querySelectorAll("[data-slot=chip-group] button"),
    ).toHaveLength(4);
    expect(
      document.querySelector("[data-slot=bottom-sheet-handle]"),
    ).toBeNull();
    expect(document.querySelector("[data-slot=list]")).toBeNull();
  });

  it("쓰는 동안 쉼표 · 칩은 값을 넣고 고르지 않는다 · 저장 본문은 숫자", () => {
    const { onSave } = mount({ kind: "total" });
    type(input(), "1234");
    expect(input().value).toBe("1,234");
    click(byText("200만원"));
    expect(input().value).toBe("2,000,000");
    expect(
      document.querySelector("[data-slot=chip-group] [aria-pressed]"),
    ).toBeNull();
    click(byText("add"));
    expect(onSave).toHaveBeenCalledWith({
      categoryRowId: 0,
      budgetAmount: 2_000_000,
    });
  });

  it("있으면 [저장] · 없으면 [추가], 빈 채 누르면 칸 아래 오류 · 요청 없음", () => {
    const { onSave } = mount({ kind: "total" });
    expect(byText("add")).toBeDefined();
    expect(byText("add").hasAttribute("disabled")).toBe(false);
    click(byText("add"));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("edit.errTotal");
    act(() => root.unmount());
    root = createRoot(container);
    mount({ kind: "total", budget: budget(1, null, 1_000_000) });
    expect(byText("save")).toBeDefined();
    expect(input().value).toBe("1,000,000");
  });
});

describe("카테고리 예산", () => {
  it("추가: 처음 카테고리 없음 · 누르면 오류 · 고르기 시트에서 예산 있는 줄은 막힘", () => {
    const { onSave } = mount();
    const row = document.querySelector<HTMLButtonElement>(
      "[data-slot=list-body][aria-haspopup]",
    )!;
    expect(row.getAttribute("aria-label")).toContain("edit.noneSelected");
    type(input(), "300000");
    click(byText("add"));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("edit.errCategory");
    const described = row.getAttribute("aria-describedby");
    expect(described).toBeTruthy();
    expect(document.getElementById(described!)?.textContent).toContain(
      "edit.errCategory",
    );
    click(row);
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-slot=bottom-sheet-content] [data-slot=list-body]:not([aria-haspopup])",
      ),
    );
    expect(items).toHaveLength(3);
    expect(items[1]!.disabled).toBe(true);
    expect(document.body.textContent).toContain("edit.hasBudget");
    click(items[0]!);
    expect(
      document
        .querySelector("[data-slot=picker-row-dot]")
        ?.getAttribute("style"),
    ).toContain("background");
    click(byText("add"));
    expect(onSave).toHaveBeenCalledWith({
      categoryRowId: 1,
      budgetAmount: 300_000,
    });
  });

  it("수정: 카테고리 줄은 눌리지 않는다", () => {
    mount({ budget: budget(5, 1, 500_000) });
    expect(
      document.querySelector("[data-slot=list-body][aria-haspopup]"),
    ).toBeNull();
    expect(input().value).toBe("500,000");
    expect(document.body.textContent).toContain("식비");
  });

  it("100억 넘는 옛 값은 열 때 그대로, 누르면 칸 아래 안내", () => {
    const { onSave } = mount({ budget: budget(5, 1, 99_000_000_000) });
    expect(input().value).toBe("99,000,000,000");
    click(byText("save"));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("amountTooLarge");
  });
});

describe("저장 실패", () => {
  it("실패하면 폼 맨 위 critical Callout 한 줄(고정 글) · 쓴 값은 그대로", () => {
    mount({ kind: "total", saveFailed: true, saveError: new Error("x") });
    const callout = document.querySelector<HTMLElement>("[role=alert]");
    expect(callout?.textContent).toContain("edit.saveFailed");
    expect(callout?.textContent).not.toContain("x");
  });
  it("실패가 없으면 Callout 이 없다", () => {
    mount({ kind: "total" });
    expect(document.querySelector("[role=alert]")).toBeNull();
  });
});

describe("표면 경계", () => {
  it("1280 미만은 시트, 이상은 대화상자(바깥 누름으로 닫히지 않음)", () => {
    const { onClose } = mount({ kind: "total" });
    expect(
      document.querySelector("[data-slot=bottom-sheet-content]"),
    ).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    wide = true;
    const again = mount({ kind: "total" });
    expect(document.querySelector("[data-slot=dialog-content]")).not.toBeNull();
    act(() => {
      document
        .querySelector<HTMLElement>("[data-slot=dialog-overlay]")!
        .dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(again.onClose).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("바뀐 값이 있으면 닫기 전에 묻는다", () => {
    const { onClose } = mount({ kind: "total" });
    type(input(), "100");
    click(
      document.querySelector("[data-slot=bottom-sheet-close]") as HTMLElement,
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector("[role=alertdialog]")).not.toBeNull();
  });
});

describe("수정 폼의 [삭제] — 밀기는 지름길이라 삭제는 들어간 화면에도 있다(swipe-actions.md:76)", () => {
  it("카테고리 예산 수정에는 [삭제] 가 있고 누르면 onDelete 만 부른다(저장 아님)", () => {
    const onDelete = vi.fn();
    const { onSave } = mount({
      kind: "category",
      budget: budget(9, 2, 100_000),
      onDelete,
    });
    click(byText("delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("추가 · 총 예산에는 [삭제] 가 없다", () => {
    mount({ kind: "category", budget: null, onDelete: vi.fn() });
    expect(
      Array.from(document.querySelectorAll("button")).some(
        (b) => b.textContent === "delete",
      ),
    ).toBe(false);
    act(() => root.unmount());
    root = createRoot(container);
    mount({
      kind: "total",
      budget: budget(1, null, 500_000),
      onDelete: vi.fn(),
    });
    expect(
      Array.from(document.querySelectorAll("button")).some(
        (b) => b.textContent === "delete",
      ),
    ).toBe(false);
  });
});
