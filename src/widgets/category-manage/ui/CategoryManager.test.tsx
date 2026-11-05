// 카테고리 관리 — 탭 · 목록 제목 · 나무 줄 · ⋮ 메뉴 · 삭제 확인 · 순서 모드(I-20 B 3 ~ 10 · M 표)
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

const state: {
  categories: unknown[] | undefined;
  isLoading: boolean;
  recurrings: { categoryRowId: number | null }[] | undefined;
  deleteMutate: ReturnType<typeof vi.fn>;
  refetch: ReturnType<typeof vi.fn>;
} = {
  categories: [],
  isLoading: false,
  recurrings: [],
  deleteMutate: vi.fn().mockResolvedValue(undefined),
  refetch: vi.fn(),
};
const snack: Array<{
  message: string;
  tone?: string;
  action?: { onClick: () => void };
}> = [];
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: { message: string }) => snack.push(o),
    dismiss: () => {},
  }),
}));
const mutation = () => ({
  mutate: () => {},
  mutateAsync: () => Promise.resolve(),
  reset: () => {},
  isPending: false,
  isError: false,
  error: null,
});
vi.mock("@/features/expense", () => ({
  useExpenseCategories: () => ({
    data: state.categories,
    isLoading: state.isLoading,
    refetch: state.refetch,
  }),
  useCreateExpenseCategory: mutation,
  useUpdateExpenseCategory: mutation,
  useDeleteExpenseCategory: () => ({
    mutateAsync: state.deleteMutate,
    reset: () => {},
    isPending: false,
  }),
  useReorderExpenseCategories: mutation,
  useExpenseBudgets: () => ({ data: [] }),
  useRangeSummary: () => ({ data: undefined }),
}));
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => ({ data: state.recurrings }),
}));
vi.mock("@/features/expense/ui/CategoryMoveTxDialog", () => ({
  CategoryMoveTxDialog: (p: {
    source: { rowId: number };
    onClose: () => void;
  }) => (
    <div data-stub="move" data-id={p.source.rowId}>
      <button data-act="close-move" onClick={p.onClose} />
    </div>
  ),
}));
vi.mock("./CategoryEditDialog", () => ({
  CategoryEditDialog: (p: {
    cat: { rowId: number } | null;
    defaultParentRowId?: number | null;
    onAddChild?: (c: never) => void;
    onMoveTx?: (c: never) => void;
    onDelete?: (c: never) => void;
  }) => (
    <div
      data-stub="edit"
      data-id={p.cat?.rowId ?? "new"}
      data-parent={p.defaultParentRowId ?? ""}
    >
      <button data-act="add" onClick={() => p.onAddChild?.(p.cat as never)} />
      <button data-act="move" onClick={() => p.onMoveTx?.(p.cat as never)} />
      <button data-act="delete" onClick={() => p.onDelete?.(p.cat as never)} />
    </div>
  ),
}));

const { CategoryManager } = await import("./CategoryManager");

const cat = (
  rowId: number,
  name: string,
  parentRowId: number | null = null,
  extra: Record<string, unknown> = {},
) => ({
  rowId,
  categoryName: name,
  expenseType: "EXPENSE",
  parentRowId,
  sortOrder: rowId,
  color: "#2c70bf",
  icon: "tag",
  hasChildren: false,
  ...extra,
});
// 식비(하위 있음) > 점심 · 교통(하위 없음)
const sample = () => [
  cat(1, "식비", null, { hasChildren: true }),
  cat(3, "점심", 1),
  cat(2, "교통"),
  cat(4, "월급", null, { expenseType: "INCOME" }),
];

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
  state.categories = sample();
  state.isLoading = false;
  state.recurrings = [];
  state.deleteMutate = vi.fn().mockResolvedValue(undefined);
  snack.length = 0;
  state.refetch = vi.fn();
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

const render = (props: { mobile?: boolean; addRequest?: number } = {}) =>
  act(() =>
    root.render(
      <CategoryManager
        mobile={props.mobile ?? true}
        addRequest={props.addRequest}
      />,
    ),
  );
const tick = (ms = 0) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
const btn = (label: string) =>
  document.querySelector<HTMLElement>(`button[aria-label='${label}']`)!;
const btnText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (b) => b.textContent === text,
  )!;
const stub = (name: string) =>
  document.querySelector<HTMLElement>(`[data-stub=${name}]`);
const stubAct = (name: string) =>
  document.querySelector<HTMLElement>(`[data-stub=edit] [data-act=${name}]`)!;
/** 줄을 눌러 수정 시트(스텁)를 연 뒤 머리 ⋮ 가 부르는 동작을 누른다 */
const viaSheet = async (row: string, action: "add" | "move" | "delete") => {
  await click(btnText(row));
  await click(stubAct(action));
  await tick(300);
};

describe("카테고리 목록(폰)", () => {
  it("탭은 지출 · 수입 둘뿐이고 개수를 붙인다", () => {
    render();
    const tabs = Array.from(document.querySelectorAll("[role=tab]")).map(
      (t) => t.textContent,
    );
    // 탭 글은 이름만 — 개수는 바로 아래 목록 제목("지출 카테고리 {n}개")이 말한다(같은 수를 두 번 말하지 않는다)
    expect(tabs).toEqual(["expense", "income"]);
  });

  it("목록 제목 · 순서 바꾸기는 불러온 뒤에만 있다", () => {
    state.isLoading = true;
    render();
    expect(document.querySelector("h2")).toBeNull();
    expect(container.textContent).not.toContain("reorderEdit");
    state.isLoading = false;
    render();
    expect(document.querySelector("h2")?.textContent).toContain("listTitle");
    expect(container.textContent).toContain("reorderEdit");
  });

  it("실패(데이터 없음)에는 개수 대신 다시 시도가 있고 누르면 다시 받는다", async () => {
    state.categories = undefined;
    render();
    expect(container.textContent).not.toContain("listTitle");
    expect(container.textContent).toContain("loadFailed");
    await tick();
    const retry = Array.from(
      container.querySelectorAll<HTMLElement>("button"),
    ).find((b) => /Try again|다시/.test(b.textContent ?? ""))!;
    await click(retry);
    expect(state.refetch).toHaveBeenCalled();
  });

  it("카테고리 0개 · 찾기 0건은 각자의 한 줄 안내", () => {
    state.categories = [];
    render();
    expect(container.textContent).toContain("empty");
    state.categories = sample();
    render();
    const input = document.querySelector<HTMLInputElement>("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "없는이름");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("noSearchResults");
  });

  it("부모 줄의 꺾쇠 단추는 '{이름} 하위 카테고리' + aria-expanded, 설명 줄은 없다", async () => {
    render();
    const chevron = btn('expandOf{"name":"식비"}');
    expect(chevron.getAttribute("aria-expanded")).toBe("true");
    await click(chevron);
    expect(chevron.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-slot=list-detail]")).toBeNull();
  });

  it("줄을 누르면 수정 폼 · 하위 줄도 같다", async () => {
    render();
    await click(btnText("식비"));
    expect(stub("edit")?.getAttribute("data-id")).toBe("1");
    await click(btnText("점심"));
    expect(stub("edit")?.getAttribute("data-id")).toBe("3");
  });

  it("세트 밖 아이콘 이름은 빈 타일이 아니라 기본 아이콘(tag)으로 그린다", () => {
    state.categories = [cat(2, "교통", null, { icon: "weird-unknown-icon" })];
    render();
    expect(
      container.querySelector("[data-slot=list-tile] svg.lucide-tag"),
    ).not.toBeNull();
  });

  it("검색칸 아래 8 + 목록 제목 위 8 — 검색 줄이 제 아래 여백을 갖는다(T3)", () => {
    render();
    const wrap = container
      .querySelector("input")!
      .closest(".px-global-gutter")!;
    expect(wrap.className).toContain("pb-x2");
  });

  it("바깥(머리 '추가')이 올린 횟수가 바뀌면 새 카테고리 폼이 열린다", () => {
    render({ addRequest: 0 });
    expect(stub("edit")).toBeNull();
    render({ addRequest: 1 });
    expect(stub("edit")?.getAttribute("data-id")).toBe("new");
  });
});

describe("줄 끝 ⋮ 는 없다 — 동작은 수정 시트 머리 ⋮ 에서(10-25 줄 끝 ⋮ 원칙)", () => {
  it("줄 어디에도 ⋮(더보기) 단추가 없다", () => {
    render();
    expect(document.querySelector("button[aria-label$='moreOf']")).toBeNull();
    expect(
      Array.from(document.querySelectorAll("button")).some((b) =>
        (b.getAttribute("aria-label") ?? "").startsWith("moreOf"),
      ),
    ).toBe(false);
    expect(container.querySelector("[data-slot=list-suffix]")).toBeNull();
  });

  it("줄 누름이 수정 시트를 연다", async () => {
    render();
    await click(btnText("교통"));
    expect(stub("edit")?.getAttribute("data-id")).toBe("2");
  });

  it("하위 카테고리 추가는 수정 시트를 닫고 그 줄을 상위로 새 폼을 연다", async () => {
    render();
    await viaSheet("교통", "add");
    expect(stub("edit")?.getAttribute("data-id")).toBe("new");
    expect(stub("edit")?.getAttribute("data-parent")).toBe("2");
  });

  it("거래 옮기기는 수정 시트를 닫고 그 카테고리로 옮기기 시트를 연다", async () => {
    render();
    await viaSheet("교통", "move");
    expect(stub("edit")).toBeNull();
    expect(stub("move")?.getAttribute("data-id")).toBe("2");
  });
});

describe("삭제 확인", () => {
  const openDelete = async (name: string) => {
    await viaSheet(name, "delete");
    await tick(300);
    expect(stub("edit")).toBeNull();
  };
  const dlg = () => document.querySelector("[role=alertdialog]");

  it("이번 달 예산이 없어도 거래는 남고 예산은 지워진다는 두 문장을 늘 말한다", async () => {
    render();
    await openDelete("교통");
    expect(dlg()?.textContent).toContain('deleteConfirm{"name":"교통"}');
    expect(dlg()?.textContent).toContain("deleteMessage");
    expect(dlg()?.textContent).not.toContain("deleteRecurring");
  });

  it("그 카테고리를 쓰는 반복 거래가 있으면 셋째 문장에 개수를 말한다(쉬는 것 포함)", async () => {
    state.recurrings = [
      { categoryRowId: 2 },
      { categoryRowId: 2 },
      { categoryRowId: 1 },
    ];
    render();
    await openDelete("교통");
    expect(dlg()?.textContent).toContain('deleteRecurring{"count":2}');
  });

  it("반복 목록을 못 받았어도 확인창은 열린다 — 두 문장", async () => {
    state.recurrings = undefined;
    render();
    await openDelete("교통");
    expect(dlg()).not.toBeNull();
    expect(dlg()?.textContent).not.toContain("deleteRecurring");
  });

  it("[삭제] 를 누르면 삭제 요청이 한 번 나간다", async () => {
    render();
    await openDelete("교통");
    await click(
      Array.from(dlg()!.querySelectorAll<HTMLElement>("button")).find(
        (b) => b.textContent === "delete",
      )!,
    );
    expect(state.deleteMutate).toHaveBeenCalledTimes(1);
    expect(state.deleteMutate.mock.calls[0]![0]).toBe(2);
  });

  it("하위가 있으면 막힘 확인 하나뿐이고 지우지 않는다", async () => {
    render();
    await openDelete("식비");
    expect(dlg()?.textContent).toContain("deleteBlockedTitle");
    expect(dlg()?.querySelectorAll("button")).toHaveLength(1);
    expect(state.deleteMutate).not.toHaveBeenCalled();
  });
});

describe("순서 바꾸기", () => {
  it("글이 '완료' 로 바뀌고 검색칸 대신 안내가 서며 ⋮ 는 없고 손잡이만 있다", async () => {
    render();
    await click(btnText("reorderEdit"));
    expect(btnText("reorderDone")).toBeTruthy();
    expect(container.textContent).toContain("reorderHint");
    expect(container.querySelector("input")).toBeNull();
    expect(document.querySelector("button[aria-label^='moreOf']")).toBeNull();
    expect(btn('dragReorderOf{"name":"식비"}')).toBeTruthy();
    expect(btn('dragReorderOf{"name":"점심"}')).toBeTruthy();
    // 늘 펼친 화면 — 꺾쇠 단추가 없다
    expect(document.querySelector("[data-slot=list-expand-button]")).toBeNull();
  });

  it("순서 모드의 부모 줄은 보기 줄과 같은 색 · 누르지 않는 비대화형 줄이다", async () => {
    render();
    const viewTitle = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-slot=list-title]"),
      ).find((e) => e.textContent === "식비")!;
    const viewClass = viewTitle().className;
    await click(btnText("reorderEdit"));
    const title = viewTitle();
    // 꺼진 색이 아니다: 글 클래스가 보기 줄과 같고 disabled 표시가 없다
    expect(title.className).toBe(viewClass);
    const item = title.closest("[data-slot=list-item]")!;
    expect(item.querySelector("[data-disabled]")).toBeNull();
    // 버튼이 아니다(키보드 초점이 가지 않는다): 줄 안 버튼은 손잡이 하나뿐
    const buttons = Array.from(item.querySelectorAll("button"));
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute("aria-label")).toBe(
      'dragReorderOf{"name":"식비"}',
    );
    expect(title.closest("button")).toBeNull();
    // 줄을 눌러도 수정 시트가 열리지 않는다
    await click(title);
    expect(stub("edit")).toBeNull();
  });

  it("완료를 누르면 목록으로 돌아온다", async () => {
    render();
    await click(btnText("reorderEdit"));
    await click(btnText("reorderDone"));
    expect(container.querySelector("input")).not.toBeNull();
    expect(btnText("교통")).toBeTruthy();
  });
});

describe("동작 뒤 초점(K2)", () => {
  const settle = () => tick(300);
  const focusedRow = () =>
    (document.activeElement as HTMLElement | null)?.dataset?.categoryRow;

  it("거래 옮기기 시트를 닫으면 그 카테고리 줄로 초점이 돌아온다", async () => {
    render();
    await viaSheet("교통", "move");
    await click(document.querySelector<HTMLElement>("[data-act=close-move]")!);
    await settle();
    expect(focusedRow()).toBe("2");
  });

  it("삭제를 취소하면 그 줄로, 지우면 이웃 줄(없으면 앞 줄)로 돌아온다", async () => {
    render();
    await viaSheet("교통", "delete");
    await tick(300);
    const dlg = () => document.querySelector("[role=alertdialog]")!;
    await click(
      Array.from(dlg().querySelectorAll<HTMLElement>("button")).find(
        (b) => b.textContent === "cancel",
      )!,
    );
    await settle();
    expect(focusedRow()).toBe("2");

    await viaSheet("교통", "delete");
    await tick(300);
    await click(
      Array.from(dlg().querySelectorAll<HTMLElement>("button")).find(
        (b) => b.textContent === "delete",
      )!,
    );
    // 서버가 지웠다고 알린다 — 교통은 맨 아래 줄이라 앞 줄(점심)로
    await act(async () => {});
    await settle();
    expect(focusedRow()).toBe("3");
  });

  it("삭제가 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도] 가 같은 삭제를 다시 한다", async () => {
    state.deleteMutate = vi.fn().mockRejectedValue(new Error("x"));
    render();
    await viaSheet("교통", "delete");
    await tick(300);
    const dlg = () => document.querySelector("[role=alertdialog]");
    await click(
      Array.from(dlg()!.querySelectorAll<HTMLElement>("button")).find(
        (b) => b.textContent === "delete",
      )!,
    );
    await act(async () => {});
    expect(snack).toHaveLength(1);
    expect(snack[0]).toMatchObject({
      message: "deleteFailed",
      tone: "critical",
    });
    state.deleteMutate.mockResolvedValue(undefined);
    await act(async () => snack[0]!.action!.onClick());
    expect(state.deleteMutate).toHaveBeenCalledTimes(2);
    expect(state.deleteMutate.mock.calls[1]![0]).toBe(2);
  });
});
