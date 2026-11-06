// 폰 "거래를 고정으로 정리하기" 페이지(I-08 Q5-A) — 대화상자가 아니라 페이지, 바닥 [적용] 하나, 줄 이름 줄바꿈
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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
const snacks: {
  message: string;
  tone?: string;
  action?: { label: string; onClick: () => void };
}[] = [];
vi.mock("@/shared/ds/snackbar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ds/snackbar")>()),
  useSnackbar: () => ({
    show: (o: (typeof snacks)[number]) => snacks.push(o),
    dismiss: () => {},
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const mutate = vi.fn();
const mState = { isError: false, error: null as unknown };
const refetch = vi.fn();
const qState = { error: false };
vi.mock("../model/useExpenses", () => ({
  useExpenses: () => ({
    isLoading: false,
    isError: qState.error,
    refetch,
    data: qState.error
      ? undefined
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
    mutate,
    isPending: false,
    isError: mState.isError,
    error: mState.error,
  }),
}));

const { FixedBulkPage } = await import("./FixedBulkPage");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  qState.error = false;
  snacks.length = 0;
  mState.isError = false;
  mState.error = null;
  delete (window as { matchMedia?: unknown }).matchMedia;
  mutate.mockReset();
  act(() => root.unmount());
  container.remove();
});

describe("폰 고정 정리 페이지", () => {
  it("페이지(role=dialog 전체 화면) — 상단 바 ← + 제목 + 바닥 버튼 하나, 처음엔 적용이 막혀 있다", () => {
    act(() =>
      root.render(
        <FixedBulkPage
          startDate="2026-10-01"
          endDate="2026-10-31"
          onClose={() => {}}
        />,
      ),
    );
    const page = document.querySelector("[data-slot=fixed-bulk-page]")!;
    expect(page).not.toBeNull();
    expect(page.querySelector("[data-slot=top-navigation]")).not.toBeNull();
    const apply = Array.from(page.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("fixed.bulk.apply"),
    ) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
  });

  it("줄 이름이 말줄임 없이 모두 보인다 · 묶음을 고르면 [적용] 이 풀린다", () => {
    act(() =>
      root.render(
        <FixedBulkPage
          startDate="2026-10-01"
          endDate="2026-10-31"
          onClose={() => {}}
        />,
      ),
    );
    const page = document.querySelector("[data-slot=fixed-bulk-page]")!;
    expect(page.textContent).toContain("월세 아주 긴 이름의 거래처");
    expect(page.querySelector("fieldset")!.innerHTML).not.toMatch(
      /text-ellipsis|truncate/,
    );
    const check = page.querySelector("[role=checkbox]") as HTMLElement;
    act(() => check.click());
    const apply = Array.from(page.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("fixed.bulk.apply"),
    ) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    act(() => apply.click());
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("[적용] 이 실패하면 스낵바가 아니라 폼 맨 위 critical Callout — 폼은 열린 채, 다시 시도는 [적용] 이 한다", () => {
    mState.isError = true;
    act(() =>
      root.render(
        <FixedBulkPage
          startDate="2026-10-01"
          endDate="2026-10-31"
          onClose={() => {}}
        />,
      ),
    );
    const page = document.querySelector("[data-slot=fixed-bulk-page]")!;
    const callout = page.querySelector("[role=alert]")!;
    expect(callout).not.toBeNull();
    expect(callout.textContent).toContain("fixed.bulk.failed");
    // 맨 위 — 안내 글(desc)보다 앞이다
    const desc = Array.from(page.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("fixed.bulk.desc"),
    )!;
    expect(
      callout.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(snacks).toEqual([]);
    // 폼은 그대로 — [적용] 이 다시 누를 수 있다
    act(() => (page.querySelector("[role=checkbox]") as HTMLElement).click());
    const apply = Array.from(page.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("fixed.bulk.apply"),
    ) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    act(() => apply.click());
    expect(mutate.mock.calls[0]![0]).toEqual({
      ids: [1],
      isFixed: true,
      silent: true,
    });
  });

  describe("실패하면 Callout 이 보이게 본문을 맨 위로 올린다", () => {
    const scroll = vi.fn();
    const renderPage = () =>
      act(() =>
        root.render(
          <FixedBulkPage
            startDate="2026-10-01"
            endDate="2026-10-31"
            onClose={() => {}}
          />,
        ),
      );
    beforeEach(() => {
      scroll.mockReset();
      Element.prototype.scrollIntoView = scroll;
    });
    const reduce = (on: boolean) => {
      window.matchMedia = ((q: string) => ({
        matches: on && q.includes("prefers-reduced-motion"),
        media: q,
        addEventListener() {},
        removeEventListener() {},
      })) as unknown as typeof window.matchMedia;
    };

    it("실패가 켜지면 Callout 을 맨 위로(부드럽게) — 실패가 없으면 움직이지 않는다", () => {
      reduce(false);
      renderPage();
      expect(scroll).not.toHaveBeenCalled();
      mState.isError = true;
      mState.error = { n: 1 };
      renderPage();
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith({
        block: "start",
        behavior: "smooth",
      });
      // 올리는 대상은 Callout 을 감싼 요소다
      expect(scroll.mock.contexts[0]).toBe(
        document.querySelector("[role=alert]")!.parentElement,
      );
    });

    it("모션 줄이기면 바로(auto) 올린다", () => {
      reduce(true);
      mState.isError = true;
      mState.error = { n: 1 };
      renderPage();
      expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
    });

    it("재시도 중(실패가 꺼진 동안)에는 움직이지 않는다", () => {
      reduce(false);
      mState.isError = true;
      mState.error = { n: 1 };
      renderPage();
      expect(scroll).toHaveBeenCalledTimes(1);
      mState.isError = false; // 다시 [적용] — pending
      mState.error = { n: 2 };
      renderPage();
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(document.querySelector("[role=alert]")).toBeNull();
    });

    it("실패 → 재시도 → 또 실패에도 매번 올린다 (실패가 켜진 채 시도만 바뀌어도)", () => {
      reduce(false);
      mState.isError = true;
      mState.error = { n: 1 };
      renderPage();
      expect(scroll).toHaveBeenCalledTimes(1);
      // 꺼짐이 안 그려지고 isError 가 true 로 이어진 채 새 시도의 실패
      mState.error = { n: 2 };
      renderPage();
      expect(scroll).toHaveBeenCalledTimes(2);
      // 같은 시도가 다시 그려지는 것(다른 이유의 리렌더)에는 또 올리지 않는다
      renderPage();
      expect(scroll).toHaveBeenCalledTimes(2);
      // 꺼졌다 켜지는 보통의 흐름
      mState.isError = false;
      mState.error = { n: 3 };
      renderPage();
      mState.isError = true;
      renderPage();
      expect(scroll).toHaveBeenCalledTimes(3);
    });

    it("Callout 과 설명 사이는 16 — 감싼 요소 아래 8 + 설명 위 8(대화상자 · 폼과 같다)", () => {
      mState.isError = true;
      renderPage();
      const wrap = document.querySelector("[role=alert]")!.parentElement!;
      expect(wrap.className).toContain("pb-x2");
      expect(document.querySelector("[role=alert]")!.className).not.toMatch(
        /\bmb-/,
      );
    });
  });

  it("실패가 없으면 Callout 도 없다", () => {
    act(() =>
      root.render(
        <FixedBulkPage
          startDate="2026-10-01"
          endDate="2026-10-31"
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector("[role=alert]")).toBeNull();
  });

  it("[적용] 이 성공하면 닫은 뒤 neutral 스낵바(마침표) — 토스트가 아니다", () => {
    mutate.mockImplementation(
      (_v: unknown, o: { onSuccess?: (r: { updatedCount: number }) => void }) =>
        o.onSuccess?.({ updatedCount: 3 }),
    );
    const onClose = vi.fn();
    act(() =>
      root.render(
        <FixedBulkPage
          startDate="2026-10-01"
          endDate="2026-10-31"
          onClose={onClose}
        />,
      ),
    );
    const page = document.querySelector("[data-slot=fixed-bulk-page]")!;
    act(() => (page.querySelector("[role=checkbox]") as HTMLElement).click());
    const apply = Array.from(page.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("fixed.bulk.apply"),
    ) as HTMLButtonElement;
    act(() => apply.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(snacks).toHaveLength(1);
    expect(snacks[0]!.message).toContain("fixed.bulk.doneFixed");
    expect(snacks[0]!.tone).toBeUndefined();
    expect(snacks[0]!.action).toBeUndefined();
  });

  it("거래 질의가 실패하면 빈 목록 글이 아니라 실패 상자 + 다시 시도", () => {
    qState.error = true;
    act(() =>
      root.render(
        <FixedBulkPage
          startDate="2026-10-01"
          endDate="2026-10-31"
          onClose={() => {}}
        />,
      ),
    );
    const page = document.querySelector("[data-slot=fixed-bulk-page]")!;
    expect(page.textContent).toContain("fixed.bulk.loadFailed");
    expect(page.textContent).not.toContain("fixed.bulk.empty");
    const retry = page.querySelector(
      "[data-slot=result-section] button",
    ) as HTMLButtonElement | null;
    expect(retry).not.toBeNull();
    act(() => retry!.click());
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
