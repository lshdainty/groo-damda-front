// 폰 증권 조각의 동작 — 찾기(키보드 · 표면) · 그룹 폼(삭제 단추 없음 · 막힘 · 닫기 확인) · 그룹 제목 (I-13 P 절 13 ~ 16 · 24)
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WatchGroup } from "../../api/stockApi";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const mocks = vi.hoisted(() => ({
  results: [] as unknown[],
  // 검색 질의 상태 — 입력 뒤 300ms 동안 질의는 꺼져 있다(data 없음). keyword 가 올 때까지 undefined 로 준다
  search: "data" as "data" | "off" | "error",
  fetching: false,
  seen: [] as string[],
  create: vi.fn(),
  rename: vi.fn(),
  opts: [] as unknown[],
  failed: false,
  snack: [] as Array<{ message: string; action?: { onClick: () => void } }>,
  del: vi.fn(),
}));
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: { message: string; action?: { onClick: () => void } }) =>
      mocks.snack.push(o),
    dismiss: () => {},
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.name != null ? `${k}|${o.name}|${o.count ?? ""}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("../../model/useStockMaster", () => ({
  useStockSearch: (keyword: string) => {
    mocks.seen.push(keyword);
    return {
      // 키워드가 비면 질의가 꺼져 있다 — react-query 는 data 를 주지 않는다
      data:
        mocks.search === "data" && keyword.trim() !== ""
          ? mocks.results
          : undefined,
      isError: mocks.search === "error" && keyword.trim() !== "",
      isFetching: mocks.fetching,
      refetch: () => {},
    };
  },
}));
vi.mock("../../api/watchlistApi", () => ({
  useCreateWatchGroup: (o?: unknown) => {
    mocks.opts.push(o);
    return {
      isPending: false,
      isError: mocks.failed,
      error: mocks.failed ? new Error("서버 원문 오류") : null,
      reset: () => {},
      mutate: mocks.create,
    };
  },
  useRenameWatchGroup: (o?: unknown) => {
    mocks.opts.push(o);
    return {
      isPending: false,
      isError: false,
      error: null,
      reset: () => {},
      mutate: mocks.rename,
    };
  },
  useDeleteWatchGroup: (o?: unknown) => {
    mocks.opts.push(o);
    return { isPending: false, mutateAsync: mocks.del };
  },
}));

const { StockSearchEntry } = await import("./stock-search");
const { WatchGroupDeleteConfirm, WatchGroupForm, WatchGroups } =
  await import("./watch-groups");

let container: HTMLDivElement;
let root: Root;
let wide = false;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("1280px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  mocks.results = [];
  mocks.search = "data";
  mocks.fetching = false;
  mocks.seen = [];
  mocks.create.mockClear();
  mocks.rename.mockClear();
  mocks.del = vi.fn();
  mocks.opts = [];
  mocks.failed = false;
  mocks.snack = [];
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
const render = (n: ReactNode) =>
  act(() => root.render(<MemoryRouter>{n}</MemoryRouter>));
const dlg = () => document.querySelector('[role="dialog"]');

const group = (id: number, name: string, n: number): WatchGroup => ({
  rowId: id,
  groupName: name,
  sortOrder: id,
  items: Array.from({ length: n }, (_, i) => ({
    rowId: id * 10 + i,
    stockMasterRowId: i,
    countryCode: "KR",
    marketCode: "KOSPI",
    symbol: `S${id}${i}`,
    nameKr: `종목${i}`,
    nameEn: null,
    securityType: "STOCK" as const,
    currency: "KRW",
  })),
});

describe("종목 찾기 입구", () => {
  it("입구는 단추다 — aria-haspopup=dialog, 이름 '종목 검색'(상자 입력이 아니다)", () => {
    render(<StockSearchEntry onPick={() => {}} />);
    const b = container.querySelector("[data-slot=stock-search-entry]")!;
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("aria-haspopup")).toBe("dialog");
    expect(b.getAttribute("aria-label")).toBe("search.label");
    expect(b.textContent).toBe("search.placeholder");
  });
  it("1279 이하는 시트, 1280 이상은 팝오버", async () => {
    wide = false;
    render(<StockSearchEntry onPick={() => {}} />);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-slot=stock-search-entry]")!
        .click();
    });
    expect(dlg()?.getAttribute("data-slot")).toMatch(/bottom-sheet/);
    expect(document.querySelector("[data-slot=popover-content]")).toBeNull();
  });
  it("1280 이상은 팝오버로 열린다", async () => {
    wide = true;
    render(<StockSearchEntry onPick={() => {}} />);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-slot=stock-search-entry]")!
        .click();
    });
    expect(
      document.querySelector("[data-slot=popover-content]"),
    ).not.toBeNull();
    wide = false;
  });
  it("1280 이상: 입구 단추가 트리거라 열린 동안 aria-expanded 가 켜지고, Esc 로 닫으면 초점이 입구로 돌아온다(M8)", async () => {
    wide = true;
    render(<StockSearchEntry compact onPick={() => {}} />);
    const entry = container.querySelector<HTMLButtonElement>(
      "[data-slot=stock-search-entry]",
    )!;
    // 트리거는 감싼 div 가 아니라 단추 자신이다
    expect(entry.getAttribute("data-slot")).toBe("stock-search-entry");
    expect(entry.getAttribute("aria-expanded")).toBe("false");
    expect(entry.parentElement?.getAttribute("aria-expanded")).toBeNull();
    entry.focus();
    await act(async () => {
      entry.click();
    });
    expect(entry.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(document.querySelector("[data-slot=popover-content]")).toBeNull();
    expect(document.activeElement).toBe(entry);
    wide = false;
  });
  it("↓ 로 강조하고 Enter 로 고르면 표면이 닫히고 그 종목이 넘어간다", async () => {
    mocks.results = [
      {
        rowId: 1,
        marketCode: "KOSPI",
        symbol: "005930",
        nameKr: "삼성전자",
        securityType: "STOCK",
      },
      {
        rowId: 2,
        marketCode: "KOSPI",
        symbol: "000660",
        nameKr: "SK하이닉스",
        securityType: "STOCK",
      },
    ];
    const picked = vi.fn();
    render(<StockSearchEntry onPick={picked} />);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-slot=stock-search-entry]")!
        .click();
    });
    const input = document.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    )!;
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      set.call(input, "삼성");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const key = async (k: string) =>
      act(async () => {
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: k, bubbles: true }),
        );
      });
    await key("ArrowDown");
    await key("Enter");
    expect(picked).toHaveBeenCalledTimes(1);
    expect(picked.mock.calls[0]![0].symbol).toBe("005930");
  });
  it("결과 줄에 오른쪽 라디오가 없다(고르면 상세로 가는 찾기)", async () => {
    mocks.results = [
      {
        rowId: 1,
        marketCode: "KOSPI",
        symbol: "005930",
        nameKr: "삼성전자",
        securityType: "STOCK",
      },
    ];
    render(<StockSearchEntry onPick={() => {}} />);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-slot=stock-search-entry]")!
        .click();
    });
    const input = document.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    )!;
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      set.call(input, "삼");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.querySelectorAll('[role="option"]').length).toBe(1);
    expect(
      document.querySelector('[role="option"] [data-slot*=radio]'),
    ).toBeNull();
    expect(document.querySelector('[role="option"]')!.textContent).toContain(
      "005930",
    );
  });
});

describe("찾기 — 받는 동안 '결과 없음' 이 비치지 않는다(검수 M2)", () => {
  const open = async () => {
    render(<StockSearchEntry onPick={() => {}} />);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-slot=stock-search-entry]")!
        .click();
    });
    return document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  };
  const type = async (input: HTMLInputElement, v: string) => {
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      set.call(input, v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  it("첫 글자를 친 직후(질의가 아직 안 나간 300ms)에는 '결과 없음' 이 아니라 Skeleton", async () => {
    const input = await open();
    await type(input, "가");
    expect(
      document.querySelector("[data-slot=searchable-list-empty]"),
    ).toBeNull();
    expect(
      document.querySelector("[data-slot=searchable-list-skeleton]"),
    ).not.toBeNull();
  });
  it("300ms 뒤 질의가 나가고 진짜 0건이면 그때 '결과 없음'", async () => {
    mocks.results = [];
    const input = await open();
    await type(input, "가");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(
      document.querySelector("[data-slot=searchable-list-empty]"),
    ).not.toBeNull();
    expect(
      document.querySelector("[data-slot=searchable-list-skeleton]"),
    ).toBeNull();
  });
  it("검색어를 바꾸면 새 결과가 올 때까지 옛 결과를 둔다(1초 안에는 Skeleton 으로 바꾸지 않는다)", async () => {
    mocks.results = [
      {
        rowId: 1,
        marketCode: "KOSPI",
        symbol: "005930",
        nameKr: "삼성전자",
        securityType: "STOCK",
      },
    ];
    const input = await open();
    await type(input, "삼");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(document.querySelectorAll('[role="option"]').length).toBe(1);
    // 글자를 더 치면 받는 중 — 옛 결과가 그대로 서 있다
    await type(input, "삼성");
    expect(document.querySelectorAll('[role="option"]').length).toBe(1);
    expect(
      document.querySelector("[data-slot=searchable-list-skeleton]"),
    ).toBeNull();
  });
  it("받는 중이 1초를 넘으면 옛 결과 대신 Skeleton", async () => {
    mocks.results = [
      {
        rowId: 1,
        marketCode: "KOSPI",
        symbol: "005930",
        nameKr: "삼성전자",
        securityType: "STOCK",
      },
    ];
    const input = await open();
    await type(input, "삼");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    mocks.fetching = true;
    await type(input, "삼성");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(
      document.querySelector("[data-slot=searchable-list-skeleton]"),
    ).not.toBeNull();
    expect(document.querySelectorAll('[role="option"]').length).toBe(0);
  });
  it("실패하면 실패 한 벌(받는 중이 아닐 때)", async () => {
    mocks.search = "error";
    const input = await open();
    await type(input, "가");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(
      document.querySelector("[data-slot=searchable-list-error]"),
    ).not.toBeNull();
  });
});

describe("그룹 폼", () => {
  it("열리면 이름 칸에 초점이 간다(검수 M11)", async () => {
    render(<WatchGroupForm group={null} onClose={() => {}} />);
    await act(async () => {});
    const input = dlg()!.querySelector<HTMLInputElement>("input")!;
    expect(document.activeElement).toBe(input);
  });
  it("삭제 단추가 없다 · 빈 이름이면 저장이 막힌다", async () => {
    render(<WatchGroupForm group={null} onClose={() => {}} />);
    await act(async () => {});
    expect(dlg()).not.toBeNull();
    expect(dlg()!.textContent).not.toContain("watch.groupDelete");
    const save = [...dlg()!.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("save"),
    )!;
    expect(save.hasAttribute("disabled")).toBe(true);
  });
  it("이름 바꾸기는 지금 이름이 들어 있고 Enter 로 저장한다(값이 같아도 요청)", async () => {
    render(<WatchGroupForm group={group(1, "반도체", 2)} onClose={() => {}} />);
    await act(async () => {});
    const input = dlg()!.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("반도체");
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(mocks.rename).toHaveBeenCalledTimes(1);
    expect(mocks.rename.mock.calls[0]![0]).toEqual({
      groupId: 1,
      groupName: "반도체",
    });
  });
  it("1280 이상 Dialog 에서는 [취소] 가 있고, 미만 시트에는 없다", async () => {
    wide = true;
    render(<WatchGroupForm group={null} onClose={() => {}} />);
    await act(async () => {});
    expect(dlg()!.textContent).toContain("cancel");
    act(() => root.render(<div />));
    wide = false;
    render(<WatchGroupForm group={null} onClose={() => {}} />);
    await act(async () => {});
    expect(
      [...dlg()!.querySelectorAll("button")].some(
        (b) => b.textContent === "cancel",
      ),
    ).toBe(false);
  });
});

describe("관심 그룹 목록", () => {
  const props = {
    onRetry: () => {},
    priceOf: () => ({ price: null, changePct: null }),
    track: () => () => {},
    onOpen: () => {},
    onAddGroup: () => {},
    onRenameGroup: () => {},
    onDeleteGroup: () => {},
  };
  it("모든 그룹이 제목 '{이름} · {개수}' 로 서고 맨 끝에 그룹 추가 줄, ⋮ 이름은 '{그룹} 더보기'", () => {
    render(
      <WatchGroups
        {...props}
        groups={[group(1, "반도체", 2), group(2, "빈 그룹", 0)]}
      />,
    );
    const heads = [...container.querySelectorAll("h3")].map(
      (h) => h.textContent,
    );
    expect(heads).toEqual([
      "watch.groupTitle|반도체|2",
      "watch.groupTitle|빈 그룹|0",
    ]);
    expect(container.textContent).toContain("watch.groupEmpty");
    expect(
      container.querySelector('button[aria-label="watch.groupMore|반도체|"]'),
    ).not.toBeNull();
    const last = [
      ...container.querySelectorAll("[data-slot=list-body]"),
    ].pop()!;
    expect(last.textContent).toBe("watch.groupAdd");
  });
  it("그룹이 0 이면 '관심 종목이 없어요' 만, 그룹 추가 줄은 없다", () => {
    render(<WatchGroups {...props} groups={[]} />);
    expect(container.textContent).toContain("watch.emptyTitle");
    expect(container.textContent).not.toContain("watch.groupAdd");
  });
});

describe("그룹 삭제 확인 · 폼 닫기 · ⋮ 메뉴 (P 절 15 · 16 · 검수 M10)", () => {
  it("삭제 확인 글은 이름과 함께 지워지는 개수를 말한다 — '{n}개가 함께 지워져요'", async () => {
    render(
      <WatchGroupDeleteConfirm
        group={group(1, "반도체", 2)}
        onClose={() => {}}
      />,
    );
    await act(async () => {});
    const d = document.querySelector('[role="alertdialog"]')!;
    expect(d.textContent).toContain("watch.groupDeleteConfirm|반도체|2");
    expect(d.textContent).toContain("watch.groupDelete");
  });
  it("빈 그룹은 개수 없는 글", async () => {
    render(
      <WatchGroupDeleteConfirm
        group={group(2, "빈 그룹", 0)}
        onClose={() => {}}
      />,
    );
    await act(async () => {});
    expect(
      document.querySelector('[role="alertdialog"]')!.textContent,
    ).toContain("watch.groupDeleteConfirmEmpty|빈 그룹");
  });
  it("폼은 바깥(딤)을 눌러도 닫히지 않는다", async () => {
    wide = true;
    const onClose = vi.fn();
    render(<WatchGroupForm group={null} onClose={onClose} />);
    await act(async () => {});
    const overlay = document.querySelector("[data-slot=dialog-overlay]")!;
    await act(async () => {
      overlay.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(dlg()).not.toBeNull();
    wide = false;
  });
  it("⋮ 메뉴 항목은 [이름 바꾸기, 그룹 삭제] 둘", async () => {
    render(
      <WatchGroups
        onRetry={() => {}}
        priceOf={() => ({ price: null, changePct: null })}
        track={() => () => {}}
        onOpen={() => {}}
        onAddGroup={() => {}}
        onRenameGroup={() => {}}
        onDeleteGroup={() => {}}
        groups={[group(1, "반도체", 2)]}
      />,
    );
    const more = container.querySelector<HTMLButtonElement>(
      'button[aria-label="watch.groupMore|반도체|"]',
    )!;
    await act(async () => {
      more.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
      more.click();
    });
    const items = [
      ...document.querySelectorAll('[role="menuitem"], [role="menu"] button'),
    ].map((e) => e.textContent);
    expect(items).toEqual(["watch.groupRename", "watch.groupDelete"]);
  });
});

describe("그룹 저장 · 삭제 실패(I-28-5 4)", () => {
  it("요청은 모두 silent — 서버 원문 토스트가 안 뜬다", async () => {
    render(<WatchGroupForm group={null} onClose={() => {}} />);
    render(
      <WatchGroupDeleteConfirm
        group={group(1, "반도체", 2)}
        onClose={() => {}}
      />,
    );
    await act(async () => {});
    expect(mocks.opts.length).toBeGreaterThan(0);
    for (const o of mocks.opts) expect(o).toEqual({ silent: true });
  });

  it("저장이 실패하면 폼 맨 위 Callout 고정 글 · 쓴 이름 그대로 · 서버 글 없음", async () => {
    mocks.failed = true;
    render(<WatchGroupForm group={null} onClose={() => {}} />);
    await act(async () => {});
    expect(dlg()!.querySelector('[role="alert"]')?.textContent).toBe(
      "watch.groupSaveFail",
    );
    expect(dlg()!.textContent).not.toContain("서버 원문 오류");
  });

  it("같은 틱에 두 번 눌러도 요청은 한 번 — 끝나면(onSettled) 다시 된다", async () => {
    render(<WatchGroupForm group={null} onClose={() => {}} />);
    await act(async () => {});
    const input = dlg()!.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "새 그룹");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...dlg()!.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("save"),
    )!;
    await act(async () => {
      save.click();
      save.click();
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const cbs = mocks.create.mock.calls[0]![1] as { onSettled: () => void };
    await act(async () => cbs.onSettled());
    await act(async () => save.click());
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("삭제가 실패하면 확인창을 닫고 critical 스낵바 + [다시 시도] 가 같은 삭제를 다시 한다", async () => {
    mocks.del = vi.fn().mockRejectedValue(new Error("x"));
    const onClose = vi.fn();
    render(
      <WatchGroupDeleteConfirm
        group={group(1, "반도체", 2)}
        onClose={onClose}
      />,
    );
    await act(async () => {});
    const confirm = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    ].find((b) => b.textContent === "watch.groupDelete")!;
    await act(async () => confirm.click());
    await act(async () => {});
    expect(mocks.snack).toHaveLength(1);
    expect(mocks.snack[0]!.message).toBe("watch.groupDeleteFail");
    mocks.del.mockResolvedValue(undefined);
    await act(async () => mocks.snack[0]!.action!.onClick());
    expect(mocks.del).toHaveBeenCalledTimes(2);
    expect(mocks.del.mock.calls[1]![0]).toBe(1);
  });
});
