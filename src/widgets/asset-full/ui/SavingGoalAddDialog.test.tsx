// 저축 목표 폼 — 치는 값은 칸 · 고르는 값은 줄 · 누를 때 검증 · 처음 색 · 팔레트 밖 색 보존(I-19 D · M 표)
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

const state = {
  goals: [] as { rowId: number; title: string; color: string }[],
  create: vi.fn(),
  update: vi.fn(),
  contribute: vi.fn(),
  opts: [] as unknown[],
  failed: false,
  snack: [] as Array<{ message: string; action?: { onClick: () => void } }>,
};
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: { message: string; action?: { onClick: () => void } }) =>
      state.snack.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("@/features/savingGoal", () => ({
  useSavingGoals: () => ({ data: { goals: state.goals } }),
  useCreateSavingGoal: (o?: unknown) => {
    state.opts.push(o);
    return {
      mutate: state.create,
      reset: () => {},
      isPending: false,
      isError: state.failed,
      error: state.failed ? new Error("서버 원문 오류") : null,
    };
  },
  useUpdateSavingGoal: (o?: unknown) => {
    state.opts.push(o);
    return {
      mutate: state.update,
      reset: () => {},
      isPending: false,
      isError: false,
      error: null,
    };
  },
  useContributeSavingGoal: (o?: unknown) => {
    state.opts.push(o);
    return {
      mutate: state.contribute,
      mutateAsync: state.contribute,
      reset: () => {},
      isPending: false,
      isError: false,
      error: null,
    };
  },
}));

const { SavingGoalAddDialog } = await import("./SavingGoalAddDialog");
const { i18n } = await import("@/shared/i18n/config");

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
  state.goals = [];
  state.create = vi.fn();
  state.update = vi.fn();
  state.contribute = vi.fn();
  state.opts = [];
  state.snack = [];
  state.failed = false;
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

const mount = (goal: Record<string, unknown> | null = null) => {
  const onClose = vi.fn();
  act(() =>
    root.render(<SavingGoalAddDialog goal={goal as never} onClose={onClose} />),
  );
  return { onClose };
};
const inputs = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-slot=text-input-value]"),
  );
const type = (el: HTMLInputElement, v: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (b) => b.textContent === text,
  )!;
const click = (el: Element) => act(() => (el as HTMLElement).click());
const rows = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "[data-slot=list-body][aria-haspopup]",
    ),
  );

const saved = {
  rowId: 7,
  title: "제주 한 달 살기 자금",
  targetAmount: 9_876_543_210,
  currentAmount: 1_234_567_890,
  deadlineDate: "2035-12-31",
  icon: "plane",
  color: "#9e9e9e",
};

describe("모양", () => {
  it("칸 셋은 한 줄에 하나(Field) · 줄 셋은 목표일 → 아이콘 → 색 · 미리보기 없음", () => {
    mount();
    expect(inputs()).toHaveLength(3);
    const titles = rows().map(
      (r) => r.querySelector("[data-slot=list-title]")?.textContent,
    );
    expect(titles).toEqual(["savingGoal.deadline", "form.icon", "form.color"]);
    expect(document.querySelectorAll("[data-slot=field]")).toHaveLength(3);
    expect(
      document.querySelector("[role=meter], [data-slot=progress]"),
    ).toBeNull();
    // 선택 표시는 현재 모은 금액에만
    expect(document.body.textContent).toContain("savingGoal.optional");
  });

  it("수정 값 — 쉼표 · 목표일 글 · 지우기 버튼 · 세트 안 아이콘 이름", () => {
    mount(saved);
    expect(inputs()[1]!.value).toBe("9,876,543,210");
    expect(inputs()[2]!.value).toBe("1,234,567,890");
    expect(document.body.textContent).toContain("2035년 12월 31일");
    expect(document.body.textContent).toContain("비행기");
    expect(
      document.querySelector("[data-slot=picker-row-clear]"),
    ).not.toBeNull();
  });
});

describe("검증은 누를 때", () => {
  it("열 때는 오류 없음 · 빈 채 누르면 칸마다 아래 글, 요청 없음", () => {
    mount();
    expect(document.body.textContent).not.toContain("savingGoal.errName");
    expect(byText("add").hasAttribute("disabled")).toBe(false);
    click(byText("add"));
    expect(document.body.textContent).toContain("savingGoal.errName");
    expect(state.create).not.toHaveBeenCalled();
    type(inputs()[0]!, "여행");
    click(byText("add"));
    expect(document.body.textContent).toContain("savingGoal.errAmount");
    expect(state.create).not.toHaveBeenCalled();
  });

  it("현재 > 목표 · 같은 이름", () => {
    state.goals = [{ rowId: 1, title: "비상금", color: "#2c70bf" }];
    mount();
    type(inputs()[0]!, "비상금");
    type(inputs()[1]!, "1000");
    click(byText("add"));
    expect(document.body.textContent).toContain("savingGoal.errNameDuplicate");
    type(inputs()[0]!, "여행");
    type(inputs()[2]!, "2000");
    click(byText("add"));
    expect(document.body.textContent).toContain("savingGoal.errCurrentExceeds");
    expect(state.create).not.toHaveBeenCalled();
  });

  it("이름은 12자에서 멈춘다", () => {
    mount();
    type(inputs()[0]!, "가나다라마바사아자차카타파");
    expect(inputs()[0]!.value.length).toBe(12);
  });
});

describe("저장 본문", () => {
  it("추가 — 쓰지 않은 첫 색(목록에 파랑 있으면 초록) · 숫자 금액 · 목표일 null", () => {
    state.goals = [{ rowId: 1, title: "비상금", color: "#2c70bf" }];
    mount();
    type(inputs()[0]!, "유럽 여행");
    type(inputs()[1]!, "5000000");
    click(byText("add"));
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.create.mock.calls[0]![0]).toEqual({
      title: "유럽 여행",
      targetAmount: 5_000_000,
      deadlineDate: null,
      icon: "piggy-bank",
      color: "#2d8060",
      currency: "KRW",
    });
  });

  it("수정 — 팔레트 밖 색은 이름만 고쳐 저장해도 그대로, 줄은 '지금 색'", () => {
    mount(saved);
    expect(document.body.textContent).toContain("지금 색");
    type(inputs()[0]!, "제주 여행");
    click(byText("save"));
    expect(state.update.mock.calls[0]![0].data.color).toBe("#9e9e9e");
    expect(state.update.mock.calls[0]![0].data.deadlineDate).toBe("2035-12-31");
  });

  it("목표일 지우기 — 열지 않고 비운다, 저장하면 null", () => {
    mount(saved);
    click(document.querySelector("[data-slot=picker-row-clear]")!);
    expect(
      document.querySelector("[data-slot=bottom-sheet-content] [role=dialog]"),
    ).toBeNull();
    expect(document.querySelector("[data-slot=picker-row-clear]")).toBeNull();
    click(byText("save"));
    expect(state.update.mock.calls[0]![0].data.deadlineDate).toBeNull();
  });
});

describe("고르기", () => {
  it("색 줄 → 시트에 색 이름 칸, 누르면 값이 바뀌고 닫힌다", () => {
    mount({ ...saved, color: "#2c70bf" });
    const colorRow = rows()[2]!;
    click(colorRow);
    const radios = Array.from(
      document.querySelectorAll<HTMLElement>("[role=radio]"),
    );
    expect(radios.map((r) => r.getAttribute("aria-label"))).toContain("주황");
    click(radios.find((r) => r.getAttribute("aria-label") === "주황")!);
    expect(rows()[2]!.closest("li")!.textContent).toContain("주황");
  });

  it("아이콘 줄 → 시트에 찾기 칸 · 한국어 이름 칸", () => {
    mount();
    click(rows()[1]!);
    expect(document.querySelector("[role=listbox]")).not.toBeNull();
    const options = Array.from(document.querySelectorAll("[role=option]"));
    expect(options.length).toBeGreaterThan(10);
  });

  it("겹친 고르기 시트는 딤이 폼 시트 위, 시트가 그 딤 위에서 위 모서리 시트 값으로 따로 뜬다", () => {
    mount();
    click(rows()[2]!);
    const overlays = Array.from(
      document.querySelectorAll("[data-slot=bottom-sheet-overlay]"),
    );
    const contents = Array.from(
      document.querySelectorAll("[data-slot=bottom-sheet-content]"),
    );
    expect(overlays).toHaveLength(2);
    expect(contents).toHaveLength(2);
    // 폼 시트는 100 · 101, 겹친 고르기 시트는 딤 102 · 시트 103
    expect(overlays[1]!.className).toContain("+1)]");
    expect(contents[1]!.className).toContain("+2)]");
    expect(overlays[0]!.className).not.toContain("+1)]");
    expect(contents[1]!.className).toContain("rounded-t-r6");
  });
});

describe("저장 실패(I-28-5 3b)", () => {
  it("요청은 silent — 서버 원문 토스트가 안 뜬다", () => {
    mount();
    expect(state.opts.length).toBeGreaterThan(0);
    for (const o of state.opts) expect(o).toEqual({ silent: true });
  });

  it("실패하면 폼 맨 위 Callout 고정 글 · 값은 그대로 · 서버 글 없음", () => {
    state.failed = true;
    mount();
    type(inputs()[0]!, "유럽 여행");
    type(inputs()[1]!, "5000000");
    const callout = document.querySelector('[role="alert"]');
    expect(callout?.textContent).toBe("savingGoal.saveFailed");
    expect(document.body.textContent).not.toContain("서버 원문 오류");
    expect(inputs()[0]!.value).toBe("유럽 여행");
    expect(inputs()[1]!.value).toBe("5,000,000");
  });

  it("실패가 없으면 Callout 도 없다", () => {
    mount();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("같은 틱에 두 번 눌러도 요청은 한 번 — onError 로 끝나면 다시 된다", () => {
    mount();
    type(inputs()[0]!, "유럽 여행");
    type(inputs()[1]!, "5000000");
    act(() => {
      byText("add").click();
      byText("add").click();
    });
    expect(state.create).toHaveBeenCalledTimes(1);
    const cbs = state.create.mock.calls[0]![1] as { onError: () => void };
    act(() => cbs.onError());
    click(byText("add"));
    expect(state.create).toHaveBeenCalledTimes(2);
  });

  it("만들기 성공 · 첫 납입 실패 — 만들기 1회 · 폼 닫힘 · 스낵바, [다시 시도] 는 납입만 1회 더", async () => {
    state.contribute = vi.fn().mockRejectedValue(new Error("x"));
    const { onClose } = mount();
    type(inputs()[0]!, "유럽 여행");
    type(inputs()[1]!, "5000000");
    type(inputs()[2]!, "100000");
    click(byText("add"));
    const cbs = state.create.mock.calls[0]![1] as {
      onSuccess: (c: { rowId: number }) => void;
    };
    await act(async () => cbs.onSuccess({ rowId: 9 }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.contribute).toHaveBeenCalledTimes(1);
    expect(state.snack).toHaveLength(1);
    expect(state.snack[0]!.message).toBe("savingGoal.firstContributeFailed");
    await act(async () => state.snack[0]!.action!.onClick());
    expect(state.contribute).toHaveBeenCalledTimes(2);
    expect(state.contribute.mock.calls[1]![0]).toEqual({
      id: 9,
      data: { amount: 100000 },
    });
    expect(state.create).toHaveBeenCalledTimes(1);
  });
});
