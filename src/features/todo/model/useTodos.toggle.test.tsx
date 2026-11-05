// 완료 체크 낙관 갱신 — 실패하면 되돌리고 우리 글로 알린다(서버 원문 토스트 없음 · I-10 14).
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Todo } from "@/entities/todo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const h = vi.hoisted(() => ({
  fail: false,
  toasts: [] as string[],
  config: undefined as unknown,
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({
    show: (o: { message: string; tone?: string }) =>
      h.toasts.push(`${o.tone}:${o.message}`),
    dismiss: () => {},
  }),
}));
vi.mock("../api/todoApi", () => ({
  todoApi: {
    toggleTodoStatus: async () => {
      if (h.fail) throw new Error("서버 원문");
      return {};
    },
  },
}));

const { useToggleTodoStatus } = await import("./useTodos");
const { i18n } = await import("@/shared/i18n/config");
const { todoKeys } = await import("@/shared/config");

const todo = (status: Todo["status"]) =>
  ({ rowId: 1, status, completedAt: null }) as Todo;

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
const holder: { api: ReturnType<typeof useToggleTodoStatus> | null } = {
  api: null,
};

function Probe() {
  const a = useToggleTodoStatus();
  useEffect(() => {
    holder.api = a;
  });
  return null;
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage("ko");
  h.fail = false;
  h.toasts = [];
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(todoKeys.list(undefined), [todo("PENDING")]);
  container = document.createElement("div");
  root = createRoot(container);
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
});
afterEach(() => act(() => root.unmount()));

describe("useToggleTodoStatus", () => {
  it("실패하면 되돌리고 새 글로 알린다 — 서버 원문은 띄우지 않는다", async () => {
    h.fail = true;
    await act(async () => {
      holder.api!.mutate(1);
    });
    const list = qc.getQueryData<Todo[]>(todoKeys.list(undefined))!;
    expect(list[0]!.status).toBe("PENDING");
    expect(h.toasts).toEqual([
      "critical:완료로 바꾸지 못했어요. 잠시 후 다시 시도해주세요.",
    ]);
  });

  it("성공하면 알리지 않는다", async () => {
    await act(async () => {
      holder.api!.mutate(1);
    });
    expect(h.toasts).toEqual([]);
  });
});
