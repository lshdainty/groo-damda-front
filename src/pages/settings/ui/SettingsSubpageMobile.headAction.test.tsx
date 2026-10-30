// 폰 머리 "추가"(I-16 11) — 카테고리는 늘, 반복 · 프리셋은 불러오는 중 · 빈 목록에서는 없다(I-20 C 13 · D 21).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SECTIONS, type SectionId } from "../model/sections";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "ko" } }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const lists: {
  recurring?: unknown[];
  presets?: unknown[];
  categories?: unknown[];
} = {};
vi.mock("@/features/recurring-transaction", () => ({
  useRecurringTransactions: () => ({ data: lists.recurring }),
}));
vi.mock("@/features/expense", () => ({
  useExpenseTemplates: () => ({ data: lists.presets }),
  useExpenseCategories: () => ({ data: lists.categories }),
}));

const { SettingsSubpageMobile } = await import("./SettingsSubpageMobile");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  lists.recurring = undefined;
  lists.presets = undefined;
  lists.categories = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function hasAddButton(id: SectionId) {
  const section = SECTIONS.find((s) => s.id === id)!;
  act(() =>
    root.render(
      <SettingsSubpageMobile
        activeSection={section}
        goBack={() => {}}
        onHeadAction={() => {}}
        body={<p>body</p>}
      />,
    ),
  );
  return [...container.querySelectorAll("header button")].some(
    (b) => b.textContent === "add",
  );
}

describe("폰 머리 추가 버튼", () => {
  it("카테고리는 늘 있다", () => {
    expect(hasAddButton("categories")).toBe(true);
  });

  it("계좌·카드 관리도 늘 있다(I-17 26)", () => {
    expect(hasAddButton("accounts")).toBe(true);
  });

  it.each([
    ["recurring", "recurring"],
    ["presets", "presets"],
  ] as const)(
    "%s — 불러오는 중(data 없음) · 빈 목록에서는 없고, 하나라도 있으면 있다",
    (id, key) => {
      lists[key] = undefined;
      expect(hasAddButton(id)).toBe(false);
      lists[key] = [];
      expect(hasAddButton(id)).toBe(false);
      lists[key] = [{ rowId: 1 }];
      expect(hasAddButton(id)).toBe(true);
    },
  );

  it("프리셋 — 카테고리를 못 받았으면(실패 화면) 머리 추가가 없다", () => {
    lists.presets = [{ rowId: 1 }];
    lists.categories = undefined;
    expect(hasAddButton("presets")).toBe(false);
    lists.categories = [];
    expect(hasAddButton("presets")).toBe(true);
  });

  it("다른 섹션은 머리 오른쪽이 비어 있다", () => {
    expect(hasAddButton("devices")).toBe(false);
    expect(hasAddButton("budget")).toBe(false);
  });
});
