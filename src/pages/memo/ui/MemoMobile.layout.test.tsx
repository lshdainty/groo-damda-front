// 메모 폰 — 화면 전체 결과(실패 · 메모 0 · 검색 0건)는 검색칸 · 칩 줄 아래 남은 자리의 세로 가운데에 선다
// (groo-design result-section.md "놓인 자리의 가운데"). jsdom 은 배치를 재지 않는다 — 가운데를 만드는 구조를 잠근다:
// 흰 면이 세로 flex 로 남은 높이를 채우고(flex-1), 결과(ResultSection — grow)가 그 바로 아래 자식이다.
// 목록 · 스켈레톤은 늘지 않고 아래 96(떠 있는 [+] 자리)을 그대로 갖는다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SwipeActionsProvider } from "@/shared/ds/swipe-actions";
import type { Memo } from "@/entities/memo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { MemoMobile } = await import("./MemoMobile");

const memo = (rowId: number, o: Partial<Memo> = {}): Memo => ({
  rowId,
  title: `메모 ${rowId}`,
  content: "본문 한 줄",
  tag: null,
  color: "#2d8060",
  isPinned: false,
  createAt: "2026-10-01T00:00:00",
  modifyAt: "2026-10-22T08:10:00",
  ...o,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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

function fakeScreen(o: Record<string, unknown> = {}) {
  const memos = [memo(1, { isPinned: true }), memo(2)];
  return {
    memos,
    query: "",
    setQuery: vi.fn(),
    tagFilter: "all",
    setTagFilter: vi.fn(),
    chips: [],
    tagColors: new Map(),
    pinned: [memos[0]!],
    others: [memos[1]!],
    filtered: memos,
    loading: false,
    failed: false,
    setViewing: vi.fn(),
    openEditor: vi.fn(),
    pinOf: vi.fn(),
    remove: vi.fn(),
    memosQ: { refetch: vi.fn() },
    ...o,
  } as never;
}

const render = (screen: never) =>
  act(() =>
    root.render(
      <MemoryRouter>
        <SwipeActionsProvider>
          <MemoMobile screen={screen} />
        </SwipeActionsProvider>
      </MemoryRouter>,
    ),
  );

const face = () =>
  container.querySelector<HTMLElement>("[data-slot=memo-phone]")!;
const classes = (el: Element) => el.getAttribute("class")?.split(/\s+/) ?? [];

describe.each([
  ["메모 0", { memos: [], pinned: [], others: [], filtered: [] }, "noMemos"],
  ["불러오기 실패", { failed: true, memos: [] }, "loadFailed"],
  [
    "검색 0건",
    { query: "없는 말", pinned: [], others: [], filtered: [] },
    "noResults",
  ],
])("결과 — %s", (_name, over, title) => {
  it("흰 면이 세로 flex 로 남은 높이를 채우고, 결과가 그 바로 아래 자식이다", () => {
    render(fakeScreen(over));
    const f = face();
    expect(classes(f)).toEqual(
      expect.arrayContaining(["flex", "flex-1", "flex-col"]),
    );
    // 결과일 때는 아래 96 을 두지 않는다 — 두면 가운데가 48 위로 밀린다(앱도 목록 · 스켈레톤에만 둔다)
    expect(classes(f)).not.toContain("pb-[96px]");
    const result = f.querySelector<HTMLElement>(
      ":scope > [data-slot=result-section]",
    );
    expect(result).not.toBeNull();
    expect(classes(result!)).toContain("grow");
    expect(result!.textContent).toContain(title);
    // 검색칸은 결과 위에 그대로 — 결과보다 앞 형제이고 늘지 않는다
    const input = f.querySelector("input")!;
    const search = Array.from(f.children).find((c) => c.contains(input))!;
    expect(
      search.compareDocumentPosition(result!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(classes(search)).not.toContain("grow");
    expect(classes(search)).not.toContain("flex-1");
  });
});

describe("목록 — 배치는 그대로", () => {
  it("아래 96 을 갖고, 늘어나는 자식(grow · flex-1)이 없다", () => {
    render(fakeScreen());
    const f = face();
    expect(classes(f)).toContain("pb-[96px]");
    expect(f.querySelector("[data-slot=result-section]")).toBeNull();
    for (const child of Array.from(f.children)) {
      expect(classes(child)).not.toContain("grow");
      expect(classes(child)).not.toContain("flex-1");
    }
    expect(f.querySelectorAll(":scope > section")).toHaveLength(2);
  });
  it("불러오는 중(스켈레톤)도 아래 96 · 늘지 않는다", () => {
    render(fakeScreen({ loading: true, memos: [], filtered: [] }));
    const f = face();
    expect(classes(f)).toContain("pb-[96px]");
    expect(f.querySelector("[data-slot=result-section]")).toBeNull();
    const busy = f.querySelector<HTMLElement>(":scope > [aria-busy=true]")!;
    expect(classes(busy)).not.toContain("grow");
  });
});
