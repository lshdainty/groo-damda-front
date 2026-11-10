// 수입이면 어디서나 "수입 방식 / 입금 계좌", 지출은 "결제 수단 / 계좌 · 카드" — 프리셋 상세 값 줄 (사용자 결정 11-10).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpenseTemplate } from "@/entities/expense-template";

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

const { PresetDetailDialog } = await import("./PresetDetailDialog");

let container: HTMLDivElement;
let root: Root;

const draw = (expenseType: string) => {
  const preset = {
    rowId: 5,
    templateName: "월급",
    expenseType,
    categoryRowId: null,
    assetRowId: 1,
    assetName: "주거래",
    categoryName: null,
    merchant: null,
    description: null,
    paymentMethod: "TRANSFER",
    amount: 9_000,
    lockAmount: "Y",
    useCount: 0,
    lastUsedAt: null,
  } as unknown as ExpenseTemplate;
  act(() =>
    root.render(
      <PresetDetailDialog
        preset={preset}
        categories={[]}
        onClose={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    ),
  );
  return document.body.textContent ?? "";
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
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

describe("프리셋 상세 — 수입 · 지출 값 줄 이름", () => {
  it("수입은 수입 방식 · 입금 계좌", () => {
    const shown = draw("INCOME");
    expect(shown).toContain("addTx.incomeMethod");
    expect(shown).toContain("addTx.depositAccount");
    expect(shown).not.toContain("paymentMethodLabel");
    expect(shown).not.toContain("accountCard");
  });

  it("지출은 결제 수단 · 계좌 · 카드 그대로", () => {
    const shown = draw("EXPENSE");
    expect(shown).toContain("paymentMethodLabel");
    expect(shown).toContain("accountCard");
    expect(shown).not.toContain("addTx.incomeMethod");
    expect(shown).not.toContain("addTx.depositAccount");
  });
});
