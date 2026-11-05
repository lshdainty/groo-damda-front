// 예산 설정 폰 — 흰 면 하나(카드 · 선 없음) · 총 예산 막대 넘침 critical · 금액 원까지 · 실패(I-08 18 ~ 23)
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
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/", search: "" }),
}));
vi.mock("@/shared/ui/groo/primitives", () => ({
  Icon: () => <svg />,
}));
vi.mock("./BudgetFormDialog", () => ({
  BudgetFormDialog: () => null,
}));

const q = (data: unknown, extra: object = {}) => ({
  data,
  isError: false,
  isLoading: data === undefined,
  refetch: vi.fn(),
  ...extra,
});
const state = {
  budgets: q(undefined) as ReturnType<typeof q>,
  summary: q(undefined) as ReturnType<typeof q>,
  cats: q(undefined) as ReturnType<typeof q>,
};
const mut = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
});
const show = vi.hoisted(() => vi.fn());
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show, dismiss: vi.fn() }),
}));
const deleteAsync = vi.fn((_id?: number) => Promise.resolve());
let nextId = 100;
const createAsync = vi.fn(() => Promise.resolve({ rowId: nextId++ }));
const updateAsync = vi.fn(() => Promise.resolve());
const prev = { data: [] as unknown[], isLoading: false };

const createOpts: unknown[] = [];
const updateOpts: unknown[] = [];

vi.mock("@/features/expense", () => ({
  useExpenseBudgets: (a: { month: number }) =>
    a.month === new Date().getMonth() + 1 ? state.budgets : prev,
  useRangeSummary: () => state.summary,
  useExpenseCategories: () => state.cats,
  useCreateExpenseBudget: (o?: unknown) => {
    createOpts.push(o);
    return { ...mut(), mutateAsync: createAsync };
  },
  useUpdateExpenseBudget: (o?: unknown) => {
    updateOpts.push(o);
    return { ...mut(), mutateAsync: updateAsync };
  },
  useDeleteExpenseBudget: () => ({ ...mut(), mutateAsync: deleteAsync }),
}));

const { BudgetManager } = await import("./BudgetManager");
const { setHiddenCards } = await import("@/shared/lib/groo/hide-amounts-core");

const now = new Date();
const b = (rowId: number, categoryRowId: number | null, amount: number) => ({
  rowId,
  categoryRowId,
  categoryName: categoryRowId == null ? null : `카테고리 ${categoryRowId}`,
  budgetAmount: amount,
  budgetYear: now.getFullYear(),
  budgetMonth: now.getMonth() + 1,
});
const cat = (rowId: number) => ({
  rowId,
  categoryName: `카테고리명 ${rowId}`,
  icon: "tag",
  color: null,
  expenseType: "EXPENSE",
  parentRowId: null,
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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  state.budgets = q([b(1, null, 1_000_000), b(2, 1, 800_000)]);
  state.summary = q({
    totalExpense: 1_234_567,
    categoryBreakdown: [
      {
        categoryRowId: 1,
        parentCategoryRowId: null,
        totalAmount: 900_000,
        expenseType: "EXPENSE",
      },
    ],
  });
  state.cats = q([cat(1), cat(2)]);
});
afterEach(() => {
  act(() => setHiddenCards([]));
  act(() => root.unmount());
  container.remove();
});
const render = (mobile = true) =>
  act(() => root.render(<BudgetManager mobile={mobile} />));

describe("예산 설정 폰 — 흰 면 하나(I-08 18 · 21)", () => {
  it("테두리 카드 · 줄 사이 선이 없다 — 달 줄이 맨 위", () => {
    render();
    expect(container.querySelector("[data-slot=card]")).toBeNull();
    expect(container.querySelector("hr, [data-slot=list-divider]")).toBeNull();
    expect(
      container.firstElementChild?.firstElementChild?.getAttribute("data-slot"),
    ).toBe("month-bar");
  });

  it("총 예산 막대 — 써서 넘치면 critical(over), 줄 막대도 같은 규칙", () => {
    render();
    const meters = container.querySelectorAll("[role=meter]");
    expect(meters.length).toBe(2);
    // 총 예산 1,000,000 에 1,234,567 → 넘침, 카테고리 800,000 에 900,000 → 넘침
    for (const m of Array.from(meters))
      expect(m.getAttribute("data-state")).toBe("over");
    state.summary = q({ totalExpense: 500_000, categoryBreakdown: [] });
    render();
    for (const m of Array.from(container.querySelectorAll("[role=meter]")))
      expect(m.getAttribute("data-state")).toBe("enabled");
  });

  it("금액은 원까지 · 이름은 말줄임 없이(긴 이름) · 줄은 누르는 줄", () => {
    state.cats = q([
      {
        ...cat(1),
        categoryName: "주거·관리비·공과금·통신 요금 자동이체 묶음",
      },
    ]);
    render();
    expect(container.textContent).toContain("1,234,567");
    expect(container.textContent).toContain(
      "주거·관리비·공과금·통신 요금 자동이체 묶음",
    );
    expect(container.querySelector(".truncate, .text-ellipsis")).toBeNull();
    expect(
      container.querySelector("[data-slot=list-title]")?.className ?? "",
    ).not.toContain("nowrap");
    expect(container.querySelector("li button")).not.toBeNull();
  });

  it("지표 셋은 키-값 줄 · 할당 가능 넘침은 U+2212 + critical", () => {
    state.budgets = q([b(1, null, 100_000), b(2, 1, 800_000)]);
    render();
    const vals = container.querySelectorAll("[data-slot=kv-value]");
    expect(vals).toHaveLength(3);
    expect(vals[2]!.textContent).toMatch(/^−.*700,000$/);
    expect(vals[2]!.className).toContain("text-fg-critical");
    expect(container.textContent).toContain("manager.overCap");
  });

  it("가림(budget.manage) — 금액이 ••••", () => {
    render();
    act(() => setHiddenCards(["budget.manage"]));
    expect(container.textContent).not.toContain("1,234,567");
    expect(container.textContent).toContain("••••");
  });
});

describe("예산 설정 — 불러오는 중 · 실패(I-08 23)", () => {
  it("질의 실패 → 설정 안 됨 · 빈 목록이 아니라 다시 시도", () => {
    state.budgets = q(undefined, { isError: true, isLoading: false });
    render();
    expect(container.textContent).toContain("manager.loadFailed");
    expect(container.textContent).not.toContain("manager.notSet");
    expect(container.textContent).not.toContain("manager.emptyCategory");
    const retry = container.querySelector("[data-slot=result-section] button");
    act(() => (retry as HTMLButtonElement).click());
    expect(state.budgets.refetch).toHaveBeenCalled();
  });

  it("불러오는 중에도 달 줄은 있다", () => {
    state.budgets = q(undefined);
    render();
    expect(container.querySelector("[data-slot=month-bar]")).not.toBeNull();
  });
});

describe("예산 설정 데스크톱 — 카드 그대로, 줄 끝 수정 · 삭제 아이콘 이름", () => {
  it("아이콘 버튼 이름이 카테고리를 말한다", () => {
    render(false);
    expect(container.querySelector("[data-slot=card]")).not.toBeNull();
    const names = Array.from(container.querySelectorAll("button")).map((x) =>
      x.getAttribute("aria-label"),
    );
    expect(names.some((n) => n?.startsWith("manager.editNamed"))).toBe(true);
    expect(names.some((n) => n?.startsWith("manager.deleteNamed"))).toBe(true);
  });
});

describe("예산 확인창 — ds Alert Dialog (I-28 3-6)", () => {
  const press = async (el: Element | null | undefined) => {
    await act(async () => {
      (el as HTMLElement).click();
    });
  };
  const dialog = () => document.querySelector("[role=alertdialog]");
  const action = () =>
    document.querySelector("[data-slot=alert-dialog-action]");
  const label = (name: string) =>
    Array.from(document.querySelectorAll("button")).find((x) =>
      x.textContent?.includes(name),
    );

  it("삭제 — 제목이 이름을 짚고, 확정은 criticalSolid · 취소는 neutralWeak, 바깥은 닫지 않는다", async () => {
    deleteAsync.mockClear();
    render(false);
    await press(container.querySelector("[aria-label^='manager.deleteNamed']"));
    const d = dialog();
    expect(d?.getAttribute("aria-modal")).toBe("true");
    expect(d?.textContent).toContain("deleteTitle");
    expect(d?.textContent).toContain("카테고리명 1");
    expect(action()?.className).toContain("bg-bg-critical-solid");
    expect(
      d?.querySelector("[data-slot=alert-dialog-cancel]")?.className,
    ).toContain("bg-bg-neutral-weak");
    // 바깥(딤)을 눌러도 닫히지 않는다
    await act(async () => {
      document
        .querySelector("[data-slot=alert-dialog-overlay]")
        ?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(dialog()).not.toBeNull();
    expect(deleteAsync).not.toHaveBeenCalled();
    await press(action());
    expect(deleteAsync).toHaveBeenCalledWith(2);
    expect(dialog()).toBeNull();
  });

  it("지난달 복사 — 겹침 일부: 확인창 criticalSolid · N 은 겹친 개수 · 되돌리기 없음", async () => {
    updateAsync.mockClear();
    createAsync.mockClear();
    show.mockClear();
    prev.data = [b(9, 1, 500_000), b(10, 5, 300_000)];
    render(false);
    await press(label("copyLastMonth"));
    const d = dialog();
    expect(d?.textContent).toContain("copyTitle");
    expect(d?.textContent).toContain('copyOverwriteMessage{"count":1}');
    expect(action()?.className).toContain("bg-bg-critical-solid");
    await press(action());
    expect(updateAsync).toHaveBeenCalledWith({ id: 2, budgetAmount: 500_000 });
    expect(createAsync).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    expect(show).not.toHaveBeenCalled();
    prev.data = [];
  });

  it("지난달 복사 — 겹침 없음: 묻지 않고 바로 복사, 되돌리기는 방금 만든 것만 지운다", async () => {
    createAsync.mockClear();
    deleteAsync.mockClear();
    show.mockClear();
    nextId = 100;
    prev.data = [b(9, 7, 500_000), b(10, 8, 300_000)];
    render(false);
    await press(label("copyLastMonth"));
    expect(dialog()).toBeNull();
    expect(createAsync).toHaveBeenCalledTimes(2);
    const opt = show.mock.calls[0]![0];
    expect(opt.message).toBe("copiedDone");
    expect(opt.tone).toBeUndefined();
    expect(opt.action.label).toBe("copyUndo");
    await act(async () => opt.action.onClick());
    expect(deleteAsync.mock.calls.map((c) => c[0]).sort()).toEqual(
      [100, 101].sort(),
    );
    expect(show).toHaveBeenCalledTimes(1);
    prev.data = [];
  });

  it("되돌리기 일부 실패 — 남은 것을 알리고 다시 시도는 남은 id 만 지운다", async () => {
    createAsync.mockClear();
    deleteAsync.mockClear();
    show.mockClear();
    nextId = 100;
    prev.data = [b(9, 7, 500_000), b(10, 8, 300_000)];
    render(false);
    await press(label("copyLastMonth"));
    deleteAsync.mockImplementationOnce(() => Promise.resolve());
    deleteAsync.mockImplementationOnce(() => Promise.reject(new Error("x")));
    await act(async () => show.mock.calls[0]![0].action.onClick());
    const fail = show.mock.calls[1]![0];
    expect(fail.tone).toBe("critical");
    expect(fail.message).toBe('copyUndoFailed{"count":1}');
    deleteAsync.mockClear();
    await act(async () => fail.action.onClick());
    expect(deleteAsync).toHaveBeenCalledTimes(1);
    expect(deleteAsync).toHaveBeenCalledWith(101);
    prev.data = [];
  });

  it("덮어쓰기 복사의 일부 실패 — 닫고 N 개 알림, 다시 시도는 실패한 것만(확인창을 다시 열지 않는다), 되돌리기 없음", async () => {
    show.mockClear();
    updateAsync.mockClear();
    createAsync.mockClear();
    updateAsync.mockRejectedValueOnce(new Error("x"));
    prev.data = [b(9, 1, 500_000), b(10, 5, 300_000)];
    render(false);
    await press(label("copyLastMonth"));
    await press(action());
    expect(dialog()).toBeNull();
    const opt = show.mock.calls[0]![0];
    expect(opt.tone).toBe("critical");
    expect(opt.message).toBe('copyPartial{"count":1}');
    await act(async () => opt.action.onClick());
    expect(dialog()).toBeNull();
    expect(updateAsync).toHaveBeenCalledTimes(2);
    expect(createAsync).toHaveBeenCalledTimes(1);
    // 끝난 뒤 되돌리기 없는 "가져왔어요"
    const done = show.mock.calls[1]![0];
    expect(done.message).toBe("copiedDone");
    expect(done.action).toBeUndefined();
    prev.data = [];
  });

  it("겹침 없는 복사에서 3개 중 둘째가 실패 — N=1 알림, 다시 시도는 1개만, 되돌리기는 셋 모두", async () => {
    show.mockClear();
    createAsync.mockClear();
    deleteAsync.mockClear();
    nextId = 100;
    createAsync.mockImplementationOnce(() =>
      Promise.resolve({ rowId: nextId++ }),
    );
    createAsync.mockImplementationOnce(() => Promise.reject(new Error("x")));
    prev.data = [b(9, 7, 1), b(10, 8, 2), b(11, 9, 3)];
    render(false);
    await press(label("copyLastMonth"));
    expect(dialog()).toBeNull();
    expect(show).toHaveBeenCalledTimes(1);
    const fail = show.mock.calls[0]![0];
    expect(fail.tone).toBe("critical");
    expect(fail.message).toBe('copyPartial{"count":1}');
    createAsync.mockClear();
    await act(async () => fail.action.onClick());
    expect(createAsync).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    const done = show.mock.calls[1]![0];
    expect(done.message).toBe("copiedDone");
    await act(async () => done.action.onClick());
    expect(deleteAsync).toHaveBeenCalledTimes(3);
    prev.data = [];
  });

  it("삭제가 실패하면 확인창을 닫고 스낵바 — 다시 시도는 같은 삭제를 다시 한다", async () => {
    show.mockClear();
    deleteAsync.mockClear();
    deleteAsync.mockRejectedValueOnce(new Error("x"));
    render(false);
    await press(container.querySelector("[aria-label^='manager.deleteNamed']"));
    await press(action());
    expect(dialog()).toBeNull();
    const opt = show.mock.calls[0]![0];
    expect(opt.tone).toBe("critical");
    expect(opt.message).toBe("deleteFailed");
    await act(async () => opt.action.onClick());
    expect(deleteAsync).toHaveBeenCalledTimes(2);
    expect(deleteAsync).toHaveBeenLastCalledWith(2);
    // 이미 확정한 삭제 — 다시 시도는 같은 질문을 두 번 하지 않는다
    expect(dialog()).toBeNull();
  });
});

describe("지난달 복사 — 이번 달 질의가 값을 줄 때만 켠다(H1)", () => {
  const copyBtn = () =>
    Array.from(document.querySelectorAll("button")).find((x) =>
      x.textContent?.includes("copyLastMonth"),
    ) as HTMLButtonElement | undefined;
  const press = async (el: Element | null | undefined) => {
    await act(async () => {
      (el as HTMLElement).click();
    });
  };

  afterEach(() => {
    prev.data = [];
  });

  it("이번 달 불러오는 중 — 지난달 값이 캐시에 있어도 버튼이 막혀 누를 수 없다", async () => {
    createAsync.mockClear();
    updateAsync.mockClear();
    prev.data = [b(9, 7, 500_000)];
    state.budgets = q(undefined);
    render(false);
    expect(copyBtn()).toBeDefined();
    expect(copyBtn()!.disabled).toBe(true);
    await press(copyBtn());
    expect(createAsync).not.toHaveBeenCalled();
    expect(updateAsync).not.toHaveBeenCalled();
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
  });

  it("이번 달 불러오기 실패 중 — 실패 화면 위에서도 막힌다", async () => {
    createAsync.mockClear();
    prev.data = [b(9, 7, 500_000)];
    state.budgets = q(undefined, { isError: true, isLoading: false });
    render(false);
    expect(copyBtn()!.disabled).toBe(true);
    await press(copyBtn());
    expect(createAsync).not.toHaveBeenCalled();
  });

  it("이번 달이 빈 목록으로 성공했으면 켜진다(빈 값 ≠ 값 없음)", () => {
    prev.data = [b(9, 7, 500_000)];
    state.budgets = q([]);
    render(false);
    expect(copyBtn()!.disabled).toBe(false);
  });

  it("이번 달 값이 있으면 켜지고, 지난달이 비어 있으면 여전히 막힌다", () => {
    prev.data = [b(9, 7, 500_000)];
    render(false);
    expect(copyBtn()!.disabled).toBe(false);
    prev.data = [];
    render(false);
    expect(copyBtn()!.disabled).toBe(true);
  });

  it("불러오는 중이던 버튼이 응답이 오면 켜진다", () => {
    prev.data = [b(9, 7, 500_000)];
    state.budgets = q(undefined);
    render(false);
    expect(copyBtn()!.disabled).toBe(true);
    state.budgets = q([b(1, null, 1_000_000)]);
    render(false);
    expect(copyBtn()!.disabled).toBe(false);
  });

  it("되돌리기 — 서버가 복사 직전 목록에 있던 행의 rowId 를 돌려줘도(upsert) 그 행은 지우지 않는다", async () => {
    createAsync.mockClear();
    deleteAsync.mockClear();
    show.mockClear();
    nextId = 100;
    // 직전 목록에 rowId 1(총 예산)·2(카테고리 1). 첫 create 가 1 을 돌려준다 = 원래 행
    createAsync.mockImplementationOnce(() => Promise.resolve({ rowId: 1 }));
    prev.data = [b(9, 7, 500_000), b(10, 8, 300_000)];
    render(false);
    await press(copyBtn());
    expect(createAsync).toHaveBeenCalledTimes(2);
    const opt = show.mock.calls[0]![0];
    expect(opt.action.label).toBe("copyUndo");
    await act(async () => opt.action.onClick());
    expect(deleteAsync.mock.calls.map((c) => c[0])).toEqual([100]);
    expect(deleteAsync).not.toHaveBeenCalledWith(1);
    expect(deleteAsync).not.toHaveBeenCalledWith(2);
  });

  it("되돌리기 — 겹침이 없던 새 행만 지운다(원래 행의 id 는 한 번도 안 나간다)", async () => {
    createAsync.mockClear();
    deleteAsync.mockClear();
    show.mockClear();
    nextId = 200;
    prev.data = [b(9, 7, 500_000), b(10, 8, 300_000)];
    render(false);
    await press(copyBtn());
    await act(async () => show.mock.calls[0]![0].action.onClick());
    const ids = deleteAsync.mock.calls.map((c) => c[0]).sort();
    expect(ids).toEqual([200, 201]);
    for (const original of [1, 2]) expect(ids).not.toContain(original);
  });
});

describe("되돌리기 — 404 는 이미 지운 것(L1)", () => {
  const copyThenUndo = async () => {
    createAsync.mockClear();
    deleteAsync.mockClear();
    show.mockClear();
    nextId = 100;
    prev.data = [b(9, 7, 1), b(10, 8, 2), b(11, 9, 3)];
    render(false);
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((x) => x.textContent?.includes("copyLastMonth"))!
        .click();
    });
  };
  const http = (status: number) =>
    Object.assign(new Error(String(status)), { response: { status } });
  afterEach(() => {
    prev.data = [];
  });

  it("전부 404 — 실패 알림이 없다(다시 시도 고리가 없다)", async () => {
    await copyThenUndo();
    deleteAsync.mockImplementation(() => Promise.reject(http(404)));
    await act(async () => show.mock.calls[0]![0].action.onClick());
    expect(deleteAsync).toHaveBeenCalledTimes(3);
    expect(show).toHaveBeenCalledTimes(1);
    deleteAsync.mockImplementation(() => Promise.resolve());
  });

  it("500 은 실패 — 그것만 센다", async () => {
    await copyThenUndo();
    deleteAsync.mockImplementationOnce(() => Promise.resolve());
    deleteAsync.mockImplementationOnce(() => Promise.reject(http(500)));
    deleteAsync.mockImplementationOnce(() => Promise.resolve());
    await act(async () => show.mock.calls[0]![0].action.onClick());
    const fail = show.mock.calls[1]![0];
    expect(fail.message).toBe('copyUndoFailed{"count":1}');
    deleteAsync.mockClear();
    await act(async () => fail.action.onClick());
    expect(deleteAsync).toHaveBeenCalledTimes(1);
    expect(deleteAsync).toHaveBeenCalledWith(101);
  });

  it("404 와 500 이 섞이면 500 만 세고, 다시 시도는 500 난 것만 지운다", async () => {
    await copyThenUndo();
    deleteAsync.mockImplementationOnce(() => Promise.reject(http(404)));
    deleteAsync.mockImplementationOnce(() => Promise.reject(http(500)));
    deleteAsync.mockImplementationOnce(() => Promise.reject(http(404)));
    await act(async () => show.mock.calls[0]![0].action.onClick());
    const fail = show.mock.calls[1]![0];
    expect(fail.message).toBe('copyUndoFailed{"count":1}');
    deleteAsync.mockClear();
    await act(async () => fail.action.onClick());
    expect(deleteAsync.mock.calls.map((c) => c[0])).toEqual([101]);
  });

  it("응답 없는 네트워크 오류는 404 가 아니다 — 실패로 센다", async () => {
    await copyThenUndo();
    deleteAsync.mockImplementationOnce(() => Promise.reject(new Error("net")));
    await act(async () => show.mock.calls[0]![0].action.onClick());
    expect(show.mock.calls[1]![0].message).toBe('copyUndoFailed{"count":1}');
  });
});

describe("실패 알림은 한 곳 — 전역 오류 토스트를 끈다", () => {
  it("복사 · 폼 저장 훅 모두 silent 다 — 복사는 스낵바, 폼 저장은 폼 맨 위 Callout 이 알린다", () => {
    createOpts.length = 0;
    updateOpts.length = 0;
    render(false);
    expect(createOpts).toContainEqual({ silent: true });
    expect(updateOpts).toContainEqual({ silent: true });
    // 옵션 없이 부른(전역 토스트가 켜진) 만들기 · 고치기 훅은 더는 없다
    expect(createOpts).not.toContain(undefined);
    expect(updateOpts).not.toContain(undefined);
  });
});
