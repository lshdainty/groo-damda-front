// 거래 옮기기 시트(D22) — 갈래 · 빈 채 [옮기기] 오류 · 12자 · 요청 본문(I-20 B 11 · M 표)
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
const snack: Array<{ message: string; tone?: string }> = [];
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: { message: string; tone?: string }) => snack.push(o),
    dismiss: () => {},
  }),
}));
const hook = { failed: false, opts: [] as unknown[] };

const move = vi.fn();
const split = vi.fn();
vi.mock("@/features/expense", () => ({
  useMoveCategoryTransactions: (o?: unknown) => {
    hook.opts.push(o);
    return {
      mutate: move,
      reset: () => {},
      isPending: false,
      isError: hook.failed,
      error: hook.failed ? new Error("서버 원문 오류") : null,
    };
  },
  useSplitCategoryIntoChild: (o?: unknown) => {
    hook.opts.push(o);
    return {
      mutate: split,
      reset: () => {},
      isPending: false,
      isError: false,
      error: null,
    };
  },
}));

const { CategoryMoveTxDialog } = await import("./CategoryMoveTxDialog");

const cat = (
  rowId: number,
  name: string,
  parentRowId: number | null = null,
  expenseType = "EXPENSE",
) =>
  ({
    rowId,
    categoryName: name,
    icon: "tag",
    color: "#9E9E9E",
    expenseType,
    parentRowId,
    sortOrder: rowId,
  }) as never;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: query.includes("never-wide"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  move.mockClear();
  snack.length = 0;
  hook.failed = false;
  hook.opts = [];
  split.mockClear();
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

const mount = (source: unknown, categories: unknown[]) =>
  act(() =>
    root.render(
      <CategoryMoveTxDialog
        source={source as never}
        categories={categories as never[]}
        onClose={() => {}}
      />,
    ),
  );
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (b) => b.textContent === text,
  )!;
const click = (el: Element) => act(() => (el as HTMLElement).click());
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

describe("거래 옮기기", () => {
  const food = cat(1, "식비");
  const traffic = cat(2, "교통");

  it("하위가 없는 최상위는 Segmented 가 있고 처음 '새 하위 만들기'", () => {
    mount(food, [food, traffic]);
    expect(document.querySelector("[role=radiogroup]")).not.toBeNull();
    expect(
      document
        .querySelector("[role=radio][aria-checked=true]")
        ?.textContent?.trim(),
    ).toBe("moveTx.modeNew");
    expect(document.body.textContent).toContain('moveTx.desc{"name":"식비"}');
  });

  it("하위가 있는 최상위 · 하위는 Segmented 없이 '기존 카테고리로' 만", () => {
    const child = cat(3, "점심", 1);
    mount(food, [food, child, traffic]);
    expect(document.querySelector("[role=radiogroup]")).toBeNull();
    expect(document.body.textContent).toContain("moveTx.target");
    expect(document.body.textContent).not.toContain("moveTx.childName");
  });

  it("빈 채 [옮기기] → 칸 아래 오류 · 요청 0 (버튼은 켜져 있다)", () => {
    mount(food, [food, traffic]);
    const submit = byText("moveTx.action");
    expect(submit.hasAttribute("disabled")).toBe(false);
    click(submit);
    expect(document.body.textContent).toContain("moveTx.errChildName");
    expect(split).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
  });

  it("새 하위 이름은 12자에서 멈추고 요청 본문은 원래 카테고리 아이콘 · 색", () => {
    mount(food, [food, traffic]);
    type(input(), "카페간식디저트모임가나다라마바");
    expect(input().value).toHaveLength(12);
    click(byText("moveTx.action"));
    expect(split).toHaveBeenCalledTimes(1);
    expect(split.mock.calls[0]![0]).toEqual({
      id: 1,
      childName: "카페간식디저트모임가나다",
      icon: "tag",
      color: "#9E9E9E",
    });
  });

  it("기존 카테고리로 — 고를 곳이 없으면 안내, 고르지 않고 누르면 오류", () => {
    mount(food, [food]);
    click(byText("moveTx.modeExisting"));
    expect(document.body.textContent).toContain("moveTx.noTarget");
    click(byText("moveTx.action"));
    expect(document.body.textContent).toContain("moveTx.errTarget");
    expect(move).not.toHaveBeenCalled();
  });

  it("기존 카테고리로 — 같은 종류 · 말단만 고르고 요청한다", () => {
    const income = cat(4, "월급", null, "INCOME");
    mount(food, [food, traffic, income]);
    click(byText("moveTx.modeExisting"));
    click(document.querySelector("[aria-haspopup=dialog]")!);
    const titles = Array.from(
      document.querySelectorAll("[data-slot=list-title]"),
    ).map((e) => e.textContent);
    expect(titles).toContain("교통");
    expect(titles).not.toContain("월급");
    expect(titles).not.toContain("식비");
    click(
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-slot=list-body]"),
      ).find((b) => b.textContent === "교통")!,
    );
    click(byText("moveTx.action"));
    expect(move.mock.calls[0]![0]).toEqual({
      id: 1,
      targetCategoryRowId: 2,
    });
  });
});

describe("거래 옮기기 실패(I-28-5 5)", () => {
  const food = cat(1, "식비");
  const child = cat(3, "점심", 1);
  const traffic = cat(2, "교통");

  it("요청은 silent — 서버 원문 토스트가 안 뜬다", () => {
    mount(food, [food, child, traffic]);
    expect(hook.opts.length).toBeGreaterThan(0);
    for (const o of hook.opts) expect(o).toEqual({ silent: true });
  });

  it("실패하면 폼 맨 위 Callout 고정 글 · 서버 글 없음", () => {
    hook.failed = true;
    mount(food, [food, child, traffic]);
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "moveTx.failed",
    );
    expect(document.body.textContent).not.toContain("서버 원문 오류");
  });

  it("성공하면 neutral 스낵바 한 문장 · 같은 틱 두 번 눌러도 요청은 한 번", () => {
    mount(food, [food, traffic]);
    type(input(), "점심");
    act(() => {
      byText("moveTx.action").click();
      byText("moveTx.action").click();
    });
    expect(split).toHaveBeenCalledTimes(1);
    const cbs = split.mock.calls[0]![1] as {
      onSuccess: (r: {
        expenses: number;
        recurring: number;
        splits: number;
      }) => void;
      onSettled: () => void;
    };
    act(() => cbs.onSuccess({ expenses: 2, recurring: 1, splits: 0 }));
    expect(snack).toEqual([
      { message: 'moveTx.done{"count":3}', tone: "neutral" },
    ]);
  });
});
