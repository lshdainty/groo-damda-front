// 메모 넓은 화면(I-15 15 ~ 19, 2-B) — 실제 부품을 띄운 채로 잠근다. 번역은 CSV 원본에서 읽는다.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Memo } from "@/entities/memo";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function koCopy(): Record<string, string> {
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
    if ((ns === "memo" || ns === "common") && key)
      out[`${ns}:${key}`] = ko ?? "";
  }
  return out;
}
const COPY = koCopy();

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      const raw = COPY[`${ns ?? "common"}:${k}`];
      if (raw == null) return k;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        String(opts?.[name] ?? ""),
      );
    },
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { MemoDesktop } = await import("./MemoDesktop");

const memo = (rowId: number, o: Partial<Memo> = {}): Memo => ({
  rowId,
  title: `메모 ${rowId}`,
  content: "본문 한 줄",
  tag: rowId === 1 ? "독서" : null,
  color: "#2d8060",
  isPinned: rowId === 1,
  createAt: "2026-10-01T00:00:00",
  modifyAt: "2026-10-22T08:10:00",
  ...o,
});

let container: HTMLDivElement;
let root: Root;
const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
};

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
  const memos = [memo(1), memo(2), memo(3, { tag: "독서" })];
  const state = { tagFilter: "all" };
  return {
    memos,
    query: "",
    setQuery: vi.fn(),
    tagFilter: state.tagFilter,
    setTagFilter: vi.fn(),
    chips: [
      { key: "독서", count: 2 },
      { key: "\uFFFF", count: 1 },
    ],
    tagColors: new Map([["독서", "#2d8060"]]),
    pinned: [memos[0]!],
    others: [memos[1]!, memos[2]!],
    filtered: memos,
    loading: false,
    failed: false,
    setViewing: vi.fn(),
    openEditor: vi.fn(),
    memosQ: { refetch: vi.fn() },
    ...o,
  } as never;
}

const render = (screen: never) =>
  act(() =>
    root.render(
      <MemoryRouter>
        <MemoDesktop screen={screen} />
      </MemoryRouter>,
    ),
  );

describe("MemoDesktop (I-15 15 ~ 19)", () => {
  it("1280 이상: 왼쪽 칸 태그 줄(하나 고르기 radio · 건수)과 '관리', 오른쪽 목록 카드 — 칩 줄은 없다", () => {
    setWide(true);
    render(fakeScreen());
    const rail = container.querySelector("[role=radiogroup]")!;
    expect(rail.querySelectorAll("[role=radio]")).toHaveLength(3);
    expect(rail.textContent).toContain("전체");
    expect(container.querySelector("[data-slot=memo-left]")).toBeTruthy();
    expect(container.textContent).toContain("관리");
    expect(container.querySelector("[data-slot=chip]")).toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("메모");
  });

  it("태그 줄을 누르면 거르기가 바뀐다 · 고른 줄은 aria-checked", () => {
    setWide(true);
    const screen = fakeScreen();
    render(screen);
    const radios = container.querySelectorAll<HTMLElement>("[role=radio]");
    expect(radios[0]!.getAttribute("aria-checked")).toBe("true");
    act(() => radios[1]!.click());
    expect(
      (screen as unknown as { setTagFilter: ReturnType<typeof vi.fn> })
        .setTagFilter,
    ).toHaveBeenCalledWith("독서");
  });

  it("768 ~ 1279: 왼쪽 칸 없이 한 카드 안 검색칸 · 칩 줄 · 묶음", () => {
    setWide(false);
    render(fakeScreen());
    expect(container.querySelector("[data-slot=memo-left]")).toBeNull();
    expect(container.querySelectorAll("[data-slot=chip]").length).toBe(3);
    expect(container.querySelectorAll("[data-slot=card]")).toHaveLength(1);
  });

  it("줄: 본문 두 줄(line-clamp-2) · 줄 끝 ⋮ 없음 · 누르면 상세", () => {
    setWide(true);
    const screen = fakeScreen();
    render(screen);
    expect(
      container.querySelector("[data-slot=memo-body]")?.className,
    ).toContain("line-clamp-2");
    expect(container.querySelector('button[aria-label$="더보기"]')).toBeNull();
    // 넓은 화면은 왼쪽 태그 칸도 List 줄이다(97bcdb01) — 메모 줄(본문이 든 줄)을 누른다
    const memoRow = container
      .querySelector("[data-slot=memo-body]")!
      .closest<HTMLElement>("[data-slot=list-body]")!;
    act(() => memoRow.click());
    expect(
      (screen as unknown as { setViewing: ReturnType<typeof vi.fn> })
        .setViewing,
    ).toHaveBeenCalled();
  });

  it("묶음 제목 · 개수, 고정이 0 이면 '모든 메모' 제목을 두지 않는다", () => {
    setWide(true);
    render(fakeScreen());
    const heads = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent,
    );
    expect(heads).toContain("고정 · 1");
    expect(heads).toContain("모든 메모 · 2");
    act(() => root.unmount());
    root = createRoot(container);
    const m = [memo(2)];
    render(fakeScreen({ pinned: [], others: m, filtered: m, memos: m }));
    expect(
      Array.from(container.querySelectorAll("h2"))
        .map((h) => h.textContent)
        .join(),
    ).not.toContain("모든 메모");
  });

  it("실패는 카드 안 Result Section + 다시 시도 · 0 건은 안내 글", () => {
    setWide(true);
    const refetch = vi.fn();
    render(fakeScreen({ failed: true, memosQ: { refetch } }));
    expect(container.textContent).toContain("메모를 불러오지 못했어요");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "다시 시도",
    )!;
    act(() => retry.click());
    expect(refetch).toHaveBeenCalled();
  });

  it("[메모 추가] 는 제목 줄의 neutralOutline small 이고 새 폼을 연다", () => {
    setWide(true);
    const screen = fakeScreen();
    render(screen);
    const add = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "메모 추가",
    )!;
    act(() => add.click());
    expect(
      (screen as unknown as { openEditor: ReturnType<typeof vi.fn> })
        .openEditor,
    ).toHaveBeenCalledWith({ _new: true });
  });

  it("태그 줄은 로빙 — 고른 줄만 Tab 멈춤이고 ↓ 로 옮기며 고른다", () => {
    setWide(true);
    const screen = fakeScreen();
    render(screen);
    const radios = Array.from(
      container.querySelectorAll<HTMLElement>("[role=radio]"),
    );
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0]!.focus();
    act(() => {
      radios[0]!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    });
    expect(
      (screen as unknown as { setTagFilter: ReturnType<typeof vi.fn> })
        .setTagFilter,
    ).toHaveBeenCalledWith("독서");
    expect(container.querySelector("[data-slot=list]")?.tagName).not.toBe("UL");
  });

  it("불러오는 동안에도 틀(검색칸 · 태그 제목 · 관리 링크)은 그리고 태그 줄 자리만 Skeleton", () => {
    setWide(true);
    render(
      fakeScreen({
        loading: true,
        memos: [],
        filtered: [],
        pinned: [],
        others: [],
      }),
    );
    expect(container.querySelector("input")).toBeTruthy();
    expect(
      Array.from(container.querySelectorAll("h2")).map((h) => h.textContent),
    ).toContain("태그");
    expect(container.querySelector("[aria-busy=true]")).toBeTruthy();
    expect(container.querySelector("[role=radio]")).toBeNull();
  });

  it("메모가 0건이어도 '관리' 는 링크로 보인다(태그 관리는 메모가 없어도 한다)", () => {
    setWide(true);
    render(fakeScreen({ memos: [], filtered: [], pinned: [], others: [] }));
    const link = container.querySelector<HTMLAnchorElement>(
      "a[href='/desk/settings?section=memo-tags']",
    );
    expect(link?.textContent).toBe("관리");
    expect(container.textContent).toContain("메모가 없어요");
  });

  it("검색 0건은 '결과가 없어요' 안내", () => {
    setWide(true);
    render(
      fakeScreen({ query: "없는글", filtered: [], pinned: [], others: [] }),
    );
    expect(container.textContent).toContain("결과가 없어요");
  });

  it("[메모 추가] 는 small 36 이고 파랑 채움이 아니다(neutralOutline)", () => {
    setWide(true);
    render(fakeScreen());
    const add = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "메모 추가",
    )!;
    expect(add.className).toContain("min-h-[36px]");
    expect(add.className).not.toContain("bg-bg-brand-solid");
  });

  it("768 ~ 1279 카드 위 검색칸은 따로 위 여백이 없다 — Card 본문 위 12 만(14 → 12)", () => {
    setWide(false);
    render(fakeScreen());
    expect(
      container.querySelector("input")?.closest("div.px-global-gutter")
        ?.className,
    ).not.toContain("pt-");
  });
});
