// 저장하는 동안은 닫지 않는다(I-wrap-b2b 1) — 부모가 닫을 때 reset() 하는 폼의 대표로 할 일을 실제 뮤테이션(TanStack)으로 돌린다.
//
// 잠그는 것: 저장이 나가 있는 동안 Esc 로 닫히지 않고 → 실패하면 폼 맨 위 Callout + 친 값 →
// 닫고(reset) 다시 열어 저장하면 요청이 다시 나간다. 예전에는 저장 중에 닫히면 reset() 이 관찰자를 떼어
// 호출별 onSettled 가 불리지 않았고, 이중 제출 가드(savingRef)가 켜진 채 남아 다음 저장이 조용히 나가지 않았다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetPointerBlockForTest } from "@/shared/lib/groo/pointer-block";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const calls = vi.hoisted(() => ({
  create: [] as Array<{
    values: Record<string, unknown>;
    resolve: () => void;
    reject: (e: unknown) => void;
  }>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ mobile: false, onAddTx: () => {} }),
  useNavigate: () => () => {},
}));
vi.mock("@/features/todo", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  const idle = () => ({
    mutate: () => {},
    isPending: false,
    reset: () => {},
    isError: false,
    error: null,
  });
  return {
    useTodos: () => ({ data: [], isLoading: false }),
    // 만들기만 진짜 뮤테이션 — 응답은 시험이 붙잡았다가 resolve · reject 한다
    useCreateTodo: () =>
      useMutation({
        mutationFn: (values: Record<string, unknown>) =>
          new Promise<void>((resolve, reject) => {
            calls.create.push({ values, resolve, reject });
          }),
      }),
    useUpdateTodo: idle,
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
  };
});
vi.mock("@/features/todo-tag", () => ({ useTodoTags: () => ({ data: [] }) }));
vi.mock("@/features/constellation", () => ({
  useConstellationToday: () => ({ data: undefined }),
  useConstellationSky: () => ({ data: [] }),
}));
vi.mock("@/widgets/constellation", () => ({}));
vi.mock("./TodoMobileLedger", () => ({ TodoMobileLedger: () => null }));

vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({ show: () => {}, dismiss: () => {} }),
}));
const { TodoPage } = await import("./TodoPage");

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  __resetPointerBlockForTest();
  calls.create.length = 0;
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  client.clear();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const buttonWith = (label: string) =>
  [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
const sheet = () =>
  document.querySelector<HTMLElement>("[data-slot=bottom-sheet-content]");
const titleInput = () =>
  document.body.querySelector<HTMLInputElement>(
    'input[placeholder="editTitlePlaceholder"]',
  );
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
const esc = () =>
  act(() => {
    sheet()!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
// 확인창 "작성한 내용이 사라져요" 가 뜨면 [나가기]
const leaveIfAsked = () => {
  const leave = [
    ...document.querySelectorAll<HTMLButtonElement>(
      "[role=alertdialog] button",
    ),
  ].find((b) => b.textContent === "나가기");
  if (leave) act(() => leave.click());
};

async function openAndSave(title: string) {
  act(() => buttonWith("newTodo")!.click());
  await tick();
  setInput(titleInput()!, title);
  act(() => buttonWith("add")!.click());
  await tick();
}

describe("할 일 — 저장 중 닫기 · 실패 뒤 다시 저장(실제 뮤테이션)", () => {
  it("저장 중 Esc 는 닫지 않고, 실패하면 Callout + 친 값 → 닫고 다시 열어 저장하면 요청이 다시 나간다", async () => {
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <TodoPage />
        </QueryClientProvider>,
      ),
    );
    await openAndSave("세금 신고");
    expect(calls.create).toHaveLength(1);

    // 저장 중 — Esc 를 눌러도 시트는 그대로, 확인창도 뜨지 않는다
    esc();
    await tick();
    expect(sheet()).not.toBeNull();
    expect(document.querySelector("[role=alertdialog]")).toBeNull();

    // 실패 — 폼 맨 위 Callout(고정 글), 친 값은 남는다
    await act(async () => calls.create[0]!.reject(new Error("500")));
    await tick();
    expect(document.querySelector("[role=alert]")?.textContent).toBe(
      "saveFailed",
    );
    expect(titleInput()!.value).toBe("세금 신고");

    // 닫는다(부모가 reset) — 바뀐 값이 있어 물으면 [나가기]
    esc();
    await tick();
    leaveIfAsked();
    await tick();
    expect(sheet()).toBeNull();

    // 다시 열어 저장 — 요청이 다시 나간다(이중 제출 가드가 갇히지 않았다)
    await openAndSave("세금 신고");
    expect(calls.create).toHaveLength(2);
    await act(async () => calls.create[1]!.resolve());
    await tick();
    expect(sheet()).toBeNull();
  });
});
