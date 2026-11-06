// 할 일 저장 · 삭제 실패(I-28-5 5) — 폼 맨 위 Callout 고정 글 · 삭제는 확인창을 닫고 스낵바 + [다시 시도].
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const snack: Array<{
  message: string;
  tone?: string;
  action?: { onClick: () => void };
}> = [];
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: { message: string }) => snack.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { TodoFormDialog } = await import("./TodoFormDialog");
const { TodoDeleteConfirm } = await import("./TodoDeleteConfirm");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  snack.length = 0;
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

describe("할 일 저장 실패", () => {
  it("실패하면 폼 맨 위 Callout 고정 글, 없으면 Callout 없음", async () => {
    const draw = (failed: boolean) =>
      act(() =>
        root.render(
          <TodoFormDialog
            todo={null}
            today="2026-10-29"
            tags={[]}
            onClose={() => {}}
            onSave={() => {}}
            saveFailed={failed}
            saveError={failed ? new Error("서버 원문 오류") : undefined}
          />,
        ),
      );
    await draw(false);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    await draw(true);
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "saveFailed",
    );
    expect(document.body.textContent).not.toContain("서버 원문 오류");
  });

  it("쓰기 결과를 확인하지 못했으면(응답을 못 읽음 · 응답 전에 끊김) 실패 글이 아니라 '저장됐는지 확인하지 못했어요'", async () => {
    const { WriteUnconfirmedError } = await import("@/shared/api/base");
    act(() =>
      root.render(
        <TodoFormDialog
          todo={null}
          today="2026-10-29"
          tags={[]}
          onClose={() => {}}
          onSave={() => {}}
          saveFailed
          saveError={new WriteUnconfirmedError(200)}
        />,
      ),
    );
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "query.saveUnconfirmed",
    );
  });
});

describe("할 일 삭제 실패", () => {
  it("확인창 [삭제] 가 실패하면 스낵바 + [다시 시도] 가 같은 삭제를 다시 한다", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("x"));
    await act(async () =>
      root.render(
        <TodoDeleteConfirm
          name="세금 신고"
          onConfirm={onConfirm}
          onClose={() => {}}
        />,
      ),
    );
    const del = Array.from(
      document.querySelectorAll<HTMLElement>('[role="alertdialog"] button'),
    ).find((b) => b.textContent === "delete")!;
    await act(async () => del.click());
    await act(async () => {});
    expect(snack).toHaveLength(1);
    expect(snack[0]).toMatchObject({
      message: "deleteFailed",
      tone: "critical",
    });
    onConfirm.mockResolvedValue(undefined);
    await act(async () => snack[0]!.action!.onClick());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
