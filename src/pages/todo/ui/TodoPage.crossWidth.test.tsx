// 폭이 768 을 넘나들어도 쓰던 할 일 폼이 남는다 — "폼은 갈림 밖"(I-wrap-b1 ε 9).
//
// 종전엔 폰 · 넓은 화면 두 return 이 폼(`{dialog}`)을 서로 다른 자리에 두어, 폭이 바뀌면
// 창은 열린 채 다시 붙으며 쓰던 제목이 비었다(390 → 844 에서 "보험 서류 챙기기" 가 빈칸).
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

const titleInput = () =>
  document.body.querySelector<HTMLInputElement>(
    'input[placeholder="editTitlePlaceholder"]',
  );

const rerender = (mobile: boolean) => {
  ctx.mobile = mobile;
  act(() => root.render(<TodoPage />));
};

describe("폭이 바뀌어도 쓰던 폼이 남는다 (I-wrap-b1 ε 9)", () => {
  it("폰에서 쓰던 제목이 넓은 화면 · 다시 폰으로 가도 그대로다", () => {
    rerender(true);
    const fab = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "addTodoLabel",
    );
    if (!fab) throw new Error("모바일 추가 Fab 을 찾지 못했다");
    click(fab);
    setInput(titleInput()!, "보험 서류 챙기기");

    rerender(false);
    expect(titleInput()?.value).toBe("보험 서류 챙기기");
    rerender(true);
    expect(titleInput()?.value).toBe("보험 서류 챙기기");
  });

  it("넓은 화면에서 쓰던 제목도 폰으로 가면 그대로다", () => {
    rerender(false);
    const add = buttonWith("newTodo");
    if (!add) throw new Error("헤더의 할 일 추가 버튼을 찾지 못했다");
    click(add);
    setInput(titleInput()!, "영수증 정리");

    rerender(true);
    expect(titleInput()?.value).toBe("영수증 정리");
  });
});
