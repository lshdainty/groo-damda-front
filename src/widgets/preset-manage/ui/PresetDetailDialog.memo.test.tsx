// 프리셋의 이 값은 어디서나 **메모** 다 (QA 12차 결정).
//
// 값은 하나인데 이름이 화면마다 갈려 있었다 — 편집 폼은 `메모`(desk-app #330 과 같은
// 이름), 상세는 `세부`. 불러오면 거래 시트의 **메모** 칸으로 그대로 들어가는 값이라
// 사용자가 따라가는 흐름의 이름은 메모 하나다.
//
// 이름은 `expense:memo` 하나를 두 화면이 같이 쓴다 — 새로 만들면 다시 갈린다.
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

const preset = {
  rowId: 5,
  templateName: "점심",
  expenseType: "EXPENSE",
  categoryRowId: null,
  assetRowId: null,
  assetName: null,
  categoryName: null,
  merchant: "한솥",
  description: "법인카드로 결제",
  paymentMethod: "CARD",
  amount: 9_000,
  lockAmount: "Y",
  useCount: 3,
  lastUsedAt: null,
} as unknown as ExpenseTemplate;

let container: HTMLDivElement;
let root: Root;

const onEdit = vi.fn();
const onDelete = vi.fn();

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.history.replaceState(null, "");
  onEdit.mockClear();
  onDelete.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <PresetDetailDialog
        preset={preset}
        categories={[]}
        onClose={() => {}}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    ),
  );
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  await new Promise((r) => setTimeout(r, 50));
});

const buttonByText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === text,
  );

describe("프리셋 상세", () => {
  it("메모 칸의 이름은 `메모` 다 — 편집 폼·거래 시트와 같은 키를 쓴다", () => {
    const shown = document.body.textContent ?? "";
    expect(shown).toContain("법인카드로 결제");
    expect(shown).toContain("memo");
    // `세부`(addTx.detail)로 되돌아가면 여기가 빨개진다.
    expect(shown).not.toContain("addTx.detail");
  });

  it("값이 없는 줄은 그리지 않는다 — '-' 자리표시자가 없다", () => {
    const shown = document.body.textContent ?? "";
    // 카테고리 · 계좌 이름이 비어 있다
    expect(shown).not.toContain("accountCard");
    expect(shown).not.toContain("preset.noCategory");
  });

  it("설명 한 줄 — 고정 금액 · 쓴 횟수(마지막 쓴 날이 없으면 그 조각을 뺀다)", () => {
    const note = document.querySelector("[data-slot=preset-detail-note]");
    expect(note?.textContent).toContain("preset.noteFixed");
    expect(note?.textContent).toContain('preset.noteUses{"count":3}');
    expect(note?.textContent).not.toContain("preset.noteLast");
  });

  it("바닥 [삭제] · [수정] 이 동작을 부른다", () => {
    act(() => buttonByText("delete")!.click());
    expect(onDelete).toHaveBeenCalledTimes(1);
    act(() => buttonByText("edit")!.click());
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
