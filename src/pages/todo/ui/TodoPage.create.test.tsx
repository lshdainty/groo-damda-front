// 할 일을 **어디서 만드는가** 를 고정한다 (QA #122 · D5).
//
// 종전엔 목록 위에 '빠른 추가' 입력칸이 있었다. 가드는 추가 버튼의 `loading` 에만
// 걸려 있었는데 Enter 는 그 버튼을 지나지 않는다 — 요청이 도는 동안 글자도 그대로
// 남아 있어 Enter 를 연타하면 그 수만큼 할 일이 생겼다.
//
// 사용자 결정(D5)은 "웹 할 일 빠른 추가 입력칸도 없앤다" 다. 그래서 두 방향을 잠근다.
//   ① 기본 화면에서는 글자를 넣고 Enter 를 눌러도 할 일이 만들어지지 않는다
//      — 가드를 다시 다는 게 아니라 그 문 자체가 없어야 한다.
//   ② **편집 폼으로는 여전히 만들어진다** — 이게 없으면 생성이 통째로 사라져도 초록불이다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Todo } from "@/entities/todo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const created = vi.hoisted(() => [] as Record<string, unknown>[]);
const ctx = vi.hoisted(() => ({ mobile: false }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: ctx.mobile, onAddTx: () => {} }),
  useNavigate: () => () => {},
}));
vi.mock("@/features/todo", () => ({
  useTodos: () => ({ data: state.todos, isLoading: false }),
  useCreateTodo: () => ({
    mutate: (values: Record<string, unknown>) => {
      created.push(values);
    },
    isPending: false,
    reset: () => {},
    isError: false,
    error: null,
  }),
  useUpdateTodo: () => ({
    mutate: () => {},
    isPending: false,
    reset: () => {},
    isError: false,
    error: null,
  }),
  useToggleTodoStatus: () => ({
    mutate: () => {},
    pendingIds: new Set<number>(),
    holdIds: new Set<number>(),
  }),
  useDeleteTodo: () => ({
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
  }),
}));
vi.mock("@/features/todo-tag", () => ({ useTodoTags: () => ({ data: [] }) }));
vi.mock("@/features/constellation", () => ({
  useConstellationToday: () => ({ data: undefined }),
  useConstellationSky: () => ({ data: [] }),
}));
vi.mock("@/widgets/constellation", () => ({}));
// 모바일 원장에는 빠른 추가가 없다 — 이 테스트가 보는 건 원장 밖의 생성 동선(Fab)이다.
vi.mock("./TodoMobileLedger", () => ({ TodoMobileLedger: () => null }));

const todo: Todo = {
  rowId: 42,
  title: "세금 신고",
  content: "",
  priority: "MEDIUM",
  category: null,
  status: "PENDING",
  type: "TASK",
  isPinned: false,
  dueDate: "2026-09-30",
  completedAt: null,
  sortOrder: 0,
  parentRowId: null,
  tags: [],
  subtaskCount: 0,
  subtaskCompletedCount: 0,
  createAt: "2026-09-01T00:00:00",
  modifyAt: "2026-09-01T00:00:00",
};

const state = { todos: [todo] as Todo[] };

vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
const { TodoPage } = await import("./TodoPage");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  created.length = 0;
  ctx.mobile = false;
  // 폼은 폭으로 표면이 갈린다(1280 이상 대화상자 · 미만 시트) — jsdom 은 미만(시트)이다
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const click = (el: Element) =>
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

const buttonWith = (label: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );

/** React 제어 입력칸에 값을 넣는다 — 네이티브 setter 를 거쳐야 onChange 가 돈다. */
function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const pressEnter = (el: Element) =>
  act(() =>
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );

describe("빠른 추가 입력칸이 없다 (QA #122 · D5)", () => {
  it("기본 화면의 어떤 칸에 글자를 넣고 Enter 를 눌러도 할 일이 안 생긴다", () => {
    act(() => root.render(<TodoPage />));

    // 편집 폼을 열지 않은 상태에서 화면에 남아 있는 텍스트 입력칸 전부.
    const inputs = [...container.querySelectorAll("input")].filter(
      (el) => el.type !== "checkbox" && el.type !== "radio",
    );
    for (const el of inputs) {
      setInput(el, "빠른 추가 부활");
      pressEnter(el);
    }
    // 칸 자체가 없으면 루프가 비므로, 페이지 본문에 대고도 한 번 눌러 본다.
    pressEnter(container);

    expect(created).toEqual([]);
  });

  it("Enter 를 연타해도 마찬가지다 — 종전엔 누른 수만큼 생겼다", () => {
    act(() => root.render(<TodoPage />));

    const inputs = [...container.querySelectorAll("input")].filter(
      (el) => el.type !== "checkbox" && el.type !== "radio",
    );
    for (const el of inputs) setInput(el, "연타");
    for (let i = 0; i < 10; i++) {
      for (const el of inputs) pressEnter(el);
      pressEnter(container);
    }

    expect(created).toEqual([]);
  });
});

describe("편집 폼으로는 여전히 만들어진다 (D5 가 지워선 안 되는 것)", () => {
  /** 편집 폼에 제목을 넣고 저장까지 누른다. */
  function fillAndSave(title: string) {
    const input = document.body.querySelector<HTMLInputElement>(
      'input[placeholder="editTitlePlaceholder"]',
    );
    if (!input) throw new Error("편집 폼의 제목 칸을 찾지 못했다");
    setInput(input, title);
    const save = buttonWith("add");
    if (!save) throw new Error("편집 폼의 저장 버튼을 찾지 못했다");
    click(save);
  }

  it("데스크톱 — 헤더의 '할 일 추가' 로 열어 저장하면 생성 요청이 나간다", () => {
    act(() => root.render(<TodoPage />));

    const add = buttonWith("newTodo");
    if (!add) throw new Error("헤더의 할 일 추가 버튼을 찾지 못했다");
    click(add);
    fillAndSave("영수증 정리");

    expect(created).toHaveLength(1);
    expect(created[0]?.title).toBe("영수증 정리");
  });

  it("모바일 — Fab 으로 열어 저장하면 생성 요청이 나간다", () => {
    ctx.mobile = true;
    act(() => root.render(<TodoPage />));

    const fab = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "addTodoLabel",
    );
    if (!fab) throw new Error("모바일 추가 Fab 을 찾지 못했다");
    click(fab);
    fillAndSave("장 보기");

    expect(created).toHaveLength(1);
    expect(created[0]?.title).toBe("장 보기");
  });

  it("모바일 흰 면은 내용을 따라 자란다 — min-h-0 이 있으면 긴 목록이 흰 면 밖(회색 바탕)으로 넘친다 (I-10 5)", () => {
    ctx.mobile = true;
    act(() => root.render(<TodoPage />));
    const face = container.querySelector<HTMLElement>(
      "div.bg-bg-layer-default",
    );
    expect(face).toBeTruthy();
    expect(face!.className).toContain("flex-1");
    expect(face!.className).not.toContain("min-h-0");
  });
});
