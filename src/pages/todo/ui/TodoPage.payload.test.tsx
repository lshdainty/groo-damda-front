// 할 일 수정이 **마감일을 어떻게 보내는가** 를 고정한다 (QA #111).
//
// 규칙은 거래 시트·자산 편집과 같다 — 이 편집기가 **가진 칸만** 싣고,
// 칸이 비어 있으면 `null`(지움)을 싣는다. PUT 은 세 갈래이므로
// (`Patch`: 키 없음=유지 · null=지움 · 값=교체, QA #96) 키를 빼면 옛 값이 남는다.
//
// 종전엔 `due || undefined` 라, 마감일을 지우고 저장해도 옛 마감일이 그대로 남았다.
// 화면은 지워진 것처럼 닫히고서. 같은 편집기의 태그(`tagValueToPayload`)는 이미
// 이 규칙대로 `null` 을 보내고 있었다 — 마감일만 빠져 있었다.
//
// 반대편도 잠근다 — 고른 마감일은 그대로 나가야 한다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Todo } from "@/entities/todo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const sent = vi.hoisted(() => ({
  values: null as Record<string, unknown> | null,
  id: undefined as number | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: false, onAddTx: () => {} }),
  useNavigate: () => () => {},
}));
vi.mock("@/features/todo", () => ({
  useTodos: () => ({ data: state.todos, isLoading: false }),
  useCreateTodo: () => ({
    mutate: () => {},
    isPending: false,
    reset: () => {},
    isError: false,
    error: null,
  }),
  useUpdateTodo: () => ({
    mutate: ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      sent.id = id;
      sent.values = data;
    },
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

const { TodoPage } = await import("./TodoPage");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // 앞 케이스의 다이얼로그가 닫히면 그 뒤 POINTER_BLOCK_MS 동안 클릭이 삼켜진다
  // (모달 닫힘 직후 오클릭 방어) — 케이스끼리 옮지 않게 여기서 푼다.
  __resetPointerBlockForTest();
  // 고정한 오늘 — 할 일 마감일(2026-09-30)과 같은 달. 날짜만 고정하고 타이머는 그대로 둔다
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-15T09:00:00"));
  sent.values = null;
  sent.id = undefined;
  // 폼 · 상세는 폭으로 표면이 갈린다(1280 이상 대화상자 · 미만 시트) — jsdom 은 미만(시트)이다
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
  vi.useRealTimers();
});

const click = (el: Element) =>
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

const buttonWith = (label: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );

/** 목록 → 상세 → 수정 순으로 편집기를 연다(화면에서 실제로 가는 길). */
function openEditor() {
  act(() => root.render(<TodoPage />));
  // 넓은 화면은 보고 있는 달의 날짜 묶음을 그린다 — 오늘 날짜에 기대지 않으려고 시계를 고정했다(beforeEach).
  const row = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("세금 신고"),
  );
  if (!row) throw new Error("할 일 줄을 찾지 못했다");
  click(row);
  const edit = buttonWith("edit");
  if (!edit) throw new Error("상세의 수정 버튼을 찾지 못했다");
  click(edit);
}

/** 마감일 칸 — Input Button(값은 "9월 30일 (수)" 꼴). 지우기 버튼은 값이 있을 때만 뜬다. */
const dueButton = () =>
  document.body.querySelector<HTMLButtonElement>(
    '[data-slot="input-button-trigger"]',
  );
const clearDue = () =>
  document.body.querySelector<HTMLButtonElement>(
    '[data-slot="input-button-clear"]',
  );

function save() {
  const btn = buttonWith("save");
  if (!btn) throw new Error("저장 버튼을 찾지 못했다");
  click(btn);
}

describe("마감일 (QA #111)", () => {
  it("비우면 null 이 나간다 — 키를 빼면 옛 마감일이 남는다", () => {
    openEditor();
    expect(
      document.body.querySelector('[data-slot="input-button-value"]')
        ?.textContent,
    ).toContain("30");
    click(clearDue()!);
    save();

    expect(sent.id).toBe(42);
    expect(sent.values).not.toBeNull();
    expect(sent.values!).toHaveProperty("dueDate");
    expect(sent.values!.dueDate).toBeNull();
  });

  it("고른 마감일은 그대로 나간다", () => {
    openEditor();
    click(dueButton()!);
    const day = document.body.querySelector<HTMLButtonElement>(
      'button[data-date="2026-09-15"]',
    );
    if (!day) throw new Error("달력에서 15일을 찾지 못했다");
    click(day);
    const done = buttonWith("tdm.apply");
    if (!done) throw new Error("달력의 완료 버튼을 찾지 못했다");
    click(done);
    save();

    expect(sent.values!.dueDate).toBe("2026-09-15");
  });

  it("고르지 않고 저장하면 지금 마감일 그대로 나간다", () => {
    openEditor();
    save();
    expect(sent.values!.dueDate).toBe("2026-09-30");
  });
});
