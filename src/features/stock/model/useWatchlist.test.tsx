// 관심목록 그룹 상태는 토스 페이지 안에 있던 것을 나무와 공용으로 끌어냈고,
// 그러면서 "이펙트로 되돌려 맞추기" 를 "유도하기" 로 바꿨다.
// 겉보기 동작이 그대로인지 — 특히 **그룹이 지워졌을 때** 되돌아가는지 — 를 고정한다.
import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchGroup } from "../api/stockApi";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const state = vi.hoisted(() => ({
  groups: [] as unknown[],
  // 그룹 질의 상태 — ok | loading(아직) | error(실패, 받아 둔 값 없음)
  q: "ok" as "ok" | "loading" | "error",
  createGroup: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  refetch: vi.fn(),
  snack: [] as Array<{
    message: string;
    tone?: string;
    action?: { onClick: () => void };
  }>,
  opts: [] as unknown[],
  entries: [] as Array<{ item: { rowId: number } }>,
  failIds: [] as number[],
  addResult: "ok" as "ok" | "fail",
  createResult: "ok" as "ok" | "fail",
}));

vi.mock("../api/watchlistApi", () => ({
  useWatchGroups: () => ({
    data: state.q === "ok" ? state.groups : undefined,
    isLoading: state.q === "loading",
    isError: state.q === "error",
    refetch: state.refetch,
  }),
  useCreateWatchGroup: (o?: unknown) => {
    state.opts.push(o);
    return {
      mutate: state.createGroup,
      mutateAsync: (...a: unknown[]) => {
        state.createGroup(...a);
        return state.createResult === "ok"
          ? Promise.resolve({ rowId: 77 })
          : Promise.reject(new Error("x"));
      },
    };
  },
  useAddWatchItem: (o?: unknown) => {
    state.opts.push(o);
    return {
      mutate: state.addItem,
      mutateAsync: (...a: unknown[]) => {
        state.addItem(...a);
        return state.addResult === "ok"
          ? Promise.resolve({})
          : Promise.reject(new Error("x"));
      },
    };
  },
  useRemoveWatchItem: (o?: unknown) => {
    state.opts.push(o);
    return {
      mutate: state.removeItem,
      mutateAsync: (id: number) => {
        state.removeItem(id);
        return state.failIds.includes(id)
          ? Promise.reject(new Error("x"))
          : Promise.resolve();
      },
    };
  },
  findWatchEntries: () => state.entries,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: { message: string; tone?: string }) => state.snack.push(o),
    dismiss: () => {},
  }),
}));

const { useWatchlist } = await import("./useWatchlist");

const group = (rowId: number, name: string, symbols: string[]): WatchGroup => ({
  rowId,
  groupName: name,
  sortOrder: rowId,
  items: symbols.map((symbol, i) => ({
    rowId: rowId * 100 + i,
    stockMasterRowId: i,
    countryCode: "KR",
    marketCode: "KOSPI",
    symbol,
    nameKr: symbol,
    nameEn: null,
    securityType: "STOCK" as const,
    currency: "KRW",
  })),
});

let container: HTMLDivElement;
let root: Root;
let seen: ReturnType<typeof useWatchlist>;

function Probe() {
  // 렌더 중에 바깥 변수를 쓰면 부수효과다 — `act` 가 effect 까지 흘려 주므로
  // 커밋 뒤에 담아도 테스트가 읽는 시점엔 이미 채워져 있다.
  const value = useWatchlist();
  useEffect(() => {
    seen = value;
  });
  return null;
}

const render = (node: ReactNode) => act(() => root.render(node));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  state.groups = [];
  state.q = "ok";
  state.createGroup.mockClear();
  state.addItem.mockClear();
  state.removeItem.mockClear();
  state.refetch.mockClear();
  state.snack = [];
  state.opts = [];
  state.entries = [];
  state.failIds = [];
  state.addResult = "ok";
  state.createResult = "ok";
});

describe("useWatchlist 의 열린 그룹", () => {
  it("그룹이 없으면 열린 그룹도 없다", () => {
    state.groups = [];
    render(<Probe />);
    expect(seen.activeGroup).toBeNull();
    expect(seen.activeGroupId).toBeNull();
  });

  it("처음에는 첫 그룹이 열린다 — 이펙트를 한 번 더 돌지 않고 첫 렌더에 바로", () => {
    state.groups = [group(1, "관심", ["005930"]), group(2, "해외", ["AAPL"])];
    render(<Probe />);
    expect(seen.activeGroupId).toBe(1);
  });

  it("고른 그룹이 열린다", () => {
    state.groups = [group(1, "관심", ["005930"]), group(2, "해외", ["AAPL"])];
    render(<Probe />);
    act(() => seen.setActiveGroupId(2));
    expect(seen.activeGroupId).toBe(2);
  });

  it("고른 그룹이 지워지면 첫 그룹으로 접힌다 — 빈 목록이 남으면 안 된다", () => {
    state.groups = [group(1, "관심", ["005930"]), group(2, "해외", ["AAPL"])];
    render(<Probe />);
    act(() => seen.setActiveGroupId(2));
    expect(seen.activeGroupId).toBe(2);

    state.groups = [group(1, "관심", ["005930"])];
    render(<Probe />);
    expect(seen.activeGroupId).toBe(1);
  });

  it("별 판정은 전 그룹을 합친다 — 어느 그룹에 있든 별이다", () => {
    state.groups = [group(1, "관심", ["005930"]), group(2, "해외", ["AAPL"])];
    render(<Probe />);
    expect(seen.watchedSymbols).toEqual(new Set(["005930", "AAPL"]));
    expect(seen.isWatched("AAPL")).toBe(true);
    expect(seen.isWatched("000660")).toBe(false);
  });
});

describe("그룹 질의가 아직이거나 실패했을 때 별 — 기본 그룹을 새로 만들지 않는다(검수 M3)", () => {
  it("로딩 중에는 별을 눌러도 아무것도 만들지 않고 ready 가 false", () => {
    state.q = "loading";
    render(<Probe />);
    expect(seen.ready).toBe(false);
    expect(seen.failed).toBe(false);
    act(() => seen.toggleWatch("005930", "KOSPI"));
    expect(state.createGroup).not.toHaveBeenCalled();
    expect(state.addItem).not.toHaveBeenCalled();
    expect(state.snack).toHaveLength(0);
  });

  it("실패했으면 아무것도 만들지 않고 실패를 알리며 다시 받는다", () => {
    state.q = "error";
    render(<Probe />);
    expect(seen.failed).toBe(true);
    act(() => seen.toggleWatch("005930", "KOSPI"));
    expect(state.createGroup).not.toHaveBeenCalled();
    expect(state.addItem).not.toHaveBeenCalled();
    expect(state.snack[0]).toMatchObject({
      message: "watch.addFail",
      tone: "critical",
    });
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it("받았고 그룹이 정말 0 개일 때만 기본 그룹부터 만든다", () => {
    state.groups = [];
    render(<Probe />);
    expect(seen.ready).toBe(true);
    act(() => seen.toggleWatch("005930", "KOSPI"));
    expect(state.createGroup).toHaveBeenCalledTimes(1);
  });

  it("요청은 silent — 서버 원문 토스트가 안 뜬다", () => {
    render(<Probe />);
    expect(state.opts.length).toBeGreaterThan(0);
    for (const o of state.opts) expect(o).toEqual({ silent: true });
  });

  it("넣기가 실패하면 스낵바 + [다시 시도] 가 같은 그룹에 넣기만 다시 한다", async () => {
    state.groups = [group(1, "관심", [])];
    state.addResult = "fail";
    render(<Probe />);
    await act(async () => seen.toggleWatch("005930", "KOSPI"));
    expect(state.snack).toHaveLength(1);
    expect(state.snack[0]).toMatchObject({
      message: "watch.addFail",
      tone: "critical",
    });
    state.addResult = "ok";
    await act(async () => state.snack[0]!.action!.onClick());
    expect(state.addItem).toHaveBeenCalledTimes(2);
    expect(state.createGroup).not.toHaveBeenCalled();
  });

  it("첫 등록에서 그룹은 만들어졌는데 넣기가 실패하면 다시 시도는 넣기만 다시 한다", async () => {
    state.groups = [];
    state.addResult = "fail";
    render(<Probe />);
    await act(async () => seen.toggleWatch("005930", "KOSPI"));
    expect(state.snack).toHaveLength(1);
    state.addResult = "ok";
    await act(async () => state.snack[0]!.action!.onClick());
    expect(state.createGroup).toHaveBeenCalledTimes(1);
    expect(state.addItem).toHaveBeenCalledTimes(2);
    expect(state.addItem.mock.calls[1]![0]).toMatchObject({ groupId: 77 });
  });

  it("그룹이 있으면 새로 만들지 않고 그 그룹에 넣는다", () => {
    state.groups = [group(1, "관심", [])];
    render(<Probe />);
    act(() => seen.toggleWatch("005930", "KOSPI"));
    expect(state.createGroup).not.toHaveBeenCalled();
    expect(state.addItem).toHaveBeenCalledTimes(1);
  });

  it("별 해제가 일부 그룹만 실패하면 스낵바 하나 + [다시 시도] 가 남은 것만 다시 지운다", async () => {
    state.groups = [
      group(1, "관심", ["005930"]),
      group(2, "반도체", ["005930"]),
    ];
    state.entries = [{ item: { rowId: 100 } }, { item: { rowId: 200 } }];
    state.failIds = [200];
    render(<Probe />);
    await act(async () => seen.toggleWatch("005930", "KOSPI"));
    expect(state.removeItem).toHaveBeenCalledTimes(2);
    expect(state.snack).toHaveLength(1);
    expect(state.snack[0]).toMatchObject({
      message: "watch.removeFail",
      tone: "critical",
    });
    state.failIds = [];
    await act(async () => state.snack[0]!.action!.onClick());
    expect(state.removeItem).toHaveBeenCalledTimes(3);
    expect(state.removeItem.mock.calls[2]![0]).toBe(200);
  });
});
