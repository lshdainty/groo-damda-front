// 거래를 고정으로 정리하기 — 1280 미만 페이지 · 이상 대화상자(I-wrap-b1 δ 1). 고른 체크는 둘을 넘나들어도 남고, 적용 중에는 닫지 않는다
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
const snacks: { message: string; tone?: string }[] = [];
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: (typeof snacks)[number]) => snacks.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const mutateAsync = vi.fn();
const mState = { isError: false, isPending: false, error: null as unknown };
const refetch = vi.fn();
const qState = { error: false, empty: false };
vi.mock("../model/useExpenses", () => ({
  useExpenses: () => ({
    isLoading: false,
    isError: qState.error,
    isRefetching: false,
    refetch,
    data: qState.error
      ? undefined
      : qState.empty
        ? []
        : [
            {
              rowId: 1,
              expenseType: "EXPENSE",
              amount: 1_234_567_890,
              description: "월세",
              merchant:
                "월세 아주 긴 이름의 거래처 이십사 글자를 넘기는 이름이에요",
              isFixed: false,
              expenseDate: "2026-10-01T09:00:00",
            },
          ],
  }),
  useBulkMarkFixed: () => ({
    mutateAsync,
    isPending: mState.isPending,
    isError: mState.isError,
    error: mState.error,
  }),
}));

// 폭 1280 — useWideSurface 가 읽는 matchMedia 를 손으로 돌린다
let wide = false;
const listeners = new Set<() => void>();
const setWide = (next: boolean) => {
  wide = next;
  act(() => listeners.forEach((l) => l()));
};

const { FixedBulk } = await import("./FixedBulk");

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();
const renderIt = (mobile = true) =>
  act(() =>
    root.render(
      <MemoryRouter>
        <FixedBulk
          mobile={mobile}
          startDate="2026-10-01"
          endDate="2026-10-31"
          onClose={onClose}
        />
      </MemoryRouter>,
    ),
  );
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  wide = false;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes("1280") ? wide : false;
    },
    media: q,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  })) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  qState.error = false;
  qState.empty = false;
  snacks.length = 0;
  mState.isError = false;
  mState.isPending = false;
  mState.error = null;
  listeners.clear();
  delete (window as { matchMedia?: unknown }).matchMedia;
  mutateAsync.mockReset();
  onClose.mockReset();
  act(() => root.unmount());
  container.remove();
});

const apply = () =>
  Array.from(document.querySelectorAll("button")).find(
    (b) =>
      b.textContent?.includes("fixed.bulk.apply") ||
      b.textContent?.includes("retry"),
  ) as HTMLButtonElement;
const check = () =>
  document.querySelector<HTMLElement>("[role=checkbox]") as HTMLElement;

describe("1280 미만 — 주소가 있는 페이지", () => {
  it("손으로 만든 role=dialog 가 아니라 페이지다 — 폰은 상단 바 ← + 제목, 처음엔 적용이 막혀 있다", () => {
    renderIt(true);
    const page = document.querySelector("[data-slot=fixed-bulk-page]")!;
    expect(page).not.toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(document.querySelector("[data-slot=top-navigation]")).not.toBeNull();
    expect(apply().disabled).toBe(true);
  });

  it("768 ~ 1279 도 같은 페이지 — 제목 줄과 '‹ 통계' 가 붙는다", () => {
    renderIt(false);
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(document.querySelector("h1")?.textContent).toBe("fixed.bulk.title");
    expect(document.body.textContent).toContain("fixed.bulk.parent");
  });

  it("줄 이름이 말줄임 없이 모두 보인다 · 묶음을 고르면 [적용] 이 풀리고 누르면 요청이 나간다", async () => {
    mutateAsync.mockResolvedValue({ updatedCount: 1 });
    renderIt(true);
    expect(document.body.textContent).toContain("월세 아주 긴 이름의 거래처");
    expect(document.querySelector("fieldset")!.innerHTML).not.toMatch(
      /text-ellipsis|truncate/,
    );
    act(() => check().click());
    expect(apply().disabled).toBe(false);
    await act(async () => apply().click());
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(snacks[0]?.message).toContain("fixed.bulk.doneFixed");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("← 는 닫는다", () => {
    renderIt(true);
    act(() =>
      document
        .querySelector<HTMLElement>("[data-slot=top-navigation-back-button]")!
        .click(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("적용 중에는 ← 가 닫지 않는다", () => {
    mState.isPending = true;
    renderIt(true);
    act(() =>
      document
        .querySelector<HTMLElement>("[data-slot=top-navigation-back-button]")!
        .click(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("적용이 실패하면 폼 맨 위 Callout(고정 글, 서버 글 없음) + 같은 자리 [다시 시도] — 고른 것은 그대로", () => {
    mState.isError = true;
    mState.error = new Error("서버가 준 긴 영어 오류");
    renderIt(true);
    const page = document.querySelector("[data-slot=fixed-bulk-page]")!;
    expect(page.querySelector("[role=alert]")?.textContent).toBe(
      "fixed.bulk.failed",
    );
    expect(page.textContent).not.toContain("서버가 준");
    expect(apply().textContent).toBe("retry");
  });

  it("조회가 실패하면 빈 목록이 아니라 실패 + 다시 시도", () => {
    qState.error = true;
    renderIt(true);
    expect(document.body.textContent).toContain("fixed.bulk.loadFailed");
    expect(document.body.textContent).not.toContain("fixed.bulk.empty");
  });

  it("거래가 없으면 Result Section(빈 상태)", () => {
    qState.empty = true;
    renderIt(true);
    const r = document.querySelector("[data-slot=result-section]");
    expect(r?.textContent).toContain("fixed.bulk.empty");
  });
});

describe("1280 이상 — 통계 위 대화상자", () => {
  it("대화상자로 뜬다(ds role=dialog)", () => {
    wide = true;
    renderIt(false);
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(document.querySelector("[data-slot=fixed-bulk-page]")).toBeNull();
  });

  it("Esc 는 닫는다 · 적용 중에는 Esc 도 닫지 않는다", () => {
    wide = true;
    renderIt(false);
    act(() => {
      document
        .querySelector("[role=dialog]")!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockReset();
    mState.isPending = true;
    renderIt(false);
    act(() => {
      document
        .querySelector("[role=dialog]")!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("폭이 1280 을 넘나들어도 고른 체크가 남는다(페이지 → 대화상자 → 페이지)", () => {
    renderIt(true);
    act(() => check().click());
    const checked = () => check().getAttribute("aria-checked");
    expect(checked()).toBe("true");
    setWide(true);
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(checked()).toBe("true");
    setWide(false);
    expect(
      document.querySelector("[data-slot=fixed-bulk-page]"),
    ).not.toBeNull();
    expect(checked()).toBe("true");
    expect(apply().disabled).toBe(false);
  });
});
