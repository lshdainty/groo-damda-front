// 할 일 빈 상태가 **있는 것**을 가리키는지 본다 (QA #133).
//
// 빠른 추가 입력칸을 없앴는데(D5) 빈 상태 문구는 `위 입력칸으로 빠르게 추가해보세요`
// 로 남아 있었다 — 없는 칸을 가리키니 읽는 사람은 자기가 못 찾는 줄 안다.
//
// 그래서 문구를 글자로 박아 두고 비교하지 않는다. **문구가 부르는 이름의 버튼이
// 같은 화면에 실제로 있는지**를 본다 — 버튼을 옮기거나 이름을 바꾸면 여기서 걸린다.
// 문구만 고치고 화면을 안 보면 같은 결함이 다시 난다.
//
// 데스크톱만 본다. 모바일은 원장(`TodoMobileLedger`)이 자기 빈 상태를 따로 그리고
// 그쪽은 Fab 을 가리킨다(`tdm.emptyMonthDesc`).
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";
import type { Todo } from "@/entities/todo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/**
 * 번역 원본은 CSV 하나다(`src/locales/**` 는 생성물) — 그래서 여기서도 CSV 를 읽는다.
 * 생성물을 읽으면 `i18n:generate` 를 안 돌린 채로도 초록불이 난다.
 */
function koCopy(namespace: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync("i18n/translations.csv", "utf-8").split(
    "\n",
  )) {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += c;
    }
    cells.push(cur);
    const [ns, key, ko] = cells;
    if (ns === namespace && key) out[key] = ko ?? "";
  }
  return out;
}

const todoKo = koCopy("todo");

/** CSV 에서 문구 하나 — 키가 없어졌으면 조용히 통과하지 않고 멈춘다. */
function copyOf(key: string): string {
  const v = todoKo[key];
  if (!v) throw new Error(`CSV 에 todo,${key} 가 없다`);
  return v;
}

const ctx = vi.hoisted(() => ({ mobile: false }));
const state = vi.hoisted(() => ({ todos: [] as Todo[] }));

// 화면에 진짜 문구가 나와야 "가리키는 것이 있는가" 를 볼 수 있다 — 키를 그대로
// 돌려주는 흔한 mock 으로는 이 테스트가 성립하지 않는다.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "ko" },
    t: (k: string, opts?: Record<string, unknown>) => {
      const raw = todoKo[k];
      if (raw == null) return k;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        String(opts?.[name] ?? ""),
      );
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: ctx.mobile, onAddTx: () => {} }),
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
vi.mock("./TodoMobileLedger", () => ({ TodoMobileLedger: () => null }));

const { TodoPage } = await import("./TodoPage");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  ctx.mobile = false;
  state.todos = [];
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

describe("할 일 빈 상태 안내 (QA #133)", () => {
  it("빈 상태 문구가 부르는 버튼이 같은 화면에 실제로 있다", () => {
    act(() => root.render(<TodoPage />));

    const desc = copyOf("tdm.emptyMonthDescWide");
    expect(container.textContent).toContain(desc);

    // 화면에 있는 버튼 이름 중 하나를 문구가 부르고 있어야 한다.
    const labels = [...container.querySelectorAll("button")]
      .map((b) => b.textContent?.trim() ?? "")
      .filter(Boolean);
    const named = labels.filter((l) => desc.includes(l));

    expect(named).not.toEqual([]);
  });

  it("없어진 빠른 추가 입력칸을 가리키지 않는다 — 그 칸은 화면에 없다", () => {
    act(() => root.render(<TodoPage />));

    const desc = copyOf("tdm.emptyMonthDescWide");
    expect(desc).not.toContain("입력칸");

    // 반대편 — 정말로 없다. 있으면 문구를 되돌리는 게 맞는 수정이 된다.
    const textInputs = [...container.querySelectorAll("input")].filter(
      (el) => el.type !== "checkbox" && el.type !== "radio",
    );
    expect(textInputs).toEqual([]);
  });

  it("모바일은 원장이 자기 빈 상태를 그린다 — 데스크톱 문구가 안 쓰인다", () => {
    ctx.mobile = true;
    act(() => root.render(<TodoPage />));

    expect(container.textContent).not.toContain(
      copyOf("tdm.emptyMonthDescWide"),
    );
  });
});
