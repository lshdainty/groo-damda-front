// 별빛 알림 — 손 토스트(useState + setTimeout + .star-toast)가 아니라 ds 스낵바(positive)가 알린다(I-wrap-b1 δ 2).
// 글은 결과 한 문장 + 마침표(snackbar v106). 서버가 돌려준 실제 적립량으로만 띄운다(0 이면 안 띄운다)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const h = vi.hoisted(() => ({
  earned: 3,
  sky: { goal: 5, points: 1, collected: false } as Record<string, unknown>,
  onToggle: null as null | ((td: { rowId: number }) => void),
  snacks: [] as { message: string; tone?: string }[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: true, onAddTx: () => {} }),
  useNavigate: () => () => {},
}));
vi.mock("@/features/todo", () => ({
  useTodos: () => ({ data: [], isLoading: false }),
  useCreateTodo: () => ({
    mutate: () => {},
    isPending: false,
    reset: () => {},
  }),
  useUpdateTodo: () => ({
    mutate: () => {},
    isPending: false,
    reset: () => {},
  }),
  useToggleTodoStatus: () => ({
    mutate: (
      _id: number,
      o: { onSuccess: (u: { earnedStarlight: number }) => void },
    ) => o.onSuccess({ earnedStarlight: h.earned }),
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
  useConstellationToday: () => ({ data: h.sky }),
  useConstellationSky: () => ({ data: [] }),
}));
vi.mock("@/widgets/constellation", () => ({}));
vi.mock("./TodoMobileLedger", () => ({
  TodoMobileLedger: (p: { onToggle: (td: { rowId: number }) => void }) => {
    h.onToggle = p.onToggle;
    return null;
  },
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: (typeof h.snacks)[number]) => h.snacks.push(o),
    dismiss: () => {},
  }),
}));
const { TodoPage } = await import("./TodoPage");

let container: HTMLDivElement;
let root: Root;
let id = 100;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  h.earned = 3;
  h.sky = { goal: 5, points: 1, collected: false };
  h.snacks.length = 0;
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<TodoPage />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
// 따닥 방어(같은 행 연속 누름)에 걸리지 않도록 행 번호를 바꿔 누른다
const complete = () => act(() => h.onToggle!({ rowId: id++ }));

describe("별빛 알림", () => {
  it("수집까지 남았으면 positive 스낵바로 알린다 — 손 토스트는 없다", () => {
    complete();
    expect(h.snacks).toEqual([
      { tone: "positive", message: 'starToast.progress{"gain":3,"left":1}' },
    ]);
    expect(document.querySelector(".star-toast")).toBeNull();
  });

  it("그날 별자리를 채우면 수집 글", () => {
    h.earned = 4;
    complete();
    expect(h.snacks[0]?.message).toBe('starToast.collected{"gain":4}');
  });

  it("적립이 0 이거나 이미 수집했으면 알리지 않는다", () => {
    h.earned = 0;
    complete();
    h.earned = 3;
    h.sky = { goal: 5, points: 1, collected: true };
    act(() => root.render(<TodoPage />));
    complete();
    expect(h.snacks).toEqual([]);
  });
});
