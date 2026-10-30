// 메모 화면 모델 — 거르기 · 상세 · 고정 · 저장 실패의 흐름(검수 M1 · M4 · L6 · L7 · L8). 훅은 가짜로 대신하고 화면 모델만 본다.
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Memo } from "@/entities/memo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  memos: [] as Memo[],
  update: vi.fn(),
  create: vi.fn(),
  toggle: vi.fn(),
  del: vi.fn(),
  show: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("@/shared/ds/snackbar", () => ({
  useSnackbar: () => ({ show: state.show, dismiss: () => {} }),
}));
vi.mock("@/features/memo-tag", () => ({
  useMemoTags: () => ({
    data: [{ rowId: 1, tagName: "독서", color: "#2d8060" }],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/features/memo", () => ({
  useMemos: () => ({
    data: state.memos,
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
  useCreateMemo: () => ({ mutateAsync: state.create, isPending: false }),
  useUpdateMemo: () => ({ mutateAsync: state.update, isPending: false }),
  useToggleMemoPin: () => ({
    mutateAsync: state.toggle,
    pendingIds: new Set<number>(),
  }),
  useDeleteMemo: () => ({ mutateAsync: state.del, isPending: false }),
}));

const { useMemoScreen } = await import("./use-memo-screen");

const memo = (rowId: number, o: Partial<Memo> = {}): Memo => ({
  rowId,
  title: `메모 ${rowId}`,
  content: null,
  tag: null,
  color: null,
  isPinned: false,
  createAt: "2026-10-01T00:00:00",
  modifyAt: `2026-10-0${rowId}T00:00:00`,
  ...o,
});

const seen: { screen: ReturnType<typeof useMemoScreen> | null } = {
  screen: null,
};
// 화면 모델 값을 효과에서 내보낸다 — 렌더 중에 바깥 값을 바꾸지 않는다
function Probe() {
  const s = useMemoScreen();
  useEffect(() => {
    seen.screen = s;
  });
  return null;
}
const cur = () => seen.screen!;
let container: HTMLDivElement;
let root: Root;
const mount = () => act(() => root.render(<Probe />));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.memos = [memo(1, { tag: "독서" }), memo(2), memo(3)];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useMemoScreen", () => {
  it("거르던 태그의 마지막 메모가 사라지면 전체로 돌아간다(M4)", () => {
    mount();
    act(() => cur().setTagFilter("독서"));
    expect(cur().tagFilter).toBe("독서");
    state.memos = [memo(2), memo(3)];
    mount();
    expect(cur().tagFilter).toBe("all");
    expect(cur().filtered).toHaveLength(2);
  });

  it("상세는 지운 메모를 계속 그리지 않는다 — 다시 시도로 지운 뒤에도 닫힌다(M1)", () => {
    mount();
    act(() => cur().setViewing(state.memos[1]!));
    expect(cur().viewing?.rowId).toBe(2);
    state.memos = [state.memos[0]!, state.memos[2]!];
    mount();
    expect(cur().viewing).toBeNull();
  });

  it("고정 요청이 도는 동안 같은 메모의 고정을 다시 누르면 토글이 한 번만 나간다(L6)", async () => {
    mount();
    let release: () => void = () => {};
    state.toggle.mockReturnValue(new Promise<void>((r) => (release = r)));
    let first!: Promise<boolean>;
    await act(async () => {
      first = cur().pinOf(state.memos[0]!);
      await cur().pinOf(state.memos[0]!);
    });
    expect(state.toggle).toHaveBeenCalledTimes(1);
    release();
    await act(async () => void (await first));
  });

  it("고정은 폼을 연 때의 값과 달라졌을 때만 부른다(L7)", async () => {
    mount();
    state.update.mockResolvedValue(state.memos[0]!);
    state.toggle.mockResolvedValue(state.memos[0]!);
    await act(async () => {
      await cur().save({ title: "a" }, 1, false, false);
    });
    expect(state.toggle).not.toHaveBeenCalled();
    await act(async () => {
      await cur().save({ title: "a" }, 1, true, false);
    });
    expect(state.toggle).toHaveBeenCalledTimes(1);
  });

  it("저장 중 폼을 닫은 뒤 실패하면 스낵바 + 다시 시도로 알린다(L8)", async () => {
    mount();
    act(() => cur().openEditor({ _new: true }));
    let fail: (e: unknown) => void = () => {};
    state.create.mockReturnValue(new Promise((_, rej) => (fail = rej)));
    let p!: Promise<void>;
    act(() => {
      p = cur().save({ title: "새" }, undefined, false, false);
    });
    act(() => cur().closeEditor());
    await act(async () => {
      fail(new Error("서버"));
      await p;
    });
    expect(cur().saveError).toBe(false);
    expect(state.show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "critical" }),
    );
  });

  it("폼이 열린 채 저장이 실패하면 폼 Callout 신호만 켠다 — 스낵바 없음", async () => {
    mount();
    act(() => cur().openEditor({ _new: true }));
    state.create.mockRejectedValue(new Error("서버"));
    await act(async () => {
      await cur().save({ title: "새" }, undefined, false, false);
    });
    expect(cur().saveError).toBe(true);
    expect(cur().saveErrorSeq).toBe(1);
    expect(state.show).not.toHaveBeenCalled();
  });
});
