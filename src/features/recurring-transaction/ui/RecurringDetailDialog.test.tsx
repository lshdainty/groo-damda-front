// 반복 거래 상세(I-20 D 24 · 25) — 바닥은 [일시정지][수정] 둘, 삭제는 바닥이 아니라 머리 ⋮ 메뉴. 쉬는 중이면 [다시 켜기].
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecurringTransaction } from "@/entities/recurring-transaction";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o ? `${k}${JSON.stringify(o)}` : k,
    i18n: { language: "ko" },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { RecurringDetailDialog } = await import("./RecurringDetailDialog");

const item = (o: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  rowId: 1,
  userRowId: 1,
  categoryRowId: null,
  categoryName: "교육",
  assetRowId: 3,
  assetName: "주거래",
  toAssetRowId: null,
  toAssetName: null,
  fee: null,
  interestAmount: null,
  sourceExpenseRowId: null,
  expenseType: "EXPENSE",
  amount: 234_560,
  description: null,
  merchant: "관리비",
  paymentMethod: "CARD",
  frequency: "MONTHLY",
  intervalValue: 1,
  dayOfWeek: null,
  dayOfMonth: 25,
  executionTime: "09:00:00",
  startDate: "2026-01-25",
  endDate: null,
  maxOccurrences: null,
  executedCount: 9,
  nextExecutionDate: "2026-11-25",
  lastExecutedAt: null,
  isActive: "Y",
  autoLog: true,
  notifyDayBefore: false,
  createAt: "2026-01-01T00:00:00",
  modifyAt: "2026-01-01T00:00:00",
  ...o,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
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

const show = (
  it: RecurringTransaction,
  handlers: Record<string, () => void> = {},
) =>
  act(() =>
    root.render(
      <RecurringDetailDialog
        item={it}
        categories={[]}
        onClose={() => {}}
        onEdit={handlers.edit ?? (() => {})}
        onToggle={handlers.toggle ?? (() => {})}
        onDelete={handlers.del ?? (() => {})}
      />,
    ),
  );
const buttons = () =>
  [...document.body.querySelectorAll<HTMLButtonElement>("button")].map(
    (b) => b.textContent?.trim() ?? "",
  );

describe("반복 거래 상세", () => {
  it("제목은 '반복 거래 상세' · 바닥은 [일시정지][수정] · 삭제 단추는 바닥에 없다", () => {
    show(item());
    expect(document.body.textContent).toContain("detailTitle");
    expect(buttons()).toContain("pause");
    expect(buttons()).toContain("edit");
    expect(buttons()).not.toContain("delete");
  });

  it("쉬는 중이면 [일시정지] 가 [다시 켜기] 로 바뀌고 다음 예정일 묶음이 없다", () => {
    show(item({ isActive: "N" }));
    expect(buttons()).toContain("resume");
    expect(buttons()).not.toContain("pause");
    expect(document.body.textContent).not.toContain("nextDatesTitle");
    expect(document.body.textContent).toContain("sentencePaused");
  });

  it("끝남이면 끝남 문장 · 다음 예정일 묶음 없음", () => {
    // 서버가 횟수를 채우며 만드는 상태 — isActive=N
    show(item({ maxOccurrences: 9, executedCount: 9, isActive: "N" }));
    expect(document.body.textContent).toContain("sentenceFinished");
    expect(document.body.textContent).not.toContain("sentencePaused");
    expect(buttons()).not.toContain("resume");
    expect(buttons()).not.toContain("pause");
    expect(document.body.textContent).not.toContain("nextDatesTitle");
  });

  it("[일시정지] 를 누르면 onToggle", () => {
    const toggle = vi.fn();
    show(item(), { toggle });
    const b = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((x) => x.textContent?.includes("pause"))!;
    act(() => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
